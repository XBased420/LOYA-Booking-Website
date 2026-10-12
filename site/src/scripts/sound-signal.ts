/* ═══════════════════════════════════════════════════════════════
   THE ISSUE LISTENS — a tiny analyser on Liz's corner player.

   SiteAudio already calls window.LoyaSound.listenTo(audio) when her
   track starts and .stop() when it pauses (it was written for the old
   SoundField background, which is no longer mounted). This provides that
   same API and the same `signal` shape — { level, bands[32], wave[256],
   live } — without any visuals of its own. motion-inner.ts reads it.

   One AudioContext and one MediaElementSource per <audio> element, ever:
   the corner player persists across client-side navigation, and an audio
   element can only be connected to a context once. If SoundField is ever
   brought back, remove this provider first or the two will fight over
   the same element (see site/MOTION.md).
   ═══════════════════════════════════════════════════════════════ */

export interface LoyaSignal { level: number; bands: Float32Array; wave: Float32Array; live: boolean }
export interface LoyaSoundApi { listenTo(el: HTMLMediaElement): void; stop(): void; readonly signal: LoyaSignal }

declare global {
  interface Window { LoyaSound?: LoyaSoundApi; webkitAudioContext?: typeof AudioContext }
}

export function soundSignal(): LoyaSoundApi {
  if (window.LoyaSound) return window.LoyaSound;

  const sig: LoyaSignal = { level: 0, bands: new Float32Array(32), wave: new Float32Array(256), live: false };
  let ctx: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let freq: Uint8Array<ArrayBuffer>, time: Uint8Array<ArrayBuffer>;
  const sources = new WeakMap<HTMLMediaElement, MediaElementAudioSourceNode>();
  let raf = 0;

  const read = () => {
    raf = 0;
    if (!analyser) return;
    analyser.getByteFrequencyData(freq);
    analyser.getByteTimeDomainData(time);
    let sum = 0;
    for (let i = 0; i < 256; i++) { const v = (time[i * 2] - 128) / 128; sig.wave[i] = v; sum += v * v; }
    sig.level = Math.min(1, Math.sqrt(sum / 256) * 2.2);
    // 32 log-spaced bands, ~40 Hz → 14 kHz
    const n = freq.length * 0.62;
    for (let b = 0; b < 32; b++) {
      const lo = Math.floor(Math.pow(b / 32, 2.1) * n), hi = Math.max(lo + 1, Math.floor(Math.pow((b + 1) / 32, 2.1) * n));
      let m = 0; for (let j = lo; j < hi; j++) m = Math.max(m, freq[j]);
      sig.bands[b] = m / 255;
    }
    if (sig.live) raf = requestAnimationFrame(read);
    else { sig.level = 0; sig.bands.fill(0); sig.wave.fill(0); }
  };

  const api: LoyaSoundApi = {
    listenTo(el) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        ctx ??= new AC();
        ctx.resume();
        if (!analyser) {
          analyser = ctx.createAnalyser();
          analyser.fftSize = 1024; analyser.smoothingTimeConstant = 0.78;
          analyser.connect(ctx.destination);
          freq = new Uint8Array(analyser.frequencyBinCount);
          time = new Uint8Array(analyser.fftSize);
        }
        if (!sources.has(el)) {
          const s = ctx.createMediaElementSource(el);
          s.connect(analyser);
          sources.set(el, s);
          // media keys, the native controls or the track ending also count
          el.addEventListener("play", () => { sig.live = true; ctx?.resume(); if (!raf) raf = requestAnimationFrame(read); });
          el.addEventListener("pause", () => { sig.live = false; });
        }
        sig.live = true;   // SiteAudio calls this as the track starts
        if (!raf) raf = requestAnimationFrame(read);
      } catch (err) {
        // never let the analyser get in the way of the music itself
        console.warn("[sound] analyser unavailable", err);
      }
    },
    stop() { sig.live = false; },
    get signal() { return sig; },
  };
  window.LoyaSound = api;
  return api;
}
