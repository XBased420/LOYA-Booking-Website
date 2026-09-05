/* Static checks for Code.gs, which nothing else validates.
 *
 *   node sheets/check.mjs
 *
 * Apps Script has no build step and no tests, so a file that PARSES will
 * deploy happily and then fail at runtime. That is exactly what happened
 * on 2026-09-05: rewriting one function silently deleted an adjacent one,
 * `node --check` passed, the deploy succeeded, GET still worked, and every
 * real booking threw.
 *
 * So this checks the thing `node --check` cannot: that every helper the
 * code CALLS is a helper the code DEFINES.
 */
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const src   = readFileSync(new URL("./Code.gs", import.meta.url), "utf8");
const setup = readFileSync(new URL("./Setup.gs", import.meta.url), "utf8");
let fail = 0;
const ok = (n) => console.log("  ok   " + n);
const bad = (n, d) => { fail++; console.log("  FAIL " + n + "\n       " + d); };

/* Syntax. Necessary, and demonstrably not sufficient. */
const tmp = join(tmpdir(), "codegs-check.js");
writeFileSync(tmp, src);
try { execFileSync(process.execPath, ["--check", tmp]); ok("parses as JavaScript"); }
catch (e) { bad("parses as JavaScript", String(e.stderr || e)); }

/* Strip comments and string literals so we only read real code. */
const strip = (t) => t
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/\/\/.*/g, "")
  .replace(/'[^'\n]*'/g, "''")
  .replace(/"[^"\n]*"/g, '""');
const code = strip(src);

/* Apps Script puts every file in ONE global scope, so a helper defined
   in Code.gs is callable from Setup.gs. Resolve across both, or this
   reports false failures — and worse, would miss a real one. */
const setupCode = strip(setup);
const both = code + "\n" + setupCode;
const defined = new Set([...both.matchAll(/function\s+(\w+)\s*\(/g)].map((m) => m[1]));
const called  = new Set([...both.matchAll(/\b(\w+_)\s*\(/g)].map((m) => m[1]));

const missing = [...called].filter((c) => !defined.has(c));
if (missing.length) bad("every helper called is defined", "missing: " + missing.join(", "));
else ok("every helper called is defined (" + [...called].sort().join(", ") + ")");

/* The site and the script must agree on the columns, or values land in
   the wrong cells and nothing errors. */
/* From the RAW source — `code` has had its string literals blanked,
   which is where the column names live. */
const cols = src.match(/var COLUMNS\s*=\s*\[([\s\S]*?)\]/);
const siteSrc = readFileSync(new URL("../site/src/lib/booking-api.ts", import.meta.url), "utf8");
const siteCols = siteSrc.match(/BOOKING_COLUMNS\s*=\s*\[([\s\S]*?)\]/);
const norm = (blob) => (blob ? blob[1].match(/["']([a-z_]+)["']/g) || [] : []).map((x) => x.slice(1, -1));
const a = norm(cols), b = norm(siteCols);
if (a.length && a.join(",") === b.join(","))
  ok("COLUMNS matches BOOKING_COLUMNS (" + a.length + " columns)");
else bad("COLUMNS matches BOOKING_COLUMNS", "Code.gs: " + a.join(",") + "\n       site:    " + b.join(","));

/* checkSetup is the only pre-deploy gate, so it has to touch the helpers. */
for (const fn of ["stamp_", "to12h_", "overRateLimit_", "formatRow_"]) {
  const body = code.slice(code.indexOf("function checkSetup"), code.indexOf("function doPost"));
  if (body.includes(fn + "(")) ok("checkSetup exercises " + fn);
  else bad("checkSetup exercises " + fn, "add it, or a deletion goes unnoticed until a booking fails");
}

/* Setup.gs has to parse as well — same trap as before, a file that
   parses is a file that will happily deploy and then throw. */
const tmp2 = join(tmpdir(), "setupgs-check.js");
writeFileSync(tmp2, setup);
try { execFileSync(process.execPath, ["--check", tmp2]); ok("Setup.gs parses as JavaScript"); }
catch (e) { bad("Setup.gs parses as JavaScript", String(e.stderr || e)); }

/* THE INVARIANT THAT MATTERS. styleBookings_ and styleBusy_ touch the
   two tabs the booking system depends on, so they must be presentation
   ONLY. Any call that writes a value, clears a range or moves a row in
   those functions is a bug waiting to eat real bookings — Bookings row 1
   is the header checkSetup validates, and Busy!A2 is the formula the
   published CSV is built from. */
const banned = /\.(setValue|setValues|setFormula|setFormulas|clear|clearContent|clearContents|deleteRow|deleteRows|deleteColumn|insertRow|insertRows)\s*\(/;
for (const fn of ["styleBookings_", "styleBusy_"]) {
  const start = setupCode.indexOf("function " + fn);
  if (start < 0) { bad(fn + " exists", "not found"); continue; }
  const rest = setupCode.slice(start + 1);
  const nextFn = rest.indexOf("\nfunction ");
  const body = nextFn < 0 ? rest : rest.slice(0, nextFn);
  const hit = body.match(banned);
  if (hit) bad(fn + " is presentation-only", "writes data: " + hit[0]);
  else ok(fn + " is presentation-only (no value writes)");
}

console.log("\n" + (fail ? fail + " FAILED" : "all checks passed") + "\n");
process.exit(fail ? 1 : 0);
