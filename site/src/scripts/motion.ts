/* ═══════════════════════════════════════════════════════════════
   MOTION LAYER — entry point, loaded on every page by Base.astro.
   Full notes: site/MOTION.md.

   This file stays tiny on purpose. It:
   • lazy-loads the real motion code (motion-inner.ts: GSAP, Lenis)
     on the long-form issue pages only. The homepage magazine owns its
     own motion and scrolling, so it never downloads any of it;
   • runs the page-to-page transitions ("opening the issue" from a
     magazine teaser, "closing the issue" on the way back to the cover).
     These are CSS view transitions, set up here so they need no change
     to the magazine's turn engine;
   • keeps the `mo` class on <html> correct across client-side
     navigation. `mo` holds the issue page's blocks hidden for the few
     milliseconds until the motion layer takes them over (motion.css);
     a failsafe shows everything if it never does.
   ═══════════════════════════════════════════════════════════════ */

const reduce = matchMedia("(prefers-reduced-motion: reduce)");
const isInner = (doc: Document) => !!doc.querySelector("main.issue-page");
const slash = (p: string) => p.replace(/\/?$/, "/");
const isHome = (url: URL) => slash(url.pathname) === slash(import.meta.env.BASE_URL);

declare global {
  interface Window { __moT?: number }
}

let teardown: null | (() => void) = null;
let navId = 0;

/* The inline script in Base.astro's <head> adds `mo` before first paint on
   a full page load. On client-side navigation the new <html> attributes come
   from the fetched document, so they're set here, on that document. */
function arm(doc: Document) {
  const h = doc.documentElement;
  h.classList.toggle("mo", !reduce.matches && isInner(doc));
  h.classList.remove("mo-ready");
}

/* If the motion code hasn't taken over within 4 s (slow network, a
   blocked chunk, an error), drop `mo` so nothing stays hidden, and let the
   layout's plain fade-in handle the page instead. */
function failsafe() {
  clearTimeout(window.__moT);
  const h = document.documentElement;
  if (!h.classList.contains("mo")) return;
  window.__moT = window.setTimeout(() => {
    if (h.classList.contains("mo") && !h.classList.contains("mo-ready")) {
      h.classList.remove("mo");
      dispatchEvent(new Event("loya:motion-fallback"));
    }
  }, 4000);
}

async function mount() {
  const id = ++navId;
  if (!isInner(document) || reduce.matches) return;
  /* Wait for the browser to be idle (or the first scroll), so loading and
     starting GSAP never competes with the page's first paint. What's on
     screen is already visible; only below-the-fold content is waiting. */
  await new Promise<void>((go) => {
    let done = false;
    const once = () => { if (!done) { done = true; removeEventListener("scroll", once); go(); } };
    addEventListener("scroll", once, { passive: true, once: true });
    if ("requestIdleCallback" in window) requestIdleCallback(once, { timeout: 700 });
    else setTimeout(once, 250);
  });
  if (id !== navId) return;
  try {
    const m = await import("./motion-inner");
    // navigated away, or the failsafe already gave up: do nothing
    if (id !== navId || !document.documentElement.classList.contains("mo")) return;
    teardown = m.mount();
  } catch (err) {
    console.warn("[motion] not loaded", err);
    document.documentElement.classList.remove("mo");
    dispatchEvent(new Event("loya:motion-fallback"));
  }
}

/* ── Opening and closing the issue ───────────────────────────────────
   OPEN: a teaser link printed on a magazine page ("More on the music
   page →") marks that page, at click time, with a view-transition name.
   The new issue page gets a matching, screen-sized stand-in, so the
   printed page grows out of the magazine and lays flat into the sheet.
   It's done at click time because the pages in the book are clones the
   engine builds; nothing in the turn engine is touched.
   CLOSE: leaving an issue page for the cover folds the sheet away; the
   magazine then plays its own drop-onto-the-desk entrance. */
let openingFrom: HTMLElement | null = null;

document.addEventListener("click", (e) => {
  if (reduce.matches || !("startViewTransition" in document)) return;
  const a = (e.target as Element | null)?.closest?.<HTMLAnchorElement>(".mag .face a.more, .mag .face a.cta--block");
  if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || a.target === "_blank") return;
  const pg = a.closest<HTMLElement>(".pg");
  if (!pg) return;
  openingFrom?.style.removeProperty("view-transition-name");
  pg.style.setProperty("view-transition-name", "loya-sheet");
  openingFrom = pg;
}, true);

document.addEventListener("astro:before-preparation", (e: any) => {
  if (reduce.matches) return;
  const h = document.documentElement;
  if (openingFrom && e.sourceElement && openingFrom.contains(e.sourceElement)) h.dataset.loyaVt = "open";
  else if (isInner(document) && isHome(e.to)) h.dataset.loyaVt = "close";
  else delete h.dataset.loyaVt;
});

document.addEventListener("astro:before-swap", (e: any) => {
  // leave the page we're on cleanly
  teardown?.(); teardown = null; navId++;
  clearTimeout(window.__moT);
  arm(e.newDocument);

  const mode = document.documentElement.dataset.loyaVt;
  if (mode) {
    e.newDocument.documentElement.dataset.loyaVt = mode;
    if (mode === "open") {
      const stand = e.newDocument.createElement("div");
      stand.className = "mo-vt-sheet";
      stand.setAttribute("aria-hidden", "true");
      e.newDocument.body.appendChild(stand);
    }
    const done = () => {
      delete document.documentElement.dataset.loyaVt;
      document.querySelectorAll(".mo-vt-sheet").forEach((n) => n.remove());
    };
    e.viewTransition?.finished?.then(done, done) ?? setTimeout(done, 1200);
  }
  openingFrom = null;
});

/* After a client-side swap, mark what's on screen (the inline script in
   Base.astro does this on a full page load). */
document.addEventListener("astro:after-swap", () => {
  if (!document.documentElement.classList.contains("mo")) return;
  const H = innerHeight;
  document.querySelectorAll("main.issue-page .wrap > *").forEach((el) => {
    if (el.getBoundingClientRect().top < H) el.setAttribute("data-mo-fold", "");
  });
});

document.addEventListener("astro:page-load", () => {
  failsafe();
  mount();
});
