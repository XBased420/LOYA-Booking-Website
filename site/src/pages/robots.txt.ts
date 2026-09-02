import type { APIRoute } from "astro";
import { site } from "../data/site";

/* Mirrors the PUBLIC flag in site.ts. While the site is a preview it
   refuses every crawler outright; once Liz approves, flipping PUBLIC
   opens it and points at the sitemap. */
export const GET: APIRoute = () =>
  new Response(
    site.PUBLIC
      ? "User-agent: *\nAllow: /\n"
      : "User-agent: *\nDisallow: /\n",
    { headers: { "Content-Type": "text/plain; charset=utf-8" } },
  );
