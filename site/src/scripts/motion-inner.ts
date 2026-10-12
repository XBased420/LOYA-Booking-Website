/* ═══════════════════════════════════════════════════════════════
   MOTION LAYER — the long-form issue pages ("the same publication
   opened flat"). Lazy-loaded by motion.ts; never on the homepage.
   Full notes, and how to switch any of it off: site/MOTION.md.

   The idea: everything on these pages is a physical object, so nothing
   just fades in. Paper is placed and settles, tape presses on, polaroids
   develop, "— Liz" is written, headlines are set line by line, rates are
   counted out. When her track plays, a few small things listen.

   Rules this file keeps:
   • Objects keep their own tilt and hover. Paper and polaroids are
     rotated with `transform`, and their hover lifts animate `transform`
     too, so this never touches `transform` on them. It moves the
     separate CSS `translate` / `rotate` properties through custom
     properties (--mo-y, --mo-r …), which stack on top of the tilt.
   • Everything lives in gsap.matchMedia(). Under reduced motion nothing
     is created, nothing is held hidden, and Lenis never exists.
   • Nothing is hidden from keyboard users: entrances use opacity only
     (never visibility), and focusing anything still waiting to arrive
     finishes its entrance at once.
   • mount() returns a teardown that reverts every tween, ScrollTrigger,
     SplitText, listener and inserted node. motion.ts calls it on
     astro:before-swap.
   ═══════════════════════════════════════════════════════════════ */
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { CustomEase } from "gsap/CustomEase";
import { soundSignal } from "./sound-signal";

gsap.registerPlugin(ScrollTrigger, SplitText, CustomEase);
CustomEase.create("loya-paper", ".22,.68,.36,1");   // = --ease-paper in tokens.css

const ROOT = "main.issue-page";
const HEAD = `${ROOT} h1.display, ${ROOT} .wrap h2.display`;
const PAPER = `${ROOT} .wrap .paper`;
const POLAROID = `${ROOT} .wrap .polaroid`;
const CARD = `${ROOT} :is(.doing__card, .svc__i, .shelf__i, .tl__i, .pc, figure.tr)`;
const OBJECT = [PAPER, POLAROID, CARD].join(",");
const OWNED = [HEAD, OBJECT].join(",");
const REVEAL_AT = "top 95%";   // start as soon as something peeks in

type Off = () => void;
const qa = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => [...root.querySelectorAll<T>(sel)];

export function mount(): Off {
  const html = document.documentElement;
  const mm = gsap.matchMedia();

  mm.add("(prefers-reduced-motion: no-preference)", () => {
    const offs: Off[] = [];
    offs.push(pasteUp());
    offs.push(listenToMusic());
    offs.push(booking());
    html.classList.add("mo-ready");
    ScrollTrigger.refresh();
    return () => offs.forEach((f) => f());
  });

  // desktop only: smooth wheel scrolling and the pointer touches
  mm.add("(prefers-reduced-motion: no-preference) and (hover: hover) and (pointer: fine)", () => {
    const offs: Off[] = [smoothWheel(), tilt(), magnet(), parallax()];
    return () => offs.forEach((f) => f());
  });

  // reduced motion: make sure nothing is held hidden
  mm.add("(prefers-reduced-motion: reduce)", () => { html.classList.remove("mo"); });

  return () => { mm.revert(); html.classList.remove("mo-ready"); };
}

/* ── shared helpers ─────────────────────────────────────────────── */
const listen = (t: EventTarget, type: string, fn: EventListener, opts?: AddEventListenerOptions | boolean): Off => {
  t.addEventListener(type, fn, opts);
  return () => t.removeEventListener(type, fn, opts);
};
const tiltOf = (el: Element) => parseFloat((el as HTMLElement).style.getPropertyValue("--rot")) || 0;
const VARS = ["--mo-y", "--mo-r", "--mo-dev", "opacity", "clip-path"];
function settle(el: HTMLElement) {
  el.removeAttribute("data-mo");
  VARS.forEach((p) => el.style.removeProperty(p));
}

/* ═══ 3. SCRAPBOOK PASTE-UP ═════════════════════════════════════════ */
function pasteUp(): Off {
  const offs: Off[] = [];
  const pending = new Map<HTMLElement, () => void>();   // element → its entrance
  const play = (el: HTMLElement) => { const f = pending.get(el); if (f) { pending.delete(el); f(); } };

  // What's left after the objects are taken out: loose type, buttons, plain blocks
  const plain: HTMLElement[] = [];
  const collect = (el: Element, depth: number) => {
    for (const c of el.children as HTMLCollectionOf<HTMLElement>) {
      if (c.matches(OWNED) || c.matches("script,style,template,.hp")) continue;
      if (depth < 4 && c.querySelector(OWNED)) collect(c, depth + 1);
      else plain.push(c);
    }
  };
  qa(`${ROOT} .wrap`).forEach((w) => collect(w, 0));

  // top-level objects only (a polaroid inside a card belongs to the card)
  const objects = qa(OBJECT).filter((el) => !el.parentElement?.closest(OBJECT));
  const papers = objects.filter((el) => el.matches(".paper"));
  const polaroids = objects.filter((el) => el.matches(".polaroid"));
  const cards = objects.filter((el) => !el.matches(".paper, .polaroid"));

  /* Already on screen at first paint (marked data-mo-fold before paint):
     it stays put. Only its photos develop, its tape presses on and its
     handwriting is written, so the page's first paint and LCP never wait
     for this file. */
  const inFold = (el: Element) => !!el.closest("[data-mo-fold]");

  /* Plain blocks: a soft rise. */
  plain.filter((el) => !inFold(el)).forEach((el) => {
    el.setAttribute("data-mo", "");
    gsap.set(el, { opacity: 0, "--mo-y": "18px" });
    pending.set(el, () => gsap.to(el, { opacity: 1, "--mo-y": "0px", duration: .6, ease: "power2.out", onComplete: () => settle(el) }));
  });

  /* Tape: pressed on from one end. Its torn-edge clip-path is collapsed to
     the left edge, then opened back out to its real shape. */
  const tapeFrom = (tape: HTMLElement) => {
    const real = getComputedStyle(tape).clipPath;
    const flat = real.replace(/(-?[\d.]+)%\s+(-?[\d.]+)%/g, (_m, _x, y) => `0% ${y}%`);
    gsap.set(tape, { clipPath: flat });
    return real;
  };
  const press = (tl: gsap.core.Timeline, tapes: HTMLElement[], at: number) => tapes.forEach((t, i) => {
    tl.to(t, { clipPath: t.dataset.moClip!, duration: .26, ease: "power2.out", onComplete: () => { t.style.removeProperty("clip-path"); delete t.dataset.moClip; } }, at + i * .06);
  });

  /* Paper and polaroids: dropped onto the wall a few px above where they
     belong, tipped a little past their own angle, then they settle. */
  const placeable = [...papers, ...polaroids];
  placeable.forEach((el) => {
    const dir = Math.sign(tiltOf(el)) || 1;
    const still = inFold(el);
    if (!still) {
      el.setAttribute("data-mo", "");
      gsap.set(el, { opacity: 0, "--mo-y": "-16px", "--mo-r": `${2.8 * dir}deg` });
    }
    const tapes = qa(":scope > .tape", el);
    tapes.forEach((t) => { t.dataset.moClip = tapeFrom(t); });
    const win = el.matches(".polaroid") ? el.querySelector<HTMLElement>(".polaroid__win") : null;
    if (win) gsap.set(win, { "--mo-dev": 1 });
    const hands = qa(".hand", el);
    hands.forEach((h) => gsap.set(h, { clipPath: "inset(0% 100% 0% 0%)" }));

    pending.set(el, () => {
      const tl = gsap.timeline({ onComplete: () => settle(el) });
      if (!still) {
        tl.to(el, { opacity: 1, duration: .2, ease: "power1.out" }, 0)
          .to(el, { "--mo-y": "0px", duration: .5, ease: "power3.out" }, 0)
          .to(el, { "--mo-r": `${-0.6 * dir}deg`, duration: .34, ease: "power2.out" }, 0)
          .to(el, { "--mo-r": "0deg", duration: .5, ease: "loya-paper" }, .34);
      }
      press(tl, tapes, still ? 0 : .3);
      // polaroids develop: the warm wash over the photo fades off
      if (win) tl.to(win, { "--mo-dev": 0, duration: 1.3, ease: "power1.out", onComplete: () => win.style.removeProperty("--mo-dev") }, .28);
      // handwriting writes itself in, left to right
      hands.forEach((h, i) => tl.to(h, { clipPath: "inset(0% 0% 0% 0%)", duration: .95, ease: "power1.inOut", onComplete: () => h.style.removeProperty("clip-path") }, .5 + i * .2));
    });
  });

  /* Cards in a run (services, the timeline, record shelves): placed. */
  cards.forEach((el, i) => {
    const still = inFold(el);
    if (!still) {
      el.setAttribute("data-mo", "");
      gsap.set(el, { opacity: 0, "--mo-y": "14px", "--mo-r": `${i % 2 ? -1.4 : 1.4}deg` });
    }
    const tapes = qa(":scope > .tape, :scope .tape", el);
    tapes.forEach((t) => { t.dataset.moClip = tapeFrom(t); });
    pending.set(el, () => {
      const tl = gsap.timeline({ onComplete: () => settle(el) });
      if (!still) {
        tl.to(el, { opacity: 1, duration: .25 }, 0)
          .to(el, { "--mo-y": "0px", "--mo-r": "0deg", duration: .6, ease: "loya-paper" }, 0);
      }
      press(tl, tapes, still ? 0 : .25);
    });
  });

  /* Headlines: set line by line, each line rising out of its own mask —
     the same feel as the magazine's headline reveal. Screen readers get
     the heading text as one label (aria: "auto"). */
  const splits: SplitText[] = [];
  // split only as each headline arrives, so the work is spread out
  qa(HEAD).filter((h) => !inFold(h)).forEach((h) => {
    h.setAttribute("data-mo-head", "");
    pending.set(h, () => {
      const split = SplitText.create(h, { type: "lines", mask: "lines", aria: "auto", linesClass: "mo-line" });
      splits.push(split);
      h.removeAttribute("data-mo-head");
      gsap.fromTo(split.lines, { yPercent: 108 }, {
        yPercent: 0, duration: .85, ease: "power3.out", stagger: .09,
        onComplete: () => split.revert(),
      });
    });
  });

  /* Rates count up to the real price, once. The price itself (from
     data/booking.ts) stays in the page for screen readers; only a
     decorative copy counts. Ported from React Bits CountUp — see credit
     at the bottom of this file. */
  const restoreRates: Off[] = [];
  qa(`${ROOT} .rates__p`).forEach((p) => {
    const m = p.textContent!.trim().match(/^(\D*?)(\d+(?:\.\d+)?)(.*)$/);
    if (!m) return;
    const original = p.innerHTML;
    const [, pre, num, post] = m;
    p.innerHTML = `<span class="visually-hidden">${p.textContent}</span><span class="mo-count" aria-hidden="true">${pre}0${post}</span>`;
    const vis = p.querySelector<HTMLElement>(".mo-count")!;
    restoreRates.push(() => { p.innerHTML = original; });
    const v = { n: 0 };
    pending.set(p, () => gsap.to(v, {
      n: Number(num), duration: 1.2, ease: "power2.out",
      onUpdate: () => { vis.textContent = `${pre}${Math.round(v.n)}${post}`; },
      onComplete: () => { vis.textContent = `${pre}${num}${post}`; },
    }));
  });
  offs.push(() => restoreRates.forEach((f) => f()));

  /* One batch per kind, each element plays once. */
  const all = [...pending.keys()];
  ScrollTrigger.batch(all, {
    // no batchMax: with once:true, elements past the cap were never called
    start: REVEAL_AT, once: true, interval: .08,
    onEnter: (els) => (els as HTMLElement[]).forEach((el, i) => gsap.delayedCall(Math.min(i, 8) * .07, () => play(el))),
  });
  // anything still waiting when you reach the very bottom arrives anyway
  ScrollTrigger.create({ trigger: ROOT, start: "bottom bottom+=4", once: true, onEnter: () => [...pending.keys()].forEach(play) });

  // a keyboard user tabbing into something not yet arrived: finish it now
  offs.push(listen(document, "focusin", (e) => {
    const t = e.target as Element;
    [...pending.keys()].filter((el) => el.contains(t)).forEach(play);
    gsap.getTweensOf(qa("[data-mo]").filter((el) => el.contains(t))).forEach((tw) => tw.progress(1));
  }));

  // the experience timeline is an accordion: page height changes on open
  qa<HTMLDetailsElement>(`${ROOT} details`).forEach((d) => offs.push(listen(d, "toggle", () => ScrollTrigger.refresh())));

  return () => {
    offs.forEach((f) => f());
    splits.forEach((s) => s.revert());
    qa("[data-mo]").forEach((el) => settle(el));
    qa("[data-mo-head]").forEach((el) => el.removeAttribute("data-mo-head"));
    qa("[data-mo-clip]").forEach((t) => { t.style.removeProperty("clip-path"); delete t.dataset.moClip; });
    pending.clear();
  };
}

/* ═══ 1. LENIS — desktop mouse wheel only ═══════════════════════════
   Touch stays native (no syncTouch). Driven by GSAP's ticker so
   ScrollTrigger and the smoothing share one clock. */
function smoothWheel(): Off {
  const offs: Off[] = [];
  let lenis: import("lenis").default | null = null, dead = false;
  const raf = (t: number) => lenis?.raf(t * 1000);
  const prevent = qa(".issue-menu__sheet, .cal__days, textarea, select, [data-scroll-area]");
  prevent.forEach((el) => el.setAttribute("data-lenis-prevent", ""));
  // loaded only here, so phones never download it
  import("lenis").then(({ default: Lenis }) => {
    if (dead) return;
    lenis = new Lenis({ lerp: .12, smoothWheel: true, syncTouch: false, anchors: false, stopInertiaOnNavigate: true });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);
  }).catch(() => { /* native scrolling it is */ });

  // the Contents menu: the page underneath stays put while it's open
  const menu = document.querySelector<HTMLDetailsElement>("details.issue-menu");
  if (menu) offs.push(listen(menu, "toggle", () => (menu.open ? lenis?.stop() : lenis?.start())));

  return () => {
    dead = true;
    offs.forEach((f) => f());
    gsap.ticker.remove(raf);
    gsap.ticker.lagSmoothing(500, 33);
    lenis?.destroy(); lenis = null;
    prevent.forEach((el) => el.removeAttribute("data-lenis-prevent"));
  };
}

/* Optional parallax: tape drifts a few px against the scroll. Desktop
   only, decorative tape only — never text or form controls. */
function parallax(): Off {
  const tweens = qa(`${ROOT} .tape`).map((t, i) => gsap.fromTo(t,
    { "--mo-py": `${i % 2 ? -5 : 5}px` },
    { "--mo-py": `${i % 2 ? 5 : -5}px`, ease: "none", scrollTrigger: { trigger: t, start: "top bottom", end: "bottom top", scrub: .6 } }));
  return () => tweens.forEach((tw) => { tw.scrollTrigger?.kill(); tw.kill(); });
}

/* ═══ 4. THE ISSUE LISTENS ═══════════════════════════════════════════
   While her track plays (LoyaSound.signal.live), the corner player's icon
   pulses and the Book a Session button breathes — from the bass, capped,
   through one ticker callback that writes a single custom property per
   element. Paused, hidden tab (the ticker stops) or reduced motion: it all
   rests at zero. (Tape flutter was tried and cut: the matte tape's backdrop
   blur made every frame expensive — it dropped the page to ~35 fps in
   testing, for a one-degree wobble.) */
function listenToMusic(): Off {
  const sound = soundSignal();
  const targets: { set: (v: number) => void; k: number }[] = [];
  const add = (el: Element | null, k = 1) => { if (el) targets.push({ set: gsap.quickSetter(el, "--mo-beat") as (v: number) => void, k }); };
  add(document.querySelector(".dock__ico"));
  add(document.querySelector(`${ROOT} .band__btn`));

  let beat = 0, shown = 0;
  const write = (v: number) => targets.forEach((t) => t.set(+(v * t.k).toFixed(3)));
  // frame-rate independent: the same feel at 30 fps or 120
  const tick = (_t: number, dt: number) => {
    const s = sound.signal;
    const bass = s.live ? (s.bands[0] + s.bands[1] + s.bands[2] + s.bands[3]) / 4 : 0;
    const target = Math.min(1, Math.max(0, (bass - .25) * 1.6));       // ignore the floor, cap the top
    const f = dt / 16.7;
    beat += (target - beat) * (1 - Math.pow(target > beat ? .55 : .88, f));
    if (beat < .002 && shown === 0) return;                             // resting: no writes at all
    if (beat < .002) beat = 0;
    write(beat); shown = beat;
  };
  gsap.ticker.add(tick);
  return () => { gsap.ticker.remove(tick); write(0); };
}

/* ═══ 5. DESKTOP POINTER TOUCHES ════════════════════════════════════
   Polaroids tilt toward the cursor and lift (their existing hover handles
   the lift). Ported from React Bits TiltedCard: rotateX/rotateY from the
   pointer's offset, eased with quickTo. Combined into the one `rotate`
   property as an axis + angle, so it never touches the tilt in
   `transform`. Respects lift={false} (data-lift="off"), where an ancestor
   owns the hover. */
function tilt(): Off {
  const offs: Off[] = [];
  const AMP = 6;   // degrees
  qa<HTMLElement>(`${ROOT} .polaroid[data-lift="on"]`).forEach((p) => {
    const parent = p.parentElement;
    const ownParent = parent && parent.children.length === 1;
    if (ownParent) parent!.style.perspective = "900px";
    p.setAttribute("data-mo-tilt", "");
    const rx = gsap.quickTo(p, "--mo-rx", { duration: .45, ease: "power3" });
    const ry = gsap.quickTo(p, "--mo-ry", { duration: .45, ease: "power3" });
    offs.push(listen(p, "pointermove", (e) => {
      if (p.hasAttribute("data-mo")) return;              // still being placed
      const r = p.getBoundingClientRect(), ev = e as PointerEvent;
      const nx = (ev.clientX - r.left) / r.width - .5, ny = (ev.clientY - r.top) / r.height - .5;
      rx(-ny * 2 * AMP); ry(nx * 2 * AMP);
    }));
    offs.push(listen(p, "pointerleave", () => { rx(0); ry(0); }));
    offs.push(() => {
      p.removeAttribute("data-mo-tilt"); p.style.removeProperty("--mo-rx"); p.style.removeProperty("--mo-ry");
      if (ownParent) parent!.style.removeProperty("perspective");
    });
  });
  return () => offs.forEach((f) => f());
}

/* Book buttons lean toward the cursor. Ported from React Bits Magnet. */
function magnet(): Off {
  const offs: Off[] = [];
  const PULL = .28, MAX = 9;
  const btns = qa<HTMLElement>(`.issue-book, ${ROOT} a.btn--primary[href*="/book"], .issue-footer a.btn--primary[href*="/book"]`);
  btns.forEach((b) => {
    b.setAttribute("data-mo-magnet", "");
    gsap.set(b, { "--mo-mx": "0px", "--mo-my": "0px" });   // gives quickTo its unit
    const mx = gsap.quickTo(b, "--mo-mx", { duration: .35, ease: "power3" });
    const my = gsap.quickTo(b, "--mo-my", { duration: .35, ease: "power3" });
    offs.push(listen(b, "pointermove", (e) => {
      const r = b.getBoundingClientRect(), ev = e as PointerEvent;
      mx(gsap.utils.clamp(-MAX, MAX, (ev.clientX - (r.left + r.width / 2)) * PULL));
      my(gsap.utils.clamp(-MAX, MAX, (ev.clientY - (r.top + r.height / 2)) * PULL));
    }));
    offs.push(listen(b, "pointerleave", () => { mx(0); my(0); }));
    offs.push(() => { b.removeAttribute("data-mo-magnet"); b.style.removeProperty("--mo-mx"); b.style.removeProperty("--mo-my"); });
  });
  return () => offs.forEach((f) => f());
}

/* ═══ 6. THE BOOKING MOMENT ═════════════════════════════════════════
   • Each step number gets circled by hand once every required field
     in it is valid (and loses it again if one stops being valid). The
     form's fields, names, values and validation are untouched.
   • Only when the real "Request sent." confirmation appears, a RECEIVED
     stamp slams onto it and a short burst of paper scraps flies off.
     Nothing fires on the preview, on an error or on the not-connected
     note: it keys on the `.out__ok` line, which only the success path
     writes. */
function booking(): Off {
  const form = document.querySelector<HTMLFormElement>("#booking");
  const out = document.querySelector<HTMLElement>("#out");
  if (!form || !out) return () => {};
  const offs: Off[] = [];

  // a hand-drawn ring around the step number, like circling it on a paper form
  const CHECK = '<svg class="mo-check" viewBox="0 0 48 40" aria-hidden="true" focusable="false"><path pathLength="1" d="M33 7C21 2 6 8 5 20c-1 11 12 17 24 14 11-3 16-13 11-22-3-6-10-8-17-7"/></svg>';
  const steps = qa<HTMLFieldSetElement>("fieldset.fs", form).map((fs) => {
    const legend = fs.querySelector("legend");
    if (!legend) return null;
    legend.insertAdjacentHTML("afterbegin", CHECK);
    const path = legend.querySelector<SVGPathElement>(".mo-check path")!;
    gsap.set(path, { strokeDashoffset: 1 });
    return { fs, path, done: false };
  }).filter(Boolean) as { fs: HTMLFieldSetElement; path: SVGPathElement; done: boolean }[];

  const complete = (fs: HTMLFieldSetElement) => {
    if (fs.disabled || fs.hidden) return false;
    const req = qa<HTMLInputElement>("[required]:not(:disabled)", fs);
    return req.length > 0 && req.every((f) => f.value.trim() !== "" && f.checkValidity());
  };
  const check = () => steps.forEach((s) => {
    const now = complete(s.fs);
    if (now === s.done) return;
    s.done = now;
    gsap.to(s.path, { strokeDashoffset: now ? 0 : 1, duration: now ? .45 : .2, ease: now ? "power2.out" : "power1.in" });
  });
  // the service picker swaps the step-4 fieldset after its own change handler runs
  const soon = () => requestAnimationFrame(check);
  offs.push(listen(form, "input", soon), listen(form, "change", soon));
  check();

  let stamped = false;
  const mo = new MutationObserver(() => {
    const ok = out.querySelector(".out__ok");
    if (!ok) { stamped = false; return; }
    if (stamped) return;
    stamped = true;
    const stamp = document.createElement("div");
    stamp.className = "mo-stamp";
    stamp.setAttribute("aria-hidden", "true");
    stamp.textContent = "Received";
    out.appendChild(stamp);
    gsap.timeline()
      .fromTo(stamp, { opacity: 0, scale: 2.6, rotation: -24 }, { opacity: .92, scale: 1, rotation: -9, duration: .32, ease: "power4.in" })
      .to(stamp, { scale: .97, duration: .08, yoyo: true, repeat: 1, ease: "power1.out" })
      .add(() => scraps(stamp), .3);
  });
  mo.observe(out, { childList: true });
  offs.push(() => mo.disconnect());

  return () => {
    offs.forEach((f) => f());
    qa(".mo-check", form).forEach((n) => n.remove());
    qa(".mo-stamp, .mo-scraps").forEach((n) => n.remove());
  };
}

/* A short burst of paper scraps in the palette, from the stamp. Ported
   from React Bits ClickSpark (sparks → torn paper bits with gravity and
   spin). One-shot; removes its canvas when done. */
function scraps(from: HTMLElement) {
  const r = from.getBoundingClientRect();
  const cs = getComputedStyle(document.documentElement);
  const colors = ["--pink", "--pink-deep", "--violet", "--mint", "--paper-300"].map((v) => cs.getPropertyValue(v).trim() || "#d4488f");
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const cv = document.createElement("canvas");
  cv.className = "mo-scraps"; cv.setAttribute("aria-hidden", "true");
  cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
  document.body.appendChild(cv);
  const g = cv.getContext("2d")!; g.scale(dpr, dpr);
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const bits = Array.from({ length: 26 }, (_, i) => {
    const a = (i / 26) * Math.PI * 2 + Math.random() * .4, sp = 3 + Math.random() * 5;
    return { x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 2.5, rot: Math.random() * 6, vr: (Math.random() - .5) * .4,
      w: 5 + Math.random() * 7, h: 3 + Math.random() * 5, c: colors[i % colors.length] };
  });
  const t0 = performance.now(), LIFE = 950;
  const frame = (now: number) => {
    const k = (now - t0) / LIFE;
    g.clearRect(0, 0, innerWidth, innerHeight);
    if (k >= 1) { cv.remove(); return; }
    g.globalAlpha = k > .65 ? 1 - (k - .65) / .35 : 1;
    for (const b of bits) {
      b.vy += .22; b.vx *= .985; b.x += b.vx; b.y += b.vy; b.rot += b.vr;
      g.save(); g.translate(b.x, b.y); g.rotate(b.rot); g.fillStyle = b.c;
      g.beginPath(); g.moveTo(-b.w / 2, -b.h / 2); g.lineTo(b.w / 2, -b.h / 2 + 1); g.lineTo(b.w / 2 - 1, b.h / 2); g.lineTo(-b.w / 2 + 1, b.h / 2 - 1); g.closePath(); g.fill();
      g.restore();
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

/* Credits — React Bits (https://github.com/DavidHDev/react-bits) by David
   Haz, MIT + Commons Clause. Ideas ported to plain TypeScript here:
   CountUp, TiltedCard, Magnet, ClickSpark. */
