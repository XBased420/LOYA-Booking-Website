# LOYA project context

## Purpose and source of truth

Build Liz Loya's personal brand and booking website so clients can see her work and request sessions without cold calls or ad hoc texts. She is a Dallas audio engineer, DJ, and artist with a Recording Arts degree from MediaTech Institute. Her experience includes Deep Ellum Recording Studio, Blaze TV Media, CoHost Entertainment, and freelance AV work.

Use verified facts from `site/src/data/` and Liz's answers. Do not invent clients, credits, testimonials, prices, contact details, or a career timeline. Keep unknown information as labeled placeholders. The public wordmark is **LOYA** and prose calls her **Liz**; do not display "Elizabeth" on the site.

- Studio: $75/hour, two-hour minimum. Mixing: $75/song. Mix and master: $100/song.
- Deposit: 50% non-refundable; balance due on arrival. Payment methods: Zelle, CashApp, Apple Pay, card, cash.
- Notice: 24 hours for studio sessions, two weeks for DJ events. Hours: 8 a.m. to midnight, Dallas time.
- Contact: `liznloya@gmail.com`, `@liznloya` on Instagram and TikTok.

## Code and deployment

- The site is Astro. Source is under `site/src/`; content and business rules live mainly in `site/src/data/site.ts`, `booking.ts`, and `work.ts`. The `u()` helper in `site/src/lib/url.ts` applies the GitHub Pages base path to internal links and media.
- GitHub Pages deploys `main` with `.github/workflows/deploy.yml` and `GITHUB_PAGES=1`. Pages **Source** is GitHub Actions. Do not upload Astro files to repository-root `pages/`, `components/`, `layouts/`, `scripts/`, or `styles/`; the workflow builds `site/`, so such files are ignored. The workflow now fails clearly if those folders appear at the root.
- The live site is https://xbased420.github.io/LOYA-Booking-Website/. The magazine homepage was deployed by merge commit `e639955` (PR #1) on 2026-09-22 and verified live. The earlier red `pages-build-deployment` check came from GitHub's separate Jekyll builder parsing `.astro` files as YAML; the custom Astro deployment succeeded. A browser refresh may be needed to replace a cached old homepage.
- Astro's `ClientRouter` swaps pages without full reloads. `site.PUBLIC` is `false` in `site/src/data/site.ts`, which keeps the preview out of search results. Liz must approve before this is changed.
- Booking requests post to the configured Apps Script endpoint in `site/src/lib/booking-api.ts` and are handled through a Google Sheet and the `sheets/` scripts. Liz confirms requests manually. `BUSY_CSV_URL` is still empty, so the public availability calendar is not connected. Do not publish the whole Bookings sheet to make the calendar work; only a limited Busy tab should be public.

## Design and magazine homepage

The visual direction is light blush and pink paper collage, like a vision board or printed magazine. Tokens are in `site/src/styles/tokens.css`; fonts are Anton, Archivo, Courier Prime, and Caveat. Use the deeper pink text token for small text contrast.

The homepage is **LOYA, Issue 01**: cover, contents, about, experience, audio engineering, music, work, DJ/live events, booking, and back-cover contact. Scrolling, swiping, or arrow keys turn its pages. Desktop uses spreads; phones use one page. Section teasers link to full pages. Music can play Liz's track `i hate 2_2`; page-turn sound is optional.

Its files are `site/src/pages/index.astro`, `site/src/layouts/Base.astro`, `site/src/components/magazine/`, `site/src/scripts/magazine.ts`, and `site/src/styles/magazine.css`. `Base.astro` uses a `bare` prop so only the homepage omits the standard nav, footer, background, and corner player. The old homepage is in the ignored `site/src/_retired/` folder locally.

Preserve these magazine behavior fixes when changing its animation:

1. Freeze videos to canvases during page turns; video playback otherwise draws above the 3D scene.
2. Keep prebuilt bending strips `visibility:hidden` at rest to avoid visible seams.
3. Keep the front face's `translateZ(.01px)` so Chrome sends clicks to page links.
4. Keep `.pg` at `box-sizing:border-box` so bottom content is not clipped.
5. Avoid `mix-blend-mode` inside the 3D magazine scene.
6. Mount on `astro:page-load` and tear down on `astro:before-swap` to avoid leaked listeners and audio.

## Work still pending

- The local `main` branch has seven unpushed booking-sheet and documentation commits. It diverged from GitHub `main` while the magazine deployment was fixed. Reconcile the branches before using `PUSHTOGITHUB.bat`, which always pushes local `main`; review those commits before publishing them.
- Add verified media and missing audio samples, portfolio projects, releases, testimonials, and an extended bio. The handoff note reports additional photos and videos in Liz's Google Drive; inspect them before using any.
- Connect a limited Busy-tab CSV feed if the public calendar should show openings. Verify the booking request flow end to end before treating it as fully launched.
- Keep `site.PUBLIC=false` until Liz approves the site for indexing.
