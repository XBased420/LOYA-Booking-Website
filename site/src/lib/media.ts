import fs from "node:fs";
import path from "node:path";

/** Scans the staged derivative ladder once at build time and indexes it by
 *  name, so <Photo> can emit a real srcset instead of a hard-coded width. */
const DIR = path.resolve("public/media/img");

type Entry = { avif: number[]; webp: number[]; jpg: number[] };
const index = new Map<string, Entry>();

if (fs.existsSync(DIR)) {
  for (const file of fs.readdirSync(DIR)) {
    const m = /^(.+)-(\d+)\.(avif|webp|jpg)$/.exec(file);
    if (!m) continue;
    const [, name, w, ext] = m;
    const e = index.get(name) ?? { avif: [], webp: [], jpg: [] };
    e[ext as keyof Entry].push(Number(w));
    index.set(name, e);
  }
  for (const e of index.values())
    (["avif", "webp", "jpg"] as const).forEach((k) => e[k].sort((a, b) => a - b));
}

export const hasImage = (name: string) => index.has(name);

export function srcset(name: string, ext: "avif" | "webp" | "jpg") {
  const e = index.get(name);
  if (!e) return "";
  return e[ext].map((w) => `/media/img/${name}-${w}.${ext} ${w}w`).join(", ");
}

/** The <img src> fallback. Deliberately a MID width, not the largest:
 *  browsers with srcset ignore src, but the preload scanner and any
 *  no-srcset path fetch it directly — pointing it at the 2400px file
 *  ships a 6x oversized image before layout is even known. */
export function fallback(name: string) {
  const e = index.get(name);
  if (!e || !e.jpg.length) return "";
  const pick =
    e.jpg.find((w) => w >= 1000) ?? e.jpg[e.jpg.length - 1];
  return `/media/img/${name}-${pick}.jpg`;
}

/** Smallest width, used to reserve layout space and avoid CLS. */
export function widths(name: string) {
  const e = index.get(name);
  return e ? e.jpg : [];
}
