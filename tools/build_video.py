"""Transcode source .MOV clips into web-ready video.

For each clip:
  web/video/<slug>.mp4        H.264, rotation baked in, long edge <= 1920, faststart
  web/video/<slug>.webm       VP9 (optional second pass, --webm)
  web/video/<slug>-loop.mp4   silent muted-autoplay loop (clips <= 15s only)
  web/poster/<slug>.jpg       poster frame for the <video poster=""> attribute
"""
import os, re, sys, json, shutil, pathlib, subprocess
from concurrent.futures import ThreadPoolExecutor, as_completed

FFDIR  = pathlib.Path(r"C:\Users\calip\AppData\Local\Microsoft\WinGet\Packages"
                      r"\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe"
                      r"\ffmpeg-8.1.2-full_build\bin")
FFMPEG, FFPROBE = str(FFDIR / "ffmpeg.exe"), str(FFDIR / "ffprobe.exe")

ROOT   = pathlib.Path(r"C:\Users\calip\loya-site\media")
SRC    = ROOT / "_source"
VIDEO  = ROOT / "web" / "video"
POSTER = ROOT / "web" / "poster"
MAXEDGE, MAXFPS, LOOP_MAX_SECONDS = 1920, 60, 15
WANT_WEBM = "--webm" in sys.argv
RESUME    = "--resume" in sys.argv

def slug(stem):
    s = re.sub(r"[^a-z0-9]+", "-", stem.lower()).strip("-")
    if len(s) > 28:
        s = s[:28].rstrip("-")
    return s

def probe(path):
    out = subprocess.run(
        [FFPROBE, "-v", "quiet", "-print_format", "json",
         "-show_streams", "-show_format", str(path)],
        capture_output=True, text=True).stdout
    d = json.loads(out)
    v = next(s for s in d["streams"] if s["codec_type"] == "video")
    a = next((s for s in d["streams"] if s["codec_type"] == "audio"), None)
    rot = 0
    for sd in v.get("side_data_list") or []:
        if "rotation" in sd:
            rot = int(sd["rotation"])
    w, h = int(v["width"]), int(v["height"])
    if abs(rot) in (90, 270):      # display dimensions after rotation
        w, h = h, w
    num, den = v.get("r_frame_rate", "30/1").split("/")
    return {"w": w, "h": h, "rot": rot, "audio": a is not None,
            "fps": round(int(num) / max(int(den), 1)),
            "dur": float(d["format"].get("duration", 0))}

def out_duration(path):
    """Duration of an encoded file, or None if it is missing or truncated."""
    if not path.exists():
        return None
    r = subprocess.run([FFPROBE, "-v", "error", "-show_entries",
                        "format=duration", "-of", "csv=p=0", str(path)],
                       capture_output=True, text=True)
    try:
        return float(r.stdout.strip())
    except ValueError:
        return None


def already_done(s, info):
    """True when every expected output for this clip exists and probes clean."""
    if out_duration(VIDEO / f"{s}.mp4") is None:
        return False
    if not (POSTER / f"{s}.jpg").exists():
        return False
    if info["dur"] <= LOOP_MAX_SECONDS and             out_duration(VIDEO / f"{s}-loop.mp4") is None:
        return False
    if WANT_WEBM and out_duration(VIDEO / f"{s}.webm") is None:
        return False
    return True


def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(r.stderr[-600:])

def vfilter(info):
    """Downscale so the long edge <= MAXEDGE; keep even dims; cap fps."""
    parts = []
    if max(info["w"], info["h"]) > MAXEDGE:
        parts.append(f"scale='if(gt(iw,ih),min({MAXEDGE},iw),-2)'"
                     f":'if(gt(iw,ih),-2,min({MAXEDGE},ih))'")
    else:
        parts.append("scale=trunc(iw/2)*2:trunc(ih/2)*2")
    if info["fps"] > MAXFPS:
        parts.append(f"fps={MAXFPS}")
    return ",".join(parts)

def process(name):
    path = SRC / name
    s = slug(path.stem)
    try:
        info = probe(path)
    except Exception as e:
        return {"file": name, "ok": False, "error": f"probe: {e}"}

    if RESUME and already_done(s, info):
        return {"file": name, "ok": True, "slug": s, "skipped": True,
                "w": info["w"], "h": info["h"], "dur": round(info["dur"], 1),
                "fps": info["fps"], "audio": info["audio"],
                "orientation": "portrait" if info["h"] > info["w"] else "landscape",
                "outputs": ["cached"],
                "mp4_mb": round((VIDEO / f"{s}.mp4").stat().st_size / 1048576, 1)}

    vf = vfilter(info)
    made = []

    # main MP4 (rotation baked in: ffmpeg autorotates on transcode by default)
    mp4 = VIDEO / f"{s}.mp4"
    cmd = [FFMPEG, "-y", "-v", "error", "-i", str(path), "-vf", vf,
           "-c:v", "libx264", "-preset", "slow", "-crf", "23",
           "-pix_fmt", "yuv420p", "-profile:v", "high", "-movflags", "+faststart"]
    cmd += (["-c:a", "aac", "-b:a", "128k", "-ac", "2"] if info["audio"] else ["-an"])
    cmd += [str(mp4)]
    try:
        run(cmd); made.append("mp4")
    except Exception as e:
        return {"file": name, "ok": False, "error": f"mp4: {e}"}

    # silent autoplay loop for short clips
    if info["dur"] <= LOOP_MAX_SECONDS:
        loop = VIDEO / f"{s}-loop.mp4"
        try:
            run([FFMPEG, "-y", "-v", "error", "-i", str(path), "-vf", vf,
                 "-c:v", "libx264", "-preset", "slow", "-crf", "28",
                 "-pix_fmt", "yuv420p", "-profile:v", "high",
                 "-movflags", "+faststart", "-an", str(loop)])
            made.append("loop")
        except Exception:
            pass

    # poster frame, 1s in (or midpoint for very short clips)
    at = 1.0 if info["dur"] > 2 else max(info["dur"] / 2, 0)
    try:
        run([FFMPEG, "-y", "-v", "error", "-ss", str(at), "-i", str(path),
             "-vf", vf, "-frames:v", "1", "-q:v", "3",
             str(POSTER / f"{s}.jpg")])
        made.append("poster")
    except Exception:
        pass

    if WANT_WEBM:
        webm = VIDEO / f"{s}.webm"
        cmd = [FFMPEG, "-y", "-v", "error", "-i", str(path), "-vf", vf,
               "-c:v", "libvpx-vp9", "-crf", "33", "-b:v", "0",
               "-deadline", "good", "-cpu-used", "3", "-row-mt", "1",
               "-pix_fmt", "yuv420p"]
        cmd += (["-c:a", "libopus", "-b:a", "128k"] if info["audio"] else ["-an"])
        cmd += [str(webm)]
        try:
            run(cmd); made.append("webm")
        except Exception:
            pass

    return {"file": name, "ok": True, "slug": s,
            "w": info["w"], "h": info["h"], "dur": round(info["dur"], 1),
            "fps": info["fps"], "audio": info["audio"],
            "orientation": "portrait" if info["h"] > info["w"] else "landscape",
            "outputs": made,
            "mp4_mb": round(mp4.stat().st_size / 1048576, 1)}

def main():
    VIDEO.mkdir(parents=True, exist_ok=True)
    POSTER.mkdir(parents=True, exist_ok=True)
    names = sorted(p.name for p in SRC.iterdir()
                   if p.suffix.lower() in {".mov", ".mp4", ".m4v"})
    print(f"{len(names)} clips  (webm={'on' if WANT_WEBM else 'off'})\n")
    results, done = [], 0
    with ThreadPoolExecutor(max_workers=4) as ex:
        futs = {ex.submit(process, n): n for n in names}
        for f in as_completed(futs):
            r = f.result(); results.append(r); done += 1
            if r["ok"]:
                extra = (f'{r["w"]}x{r["h"]:<5} {r["dur"]:6.1f}s '
                         f'{r["orientation"]:9} {r["mp4_mb"]:5.1f}MB '
                         f'[{"+".join(r["outputs"])}]')
            else:
                extra = r["error"]
            print(f'[{done:2}/{len(names)}] {"ok " if r["ok"] else "ERR"} '
                  f'{r["file"]:<46} {extra}')
    results.sort(key=lambda r: r["file"])
    (ROOT / "videos.json").write_text(json.dumps(results, indent=2))
    bad = [r for r in results if not r["ok"]]
    print(f"\ndone: {len(results)-len(bad)} ok, {len(bad)} failed")

if __name__ == "__main__":
    main()
