# Motion layer — LOYA, Issue 01

The inner pages are "the same publication opened flat", so their motion treats everything as a physical object. Paper is placed and settles, tape presses on, polaroids develop, "— Liz" is written, headlines are set line by line, and rates are counted out. When her track plays, a couple of small things listen. The test for any new effect: does it make this feel more like Liz's magazine, or is it just movement? If it's just movement, cut it.

The homepage magazine is **not** part of this layer. It has its own engine (`scripts/magazine.ts`) and its own rules (see `AGENTS.md`).

## Files

| File | What it does |
|---|---|
| `src/scripts/motion.ts` | Tiny loader, bundled on every page (~1.6 KB gz). Lazy-loads `motion-inner.ts` on issue pages only. Runs the open and close view transitions. Keeps the `mo` class right across client-side navigation and runs the 4 s failsafe. |
| `src/scripts/motion-inner.ts` | The effects. GSAP + ScrollTrigger + SplitText + CustomEase, ~54 KB gz, loaded in idle time on issue pages only. |
| `src/scripts/sound-signal.ts` | `window.LoyaSound`: a hidden analyser on the corner player (`level`, 32 `bands`, `wave`, `live`). |
| `src/styles/motion.css` | Pre-hide, the entrance properties, the develop overlay, the booking ring and stamp, the view-transition keyframes, and Lenis's CSS. |
| `src/layouts/Base.astro` | Imports the above. Two inline scripts (`mo` before paint; mark what's on screen). The old fade-in now steps aside when `mo` is set. |
| `src/styles/issue.css` | The sheet's shadow moved from `filter: drop-shadow` to `box-shadow` (see Performance). |

Libraries are pinned in `package.json`: `gsap@3.15.0`, `lenis@1.3.26`. Lenis loads as its own small chunk (~5 KB gz), on desktop only.

## The effects

| Effect | Where | How |
|---|---|---|
| **Open the issue** | Clicking a teaser printed in the magazine ("More on the music page →", "Start booking →") | At click time, that printed page gets `view-transition-name: loya-sheet`. The new page gets a screen-sized stand-in with the same name (`.mo-vt-sheet`). The page tips, lifts and grows into the sheet. No change to the turn engine. |
| **Close the issue** | Any link from an issue page to `/` or `/#pN`, or the browser back button | The sheet folds away (`mo-close`), then the magazine plays its own entrance on the matching spread. The magazine builds itself after the swap, so it can't be a morph target. That's why this is a fold, not a morph. |
| Paper placed | `.paper` | Drops 16 px with ~3° extra tilt, overshoots a little and settles to its own `--rot` (`loya-paper` = `--ease-paper`). |
| Tape pressed on | `.tape` inside paper, polaroids and cards | Its torn-edge `clip-path` is collapsed to the left edge, then opened to its real shape (0.26 s), after the paper lands. |
| Polaroids develop | `.polaroid` | Placed like paper, then a warm wash over the photo (`.polaroid__win::after`, opacity via `--mo-dev`) fades off over 1.3 s. Opacity only, no filters on photos. |
| Handwriting | `.hand` ("— Liz") | Left-to-right `clip-path` wipe after its paper lands. |
| Headlines | `h1.display`, and `h2.display` in `.wrap` | SplitText lines with masks, each line rising. Split only when it arrives, then reverted. Screen readers get one label (`aria: "auto"`). |
| Cards | `.doing__card, .svc__i, .shelf__i, .tl__i, .pc, figure.tr` | Placed in a run with a small alternating tilt. |
| Plain blocks | Everything else in a `.wrap` | A soft 18 px rise, once. |
| Rates count up | `.rates__p` (Book) | 0 → the real price from `data/booking.ts`, once. The real text stays in a `.visually-hidden` span; only an `aria-hidden` copy counts. Port of React Bits CountUp. |
| Tape parallax | `.tape`, desktop | ±5 px scrubbed. Never on text or controls. |
| Smooth wheel | Issue pages, desktop (`hover: hover` and `pointer: fine`) | Lenis, `lerp .12`, no `syncTouch`, `anchors: false`, driven by `gsap.ticker`. `data-lenis-prevent` goes on the Contents sheet, the calendar strip, textareas and selects at runtime. Stops while the Contents menu is open. |
| The issue listens | Corner player icon, BookBand button | While `LoyaSound.signal.live`: icon pulse (≤ +22% scale) and button breath (≤ +3%) from the bass, through one ticker callback, frame-rate independent. Rests at zero when paused or the tab is hidden. |
| Polaroid tilt | `.polaroid[data-lift="on"]`, desktop | Tilts ≤ 6° toward the cursor (React Bits TiltedCard). rotateX/Y are folded into the `rotate` property as axis + angle. Skips `lift={false}`. |
| Magnet | Nav **Book**, Book buttons in pages and footer, desktop | Leans ≤ 9 px toward the cursor (React Bits Magnet). |
| Step rings | Book form legends | Once every required, enabled field in a step is valid, its number is circled by hand (SVG stroke). The ring is removed if a field stops being valid. Fields, names, values and validation are untouched. |
| RECEIVED stamp | Book, `#out` | Only when `.out__ok` ("Request sent.") appears. Never on the preview, an error or "not connected". A stamp slams on plus a one-shot burst of paper scraps (canvas, removed after ~1 s; React Bits ClickSpark). |

## How it loads (and why first paint doesn't wait)

1. On a full load, an inline `<head>` script adds `mo` to `<html>`, but only on issue pages and only when motion is allowed. It also starts a 4 s failsafe.
2. An inline script after `</main>` marks every `.wrap > *` block that's on screen at first paint with `data-mo-fold`.
3. CSS (`html.mo:not(.mo-ready)`) hides only blocks **below** the fold. On-screen blocks render normally, so LCP is unchanged. Their photos show "undeveloped" (the photo is painted underneath, so it still counts for LCP), their tape isn't on yet and "— Liz" isn't written.
4. `motion.ts` loads `motion-inner.ts` when the browser is idle (≤ 700 ms) or on the first scroll. That file sets each object's start state, then adds `mo-ready`. On-screen objects develop, press and write; everything below is placed as you scroll to it.
5. The failsafe: if `mo-ready` hasn't appeared within 4 s, `mo` is removed and `loya:motion-fallback` fires. The old fade-in in `Base.astro` then takes over. Nothing can stay hidden.

On client-side navigation, `motion.ts` sets `mo` on the incoming document in `astro:before-swap` and marks the fold in `astro:after-swap`. `mount()` returns a teardown that `motion.ts` calls on `astro:before-swap`. It reverts every tween, ScrollTrigger and SplitText (via `gsap.matchMedia()`), every listener, Lenis and every inserted node.

## How to turn things off

- **Everything:** delete the `<script>import "../scripts/motion";</script>` block in `Base.astro`. With no `mo` class nothing is hidden, and the old fade-in runs as before. Optionally delete the two inline `mo` scripts too.
- **Lenis only:** remove `smoothWheel()` from the desktop `mm.add(...)` list in `motion-inner.ts`.
- **One effect:** each is its own function or block in `motion-inner.ts` (`pasteUp`, `smoothWheel`, `parallax`, `listenToMusic`, `tilt`, `magnet`, `booking`).
- **The transitions:** remove the click, `astro:before-preparation` and the `loyaVt` part of `astro:before-swap` in `motion.ts`.
- **Reduced motion** already does all of this: `motion-inner.ts` is never loaded, `mo` is never set, Lenis never exists and the view-transition keyframes don't apply.

## Rules to keep

1. **Never touch `transform` on paper, polaroids, tape, cards or buttons.** Their tilt and hover live there. Move `translate` and `rotate` through `--mo-*` custom properties (CSS in `motion.css`). GSAP's own `rotate`/`scale` aliases write `transform`, so don't use them on these elements.
2. **Opacity, never `visibility`,** for anything waiting to arrive, so keyboard focus still reaches it. The `focusin` handler finishes an entrance at once.
3. **Never hold above-the-fold content hidden.** It's what keeps LCP where it was.
4. **No `filter` on the sheet or any large ancestor.** Animating inside a filtered parent re-filters the whole page every frame. On GitHub main this dropped scrolling to ~9 fps in testing. The sheet shadow is a `box-shadow` on `.issue-page`.
5. **Don't animate the matte tape continuously.** Its `backdrop-filter` makes every repaint expensive. A tape flutter driven by the music was tried and cut (it dropped the page to ~35 fps in testing).
6. **One AudioContext and one MediaElementSource per `<audio>`, ever,** created inside the play click. If `SoundField.astro` is ever mounted again, remove `sound-signal.ts` first: both would try to connect the same element, and the second call throws.
7. **The stamp keys only on `.out__ok`.** Test it only against a mocked endpoint (route `**/script.google.com/**` in Playwright). Never submit to the real Apps Script from a test.
8. **Never create Lenis on the homepage.** `magazine.ts` owns scrolling there. Keep its 8 behaviour fixes (`AGENTS.md`) intact.
9. **ScrollTrigger.batch with `once: true`: don't set `batchMax`.** Elements past the cap were never called back in testing.
10. Keep the React Bits credit (MIT + Commons Clause) at the bottom of `motion-inner.ts`.

## Homepage ideas (proposed, not built)

Both would be CSS-only, on children of `.face.is-open`, with no change to the turn engine:

- **a.** The magazine's taped snapshots (`.snap`) develop the way inner polaroids do: a warm wash on `.snap img`'s wrapper that fades off as the page opens.
- **b.** The tape on those snapshots (`.snap::before`) presses on after the snap lands, using the same collapsed-`clip-path` trick.

Both need checking against the turn engine's bending copies (`.sl *` has animations and transitions switched off, which is what we want) and on a real GPU before shipping.

## Verified (Oct 12, 2026)

Playwright on the built `dist`, served under `/LOYA-Booking-Website/`, at 1440×900 and 390×844:

- **Errors:** zero console errors. All 16 routes pass, on desktop and phone.
- **Magazine:** one page per notch and per swipe, videos freeze mid-turn, deep links and back all work.
- **Transitions:** open and close frames captured at 10% speed.
- **Lenis:** present on desktop issue pages, absent on the homepage and on touch.
- **Reduced motion:** nothing hidden, no `mo`, motion code never requested.
- **Keyboard:** focus reaches below-the-fold links with the outline visible.
- **No leaks:** listener counts flat over 72 client-side navigations, one `<audio>`.
- **Booking:** the ring and stamp behave as above against a mocked endpoint.

Phone performance (4× CPU, ~9 Mbps), median of 5 runs, main → motion:

| Page | LCP | Longest task | Total blocking |
|---|---|---|---|
| About | 848 → 796 ms | 356 → 373 ms | 406 → 707 ms |
| Book | 752 → 872 ms | 279 → 380 ms | 504 → 718 ms |
| Experience | 644 → 584 ms | 286 → 264 ms | 307 → 465 ms |

The added blocking time is GSAP parsing in idle time, after the page is up.
