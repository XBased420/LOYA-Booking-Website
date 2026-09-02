/** Palette pulled from her own footage — violet stage light, gold venue wash,
 *  on an ink-dark ground with warm paper cards. Deliberately not blue/beige. */
export const theme = {
  ink: "#131116",
  inkDeep: "#0b0a0d",
  paper: "#f2ece0",
  paperEdge: "#ded5c4",
  violet: "#7c5cff",
  magenta: "#d94f9a",
  gold: "#e8b455",
  type: "'Courier New', ui-monospace, monospace",
  display: "'Helvetica Neue', Arial, sans-serif",
} as const;

export type Shot = {
  src: string;
  caption: string;
  kicker: string;
  orientation: "portrait" | "landscape";
  tilt: number;
};

export const SHOTS: Shot[] = [
  { src: "clips/studio-mic.mp4",       caption: "tracking vocals",      kicker: "STUDIO",     orientation: "landscape", tilt: -1.6 },
  { src: "clips/studio-console.mp4",   caption: "at the desk",          kicker: "STUDIO",     orientation: "portrait",  tilt:  2.1 },
  { src: "clips/studio-faders.mp4",    caption: "riding the faders",    kicker: "MIXING",     orientation: "portrait",  tilt: -2.4 },
  { src: "clips/daw-arrange.mp4",      caption: "arrangement",          kicker: "PRODUCTION", orientation: "portrait",  tilt:  1.4 },
  { src: "clips/daw-keys.mp4",         caption: "writing",              kicker: "PRODUCTION", orientation: "portrait",  tilt: -1.9 },
  { src: "clips/laser-portrait.mp4",   caption: "lights up",            kicker: "LIVE",       orientation: "landscape", tilt:  1.2 },
  { src: "clips/stage-wide.mp4",       caption: "main stage",           kicker: "LIVE",       orientation: "portrait",  tilt: -1.3 },
  { src: "clips/venue-gold.mp4",       caption: "reading the room",     kicker: "DJ",         orientation: "portrait",  tilt:  2.3 },
  { src: "clips/venue-magenta.mp4",    caption: "last hour",            kicker: "DJ",         orientation: "portrait",  tilt: -1.7 },
];

export const SHOT_FRAMES = 64;
export const TITLE_FRAMES = 52;
export const OUTRO_FRAMES = 62;
export const TOTAL =
  TITLE_FRAMES + SHOTS.length * SHOT_FRAMES + OUTRO_FRAMES;
