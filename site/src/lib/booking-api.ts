/* ═══════════════════════════════════════════════════════════════
   Talking to the Google Sheet.

   Supabase is out. The Sheet is the database, because Liz confirms
   every booking by hand — her own "what happens next" is:
     1. You send the request.  2. I confirm the date and time.
     3. You pay a 50% deposit.
   A human is already the conflict resolver, so Postgres's exclusion
   constraint was guarding a race this workflow does not have. What a
   Sheet buys instead is that she can open, sort and edit it on her
   phone.

   THE RULE THAT FOLLOWS: the calendar on this site means "she's
   probably free then", NOT "this slot is yours". Nothing in here or
   on the page may promise otherwise. If booking ever becomes instant
   self-service, this goes back to a real database and
   supabase/schema.sql is kept for exactly that reason.

   Two directions, two mechanisms, deliberately independent:

     READ   published Busy tab -> CSV over HTTPS.  No script, no auth,
            served from Google's CDN. If the write path breaks, the
            calendar still works.

     WRITE  form -> Apps Script Web App -> appends a row to Bookings.
            If the read path breaks, requests still land.

   Make is not involved. It may be later, for payments and texts; the
   endpoint below is just a URL and swapping it for a Make webhook is
   a one-line change.
   ═══════════════════════════════════════════════════════════════ */

import { zonedToUtc } from "./slots.ts";
import type { Busy } from "./slots.ts";
import {
  bookableServices, rates, deposit, leadTime, availability,
} from "../data/booking.ts";

/* ═══ PASTE YOUR TWO URLS HERE ═══════════════════════════════════

   1. BUSY_CSV_URL
      Google Sheets -> File -> Share -> Publish to web.
      In the FIRST dropdown pick the "Busy" tab BY NAME. Not "Entire
      Document". In the second pick "Comma-separated values (.csv)".
      The URL you get looks like:
        https://docs.google.com/spreadsheets/d/e/2PACX-1vR.../pub?gid=123456&single=true&output=csv

      DO NOT use a /gviz/tq?tqx=out:csv URL instead. That one reads any
      tab you name, but only works if the whole document is shared, and
      "whole document" includes the Bookings tab — client names, emails
      and phone numbers on the open web. Publish-to-web on a single tab
      is the entire privacy design. Publishing the doc undoes it.

   2. BOOKING_ENDPOINT
      The Apps Script Web App /exec URL. See docs/sheet-setup.md.
      Deploy -> New deployment -> Web app -> Execute as: Me,
      Who has access: Anyone. It ends in /exec, not /dev.
      A /dev URL only works while YOU are logged in, so it will look
      fine to you and fail for every client.

   Both are safe in a public repo. The CSV URL exposes only the three
   columns of the Busy tab, which the calendar was about to draw
   anyway. The /exec URL can only append a row; it never reads back.  */

export const BUSY_CSV_URL     = "";
export const BOOKING_ENDPOINT = "";

/** Her timezone. Every time on the site is rendered in this, not the
 *  visitor's — a client in LA booking "2pm" means 2pm in Dallas. The
 *  Sheet is written in this timezone too, so what she reads on her
 *  phone is the wall clock she'll be standing in. */
export const STUDIO_TZ = "America/Chicago";

/** Read path ready? The calendar hides itself rather than throwing at
 *  a stranger when this is false. */
export const configured = () => BUSY_CSV_URL !== "";

/** Write path ready? Drives whether "Send request" is enabled. */
export const writeConfigured = () => BOOKING_ENDPOINT !== "";

/* ═══════════════════════════════════════════════════════════════
   SERVICES AND HOURS — from booking.ts, at build time

   These used to be two network reads. They are now plain objects,
   because booking.ts already holds Liz's real answers and a Sheet
   round-trip to re-learn what the repo already knows would be a
   network request that can fail for no gain.

   The shape is unchanged on purpose: AvailabilityCalendar.astro is
   storage-agnostic and must not need editing when storage changes.
   ═══════════════════════════════════════════════════════════════ */

export type Service = {
  slug: string;
  name: string;
  direct: boolean;
  hourly_cents: number | null;
  flat_cents: number | null;
  min_minutes: number | null;
  deposit_pct: number;
  lead_time_hours: number;
};

export type AvailabilityRow = { weekday: number; opens: string; closes: string };

/** A consult call is free and short, so it carries no deposit. */
const CONSULT_MIN =
  /* ⚠ PLACEHOLDER — 30 minutes is a guess, not Liz's answer. She has
     not said how long a consult call runs. Ask her before this goes
     live; it is the one number on this page she did not give us. */
  30;

const isEvent = (slug: string) => slug === "dj";

/** booking.ts -> the row shape the calendar expects. Money in cents so
 *  no float ever touches a price. */
function toService(s: (typeof bookableServices)[number]): Service {
  const hourly = s.slug === "recording" ? rates.studioHourly * 100 : null;
  const flat =
    s.slug === "mixing"     ? rates.mixPerSong * 100 :
    s.slug === "mix-master" ? rates.mixAndMasterPerSong * 100 :
    s.slug === "consult"    ? 0 :
    null;

  return {
    slug: s.slug,
    name: s.label,
    direct: s.direct,
    hourly_cents: hourly,
    flat_cents: flat,
    min_minutes:
      s.slug === "recording" ? rates.studioMinimumHours * 60 :
      s.slug === "consult"   ? CONSULT_MIN :
      null,
    /* A free consult cannot take 50% of nothing. */
    deposit_pct: s.slug === "consult" ? 0 : deposit.percent,
    lead_time_hours: isEvent(s.slug)
      ? leadTime.eventDays * 24
      : leadTime.studioHours,
  };
}

export const fetchServices = async (): Promise<Service[]> =>
  bookableServices.map(toService);

/** Her hours, seven days a week, from booking.ts.
 *
 *  ⚠ OPEN QUESTION, NOT A CODE DECISION. She said 8am–midnight, seven
 *  days (Q32), and she also said the problem is "I want to be able to
 *  rest knowing ppl won't blow up my phone" (Q22). Those two answers
 *  fight each other and the second one is the reason this site exists.
 *  Needs a text to her before it is baked in. Until then this reflects
 *  what she actually said, not what we think she meant. */
export const fetchAvailability = async (): Promise<AvailabilityRow[]> => {
  const days = [0, 1, 2, 3, 4, 5, 6].filter(
    (d) => !availability.daysOff.includes(String(d)),
  );
  return days.map((weekday) => ({
    weekday,
    opens: availability.earliest,
    closes: availability.latest,
  }));
};

/* ═══════════════════════════════════════════════════════════════
   BUSY — the one real network read
   ═══════════════════════════════════════════════════════════════ */

/** RFC 4180 CSV -> rows of fields.
 *
 *  Written out rather than `text.split(",")` because Google quotes any
 *  field containing a comma, and a note like "Studio A, back room" would
 *  otherwise become two fields and silently shift every column after it
 *  by one. Handles quoted commas, quoted newlines, "" escapes, and both
 *  CRLF and LF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  /* Strip a UTF-8 BOM: Google sometimes sends one, and it would end up
     glued to the first header name, so "date" never matches. */
  const s = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  for (let i = 0; i < s.length; i++) {
    const c = s[i];

    if (quoted) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; }   // "" -> literal "
        else quoted = false;
      } else field += c;
      continue;
    }

    if (c === '"')       { quoted = true; }
    else if (c === ",")  { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c === "\r") { /* CRLF: the \n does the work */ }
    else                 { field += c; }
  }
  /* Last field only counts if the file did not end on a newline. */
  if (field !== "" || row.length) { row.push(field); rows.push(row); }

  return rows;
}

/** Header name -> column index, matched by NAME not position.
 *  She will reorder these columns eventually. When she does, nothing
 *  here should break. */
function headerIndex(header: string[]): Record<string, number> {
  const idx: Record<string, number> = {};
  header.forEach((h, i) => {
    const key = h.trim().toLowerCase().replace(/\s+/g, "_");
    if (key && !(key in idx)) idx[key] = i;
  });
  return idx;
}

/** "14:00" | "2:00 PM" | "14:00:00" -> [14, 0], or null if it is not a
 *  time at all. Google renders a time cell differently depending on how
 *  the column is formatted and whether she typed it or a formula did, so
 *  all three shapes have to be read. */
export function parseClock(v: string): [number, number] | null {
  const t = String(v ?? "").trim();
  if (!t) return null;

  const m = t.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*([ap]\.?m\.?)?$/i);
  if (!m) return null;

  let h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min)) return null;
  if (min > 59) return null;

  const ampm = m[3]?.toLowerCase().replace(/\./g, "");
  if (ampm === "pm" && h < 12) h += 12;
  if (ampm === "am" && h === 12) h = 0;

  /* 24:00 is a legitimate way to write midnight-at-the-end-of-the-day. */
  if (h > 24) return null;
  return [h, min];
}

/** "2026-09-15" -> [2026, 9, 15], or null. Also accepts the M/D/YYYY
 *  that a US-locale Sheet produces when the column is formatted as a
 *  date rather than as plain text. */
export function parseDay(v: string): [number, number, number] | null {
  const t = String(v ?? "").trim();
  if (!t) return null;

  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3])];

  m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return [Number(m[3]), Number(m[1]), Number(m[2])];

  return null;
}

/** The published Busy tab -> busy ranges in epoch ms.
 *
 *  Every row is treated as hostile. A bad row is SKIPPED, never thrown
 *  on: one typo in one cell must not blank the whole calendar, because
 *  a blank calendar looks to a client exactly like "she has no time".
 *  Skipped rows are counted and warned about once. */
export function parseBusyCsv(text: string, tz: string): Busy[] {
  const rows = parseCsv(text);
  if (!rows.length) return [];

  const idx = headerIndex(rows[0]);
  const cDate = idx.date, cStart = idx.start, cEnd = idx.end;

  /* No usable header means we are looking at something that is not the
     Busy tab — a 404 page, or the doc's HTML if publishing was set up
     wrong. Returning [] is right; guessing at column positions is not. */
  if (cDate === undefined || cStart === undefined || cEnd === undefined) {
    console.warn(
      "[booking] Busy CSV has no date/start/end header. Got:", rows[0],
    );
    return [];
  }

  const out: Busy[] = [];
  let skipped = 0;

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    /* A blank line between blocks of rows is normal in a hand-edited
       sheet, and a formula-fed range emits trailing empties. */
    if (!row.length || row.every((c) => c.trim() === "")) continue;

    const day = parseDay(row[cDate]);
    const s = parseClock(row[cStart]);
    const e = parseClock(row[cEnd]);
    if (!day || !s || !e) { skipped++; continue; }

    const [y, mo, d] = day;
    const start = zonedToUtc(y, mo, d, s[0], s[1], tz);
    let end = zonedToUtc(y, mo, d, e[0], e[1], tz);

    /* An end at or before the start means the block runs past midnight
       — "22:00 to 00:00". Roll it to the next day rather than dropping
       it. Erring toward MORE busy time is the safe direction: the worst
       case is she is offered as unavailable when she was free, which she
       fixes in one tap. The other direction double-books her. */
    if (end <= start) end = zonedToUtc(y, mo, d + 1, e[0], e[1], tz);

    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      skipped++; continue;
    }
    out.push({ start, end });
  }

  if (skipped) {
    console.warn(`[booking] skipped ${skipped} unreadable row(s) in the Busy tab`);
  }
  return out;
}

/** Busy ranges overlapping [from, to).
 *
 *  `from`/`to` are accepted and applied here rather than being pushed
 *  into the request, because a published CSV is a whole file — there is
 *  no query string to narrow it. The signature is kept identical to the
 *  Supabase one so the calendar did not have to change. */
export async function fetchBusy(from: Date, to: Date): Promise<Busy[]> {
  if (!configured()) return [];

  const res = await fetch(BUSY_CSV_URL, { redirect: "follow" });
  if (!res.ok) throw new Error(`Busy CSV ${res.status}: ${res.statusText}`);

  const all = parseBusyCsv(await res.text(), STUDIO_TZ);
  const lo = from.getTime(), hi = to.getTime();
  return all.filter((b) => b.start < hi && lo < b.end);
}

/* ═══════════════════════════════════════════════════════════════
   WRITE — the form to the Bookings tab
   ═══════════════════════════════════════════════════════════════ */

/** Exactly the columns of the Bookings tab, in order. The Apps Script
 *  reads this list too, so adding a column is a change in two files and
 *  nowhere else. */
export const BOOKING_COLUMNS = [
  "date", "start", "end", "service", "name", "email", "phone",
  "status", "quoted", "deposit_paid", "balance_paid", "notes",
] as const;

export type BookingPayload = {
  date: string;          // yyyy-mm-dd, her local date
  start: string;         // HH:mm 24h, her local time
  end: string;           // HH:mm 24h, computed from the service length
  service: string;
  name: string;
  email: string;
  phone: string;
  status: string;
  quoted: string;        // hers to fill in — she quotes by hand
  deposit_paid: string;
  balance_paid: string;
  notes: string;
  /** Honeypot. A real person leaves this empty because it is not
   *  rendered; a bot fills every field it finds. */
  website: string;
};

/** "14:00" + 120 minutes -> "16:00". Wraps at midnight to "24:00" rather
 *  than "00:00", so the Sheet shows a 2-hour session ending after a
 *  10pm start as 22:00–24:00 and not as an end before its own start. */
export function addMinutes(clock: string, minutes: number): string {
  const p = parseClock(clock);
  if (!p) return "";
  const total = p[0] * 60 + p[1] + minutes;
  const h = Math.floor(total / 60), m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Everything the form collected -> one Bookings row.
 *
 *  `quoted`, `deposit_paid` and `balance_paid` are left EMPTY on
 *  purpose. She quotes by hand and takes the deposit by hand, and a
 *  number this code guessed sitting in her quote column is worse than a
 *  blank one — she would have to check whether she meant it.
 *
 *  balance_paid exists because nothing was tracking the 50% due on
 *  arrival, which was the gap in the old model. */
export function buildPayload(
  form: Record<string, string>,
  service: Service | undefined,
): BookingPayload {
  const date  = form.date  ?? "";
  const start = form.time  ?? "";
  const mins  = service?.min_minutes ?? 60;

  /* The intake answers, in the order the form asked them, as readable
     lines. One `notes` cell she can read on a phone beats nine columns
     that are empty for eight services out of nine. */
  const skip = new Set([
    "date", "time", "service", "name", "email", "phone", "project", "website",
  ]);
  const extras = Object.entries(form)
    .filter(([k, v]) => !skip.has(k) && String(v).trim() !== "")
    .map(([k, v]) => `${k}: ${v}`);

  const notes = [
    (form.project ?? "").trim(),
    ...extras,
  ].filter(Boolean).join("\n");

  return {
    date,
    start,
    end: start ? addMinutes(start, mins) : "",
    service: service?.name ?? form.service ?? "",
    name:  form.name  ?? "",
    email: form.email ?? "",
    phone: form.phone ?? "",
    /* NOT "confirmed". The Busy tab's formula pulls rows where status is
       confirmed, so anything written here that says confirmed would take
       a slot off her public calendar before she had even read it. */
    status: "pending",
    quoted: "",
    deposit_paid: "",
    balance_paid: "",
    notes,
    website: form.website ?? "",
  };
}

export type SubmitResult = { ok: boolean; error?: string };

/** POST one booking to the Apps Script Web App.
 *
 *  Content-Type is text/plain ON PURPOSE, and the body is a JSON string
 *  inside it. Sending application/json makes the browser send a CORS
 *  preflight OPTIONS request first, and an Apps Script web app cannot
 *  answer OPTIONS at all — there is no doOptions. The request dies
 *  before doPost is ever reached, with a console error that says
 *  nothing useful. text/plain is one of the three types that are exempt
 *  from preflight, so the POST goes straight through. Apps Script reads
 *  the body from e.postData.contents either way.
 *
 *  If this ever gets swapped for a Make webhook, text/plain is fine
 *  there too — do not "fix" it back to application/json. */
export async function submitBooking(p: BookingPayload): Promise<SubmitResult> {
  if (!writeConfigured()) {
    return { ok: false, error: "No booking endpoint is configured." };
  }

  try {
    const res = await fetch(BOOKING_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(p),
      redirect: "follow",   // Apps Script 302s to script.googleusercontent.com
    });

    if (!res.ok) return { ok: false, error: `Server said ${res.status}.` };

    /* The script replies with JSON. If that ever fails to parse we treat
       it as a failure and tell the client to email — the row may well
       have been written, so they might send it twice. That is the right
       way round: a duplicate request is an annoyance, a silently lost
       one costs Liz the booking. */
    const body = await res.json().catch(() => null);
    if (body && body.ok === false) {
      return { ok: false, error: String(body.error ?? "Rejected.") };
    }
    if (!body || body.ok !== true) {
      return { ok: false, error: "Unexpected reply from the booking script." };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Network error." };
  }
}
