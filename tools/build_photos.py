"""Convert every source photo (HEIC / CR3 / JPG / PNG) into web-ready derivatives.

Stage 1: decode -> full-res sRGB JPEG master in media/work/photos
Stage 2: responsive AVIF + WebP + JPEG in media/web/img
EXIF (including GPS) is dropped on everything that ships.
"""
import os, sys, re, json, pathlib
from concurrent.futures import ProcessPoolExecutor, as_completed
from PIL import Image, ImageOps, ImageCms
import pillow_heif, rawpy

pillow_heif.register_heif_opener()
Image.MAX_IMAGE_PIXELS = None

ROOT   = pathlib.Path(r"C:\Users\calip\loya-site\media")
SRC    = ROOT / "_source"
MASTER = ROOT / "work" / "photos"
WEB    = ROOT / "web" / "img"
WIDTHS = [400, 800, 1200, 1600, 2400]
PHOTO_EXT = {".heic", ".cr3", ".jpg", ".jpeg", ".png"}

def slug(stem):
    s = re.sub(r"[^a-z0-9]+", "-", stem.lower()).strip("-")
    return re.sub(r"-original$", "", s)

def to_srgb(im):
    """Convert via embedded ICC profile if present, else assume sRGB."""
    icc = im.info.get("icc_profile")
    if icc:
        try:
            src = ImageCms.ImageCmsProfile(__import__("io").BytesIO(icc))
            im = ImageCms.profileToProfile(im, src, ImageCms.createProfile("sRGB"),
                                           outputMode="RGB")
        except Exception:
            im = im.convert("RGB")
    return im.convert("RGB")

def load(path):
    ext = path.suffix.lower()
    if ext == ".cr3":
        with rawpy.imread(str(path)) as raw:
            rgb = raw.postprocess(use_camera_wb=True, output_bps=8,
                                  no_auto_bright=False, output_color=rawpy.ColorSpace.sRGB)
        return Image.fromarray(rgb)
    im = Image.open(path)
    im = ImageOps.exif_transpose(im)   # bake orientation, then drop EXIF
    return to_srgb(im)

def process(name):
    path = SRC / name
    try:
        im = load(path)
    except Exception as e:
        return {"file": name, "ok": False, "error": f"{type(e).__name__}: {e}"}

    stem = slug(path.stem)
    w, h = im.size

    master = MASTER / f"{stem}.jpg"
    im.save(master, "JPEG", quality=95, subsampling=0, optimize=True)

    made = []
    for tw in WIDTHS:
        if tw > w:
            continue
        th = round(h * tw / w)
        r = im.resize((tw, th), Image.LANCZOS)
        r.save(WEB / f"{stem}-{tw}.avif", "AVIF", quality=55, speed=6)
        r.save(WEB / f"{stem}-{tw}.webp", "WEBP", quality=80, method=5)
        r.save(WEB / f"{stem}-{tw}.jpg",  "JPEG", quality=82, optimize=True,
               progressive=True)
        made.append(tw)
    if not made:                      # smaller than the narrowest breakpoint
        im.save(WEB / f"{stem}-{w}.avif", "AVIF", quality=55, speed=6)
        im.save(WEB / f"{stem}-{w}.webp", "WEBP", quality=80, method=5)
        im.save(WEB / f"{stem}-{w}.jpg",  "JPEG", quality=82, optimize=True,
                progressive=True)
        made.append(w)

    return {"file": name, "ok": True, "slug": stem, "src_w": w, "src_h": h,
            "orientation": "portrait" if h > w else "landscape",
            "widths": made}

def main():
    MASTER.mkdir(parents=True, exist_ok=True)
    WEB.mkdir(parents=True, exist_ok=True)
    names = sorted(p.name for p in SRC.iterdir()
                   if p.suffix.lower() in PHOTO_EXT)
    print(f"{len(names)} photos -> {MASTER}\n")
    results, done = [], 0
    with ProcessPoolExecutor(max_workers=min(8, os.cpu_count() or 4)) as ex:
        futs = {ex.submit(process, n): n for n in names}
        for f in as_completed(futs):
            r = f.result(); results.append(r); done += 1
            flag = "ok " if r["ok"] else "ERR"
            extra = (f'{r["src_w"]}x{r["src_h"]} {r["orientation"]:9} '
                     f'{len(r["widths"])} sizes') if r["ok"] else r["error"]
            print(f'[{done:2}/{len(names)}] {flag} {r["file"]:<34} {extra}')
    results.sort(key=lambda r: r["file"])
    (ROOT / "photos.json").write_text(json.dumps(results, indent=2))
    bad = [r for r in results if not r["ok"]]
    print(f"\ndone: {len(results)-len(bad)} ok, {len(bad)} failed")

if __name__ == "__main__":
    main()
