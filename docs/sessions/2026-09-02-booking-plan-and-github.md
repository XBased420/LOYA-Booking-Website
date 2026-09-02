# Session log — 2026-09-02

Booking architecture settled, a setup guide handed to Liz, and the project
finally has a backup.

---

## The booking system: how it works, and what it costs

X asked for a plan — clients paying on the site, Liz confirmed by email, a
public calendar, no double-booking, and her iPhone updating. Then, after
reading it, asked for the version that costs nothing.

### The finding that shaped everything

**Cash App on a website is Square.** Block owns both, and Cash App Pay is only
available to a business through Square's Web Payments SDK. There is no other
route. Which means the `$cashtag` she uses today cannot be automated at all —
personal Cash App has no API, so nothing can ask it "did $75 arrive, and who
from?" Every automatic piece depends on her opening a Square account.

### There is no free way to take a card

Stripe 2.9% + 30¢. Square 2.9–3.3% + 30¢. PayPal 3.49% + 49¢. Nobody is at 0%,
because the card networks charge the processor first. So "free" has exactly one
meaning here: **the money does not go through the website.**

### The architecture

Split the job. **The slot is automated and free; the money goes around the
outside.**

- **Square Appointments, free plan** holds the calendar, refuses a taken slot,
  and emails both parties. Because no money moves through Square, Square
  charges nothing at all.
- **Buyer-level `CreateBooking`** is the key detail: it is the mode where
  Square itself rejects a double-booking or an off-hours request, and it works
  on the free plan. Seller-level writes — the ones that *allow* double-booking
  — are the Plus-only feature, and we do not want them.
- **The deposit goes straight to her**: Zelle at $0.00, or a Cash App business
  link at 2.75% flat.
- **A nightly cron** releases any booking still unconfirmed after 24 hours, so
  the one manual step cannot strand a slot.
- Cloudflare Pages + Workers, 100k requests/day free — roughly 3,000× what this
  site will do.

**Running cost: $0.00/month, $0.00 per booking on Zelle.** The only number
that is not zero is a domain, ~$12–15/year.

### The trade, with the numbers

Full automation (cards on the site) costs ~3% per deposit — about $600/year at
twenty bookings a month. The free path costs Liz **ten seconds per booking**:
she taps confirm when the money lands. At her volume that is roughly three
minutes a month against $600 a year. Not close. Revisit at 100+ bookings/month.

### Two things flagged that are not website decisions

- **Her personal Cash App account breaks Cash App's terms.** Their stated
  position is that business activity on a personal account can mean frozen
  funds or a closed account. She is doing this now. Cash App for Business is
  free to switch to, keeps the same `$cashtag`, and costs 2.75%.
- **The public calendar should show open slots, not where she is.** X described
  it as "when she's in the office at the studio," which broadcasts a young
  woman's location and schedule permanently. Same booking benefit, none of the
  exposure — and no client's name or session type ever goes public.

Plan lives at the artifact `1c959eaf-b08c-45a5-932b-7d44173c4add`.

---

## Setup guide written for Liz

A Google Doc — *"Liz — Booking & Payments Setup (start here)"* — addressed to
her rather than to X. Cash App for Business first (10 min, and it is the urgent
one), Square Appointments second (25 min). Not an artifact: artifact links 404
for her on this account, which is a known constraint on this project.

Two translations worth recording, because they are decisions and not typing:

- **Recording becomes three fixed blocks** (2hr/$150, 3hr/$225, 4hr/$300).
  Square books time blocks, not hours-at-a-rate.
- **Mixing, mix + master, production and DJ do not go in the calendar.** They
  are not a slot — you do not know the day and time when someone asks for a
  mix. They stay as requests through the site form. This maps exactly onto the
  `direct: true / false` split already in `booking.ts`.

Also told her to skip Square's card-processing setup entirely, since no money
passes through Square. A bank account is not required to finish setup.

---

## The project is on GitHub

`github.com/XBased420/LOYA-Booking-Website` — **private**, commit `19c0b60`,
446 files, 128 MB.

**It was public and empty when X asked.** Pushing there would have published
her unreleased music, 119 photos, her employment history and her personal Gmail
— while `site.PUBLIC` is still `false` specifically because she has not
approved going live, and git history is permanent. Asked first; he made it
private.

### What took four attempts

- **The Cowork session cannot reach GitHub at all.** The git proxy refuses any
  repo not in "this session's authorized repository set", and the error tells
  the agent to call `add_repo` — **a tool that does not exist**. This is a
  known open bug, anthropics/claude-code#84581, filed 6 Aug 2026. There is no
  repo picker in Cowork either, so there was never a path where Claude does the
  push. Time was wasted offering one.
- **Git had no identity on the machine.** `Author identity unknown` → commit
  aborted → no `main` branch → `src refspec main does not match any`. Set
  `user.name` / `user.email` globally once and it went through. Used the GitHub
  noreply address so his real inbox is not written permanently into commit
  history — the repo may well go public later as a portfolio piece.

### What is in the repo

Excluded as generated or dead: `node_modules`, `dist`, `site/dist`,
`motion/out`, `_retired`, `graphify-out`, and a stray duplicate mp3 at the
root. A `.gitattributes` pins LF in the repo, CRLF for `.bat` files so cmd.exe
does not mis-parse them, and marks media binary — which also stopped the CRLF
warning spam.

`PUSHTOGITHUB.bat` in the project root is the whole workflow now: double-click,
type what changed, done. First version reused one commit message forever;
fixed to prompt, and to say so rather than make an empty commit when nothing
has changed.

---

## Risk: his OneDrive is full and the project is inside it

5.2 GB of 5 GB, over quota for more than a month, sync erroring. Microsoft's
policy on a frozen account is that after six months they may delete the
OneDrive and everything in it, non-recoverable.

`site/` alone is 374 MB, so the project is a large part of why he is over.
Moving `LoyaPersonalWebsite` out of OneDrive fixes three things at once: frees
enough space to unfreeze the account, ends the sync error, and removes the
OneDrive-versus-git corruption risk. GitHub is now the real backup, which is
what makes the move safe.

Still to do on his side: delete `site/_retired/_gh/` (127 MB of staging chunks
from the push) and move the folder out of OneDrive.
