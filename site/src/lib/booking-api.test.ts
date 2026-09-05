/* Tests for booking-api.ts.  Nothing imports this file, so it never
   ships — it exists to be run by hand:

     cd site
     node --experimental-strip-types src/lib/booking-api.test.ts

   Needs Node 22+.  Run it after ANY change to booking-api.ts.

   The Sheet is edited by a human on a phone. That is the whole threat
   model here: not an attacker, just Liz reordering columns, typing
   "2:00 PM" in one row and "14:00" in the next, leaving a blank line
   between two weeks, and writing a note with a comma in it. Every case
   below is one of those, and every one of them silently blanks the
   calendar if it is not handled — which to a client looks exactly like
   "she has no time available".                                        */

import {
  parseCsv, parseBusyCsv, parseClock, parseDay, addMinutes,
  buildPayload, BOOKING_COLUMNS, fetchServices,
} from "./booking-api.ts";

const TZ = "America/Chicago";
let pass = 0, fail = 0;

function check(name: string, got: unknown, want: unknown) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.log(`  FAIL ${name}\n       got  ${g}\n       want ${w}`); }
}

/** Busy ranges as readable local wall-clock, so a failure is legible. */
const show = (b: { start: number; end: number }) => {
  const f = (t: number) => new Intl.DateTimeFormat("en-US", {
    timeZone: TZ, month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(new Date(t)).replace(", ", " ");
  return `${f(b.start)}->${f(b.end)}`;
};

console.log("\n1. CSV parsing");

check("plain rows",
  parseCsv("a,b\n1,2\n"), [["a", "b"], ["1", "2"]]);

/* Google quotes any field containing a comma. Splitting on "," would
   shift every column after it by one, so the `end` column would be read
   out of the middle of somebody's note. */
check("quoted comma stays one field",
  parseCsv('a,b\n"Studio A, back room",2\n'),
  [["a", "b"], ["Studio A, back room", "2"]]);

check("escaped quote inside a quoted field",
  parseCsv('a\n"she said ""yes"""\n'),
  [["a"], ['she said "yes"']]);

check("newline inside a quoted field",
  parseCsv('a,b\n"line one\nline two",2\n'),
  [["a", "b"], ["line one\nline two", "2"]]);

check("CRLF line endings",
  parseCsv("a,b\r\n1,2\r\n"), [["a", "b"], ["1", "2"]]);

check("no trailing newline still yields the last row",
  parseCsv("a,b\n1,2"), [["a", "b"], ["1", "2"]]);

check("empty input is not a crash",
  parseCsv(""), []);

/* A BOM would glue itself to the first header name, so "date" would
   never match and the whole calendar would come back empty. */
check("UTF-8 BOM is stripped off the first header",
  parseCsv("﻿date,start\n2026-09-15,14:00\n")[0],
  ["date", "start"]);

console.log("\n2. clock and date shapes");

check("24h", parseClock("14:00"), [14, 0]);
check("24h with seconds", parseClock("14:00:00"), [14, 0]);
check("12h pm", parseClock("2:00 PM"), [14, 0]);
check("12h am", parseClock("9:30 am"), [9, 30]);
check("noon stays noon", parseClock("12:00 PM"), [12, 0]);
check("midnight 12am is hour 0", parseClock("12:00 AM"), [0, 0]);
check("dotted am/pm", parseClock("2:00 p.m."), [14, 0]);
check("24:00 is allowed (end of day)", parseClock("24:00"), [24, 0]);
check("garbage is null", parseClock("soon"), null);
check("empty is null", parseClock(""), null);
check("impossible minute is null", parseClock("14:99"), null);

check("ISO date", parseDay("2026-09-15"), [2026, 9, 15]);
check("US date from a date-formatted cell", parseDay("9/15/2026"), [2026, 9, 15]);
check("date garbage is null", parseDay("next tuesday"), null);

console.log("\n3. the hostile Busy tab");

/* Columns SHUFFLED (end, date, start — not the documented order), one
   junk row, one blank line, a quoted comma, mixed time formats, a
   trailing empty row. Everything a real sheet does. */
const hostile =
  'end,date,start\n' +
  '16:00,2026-09-15,14:00\n' +
  '\n' +                                        // blank line mid-file
  '5:00 PM,9/16/2026,3:00 PM\n' +               // US date + 12h clock
  'nope,2026-09-17,alsonope\n' +                // junk row
  '23:00,2026-09-18,21:00\n' +
  ',,\n';                                       // trailing empties

const busy = parseBusyCsv(hostile, TZ);

check("three good rows survive, junk does not", busy.length, 3);
check("columns are found by name, not position",
  busy.map(show),
  ["09/15 14:00->09/15 16:00",
   "09/16 15:00->09/16 17:00",
   "09/18 21:00->09/18 23:00"]);
check("ranges are ascending and non-empty",
  busy.every((b) => b.end > b.start), true);

check("a sheet with no usable header returns nothing, not junk",
  parseBusyCsv("foo,bar\n1,2\n", TZ), []);

check("an HTML error page instead of CSV returns nothing",
  parseBusyCsv("<!DOCTYPE html><html><body>Not found</body></html>", TZ), []);

check("header-only sheet is empty, not an error",
  parseBusyCsv("date,start,end\n", TZ), []);

/* Extra columns she added herself must be ignored, not break matching. */
check("unknown extra columns are ignored",
  parseBusyCsv(
    "date,who,start,end,note\n2026-09-15,Liz,14:00,16:00,\"mix, vocals\"\n", TZ,
  ).map(show),
  ["09/15 14:00->09/15 16:00"]);

check("header case and spacing do not matter",
  parseBusyCsv(" Date , Start , End \n2026-09-15,14:00,16:00\n", TZ).map(show),
  ["09/15 14:00->09/15 16:00"]);

console.log("\n4. midnight and DST");

/* 22:00 to 00:00 means "until midnight", not "a negative session".
   Dropping the row would offer her 22:00 while she is working. */
check("a block ending at midnight rolls to the next day",
  parseBusyCsv("date,start,end\n2026-09-15,22:00,00:00\n", TZ).map(show),
  ["09/15 22:00->09/16 00:00"]);

check("22:00 to 24:00 is the same two hours",
  parseBusyCsv("date,start,end\n2026-09-15,22:00,24:00\n", TZ)[0],
  parseBusyCsv("date,start,end\n2026-09-15,22:00,00:00\n", TZ)[0]);

/* US DST ends 2026-11-01. A busy block that morning must still be the
   wall-clock hours she wrote, not an hour out. */
const dst = parseBusyCsv("date,start,end\n2026-11-01,01:00,03:00\n", TZ);
check("a block across the DST fall-back is still 1am to 3am on the clock",
  dst.map(show), ["11/01 01:00->11/01 03:00"]);
check("...and is three real hours long, because 1am happens twice",
  (dst[0].end - dst[0].start) / 3_600_000, 3);

console.log("\n5. session end times");

check("2 hours from 14:00", addMinutes("14:00", 120), "16:00");
check("30 minutes from 09:45", addMinutes("09:45", 30), "10:15");
check("a late session ends at 24:00, never before its own start",
  addMinutes("22:00", 120), "24:00");
check("an unreadable start yields no end", addMinutes("", 120), "");

console.log("\n6. the Bookings row");

const services = await fetchServices();
const recording = services.find((s) => s.slug === "recording");
const dj        = services.find((s) => s.slug === "dj");

const studioForm = {
  service: "recording", date: "2026-09-15", time: "14:00",
  name: "Ada L", email: "ada@example.com", phone: "555-0100",
  project: "Two verses, need vocals tracked.",
  songs: "2", genre: "R&B", length: "2 hours", beats: "yes",
  references: "SZA", recorded: "no", budget: "300",
  deadline: "end of the month", found: "Instagram",
  website: "",
};

const row = buildPayload(studioForm, recording);

check("every Bookings column is present and spelled right",
  BOOKING_COLUMNS.every((c) => c in row), true);
check("the row carries no column the sheet does not have",
  Object.keys(row).filter((k) => k !== "website")
    .every((k) => (BOOKING_COLUMNS as readonly string[]).includes(k)), true);

check("date and start come straight from the form", [row.date, row.start],
  ["2026-09-15", "14:00"]);
/* A recording session is 2 hours minimum (booking.ts), so end is 16:00.
   If this ever reads 15:00 the minimum has been lost somewhere. */
check("end is computed from her 2-hour studio minimum", row.end, "16:00");
check("service is stored by her label, not the slug", row.service, "Recording session");

/* status must NOT be confirmed: the Busy tab pulls confirmed rows, so a
   new request marked confirmed would remove one of her public openings
   before she had even read it. */
check("a new request is pending, never confirmed", row.status, "pending");
check("quoted is left blank for her to fill", row.quoted, "");
check("deposit_paid is blank", row.deposit_paid, "");
check("balance_paid exists and is blank", row.balance_paid, "");

check("notes lead with the project description",
  row.notes.startsWith("Two verses, need vocals tracked."), true);
check("notes carry every intake answer",
  ["songs: 2", "genre: R&B", "beats: yes", "found: Instagram"]
    .every((line) => row.notes.includes(line)), true);
check("notes do not repeat the columns that have their own cell",
  ["ada@example.com", "555-0100"].some((v) => row.notes.includes(v)), false);

const djRow = buildPayload(
  { service: "dj", date: "2026-10-10", time: "20:00", name: "Ray",
    email: "r@example.com", phone: "555-0111", project: "Birthday set",
    eventDate: "2026-10-10", venue: "The Nines", guests: "80",
    venueSound: "yes", length: "3 hours", budget: "600", found: "friend",
    website: "" },
  dj,
);
check("a DJ request with no session length still produces a row",
  [djRow.date, djRow.start, djRow.status], ["2026-10-10", "20:00", "pending"]);
check("event intake lands in notes", djRow.notes.includes("venue: The Nines"), true);

/* An empty form must not throw — someone will hit this endpoint with
   curl, and the script should get a well-shaped row it can reject. */
const empty = buildPayload({}, undefined);
check("an empty form yields a well-shaped, empty row",
  BOOKING_COLUMNS.every((c) => typeof empty[c] === "string"), true);

console.log("\n7. services and hours from booking.ts");

check("recording is direct and priced by the hour",
  [recording?.direct, recording?.hourly_cents, recording?.min_minutes],
  [true, 7500, 120]);
check("a free consult carries no deposit",
  services.find((s) => s.slug === "consult")?.deposit_pct, 0);
check("a paid service carries her 50%",
  recording?.deposit_pct, 50);
check("DJ work gets her two-week lead time, in hours",
  dj?.lead_time_hours, 336);
check("studio work gets 24 hours",
  recording?.lead_time_hours, 24);
check("live sound is still not offered",
  services.some((s) => /live|sound|av/i.test(s.name)), false);

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
