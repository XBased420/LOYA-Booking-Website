import { defineConfig } from "astro/config";

const pages = process.env.GITHUB_PAGES === "1";

export default defineConfig({
  /* Feeds `canonical` and the absolute og:image URL on every page, so this
     string ships in the HTML whether or not the site is indexed. It must not
     contain "Elizabeth" — she asked for that name to be off the site.
     PROVISIONAL: no domain has been registered yet. Confirm with Liz before
     go-live; it is tracked in `pending` as ADD FINAL DOMAIN. */
  /* GitHub Pages serves a project site from /<repo>/, so the build needs a
     base path — but only that build. The workflow sets GITHUB_PAGES=1;
     locally the variable is unset, base stays "/", and START.bat behaves
     exactly as it always has. */
  site: pages ? "https://xbased420.github.io" : "https://lizloya.com",
  base: pages ? "/LOYA-Booking-Website" : undefined,
  build: { inlineStylesheets: "auto" },
  image: { responsiveStyles: true },
});
