/* ═══════════════════════════════════════════════════════════════
   SINGLE SOURCE OF TRUTH

   Every fact below is user-supplied (Miro board frame 01 "Source of
   Truth" + the design specification). Nothing here is inferred.

   Anything not supplied is a Placeholder — it renders as a visible,
   labelled slot rather than being quietly filled in or omitted.
   To go live, replace the Placeholder with real data. Nothing else
   needs to change.
   ═══════════════════════════════════════════════════════════════ */

export type Placeholder = { __placeholder: string };
export const TBD = (label: string): Placeholder => ({ __placeholder: label });
export const isPlaceholder = (v: unknown): v is Placeholder =>
  typeof v === "object" && v !== null && "__placeholder" in v;

/* NAMING — brief Q13 + Q17. She chose "LOYA" for the display mark and
   asked for "Liz" to be off the site entirely: "I just want liz".
   So: `name` is the wordmark, `firstName` is what prose calls her, and
   `legalName` exists ONLY for places a full name is unavoidable (an
   invoice, a contract). It is not rendered anywhere on the site. */
export const site = {
  /** false = every page ships noindex,nofollow and robots.txt disallows
   *  everything. Liz has answered the brief but has not seen the site
   *  live; publishing a real person's name and face to search results
   *  is her call, not ours. Set true only when she says go. */
  PUBLIC: false,
  name: "LOYA",
  firstName: "Liz",
  fullName: "Liz Loya",
  shortName: "Loya",
  location: "Dallas, Texas",
  /** Order is hers — she leads with Audio Engineer (Q38). Radio
   *  Producer dropped from the headline set: she did not keep it in
   *  her four (Q37). The Blaze TV role still stands on Experience. */
  roles: ["Audio Engineer", "DJ", "Creative", "Artist"],
  rolesLine: "Audio Engineer • DJ • Creative • Artist",
  intro:
    "I'm an audio engineer, DJ, and artist dedicated to creating experiences through sound.",
  seo: {
    title: "LOYA — Audio Engineer & DJ in Dallas",
    description:
      "Liz Loya is a Dallas-based audio engineer, DJ, and artist. Recording, mixing, music production, and studio sessions.",
  },
  /** One verified line exists (intro). A fuller bio has not been supplied. */
  bio: TBD("ADD EXTENDED BIO"),
  contact: {
    email: "liznloya@gmail.com",
    instagram: "liznloya",
    tiktok: "liznloya",
    linkedin: TBD("ADD LINKEDIN"),
  },
} as const;

/** Turn a stored handle into a real URL. The values in site.contact are
 *  bare (an address, a username) so they can be DISPLAYED as-is; only the
 *  href needs a scheme. Without this they resolve as relative paths — which
 *  is exactly how every contact link on the site once 404'd. */
export const channelHref = (key: string, v: string) =>
  key === "email"     ? `mailto:${v}`
: key === "instagram" ? `https://instagram.com/${v.replace(/^@/, "")}`
: key === "tiktok"    ? `https://tiktok.com/@${v.replace(/^@/, "")}`
: key === "linkedin"  ? (v.startsWith("http") ? v : `https://linkedin.com/in/${v}`)
: v;

/** The channels worth surfacing, in display order. `handle` is what a
 *  visitor reads; channelHref() builds what they click. */
export const contactChannels = [
  { key: "email",     label: "Email",     value: site.contact.email },
  { key: "instagram", label: "Instagram", value: site.contact.instagram },
  { key: "tiktok",    label: "TikTok",    value: site.contact.tiktok },
  { key: "linkedin",  label: "LinkedIn",  value: site.contact.linkedin },
] as const;

export const education = {
  school: "MediaTech Institute",
  program: "Recording Arts",
  credential: "Degree in Recording Arts",
  training: [
    "Professional recording techniques",
    "Audio engineering",
    "Mixing",
    "Editing",
    "Studio production",
    "Music technology",
  ],
};

/** What I Do — specification §10. Order is the specification's. */
export const disciplines = [
  { title: "Audio Engineering", note: "Recording, routing, session craft." },
  { title: "Recording",         note: "Tracking vocals and instruments." },
  { title: "Mixing",            note: "Balance, depth, translation." },
  { title: "Music Production",  note: "Building records from the ground up." },
  { title: "DJing",             note: "Reading a room and holding it." },
  { title: "Live Sound",        note: "Front of house and stage." },
  { title: "AV Production",     note: "Event systems, setup, playback." },
  { title: "Radio Production",  note: "Broadcast audio and segments." },
];

/** Career, in the order the site tells it. No dates were supplied and none
 *  are shown — inventing a timeline is still inventing facts.
 *
 *  The North Face (Sales Associate) was removed 2026-08-31 at Liz's request:
 *  retail does not speak to what this site is selling. Deliberate omission,
 *  not an oversight — do not restore it from the original board. */
export const experience = [
  {
    slug: "mediatech",
    org: "MediaTech Institute",
    role: "Recording Arts Degree",
    kind: "education",
    image: "mediatech-building",
    detail: education.training,
  },
  {
    slug: "cohost",
    org: "CoHost Entertainment",
    role: "DJ / Host",
    kind: "work",
    image: "dj-event",
    detail: [],
  },
  {
    slug: "blaze",
    org: "Blaze TV Media",
    role: "Radio Producer",
    kind: "work",
    image: "radio-desk",
    /* Folded in from the retired /radio-media page. These are the
       disciplines the role covers, not claims about specific shows —
       programmes and dates are still [ADD ROLE RESPONSIBILITIES]. */
    detail: [
      "Radio production",
      "Audio production",
      "Editing",
      "Media production",
      "Music curation",
      "Client communication",
    ],
  },
  {
    slug: "freelance-av",
    org: "Freelance",
    role: "AV Technician",
    kind: "work",
    image: "av-cases",
    detail: [],
  },
  {
    slug: "deep-ellum",
    org: "Deep Ellum Recording Studio",
    role: "Audio Engineer",
    kind: "work",
    image: "console-standing",
    detail: [],
  },
];

/** Tools, board frame 01. Verified. */
export const tools = [
  "Pro Tools", "Logic Pro", "FL Studio", "Waves plugins",
  "Melodyne", "Rekordbox",
];

/** Everything still owed by Liz. Rendered on-page as labelled
 *  slots. There is no separate gap page — this array is the record, so an
 *  on-page [SLOT] with no matching entry here is a bug in the list. */
/* Closed 2026-08-27 from The Loya Brief: professional email, socials,
   pricing, availability, deposit and payment, services list, brand
   colours, and the booking rules. Ten items remain — she left Section
   08 of the brief mostly blank and they are being collected as we go. */
export const pending = [
  "UPLOAD AUDIO SAMPLES",        // still the highest-value gap
  "ADD PORTFOLIO PROJECTS",
  "ADD MUSIC RELEASES",
  "ADD TESTIMONIALS",
  "ADD CLIENT CREDITS",
  "ADD FAQ CONTENT",
  "ADD EXTENDED BIO",
  "ADD ROLE RESPONSIBILITIES",
  "ADD BEFORE / AFTER EXAMPLES",
  "ADD EQUIPMENT LIST",          // one mic supplied so far; label matches the on-page slot
  "ADD SERVICES LIST",           // the DJ page still shows this gap
  "ADD FINAL DOMAIN",            // astro.config `site` is provisional (lizloya.com)
  "ADD LINKEDIN",
  "ADD FINAL REFERENCE IMAGES",
  "ADD BOOKING PLATFORM",        // endpoint still empty; form stays disabled
];

/** Nav is the nine pages she kept in Q20. Radio + Media and Studio
 *  were dropped; their content folded into Experience and Audio
 *  Engineering rather than being deleted. */
export const nav = [
  { href: "/",                  label: "Home" },
  { href: "/about",             label: "About" },
  { href: "/experience",        label: "Experience" },
  { href: "/audio-engineering", label: "Audio Engineering" },
  { href: "/music",             label: "Music" },
  { href: "/archive",           label: "My Work" },
  { href: "/dj-live-events",    label: "DJ + Live" },
  { href: "/book",              label: "Book a Session" },
  { href: "/contact",           label: "Contact" },
];
