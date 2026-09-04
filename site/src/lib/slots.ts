/* ═══════════════════════════════════════════════════════════════
   Slot maths.  Phase 2.

   Pure functions only — no DOM, no network, no Supabase.  That is
   deliberate: this is the one piece with real logic in it, so it is
   the one piece worth being able to test on its own.  See slots.test.ts.

   IMPORTANT: nothing in here is trusted.  The browser works out what
   *looks* open so the page has something to draw; the database decides
   what actually is, via the exclusion constraint.  If this file is
   wrong the worst case is a client picks a slot and is told it is
   taken — never a double booking.
   ═══════════════════════════════════════════════════════════════ */

/** A row from `availability`. `opens`/`closes` are Postgres `time`
 *  values, which arrive over the REST API as "08:00:00". */
export type Rule = { weekday: number; opens: string; closes: string };

/** A busy range in epoch milliseconds, half-open: [start, end). */
export type Busy = { start: number; end: number };

export type SlotQuery = {
  rules: Rule[];
  busy: Busy[];
  /** How long the session runs. */
  durationMin: number;
  /** Granularity of offered start times, e.g. 60 = on the hour. */
  stepMin: number;
  /** Her lead time for this service, in hours. */
  leadHours: number;
  /** How many days ahead to offer. */
  days: number;
  /** Now, epoch ms. Passed in rather than read, so tests are deterministic. */
  now: number;
  /** Her timezone. Everything is computed in HER local time, not the
   *  visitor's — a client in Los Angeles must see Dallas hours. */
  tz: string;
};

const MIN = 60_000;

/* ── Timezone helpers ───────────────────────────────────────────
   No date library. Intl already knows every timezone rule including
   DST, so we ask it rather than shipping 70KB to re-derive it. */

/** How far ahead of UTC `tz` is at this instant, in ms. */
function offsetAt(utcMs: number, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(new Date(utcMs));

  const f: Record<string, number> = {};
  for (const p of parts) if (p.type !== "literal") f[p.type] = Number(p.value);

  /* Some engines report midnight as hour 24; % 24 normalises it. */
  const asIfUtc = Date.UTC(f.year, f.month - 1, f.day, f.hour % 24, f.minute, f.second);
  return asIfUtc - utcMs;
}

/** The instant at which the wall clock in `tz` reads the given local time.
 *
 *  Two passes: the first offset is a guess taken at the wrong instant, the
 *  second corrects it. That matters exactly twice a year — on a DST
 *  boundary a one-pass version lands an hour out, which would silently
 *  offer 7am slots on the wrong morning. */
export function zonedToUtc(
  y: number, mo: number, d: number, hh: number, mm: number, tz: string,
): number {
  const naive = Date.UTC(y, mo - 1, d, hh, mm);
  const first = naive - offsetAt(naive, tz);
  return naive - offsetAt(first, tz);
}

/** Calendar date in `tz` for an instant, as [year, month, day, weekday]. */
export function zonedParts(utcMs: number, tz: string): [number, number, number, number] {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short",
  }).formatToParts(new Date(utcMs));

  const f: Record<string, string> = {};
  for (const p of parts) if (p.type !== "literal") f[p.type] = p.value;

  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(f.weekday);
  return [Number(f.year), Number(f.month), Number(f.day), wd];
}

/** "08:00:00" or "08:00" -> [8, 0] */
function hhmm(t: string): [number, number] {
  const [h, m] = t.split(":");
  return [Number(h), Number(m)];
}

/* ── The actual work ────────────────────────────────────────────── */

/** Open start times, epoch ms, ascending.
 *
 *  A slot is offered when all four hold:
 *    - it sits inside her hours for that weekday
 *    - the whole session fits before closing
 *    - it starts at or after now + lead time
 *    - it overlaps nothing already booked or blocked
 */
export function openSlots(q: SlotQuery): number[] {
  const byWeekday = new Map<number, Rule[]>();
  for (const r of q.rules) {
    const list = byWeekday.get(r.weekday) ?? [];
    list.push(r);
    byWeekday.set(r.weekday, list);
  }

  const earliest = q.now + q.leadHours * 60 * MIN;
  const durMs = q.durationMin * MIN;
  const out: number[] = [];

  for (let dayOffset = 0; dayOffset < q.days; dayOffset++) {
    /* Step a day at a time from today's calendar date in HER timezone.
       Adding 24h to an instant would drift by an hour across a DST
       change; walking the calendar date cannot. */
    const [y, mo, d] = zonedParts(q.now + dayOffset * 24 * 60 * MIN, q.tz);
    const noonish = zonedToUtc(y, mo, d, 12, 0, q.tz);
    const [yy, mm2, dd, weekday] = zonedParts(noonish, q.tz);

    for (const rule of byWeekday.get(weekday) ?? []) {
      const [oh, om] = hhmm(rule.opens);
      const [ch, cm] = hhmm(rule.closes);

      const opensAt = zonedToUtc(yy, mm2, dd, oh, om, q.tz);
      const closesAt = zonedToUtc(yy, mm2, dd, ch, cm, q.tz);

      for (let t = opensAt; t + durMs <= closesAt; t += q.stepMin * MIN) {
        if (t < earliest) continue;
        const end = t + durMs;
        /* Half-open on both sides, so a session ending exactly when
           another starts is not a clash. Matches the tstzrange the
           database is using, which is the whole point. */
        const clash = q.busy.some((b) => t < b.end && b.start < end);
        if (!clash) out.push(t);
      }
    }
  }

  out.sort((a, b) => a - b);
  return out;
}

/** Group slot instants by their calendar date in `tz`, preserving order. */
export function groupByDay(slots: number[], tz: string): Map<string, number[]> {
  const days = new Map<string, number[]>();
  for (const t of slots) {
    const [y, mo, d] = zonedParts(t, tz);
    const key = `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const list = days.get(key) ?? [];
    list.push(t);
    days.set(key, list);
  }
  return days;
}
