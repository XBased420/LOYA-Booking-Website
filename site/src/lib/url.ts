/** Prefix an absolute site path with Astro's configured `base`.
 *
 *  Why this exists: Astro's `base` rewrites bundled asset URLs, but it does
 *  NOT touch paths you wrote yourself — `href="/book"` stays `/book` and
 *  404s the moment the site is served from a subpath. GitHub Pages serves
 *  project sites from `/<repo>/`, so every internal link and every file in
 *  public/ has to go through here.
 *
 *  Locally `base` is "/" and this is a no-op, so nothing changes when you
 *  run START.bat.
 */
export const u = (p: string): string => {
  const base = import.meta.env.BASE_URL ?? "/";
  const stem = base.endsWith("/") ? base.slice(0, -1) : base;
  return stem + (p.startsWith("/") ? p : "/" + p);
};
