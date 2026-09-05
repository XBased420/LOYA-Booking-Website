# Session log — 2026-09-04

The booking plan was replaced twice, then built. Phases 1 and 2 are done and
running against a real database.

---

## The plan changed, twice, and the second change was X's

Started the day on **Make**. Researched it properly and landed on a reframe:
Make is glue, not a calendar — it cannot hold or atomically reserve a slot, so
Google Calendar would own the slot and Make would own the paperwork.

Then X asked the better question: *"can we connect Square through Make, and
have that Square connected to Cash App?"* That turned out to matter, because
**Cash App Pay is a Square checkout method, not a Cash App integration.** Money
paid that way lands in a Square balance, and Make has real Square modules —
which closed the one hole in the Make plan, the manual "mark it paid" step.

Three separate things hide behind "connect Square to Cash App", and they have
three different answers:

| | |
|---|---|
| Clients pay **with** Cash App | Yes — native Square checkout, works on Appointments |
| Money lands **in** her Cash App | No — it lands in Square, same as a card |
| Square **pays out** to Cash App | Yes, but standard transfers only, up to 4 business days |

Then he asked for the version we build ourselves on free tools only. That is
what got built.

---

## The stack, and the one hard problem

**Astro on GitHub Pages + Supabase (Postgres + Edge Functions) + Stripe with
Cash App Pay + Resend.** $0/month, 2.9% + 30¢ per deposit.

GitHub Pages serves static files only, so the backend lives in Supabase Edge
Functions rather than moving hosts — X had already said he did not want to
adopt another platform to make this work.

A booking system has exactly one genuinely hard requirement: two people must
never get the same slot. Every check-then-insert has a gap between the check
and the insert. Postgres closes it in one line:

```sql
exclude using gist (during with &&) where (status <> 'cancelled')
```

`during` is a `tstzrange`; `&&` is overlap. No two live bookings may overlap,
enforced by the database, so concurrency cannot beat it. It handles her
different session lengths for free — a unique constraint on start time would
let a 4-hour and a 1-hour session collide.

Blackouts are rows in `bookings` with `service_slug = 'blocked'`, so one
constraint guards her dentist appointment as hard as a paid session.

---

## Phase 1 — the database

`supabase/schema.sql`, seeded entirely from `booking.ts`, which came from
Liz's own answers. Verified against a real Postgres 16 before it was handed
over: overlapping insert rejected with `23P01`, back-to-back insert accepted,
cancelled rows exempt, blocked time colliding with a session rejected.

X ran the gate himself and it failed correctly. The `DETAIL` line also proved
the timezone handling: he typed `15:00-05` and Postgres stored `20:00+00`.

**Two things reading the real data changed:**

- **The deposit design was wrong.** Her deposit is 50% of a total that depends
  on session length ($75/hr, 2hr minimum). A flat `deposit_cents` per service
  cannot express that, so the schema stores `hourly_cents` + `min_minutes` +
  `deposit_pct` and computes the deposit at booking time, server-side.
- **Only two services need slots.** `recording` and `consult` are
  `direct: true`; the other five are requests. That halved Phase 1's scope, and
  `consult` being free makes it the ideal end-to-end test later.

**A bug caught by testing, not by eye:** the first schema had the RLS policies
but not the table grants. On Supabase the anon role is pre-granted so it might
have worked; in vanilla Postgres it returned `permission denied for table
services`, which would have rendered an empty booking form.

---

## Phase 2 — live availability on the site

Four new files. No dependency added — Supabase's REST layer is plain HTTP and
this makes three calls, so `fetch` does it without ~30KB on every page load.

- `src/lib/slots.ts` — the slot maths. Pure functions, no DOM, no network.
- `src/lib/slots.test.ts` — 19 tests, run by hand with Node 22 type-stripping.
- `src/lib/booking-api.ts` — the three reads.
- `src/components/AvailabilityCalendar.astro` — the UI.

The browser only *suggests* slots; the database decides. If the maths is wrong
the worst case is someone picks a slot and is told it is taken — never a double
booking.

### Three real bugs

**`Date.parse` returns NaN on Postgres timestamps.** Postgres writes the zone
as `+00`; ISO wants `+00:00`. `Date.parse("...T19:00:00+00")` is NaN in V8. The
failure is silent: every busy range is dropped, so the calendar cheerfully
offers times she is already booked. Caught by a parser test.

**`min-width: auto` blew the layout out.** Grid and flex items refuse to shrink
below their widest child, so a 21-chip day strip pushed the form column out
under the sidebar and `overflow-x: auto` never engaged. Fixed with
`minmax(0, …)` on the tracks and `min-width: 0` down the chain.

**`[hidden]` was being overridden — found by X on the live site.** `hidden`
works through a user-agent rule, and any author rule that sets `display` beats
it. `.fs { display: grid }` meant *both* section-4 intake sets rendered for
every service: someone booking a mix was asked for a venue and a guest count.
`.out { display: block }` had the same problem, so the "here is what would be
sent" preview showed on page load. Same bug on `/contact`.

The agent's own test had passed because it checked `!element.hidden` — the
property it had just set — rather than computed display. It measured intent
instead of outcome. Retested by computed display across every service.

---

## OneDrive stopped being a nuisance and became the blocker

It has now caused five distinct failures:

1. Dehydrated `package.json`, `astro.config.mjs`, `tsconfig.json` to cloud-only
   placeholders, unreadable through the bridge.
2. Made git report 43 files as modified that it could not read
   (`fatal: cannot hash README.md`).
3. **Broke local builds entirely.** `REFRESHBUILD.bat` fails with
   *"An Application Control policy has blocked this file"* on
   `astro.win32-x64-msvc.node` — Windows refusing to load an unsigned native
   binary. It built fine on 31 Aug; the file has not changed, Windows' opinion
   of it has. `Unblock-File` did not clear it.
4. Still over quota, still erroring.
5. The project remains inside it.

**The WASM fallback is not a way out.** Both Astro's compiler and rolldown ship
`wasm32-wasi` bindings and `NAPI_RS_FORCE_WASI=1` to select them, which would
sidestep unsigned native code entirely. Tested it: the wasm binding does not
match the emnapi runtime Astro 7 pulls in — `napi_set_last_error: function
import requires a callable`. Dead end, recorded so nobody spends an evening on
it.

**Working arrangement until the folder moves:** GitHub Actions is the build
machine. It runs on Ubuntu where the policy does not exist, and it is the same
build that produces the deployed site.

---

## Booking page design

- **The hero was a full-bleed photo under an 88% white veil** — a whole screen
  of washed-out image before anyone reached the form. Now a 24rem framed
  photograph beside the heading. 366px tall instead of a full screen.
- **The audio player moved to bottom-right on desktop**, bottom-left on phones.
  It was sitting directly on the booking form's first field.
- Fixed a missing space where the agent's sentence butted against Liz's
  lead-time text.

---

## Open, and not code decisions

- **Her stated hours contradict her stated goal.** Q32 was "nothing between
  midnight and 8am", no days excluded — so 8am–midnight, seven days. Q22, on
  what the site is for: *"people calling me all the time — I want to be able to
  rest knowing ppl won't blow up my phone."* Publishing that window lets a
  stranger book her at 11:40pm on a Tuesday. Two of her own answers pointing
  opposite ways; worth one text before it is baked in.
- **Mixing and production get the full studio intake** — beats ready, reference
  tracks, have you recorded before. For someone sending a finished recording to
  be mixed, half of those do not apply.
- Buffer between sessions, and whose Stripe account (must be hers).
