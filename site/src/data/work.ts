/* ═══════════════════════════════════════════════════════════════
   Studio work: services, audio, projects.

   `services` describes the craft, not claims about Liz's results
   — no clients, outcomes, or statistics are asserted anywhere here.

   `tracks` and `projects` are intentionally EMPTY. Every consumer
   renders a labelled slot when the array is empty, so shipping real
   work later is a data edit, not a template change.
   ═══════════════════════════════════════════════════════════════ */

export type Service = {
  slug: string;
  title: string;
  blurb: string;
  covers: string[];
};

export const services: Service[] = [
  {
    slug: "recording",
    title: "Recording",
    blurb:
      "Tracking vocals and instruments — mic selection, placement, gain staging, and a session that keeps takes organised and usable.",
    covers: ["Vocal tracking", "Instrument tracking", "Session setup", "Comping"],
  },
  {
    slug: "mixing",
    title: "Mixing",
    blurb:
      "Balance, depth, and translation — turning a raw session into something that holds up on monitors, headphones, and a phone speaker.",
    covers: ["Balance & panning", "EQ and dynamics", "Effects & space", "Reference checks"],
  },
  {
    slug: "editing",
    title: "Editing",
    blurb:
      "Cleaning up what was captured — timing, tuning, noise, and the unglamorous passes that make a take sound intentional.",
    covers: ["Timing & alignment", "Tuning", "Noise & clicks", "Arrangement edits"],
  },
  {
    slug: "production",
    title: "Music Production",
    blurb:
      "Building a record from the ground up, or shaping one that already has a direction and needs someone to finish it.",
    covers: ["Arrangement", "Sound selection", "Direction", "Finishing"],
  },
];

/** Signal chain / software actually named on the source-of-truth board. */
export const studioTools = [
  { name: "Neumann U 87", kind: "Microphone" },   // supplied in the brief
  { name: "Pro Tools", kind: "DAW" },
  { name: "Logic Pro", kind: "DAW" },
  { name: "FL Studio", kind: "DAW" },
  { name: "Waves plugins", kind: "Processing" },
  { name: "Melodyne", kind: "Tuning" },
];

export type Track = {
  slug: string;
  title: string;
  role: string;
  src: string;
  note?: string;
  /** Which archive category the track is filed under, so it appears on that
   *  category page as well as on /music. */
  category?: CategorySlug;
};

/** Audio filed in the archive. Separate from `backgroundTrack` below: that
 *  one is the corner player and runs the full track, this is the listening
 *  sample. One entry so far — everything else is still [UPLOAD AUDIO
 *  SAMPLES]. */
export const tracks: Track[] = [
  {
    slug: "i-hate-2-2",
    title: "i hate 2_2",
    role: "Original song",
    src: "/media/audio/i-hate-2-2-30s.mp3",
    note: "First 30 seconds. The full track plays from the corner of any page.",
    category: "music",
  },
];

/** Tracks filed under one archive category. */
export const tracksFor = (slug: CategorySlug): Track[] =>
  tracks.filter((t) => t.category === slug);

/** The track offered by the player in the corner of every page.
 *  Never autoplays; the visitor presses it. */
export type BackgroundTrack = { title: string; artist: string; src: string };
export const backgroundTrack: BackgroundTrack = {
  title: "i hate 2_2",
  artist: "Liz Loya",
  src: "/media/audio/i-hate-2-2.mp3",
};

export type Project = {
  slug: string;
  title: string;
  role: string;
  category: string;
  summary: string;
  image?: string;
  credits?: string[];
};

/** No projects have been supplied. See [ADD PORTFOLIO PROJECTS]. */
export const projects: Project[] = [];

/** Studio photography that IS available — all verified as her work
 *  environment, captioned descriptively rather than with invented context. */
export const studioShots = [
  { img: "console-standing",  alt: "Liz Loya standing at a large mixing console.",        cap: "at the desk",       rot: -2.1 },
  { img: "console-detail",    alt: "Close-up of a mixing console channel strip lit up.",        cap: "channel strip",     rot: 1.8 },
  { img: "protools-ssl",      alt: "A Pro Tools session on screen beside an SSL console.",      cap: "session view",      rot: -1.5 },
  { img: "console-portrait",  alt: "Liz Loya at the console in the control room.",        cap: "control room",      rot: 2.4 },
  { img: "piano-mic",         alt: "A microphone positioned over piano strings.",               cap: "piano, close mic",  rot: -2.6 },
  { img: "console-moody",     alt: "The console under low light during a session.",             cap: "late session",      rot: 1.3 },
];

/* ═══════════════════════════════════════════════════════════════
   THE ARCHIVE

   Board rule 05.1: a top-level page and an archive category are NOT
   duplicates. The top-level page is the pitch; the archive category is
   the evidence. Every project record lives in exactly one place — here —
   and top-level pages link into the matching filter rather than
   restating content.
   ═══════════════════════════════════════════════════════════════ */

export type CategorySlug =
  | "audio-engineering" | "music" | "dj-events" | "radio-media"
  | "live-sound" | "av" | "creative-projects";

export const categories: { slug: CategorySlug; label: string; blurb: string }[] = [
  { slug: "audio-engineering", label: "Audio Engineering", blurb: "Recording, mixing, editing, production." },
  { slug: "music",             label: "Music",             blurb: "Releases, beats, and my own work." },
  { slug: "dj-events",         label: "DJ / Events",       blurb: "Sets, weddings, and event work." },
  { slug: "radio-media",       label: "Radio / Media",     blurb: "Broadcast and produced audio." },
  { slug: "live-sound",        label: "Live Sound",        blurb: "Front of house and stage." },
  { slug: "av",                label: "AV",                blurb: "Event systems, setup, playback." },
  { slug: "creative-projects", label: "Creative Projects", blurb: "Everything that does not sit in one box." },
];

/** Real, verified imagery from the shoot and phone archive, filed by the
 *  work it documents. This is NOT a substitute for project records — it is
 *  evidence that exists today while `projects` is still empty. Captions
 *  describe what is visible and nothing more. */
export type ArchiveItem = {
  img: string; alt: string; cap: string; category: CategorySlug;
};

export const archiveMedia: ArchiveItem[] = [
  { img: "console-standing",   alt: "Liz Loya standing at a large mixing console.",       cap: "at the desk",        category: "audio-engineering" },
  { img: "console-portrait",   alt: "Liz Loya at the console in the control room.",       cap: "control room",       category: "audio-engineering" },
  { img: "console-detail",     alt: "Close-up of a mixing console channel strip lit up.",       cap: "channel strip",      category: "audio-engineering" },
  { img: "console-moody",      alt: "The console under low light during a session.",            cap: "late session",       category: "audio-engineering" },
  { img: "protools-ssl",       alt: "A Pro Tools session on screen beside an SSL console.",     cap: "session view",       category: "audio-engineering" },
  { img: "console-series",     alt: "Liz Loya working at the console.",                   cap: "tracking",           category: "audio-engineering" },
  { img: "grad-console-a",     alt: "Liz Loya in cap and gown at a large console.",       cap: "graduation day",     category: "audio-engineering" },
  { img: "headphones-portrait",alt: "Liz Loya wearing headphones in the studio.",         cap: "in the room",        category: "audio-engineering" },
  { img: "piano-mic",          alt: "A microphone positioned over piano strings.",              cap: "piano, close mic",   category: "music" },
  { img: "dj-booth",           alt: "A DJ booth set up in a bright venue.",                     cap: "booth, set up",      category: "dj-events" },
  { img: "dj-event",           alt: "A DJ booth lit purple at an event.",                       cap: "uplit room",         category: "dj-events" },
  { img: "dj-reception",       alt: "DJ equipment at a wedding reception.",                     cap: "reception",          category: "dj-events" },
  { img: "dj-selfie",          alt: "Liz Loya at a DJ setup under red light.",            cap: "mid-set",            category: "dj-events" },
  { img: "event-clients",      alt: "Liz Loya with clients at an event.",                 cap: "the couple",         category: "dj-events" },
  { img: "radio-desk",         alt: "A broadcast desk beneath a red studio sign.",              cap: "on air",             category: "radio-media" },
  { img: "radio-desk-b",       alt: "Liz Loya at the broadcast desk.",                    cap: "the board",          category: "radio-media" },
  { img: "radio-desk-c",       alt: "The broadcast studio during a session.",                   cap: "studio floor",       category: "radio-media" },
  { img: "live-stage",         alt: "Stage lighting over a crowd at a live show.",              cap: "house lights",       category: "live-sound" },
  { img: "av-cases",           alt: "Road cases and speaker stacks packed for an event.",       cap: "load-in",            category: "av" },
];

export const mediaFor = (c: CategorySlug) =>
  archiveMedia.filter((m) => m.category === c);
export const projectsFor = (c: CategorySlug) =>
  projects.filter((p) => p.category === c);
