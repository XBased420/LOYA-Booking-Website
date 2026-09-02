import { defineConfig } from "astro/config";

export default defineConfig({
  /* Feeds `canonical` and the absolute og:image URL on every page, so this
     string ships in the HTML whether or not the site is indexed. It must not
     contain "Elizabeth" — she asked for that name to be off the site.
     PROVISIONAL: no domain has been registered yet. Confirm with Liz before
     go-live; it is tracked in `pending` as ADD FINAL DOMAIN. */
  site: "https://lizloya.com",
  build: { inlineStylesheets: "auto" },
  image: { responsiveStyles: true },
});
