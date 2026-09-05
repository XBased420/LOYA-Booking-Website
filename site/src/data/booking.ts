/* ═══════════════════════════════════════════════════════════════
   Booking model.

   REBUILT 2026-08-27 from Liz's answers in The Loya Brief (Q22–Q35).
   Everything below is hers, verbatim in substance — no rate, rule or
   policy here was invented.

   What she said the problem is (Q22): "getting paid the full amount
   and people calling me all the time — I want to be able to rest
   knowing ppl won't blow up my phone." Every rule in this file exists
   to answer one of those two things.

   STILL NOT LIVE: no booking platform was chosen, so `bookingEndpoint`
   is empty and the form validates fully and then says plainly that it
   has no destination, rather than appearing to succeed.
   ═══════════════════════════════════════════════════════════════ */

export type BookingStatus =
  | "pending"
  | "confirmed"
  | "paid"
  | "completed"
  | "cancelled";

export type DepositStatus = "not-required" | "awaiting" | "paid" | "refunded";

export type BookingRecord = {
  name: string;
  email: string;
  phone: string;
  service: string;
  date: string;          // ISO yyyy-mm-dd
  time: string;          // 24h HH:mm
  projectDescription: string;
  intake: Record<string, string>;
  depositStatus: DepositStatus;
  status: BookingStatus;
  createdAt: string;     // ISO timestamp
};

/* ── Rates (Q25) ────────────────────────────────────────────────
   She chose to show real prices, not ranges (Q24). */
export const rates = {
  studioHourly: 75,
  studioMinimumHours: 2,
  mixPerSong: 75,
  mixAndMasterPerSong: 100,
  /** Mixing is quoted separately from a recording session — her words:
   *  "mixing $75 per song (not included in recording)". Stated on the
   *  page so nobody assumes a session price covers the mix. */
  mixingSeparateFromRecording: true,
};

export const rateLines = [
  { label: "Studio time",      price: "$75/hr",     note: "2 hour minimum" },
  { label: "Mixing",           price: "$75/song",   note: "Not included in a recording session" },
  { label: "Mix + master",     price: "$100/song",  note: "" },
];

/* ── Deposit and payment (Q26–Q28, Q30, Q35) ───────────────────── */
export const deposit = {
  required: true,
  kind: "percentage" as const,
  percent: 50,
  refundable: false,
  /** Q30, her standing ask: "Please pay the full amount as soon as
   *  getting to the session." */
  balanceDue: "The rest is due when you arrive, before the session starts.",
};

export const paymentMethods = ["Zelle", "CashApp", "Apple Pay", "Card", "Cash"];

/** Q35, in her words. Shown on the booking page and in the confirmation. */
export const cancellationPolicy = [
  "The deposit is non-refundable.",
  "Your session starts at the time you booked and ends at the time you booked.",
];

/* ── Bookable services (Q23) ────────────────────────────────────
   Only two go straight through with no conversation first. Everything
   else is a request, which is the filter she asked for. */
/* Live sound / AV was removed from this list 2026-08-31 at her request —
   she does not take that work, so it should never be bookable here. */
export const bookableServices = [
  { slug: "recording",  label: "Recording session",  price: "$75/hr · 2hr min", direct: true },
  { slug: "consult",    label: "Consult call",       price: "Free",             direct: true },
  { slug: "mixing",     label: "Mixing",             price: "$75/song",         direct: false },
  { slug: "mix-master", label: "Mix + master",       price: "$100/song",        direct: false },
  { slug: "production", label: "Music production",   price: null,               direct: false },
  { slug: "dj",         label: "DJ / event booking", price: null,               direct: false },
  { slug: "other",      label: "Something else",     price: null,               direct: false },
];

/* ── Lead time (Q31) ────────────────────────────────────────────
   Different per kind of work: "B for studio, E for DJ". */
export const leadTime = {
  studioHours: 24,
  eventDays: 14,
  label: {
    studio: "Studio sessions need at least 24 hours' notice.",
    event: "DJ and event bookings need at least two weeks.",
  },
};

/* ── Availability (Q32) ─────────────────────────────────────────
   The only hard rule she gave: nothing between midnight and 8am. No
   days are excluded because she did not exclude any — the earlier
   build's "availability unknown" is now closed. */
export const availabilityKnown = true;
export const availability = {
  earliest: "08:00",
  latest: "23:59",
  closedNote: "Nothing between midnight and 8am.",
  daysOff: [] as string[],
};

/* ── Intake (Q29) ───────────────────────────────────────────────
   She answered "all" — every field becomes a required question, which
   is the whole point: she stops chasing this over text. Split by kind
   of booking so an artist is not asked about guest counts. */
export const intakeFields = {
  studio: [
    { id: "songs",      label: "How many songs or tracks?",              type: "number" },
    { id: "genre",      label: "Genre",                                  type: "text" },
    { id: "length",     label: "How long do you need?",                  type: "text" },
    { id: "beats",      label: "Do you have your beats ready?",          type: "yesno" },
    { id: "references", label: "Reference tracks",                       type: "text" },
    { id: "recorded",   label: "Have you recorded in a studio before?",  type: "yesno" },
    { id: "budget",     label: "Your budget",                            type: "text" },
    { id: "deadline",   label: "Your deadline",                          type: "text" },
    { id: "found",      label: "How did you find me?",                   type: "text" },
  ],
  event: [
    { id: "eventDate",  label: "Event date",                             type: "date" },
    { id: "venue",      label: "Venue",                                  type: "text" },
    { id: "guests",     label: "Guest count",                            type: "number" },
    { id: "venueSound", label: "Does the venue have sound?",             type: "yesno" },
    { id: "length",     label: "How long do you need?",                  type: "text" },
    { id: "budget",     label: "Your budget",                            type: "text" },
    { id: "found",      label: "How did you find me?",                   type: "text" },
  ],
};

/** Services that are scheduled around an EVENT rather than a studio session,
 *  so they get the event intake set. Single source of truth — book.astro
 *  reads this rather than keeping its own copy. */
export const eventSlugs = ["dj"];

/** A consult call is a free conversation, not a booked session. Asking it the
 *  full nine-question studio intake ("do you have your beats ready?", "your
 *  budget") is the friction the form exists to remove. */
export const noIntakeSlugs = ["consult"];

/** Which intake set a service uses: "studio", "event", or null for none. */
export const intakeFor = (slug: string): "studio" | "event" | null =>
  noIntakeSlugs.includes(slug) ? null
  : eventSlugs.includes(slug) ? "event"
  : "studio";

/* ── Where a request goes (Q33) ─────────────────────────────────
   She wants both email and a text. Neither is wired yet — no platform
   has been chosen. */
export const notify = { email: true, sms: true };

/** MOVED. The booking endpoint now lives in src/lib/booking-api.ts as
 *  BOOKING_ENDPOINT, next to the Busy-tab CSV URL, so both halves of the
 *  Sheet connection are in one file. This file is for LIZ'S ANSWERS —
 *  rates, hours, policies — and a URL is not one of those.
 *
 *  Kept as an empty export only so nothing that still imports it breaks
 *  silently. Delete once nothing does. */
export const bookingEndpoint = "";
