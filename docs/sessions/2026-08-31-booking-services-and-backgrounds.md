# Session log — 2026-08-31

Project: Elizabeth "Liz" Loya personal brand + booking site.
Working folder: `LoyaPersonalWebsite`. Built with Astro, static output.

---

## What changed this session

### Live sound / AV removed from the Session Request form
Liz does not take live sound or AV work, so it should never have been
bookable. Removed the `live-sound` entry from `bookableServices` in
`site/src/data/booking.ts` and narrowed `eventSlugs` from
`["dj", "live-sound"]` to `["dj"]`, since DJ work is now the only service
routed to the event intake set. A dated comment sits above the array so the
removal reads as deliberate rather than as an accidental deletion.

Verified after rebuild: the Service dropdown offers seven options
(Recording session, Consult call, Mixing, Mix + master, Music production,
DJ / event booking, Something else), the string "Live sound" no longer
appears anywhere on `/book/`, the event fieldset still reveals for `dj` and
stays `hidden disabled` for studio services, consult still asks no intake at
all, and the form survives a second client-side arrival through the router.

### Animated background studies, round two
Kept **Stage Wash** and **Standing Wave**. Replaced Room Tone, The Board and
Cut Paper with **Record Groove**, **Off Register** and **Afternoon**. The
control rail was rewritten to address Liz rather than a developer. Off
Register was tuned down after first rendering as solid pink cards
(ink alpha .60 -> .16, offset 5px -> 3px). Awaiting her pick.

---

## Open decision for X: live sound still appears elsewhere

Taking it out of the booking form does not take it off the site. If she does
not do this work at all, these all currently say otherwise:

- `site/src/data/site.ts` — `disciplines` lists "Live Sound" and
  "AV Production" in the homepage "What I do" block.
- `site/src/data/site.ts` — `experience` includes a "Freelance / AV
  Technician" role.
- `site/src/data/work.ts` — `live-sound` is an archive category with a
  photo assigned to it.
- `site/src/pages/dj-live-events.astro` — a whole standing page titled
  "DJ + Live" with a "Live sound" section and a link to
  `/archive/live-sound`.

These are content decisions, not code cleanup, so nothing was changed.
Worth asking Liz whether "does not do this" means "does not book this" or
"does not do this at all" — the second answer collapses that page.

---

## Standing constraints (do not violate)

- `site.PUBLIC` stays `false`. It gates `noindex` plus a robots.txt
  Disallow. The site carries a real person's name, face and employment
  history, so it stays unindexed until Liz has seen it and approved going
  live.
- Deletes are not permitted in the mounted folder. Retired files move into
  a `_retired/` subfolder instead of being removed.
- Artifact sharing is blocked on this account, so anything Liz needs to see
  goes through Google Docs or a standalone file.
- Windows machine, Linux VM mount: `node_modules` on disk are Windows
  binaries, so builds and Playwright verification run in the cloud
  container, never in the mount.

## Known-but-unfixed

- Veil CSS duplicated across five files with values that have drifted apart.
- `Photo.astro` has no intrinsic sizing; it is only CLS-safe because every
  caller happens to set `aspect-ratio`.
- `grain-drift` animates forever even when off-screen.
- No sitemap; JSON-LD is thin.
- `ADD FAQ CONTENT` sits in `pending` with no page surfacing it.
- `astro.config.mjs` uses the provisional `https://lizloya.com`. No domain
  is registered yet.
- Audio samples remain the largest content gap on the site.

## Waiting on

- Liz picking a background concept from the five on offer.
- X running `REFRESHBUILD.bat` then `START.bat` to see the accumulated
  source changes: first-person music copy, footer contact block, North Face
  removed from Experience, THE WALL peel clipping fix, right-side dropdown
  menu with its open animation, and this service-list change.

---

## Background studies, round three — all five are sound waves

X's direction: make every option a variation of Standing Wave, so the
background reads as sound waves, and build it so that when music plays on the
site the background reacts to it. Rebuilt the studies page around that.

The five now on offer:

- **Standing Wave** — two hairline sine fields at close frequencies; the
  interference banding phases slowly. Each row swells with the part of the
  spectrum it sits in, so bass shows as weight low on the page.
- **The Print** — the render of an audio file, mirrored around its centre
  line, scrolling. Writes a real rolling history, so the left edge is what
  played a few seconds ago.
- **Room Modes** — rings spreading from three points and crossing. Every kick
  throws a ring, so the page has a pulse rather than a loop.
- **The Analyzer** — one column per frequency band off the bottom edge,
  blurred into colour rather than drawn as bars. Warm at the bass end,
  violet at the top.
- **The Scope** — the vectorscope X-Y figure, one continuous loop distorted
  by the waveform.

### How the reactivity is built

Every study reads one shared `Signal` object — `level`, 32 `bands`, the raw
`wave`, and a `kick` flag — and nothing else. `Signal` has two sources:

- **idle** — a slow synthetic breath, so the page is alive with no music.
- **live** — a real Web Audio `AnalyserNode`.

The page ships a demo loop synthesised in the browser (kick, clap, hats,
shaker, bass, pad at 88 bpm) routed through that analyser, so the reaction
shown is real rather than mimed. Putting Liz's music on the site means
pointing the analyser at an `<audio>` element instead. **None of the five
drawings change.** That is the reason for the indirection.

### Bugs found and fixed while building it

- The stage was stretching to the control rail's full content height —
  1343px on a 900px screen — so every bottom-anchored study drew its whole
  effect below the fold. The Analyzer looked broken and was not. Stage is now
  exactly one viewport on desktop; the rail scrolls inside itself. **Worth
  remembering for the real site: a bottom-anchored background on a page
  taller than the viewport is invisible.**
- The demo loop had almost no energy above 5 kHz, so two thirds of the
  spectrum sat dead. Fixed the music rather than the meter — longer hats, an
  open hat on the offbeats, and a shaker.
- Raw analyser output reads as one fat bass column and nothing else, because
  music energy falls off with frequency. Bands are now tilted up toward the
  top end the way a spectrum display does.
- Room Modes' rings were fading before they could be seen; The Scope and the
  Analyzer were both too transparent to register on the blush ground.

Verified at 1440/1280/390: no horizontal overflow, no page errors, all
controls round-trip, reduced-motion starts paused, and all five paint.

Still waiting on Liz to pick one.

---

## The Analyzer is now the site background

X picked it. Implemented as `site/src/components/SoundField.astro`, mounted
once in `Base.astro` so every page gets it without knowing about it.

### Two decisions worth keeping straight

**It is fixed to the viewport, not to the document.** The columns anchor to
the bottom of the *screen*. Anchored to the bottom of the document they would
sit below the fold on every page longer than one screen, which is every page
here — the exact bug that made the study look broken before it was found.

**It draws from a signal, not a clock.** Everything on screen comes from one
`sig` object: 32 bands, level, waveform. Today that is filled by a synthetic
idle source. When audio goes on the site, call once from a click handler:

```js
window.LoyaSound.listenTo(document.querySelector("audio"))
```

and a real `AnalyserNode` fills the same object. `window.LoyaSound.stop()`
goes back to idle. Nothing in the drawing changes. Caveats: it needs a user
gesture, and the audio must be same-origin or CORS-clean or the analyser
reads silence.

### Layering

`global.css` moves the ground colour onto `<html>` and leaves `<body>`
transparent, so the canvas can sit at `z-index: -1` — above the page
background, below every piece of content — without a single element needing
a z-index of its own. Nothing else in the stylesheet changed.

The idle signal has a falling slope across the bands. Without it every band
rests at the same height and the whole thing reads as a solid stripe across
the bottom of the screen instead of as a spectrum.

### Verified

Built clean, all 16 pages carry it. Painting on all 9 top-level routes, still
animating after nine consecutive client-side navigations (`transition:persist`
plus an `astro:page-load` re-attach, so it survives either way). Nothing on
any page is covered by it (hit-tested against headings, copy, buttons and nav
links). Reduced motion renders one still frame and stops. No horizontal
overflow at 390px. No page errors. All internal links still resolve.

### Booking-funnel copy caught in the same pass

The service list stopped offering live sound this morning but the copy around
the booking funnel was still selling it. Fixed in four places: the `/book`
lede and meta description, the `BookBand` default body used across pages, the
`/contact` enquiry-type note, and the site-wide SEO description in `site.ts`.

The portfolio side is deliberately untouched and still the open question:
`/dj-live-events`, the `live-sound` and `av` archive categories, the
"Live Sound" and "AV Production" entries in `disciplines`, and the
"Freelance / AV Technician" role in `experience`.

---

## Scroll reveal, and one closing band everywhere

### Scroll reveal

Every block inside a `.wrap` now fades and drifts as it crosses the top and
bottom edges of the screen, in whichever direction you are scrolling. Lives
in `Base.astro` alongside the reel script, with the states in `global.css`.

Three things about it that are decisions, not accidents:

**The observer root is inset 7% top and bottom.** With a plain
threshold-0 observer a block only stops intersecting once it is completely
off screen, so the fade-out happens where nobody can see it. Shrinking the
root moves both edges *inside* the screen, which is the whole point — leaving
looks like the reverse of arriving. 7% is chosen: the sticky nav is about
70px, and 7% of even a short 600px viewport is only 42px, so the top dead
band always hides behind the bar and never swallows content sitting at the
top of the document on first paint.

**Rotated blocks fade without moving.** Paper, polaroids and the primary
button all carry a one- or two-degree tilt, and that tilt is the look. Any
block whose computed transform is not `none` gets `data-rev-still` and the
CSS then never declares a transform on it at all — not even `transform:
none`, which would flatten the tilt. The rules are written as
`[data-rev="in"]:not([data-rev-still])` for exactly this reason.

**The transform is measured once per element, ever.** First version
re-measured on every run, and since `astro:page-load` fires right after the
direct call, the second run read the reveal's own `translateY` (or a
transition still in flight) as "this element is rotated" and marked 10 of 14
blocks unmovable. Elements now carry `data-rev-init` after their first
measurement. New nodes after a page swap have no marker, so they still get
measured properly.

Only JS ever sets `data-rev`, so with scripting off nothing is hidden.
Reduced motion removes the attributes entirely rather than just skipping the
tagging, so someone who changes the setting mid-session is never left with
content stranded at opacity 0.

Tagging is one level deep — direct children of `.wrap` — deliberately. Going
deeper would nest a fading parent inside a fading child and compound both the
opacity and the translate.

### One closing band on every page

The tape is off the "Let's make something" band, and the band itself is now
the shared `BookBand` component everywhere it appears.

It was pasted inline in three places with values that had drifted: the
homepage had veil `.86` → was `0.8` plus an extra `padding-top`,
audio-engineering had `0.84`, and the component itself `0.86`. Both inline
copies and their duplicate `.band*` CSS are gone.

Pages that previously ended in an ad-hoc CTA now close the same way:
experience (was a bare button inside the disclosure section), about,
archive index, and archive category (kept its "← All work" link, dropped the
duplicate Book button). `/book` and `/contact` deliberately have no band —
they are the destination.

Headings stay page-appropriate; the structure is what is now identical.

### Two bugs caught in the pass

- `heading="Let&rsquo;s make something"` rendered literally as
  **LET&RSQUO;S MAKE SOMETHING**. Astro escapes attribute values, so an HTML
  entity in a component prop is not decoded. The character itself belongs
  there. Anything passed as a prop needs the real character, not an entity.
- `<BookBand image="tracking" />` on the archive category page pointed at an
  image that does not exist in `public/media/img`. Changed to `protools-ssl`.
  Worth a build-time check on image names at some point.

### Verified

16 pages build clean. 0 mis-flagged blocks, correct direction on the way down
and back up, rotations preserved while faded, all 9 internal links resolve,
no page errors, no horizontal overflow at 390px, reveal fully disabled under
reduced motion and with JS off.

---

## Her track, and five player designs

X supplied **`i hate 2_2`** — 2:13, 128 kbps stereo, 2.1 MB, `encoded_by: Pro Tools`,
so it is her own master rather than a rip. This is the first real audio the
project has had; `tracks` in `work.ts` is still an empty array feeding an
"[UPLOAD AUDIO SAMPLES]" slot, so the same file also closes part of the
project's oldest and largest content gap.

Five candidate controls drafted, each bound to one `<audio>` element and one
analyser so only the control changes between them:

- **Tape Strip** — a taped label bottom-left; progress creeps along its edge.
  The only one that does not read as a widget.
- **J-Card** — a cassette insert: title in the display face, her signature,
  round transport, hairline scrub. Treats the song as work, not ambience.
- **Bottom Rail** — a thin dark bar flush to the bottom edge, sitting on the
  analyzer so bar and spectrum read as one instrument. Impossible to miss;
  covers the thing it sits on.
- **Console Strip** — a channel off a desk, left edge, the fader cap riding
  up as the track plays. Could not belong to anyone but an engineer.
- **Ring** — a filling ring, bottom right. Survives everywhere, least
  characterful.

Nothing autoplays, in the drafts or in the plan. A phone-width toggle checks
each at 390px.

### The real find: the analyzer was calibrated for the wrong thing

The site's live band mapping had an upward tilt (`0.8 + 1.5·f`) that was tuned
against the synthetic demo loop on the background-studies page, which had
almost no energy above 5 kHz. Pointed at an actual mastered track it pegs:

- **measured 0.90 mean against an idle mean of 0.117**, top twelve bands fully
  clipped at 1.0 — the background stops being a spectrum and becomes a wall of
  pink that swallows the page.

Fixed in `SoundField.astro` before it could ever ship:

- Opened the analyser's dB window — `minDecibels −62`, `maxDecibels −12` —
  so loud bands have headroom and quiet ones have somewhere to fall. The
  default −100..−30 window is what pins a mastered track to the ceiling.
- **Dropped the tilt entirely.** A real full-range track does not need help at
  the top end.
- `LIVE_GAIN = 1.25` places playing music at roughly twice the resting height.

Measured after: 0.05–0.20 mean, 0.29–0.42 peaks, 31 of 32 bands moving.
The idle path is untouched, so the site looks exactly as it did — the fix only
changes what happens once audio is connected. Re-check the three constants if
the master's loudness ever changes.

**Worth naming:** the demo loop was a stand-in, and tuning a real system
against a stand-in calibrated it for the stand-in. The synthetic loop needed a
tilt precisely because it was not music.

### Open

- Awaiting X's pick among the five.
- **Is `2_2` standing in for a slash or a colon?** The underscore may be a
  filename artifact. It is rendered exactly as written for now; changing it is
  a one-line edit once confirmed.
- The mp3 has not been committed into `public/media/audio/` yet — deliberately
  waiting until a design is chosen.

---

## The player shipped — Ring, bottom left

X picked **Ring**, moved from bottom right to bottom left. Built as
`site/src/components/SiteAudio.astro`, mounted once in `Base.astro`.

The track lives at `site/public/media/audio/i-hate-2-2.mp3` and its metadata
in `work.ts` as `backgroundTrack` — separate from the `tracks` array, which
still feeds the archive's "[UPLOAD AUDIO SAMPLES]" slot. The corner player and
the audio archive are different things and should stay different things.

**Button first, title after it.** At the left edge the label has to run
inward or it walks off the side of the screen — the studies had it the other
way round because the ring sat bottom right.

**It survives navigation.** Both the `<audio>` element and the control carry
`transition:persist`, so clicking through pages does not cut the song off
mid-bar. Verified: playback ran continuously across three client-side
navigations with `currentTime` advancing the whole way.

**It feeds the background.** On first play it hands the element to
`window.LoyaSound.listenTo()`, so the spectrum along the bottom of the page is
reacting to the real signal. That is the hook built two sessions ago, used for
the first time and working unchanged.

Set: `loop` on, `volume` 0.8, never autoplays.

### Two problems found and fixed

**A drawn control that does nothing without JS.** The ring is an inert circle
with scripting off, which breaks this project's own rule — `AudioTrack.astro`
uses native `<audio controls>` precisely so it works without JS. So the ring
is hidden until its script claims it (`data-ready`), and a `<noscript>` block
puts a plain native player in the same corner. Verified: with JS disabled the
ring is `display: none` and the native player renders.

**On a phone it sat on top of the Book a Session button.** Measured, not
guessed — a hit test found the hero CTA overlapping the dock's box at 390px.
A fixed control covering the site's primary action is not a trade worth
making, so on narrow screens only, the player waits until the visitor has
scrolled past the first screen. Once the track is playing it stays put
regardless, because then it is the control someone is actually looking for.
Desktop never tucks.

Verified at 390px: tucked at the top with `pointer-events: none` and zero
buttons overlapping, visible and overlapping nothing after scrolling, tucks
again on the way back up, and stays visible at the top once playing.

### Still open

- **Is `2_2` standing in for a slash or a colon?** Still unanswered. Rendered
  exactly as written; it is one string in `work.ts` to change.
- Whether this track also belongs on the Music page as the first entry in
  `tracks`. It would close part of the site's oldest content gap.

---

## The hero was cutting the spectrum in half

X spotted a hard horizontal line across the homepage where the animated
background stopped dead. Cause: `.hero` in `index.astro` painted its own wash

```css
linear-gradient(168deg, var(--ground-1), var(--ground-0) 64%)
```

which is **fully opaque**. The SoundField canvas sits behind the whole page at
`z-index: -1`, so an opaque section background does not tint it — it hides it.
The columns were chopped off at exactly the hero's bottom edge (y=809 at
1440×900), and because that wash is within a shade or two of the page ground,
the edge read as a rendering fault rather than as a change of surface.

Fixed by making every layer of the wash translucent and fading it to fully
transparent before the hero's bottom edge, so the columns rise through it
instead of stopping under it. Uses `color-mix`, which `Nav.astro` already
depends on.

Measured across the hero's bottom edge afterwards: **0.17 levels out of 255** —
no perceptible discontinuity. Confirmed the residual is not the grain layer
either (0.55 levels with grain disabled, so the grain is not what edges it).

### The general rule this exposes

Any full-bleed section background is now also a decision about the animated
background. Three cases, and only the first is a bug:

1. **A wash within a shade of the page ground** — reads as clipping. Make it
   translucent. This was the hero.
2. **A veil over a real photo or video** — `.ae-hero__veil`,
   `.dj-hero__veil`, `BookBand`'s `.band__veil`. Legitimately covers the
   canvas; there is a visible reason for the edge. Left alone.
3. **Cards and panels** — `.doing__card`, `.svc__i`, `.proj__card`,
   `.tl__card` all sit on `--ground-1` with a border. They read as objects on
   top of the background, which is the intent. Left alone.

Audited all three categories across every page; the hero was the only case in
group 1.

---

## The song is in the archive — 30-second cut

Cut with ffmpeg: first 30 seconds with a 1.8s fade over the tail, so it ends
rather than stops dead. Same 128 kbps / 44.1 kHz stereo as the master.
`site/public/media/audio/i-hate-2-2-30s.mp3`, 470 KB. The full track stays
where it was and still feeds the corner player — **two files, two jobs.**

Filed as the first entry in `tracks` in `work.ts`. Renders through the
existing `AudioTrack` component, which uses native `<audio controls>` — so it
is keyboard operable, screen-reader labelled, respects the OS media keys, and
works with scripting off, all for free.

### Track gained a category, and two pages needed filtering

`Track` now carries an optional `category: CategorySlug`, with a `tracksFor()`
helper alongside `mediaFor()` and `projectsFor()`. Two reasons:

1. **The archive category pages could not show audio at all.**
   `archive/[category].astro` rendered projects and images only. It now
   renders a "Listen" block, so a track filed under a category appears on
   that category's page — the archive is supposed to be the single source of
   truth, and audio was silently exempt from it.

2. **Audio Engineering was about to claim her song as client work.** Its
   "Work you can hear" section rendered `tracks` unfiltered, so the moment
   the array stopped being empty, her own release appeared under a heading
   that means *work she engineered for other people*. Now filtered to
   `tracksFor("audio-engineering")`, which is empty, so that section still
   shows its upload slots — which is the honest state.

`/music` filters the same way rather than taking whatever happens to be in
the array.

### On the credit line

`role` is set to **"Original song"** — deliberately neutral. The real line
would name what she did on it (written / produced / mixed / mastered), and
none of that was supplied. The project rule is not to invent credits, so it
stays generic until Liz says otherwise. One string in `work.ts` to change.

### Verified

Snippet reports exactly 30.00s. Appears on `/music` and `/archive/music`
only; the category nav counts it ("Music 1"). Native controls, no autoplay
anywhere. The corner player still points at the full track, not the snippet.
16 pages build clean, no page errors.
