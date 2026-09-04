/* ═══════════════════════════════════════════════════════════════
   Talking to Supabase.  Phase 2 — reads only.

   No client library.  Supabase's REST layer is plain HTTP and we make
   exactly three calls, so `fetch` does the job without adding ~30KB to
   every page load and a dependency to every build.
   ═══════════════════════════════════════════════════════════════ */

/* ── PASTE YOUR TWO VALUES HERE ─────────────────────────────────
   Supabase dashboard -> Project Settings -> API.

   YES, THESE BELONG IN THE PUBLIC REPO.  The anon key is designed to
   ship in browsers — it identifies the project, it does not grant
   anything. What it can touch is decided by row level security, which
   Phase 1 turned on: it can read `services` and `availability`, it can
   call `busy_times()`, and that is the entire list. It cannot read a
   client's name or email, and it cannot write anything at all.

   The key that DOES grant everything is `service_role`. That one never
   comes near this file, this repo, or your machine — it lives in
   Supabase Edge Function secrets from Phase 3 onward. If you ever find
   yourself pasting a key that starts with the words "service role",
   stop.                                                              */
export const SUPABASE_URL  = "https://yahqdrfdumjubptnddpg.supabase.co";
export const SUPABASE_ANON = "sb_publishable_tw6V3CUu8NQxfZ-Zes_QDw_tz7Y8QA3";

/** Her timezone. Every time on the site is rendered in this, not in the
 *  visitor's — a client in LA booking "2pm" means 2pm in Dallas. */
export const STUDIO_TZ = "America/Chicago";

/** True once the two values above have actually been filled in. Lets the
 *  page fail visibly and politely instead of throwing at a stranger. */
export const configured = () =>
  !SUPABASE_URL.startsWith("PASTE_") && !SUPABASE_ANON.startsWith("PASTE_");

/* Supabase is mid-migration between two key formats:
     - legacy `anon`, a JWT, starts "eyJ"
     - new `sb_publishable_...`, which is NOT a JWT
   Both are safe in a browser and both go in SUPABASE_ANON above. But
   sending a non-JWT as `Authorization: Bearer` makes the gateway try to
   parse it as a token and fail, so only send that header when the key
   actually is one. `apikey` is what identifies the project either way. */
const headers = () => {
  const h: Record<string, string> = {
    apikey: SUPABASE_ANON,
    "Content-Type": "application/json",
  };
  if (SUPABASE_ANON.startsWith("eyJ")) h.Authorization = `Bearer ${SUPABASE_ANON}`;
  return h;
};

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: headers() });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

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

/** Only active services, and only the columns the page uses. */
export const fetchServices = () =>
  get<Service[]>(
    "services?select=slug,name,direct,hourly_cents,flat_cents,min_minutes," +
    "deposit_pct,lead_time_hours&active=eq.true",
  );

export const fetchAvailability = () =>
  get<AvailabilityRow[]>("availability?select=weekday,opens,closes");

/** Busy ranges between two instants.
 *
 *  This is an RPC, not a table read, and that is the point: the anon key
 *  has no access to `bookings` at all. The function is `security definer`,
 *  so it reads the table on our behalf and hands back time ranges with
 *  every other column stripped. A visitor with devtools open learns when
 *  she is unavailable — which the calendar was about to show them anyway. */
export async function fetchBusy(from: Date, to: Date): Promise<{ start: number; end: number }[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/busy_times`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ from_ts: from.toISOString(), to_ts: to.toISOString() }),
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);

  /* Postgres serialises a tstzrange as a string:
       ["2026-10-01 19:00:00+00","2026-10-01 21:00:00+00")
     Brackets vary ( [ vs ( ), so match the two timestamps rather than
     trying to parse the range syntax. */
  const rows: { busy: string }[] = await res.json();
  const out: { start: number; end: number }[] = [];

  for (const row of rows) {
    const m = row.busy?.match(/"([^"]+)","([^"]+)"/);
    if (!m) continue;
    const start = pgTimestamp(m[1]);
    const end = pgTimestamp(m[2]);
    if (Number.isFinite(start) && Number.isFinite(end)) out.push({ start, end });
  }
  return out;
}

/** Postgres timestamp text -> epoch ms.
 *
 *  Do not shortcut this to `Date.parse(s.replace(" ", "T"))`. Postgres
 *  writes the zone as "+00", and `Date.parse("...T19:00:00+00")` returns
 *  NaN in V8 — ISO wants "+00:00". The failure is silent and nasty: every
 *  busy range is dropped, so the calendar cheerfully offers times she is
 *  already booked for. Caught by test, not by eye.                      */
export function pgTimestamp(s: string): number {
  let t = String(s).trim().replace(" ", "T");
  t = t.replace(/\.(\d{3})\d+/, ".$1");          // microseconds -> millis
  t = t.replace(/([+-]\d{2})(\d{2})$/, "$1:$2");  // +0500 -> +05:00
  t = t.replace(/([+-]\d{2})$/, "$1:00");         // +05   -> +05:00
  return Date.parse(t);
}
