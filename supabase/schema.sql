-- ═══════════════════════════════════════════════════════════════
-- Loya booking — database schema.  Phase 1 of the build plan.
-- Paste this whole file into the Supabase SQL editor and run it once.
--
-- Every rate, deposit rule and lead time below comes from
-- site/src/data/booking.ts, which came from Liz's own answers.
-- Nothing here is invented.
-- ═══════════════════════════════════════════════════════════════

create extension if not exists btree_gist;


-- ── Services ──────────────────────────────────────────────────
-- `direct` mirrors booking.ts: only recording + consult take a real
-- slot.  Everything else is a request she answers by hand, so it
-- never touches the calendar.
--
-- Her deposit is 50% of the TOTAL, and the total depends on how long
-- the session is.  So price is stored as a rate, not a fixed amount,
-- and the deposit is computed at booking time.
create table services (
  slug            text primary key,
  name            text        not null,
  direct          boolean     not null default false,
  hourly_cents    int,                 -- time-based work
  flat_cents      int,                 -- fixed-price work
  min_minutes     int,                 -- her stated minimum
  deposit_pct     int         not null default 50,
  lead_time_hours int         not null default 24,
  active          boolean     not null default true
);

insert into services
  (slug, name, direct, hourly_cents, flat_cents, min_minutes, deposit_pct, lead_time_hours) values
  ('recording',   'Recording session',  true,  7500, null,  120, 50,  24),
  ('consult',     'Consult call',       true,     0,    0,   30,  0,  24),
  ('mixing',      'Mixing',             false, null, 7500, null, 50,  24),
  ('mix-master',  'Mix + master',       false, null,10000, null, 50,  24),
  ('production',  'Music production',   false, null, null, null, 50,  24),
  ('dj',          'DJ / event booking', false, null, null, null, 50, 336),  -- 14 days
  ('other',       'Something else',     false, null, null, null, 50,  24),
  ('blocked',     'Blocked time',       false, null, null, null,  0,   0);
  -- 'blocked' is not a service anyone can book.  It exists so her own
  -- time off is a row in `bookings`, guarded by the same constraint as
  -- a paid session.  One rule protects everything.


-- ── Weekly hours ──────────────────────────────────────────────
-- From Q32: "nothing between midnight and 8am", no days excluded.
-- CONFIRM WITH HER before going live — see the note in the plan.
create table availability (
  id      bigserial primary key,
  weekday int  not null check (weekday between 0 and 6),  -- 0 = Sunday
  opens   time not null,
  closes  time not null
);

insert into availability (weekday, opens, closes)
select g, time '08:00', time '23:59' from generate_series(0,6) g;


-- ── Bookings ──────────────────────────────────────────────────
create table bookings (
  id                uuid primary key default gen_random_uuid(),
  service_slug      text        not null references services(slug),
  during            tstzrange   not null,
  status            text        not null default 'held'
                    check (status in ('held','confirmed','cancelled')),
  client_name       text,
  client_email      text,
  client_phone      text,
  intake            jsonb       not null default '{}'::jsonb,
  quoted_cents      int,        -- what the session costs in total
  deposit_cents     int,        -- what we actually charged now
  stripe_session_id text,
  hold_expires_at   timestamptz,
  created_at        timestamptz not null default now(),

  -- ═══ THE LINE ═══
  -- No two live bookings may overlap.  Enforced by Postgres itself,
  -- so two simultaneous requests cannot both win.  Violations raise
  -- SQLSTATE 23P01, which create-booking catches and turns into a
  -- polite "that slot just went".
  exclude using gist (during with &&) where (status <> 'cancelled')
);

create index bookings_during_idx on bookings using gist (during);
create index bookings_status_idx on bookings (status);


-- ── Lock everything down ──────────────────────────────────────
-- No anon policies at all: the public key can read nothing directly.
-- Reads go through busy_times() below; writes go through Edge
-- Functions using the service_role key, which never leaves Supabase.
alter table bookings     enable row level security;
alter table services     enable row level security;
alter table availability enable row level security;

-- Services and hours ARE public — the site needs them to draw the form.
create policy services_public_read on services
  for select to anon using (active = true);
create policy availability_public_read on availability
  for select to anon using (true);

-- RLS decides which ROWS you may see; table grants decide whether you may
-- look at all.  Supabase pre-grants the anon role on public tables, so be
-- explicit rather than inheriting whatever the defaults happen to be.
-- Verified 2026-09-04 against Postgres 16: without these, anon gets
-- "permission denied for table services" and the booking form renders empty.
revoke all on bookings from anon;
grant select on services     to anon;
grant select on availability to anon;


-- ── The only window into bookings ─────────────────────────────
-- Returns busy time ranges and nothing else.  No names, no emails,
-- no amounts.  Someone reading this with devtools open learns only
-- when she is unavailable, which is the same thing the calendar
-- shows them anyway.
create or replace function public.busy_times(from_ts timestamptz, to_ts timestamptz)
returns table (busy tstzrange)
language sql
security definer
set search_path = public
as $$
  select b.during
  from bookings b
  where b.status <> 'cancelled'
    and b.during && tstzrange(from_ts, to_ts)
$$;

revoke all on function public.busy_times(timestamptz, timestamptz) from public;
grant execute on function public.busy_times(timestamptz, timestamptz) to anon;


-- ── Release abandoned checkouts ───────────────────────────────
-- A held slot that never got paid for goes back on the calendar.
-- Without this, one person closing a tab removes a slot forever.
-- pg_cron must exist before this runs.  Enable it FIRST in the dashboard:
--   Integrations -> Cron -> Enable pg_cron
-- (The SQL editor may run this whole file in one transaction, so a failure
--  here would roll back every table above it.  Enable it first and this
--  line is a no-op.)
create extension if not exists pg_cron;

select cron.schedule('expire-holds', '*/5 * * * *', $$
  update bookings
     set status = 'cancelled'
   where status = 'held'
     and hold_expires_at < now()
$$);


-- ═══════════════════════════════════════════════════════════════
-- PHASE 1 GATE — run these two inserts by hand.  The FIRST must
-- succeed.  The SECOND must fail with:
--     ERROR: conflicting key value violates exclusion constraint
--     SQLSTATE: 23P01
-- If the second one succeeds, STOP.  Nothing built on top is safe.
-- ═══════════════════════════════════════════════════════════════
--
-- insert into bookings (service_slug, during, status, client_name)
-- values ('recording',
--   tstzrange('2026-10-01 14:00-05', '2026-10-01 16:00-05'),
--   'confirmed', 'Gate test A');
--
-- insert into bookings (service_slug, during, status, client_name)
-- values ('recording',
--   tstzrange('2026-10-01 15:00-05', '2026-10-01 17:00-05'),  -- overlaps by 1hr
--   'confirmed', 'Gate test B');   -- <- MUST FAIL
--
-- clean up after:
-- delete from bookings where client_name like 'Gate test%';
