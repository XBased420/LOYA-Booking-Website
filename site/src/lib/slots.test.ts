/* Tests for slots.ts.  Nothing imports this file, so it never ships —
   it exists to be run by hand:

     cd site
     node --experimental-strip-types src/lib/slots.test.ts

   Needs Node 22+.  Run it after ANY change to slots.ts.  Every case in
   here is a bug that would otherwise show up as "why did it offer that
   time?" three weeks from now with a real client on the phone.        */

import { openSlots, zonedToUtc, zonedParts, groupByDay } from "./slots.ts";
import type { Rule, Busy } from "./slots.ts";

const TZ = "America/Chicago";
let pass = 0, fail = 0;

function check(name: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.log(`  FAIL ${name}\n       got  ${g}\n       want ${w}`); }
}

const label = (t: number) =>
  new Intl.DateTimeFormat("en-US", {
    timeZone: TZ, month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(new Date(t));

const allDays: Rule[] = Array.from({ length: 7 }, (_, w) => ({
  weekday: w, opens: "08:00:00", closes: "23:59:00",
}));

console.log("\n1. timezone conversion");

/* 2026-10-01 15:00 Central (CDT, UTC-5) === 20:00 UTC.  This is the exact
   conversion Postgres did in the Phase 1 gate — the DETAIL line of that
   error said 20:00+00. If this test ever fails, the page and the database
   have started disagreeing about what "3pm" means. */
check("Oct 1 15:00 CDT -> 20:00 UTC",
  new Date(zonedToUtc(2026, 10, 1, 15, 0, TZ)).toISOString(),
  "2026-10-01T20:00:00.000Z");

check("Nov 15 15:00 CST -> 21:00 UTC",
  new Date(zonedToUtc(2026, 11, 15, 15, 0, TZ)).toISOString(),
  "2026-11-15T21:00:00.000Z");

check("weekday of 2026-10-01 is Thursday(4)",
  zonedParts(zonedToUtc(2026, 10, 1, 12, 0, TZ), TZ)[3], 4);

console.log("\n2. a booking removes exactly the overlapping starts");

const now = zonedToUtc(2026, 9, 30, 9, 0, TZ);
const busy: Busy[] = [{
  start: zonedToUtc(2026, 10, 1, 14, 0, TZ),
  end:   zonedToUtc(2026, 10, 1, 16, 0, TZ),
}];

const slots = openSlots({
  rules: allDays, busy, durationMin: 120, stepMin: 60,
  leadHours: 24, days: 2, now, tz: TZ,
});
const oct1 = slots.filter((t) => zonedParts(t, TZ)[2] === 1).map(label);

check("13:00 blocked (would run into the booking)", oct1.includes("10/01, 13:00"), false);
check("14:00 blocked", oct1.includes("10/01, 14:00"), false);
check("15:00 blocked", oct1.includes("10/01, 15:00"), false);
check("12:00 open (ends exactly at 14:00)", oct1.includes("10/01, 12:00"), true);
check("16:00 open (starts exactly as booking ends)", oct1.includes("10/01, 16:00"), true);

console.log("\n3. closing time is respected");

check("22:00 not offered for a 2hr session", oct1.includes("10/01, 22:00"), false);
check("21:00 IS offered", oct1.includes("10/01, 21:00"), true);
check("nothing before 08:00", oct1.some((s) => s < "10/01, 08:00"), false);

console.log("\n4. lead time");

const soon = openSlots({
  rules: allDays, busy: [], durationMin: 120, stepMin: 60,
  leadHours: 24, days: 3, now, tz: TZ,
});
check("nothing inside the 24hr lead window",
  soon.every((t) => t >= now + 24 * 3600_000), true);
check("no slots at all on the day itself",
  soon.some((t) => zonedParts(t, TZ)[2] === 30), false);

const event = openSlots({
  rules: allDays, busy: [], durationMin: 120, stepMin: 60,
  leadHours: 336, days: 20, now, tz: TZ,
});
check("14-day lead pushes the first slot past Oct 14",
  new Date(event[0]).toISOString().slice(0, 10) >= "2026-10-14", true);

console.log("\n5. DST — the fall-back weekend");

/* 2026-11-01 is the US fall-back. A naive "add 24h" walk drifts an hour
   here and starts offering 07:00 slots. Walking calendar dates must not. */
const dstNow = zonedToUtc(2026, 10, 29, 9, 0, TZ);
const across = openSlots({
  rules: allDays, busy: [], durationMin: 60, stepMin: 60,
  leadHours: 24, days: 6, now: dstNow, tz: TZ,
});
const hours = new Set(across.map((t) =>
  new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "2-digit", hour12: false })
    .format(new Date(t))));
check("no slot before 08:00 anywhere across the DST change",
  [...hours].every((h) => Number(h) >= 8), true);
check("Nov 1 itself still has slots",
  across.some((t) => { const [, mo, d] = zonedParts(t, TZ); return mo === 11 && d === 1; }), true);

console.log("\n6. a day with no rule is closed");

const weekdaysOnly: Rule[] = [1, 2, 3, 4, 5].map((w) => ({
  weekday: w, opens: "10:00:00", closes: "18:00:00",
}));
const wk = openSlots({
  rules: weekdaysOnly, busy: [], durationMin: 60, stepMin: 60,
  leadHours: 24, days: 14, now, tz: TZ,
});
check("no weekend slots when no weekend rule exists",
  wk.every((t) => { const wd = zonedParts(t, TZ)[3]; return wd !== 0 && wd !== 6; }), true);

console.log("\n7. grouping");

const grouped = groupByDay(slots, TZ);
check("grouped keys are ISO dates",
  [...grouped.keys()].every((k) => /^\d{4}-\d{2}-\d{2}$/.test(k)), true);
check("every slot survives grouping",
  [...grouped.values()].reduce((n, v) => n + v.length, 0), slots.length);

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
