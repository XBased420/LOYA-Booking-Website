# Connecting the Google Sheet

Do these in order. It takes about 15 minutes. At the end you paste two
URLs into `site/src/lib/booking-api.ts` and push.

Nothing here needs Make, Supabase, or a paid anything.

---

## The shape of it

```
    the booking page                        the Sheet
    ────────────────                        ─────────

    calendar  ──── reads ────►  Busy tab (published as CSV)
                                     ▲
                                     │ formula, status = confirmed
                                     │
    form  ──── POSTs ────►  Apps Script  ──── appends ────►  Bookings tab
                                  │                          (private)
                                  └──── emails ────►  Liz
```

Two directions, two mechanisms, on purpose. If the script breaks the
calendar still works. If the CSV goes stale requests still land.

**The Busy tab is published. The Bookings tab is not.** That separation
is the whole privacy design: Bookings holds client names, emails and
phone numbers, and publishing the whole document would put all of it on
the open web where anyone can read it. Publish the Busy tab and nothing
else, ever.

---

## 1. The Sheet

**This already exists.** Built and verified 2026-09-05:

> **Loya Bookings — Database**
> `https://docs.google.com/spreadsheets/d/1-dShzzhGAPyl2OJunaF8RpZ9JVAQMyrQ7EKNPHNb8c8/edit`

Both tabs are in place, the formula is in and tested (a `confirmed` row
appears in Busy within seconds; flipping it to `pending` removes it
again). The rest of this section is what it contains, so you can rebuild
it or check it.

### Tab 1 — `Bookings`

Row 1, one header per cell, exactly these twelve names in this order:

```
date  start  end  service  name  email  phone  status  quoted  deposit_paid  balance_paid  notes
```

Then add one more header in column M: `received`. The script writes the
arrival time there. It is not in the twelve because the website does not
send it and must not be able to fake it.

`balance_paid` is the column that was missing before: the 50% due on
arrival was not being tracked anywhere.

### Display formats (already applied)

`start` and `end` are shown as **12-hour with AM/PM**, and `received` as
`yyyy-mm-dd h:mm AM/PM`. Applied via Format → Number → Custom number
format, using `h:mm AM/PM` and `yyyy-mm-dd h:mm AM/PM`.

**This is display only, and that distinction is the whole point.** The
cells still hold time VALUES. The Busy tab reads those values with
`TEXT(...,"HH:mm")`, which ignores the display format, so the published
CSV stays 24-hour no matter how the Bookings tab is formatted.

Verified: with Bookings showing `2:00 PM` / `2:30 PM`, the Busy tab
emits `14:00` / `14:30`. Keep it that way. The site's parser does
understand `2:00 PM` — there are tests for it — but there is no reason
to put an AM/PM ambiguity into a machine feed nobody reads.

### Tab 2 — `Busy`

Add a second tab named exactly `Busy`. Row 1:

```
date  start  end
```

In `A2`, one formula that fills the whole tab from confirmed bookings:

```
=IFERROR(ARRAYFORMULA(TEXT(QUERY(Bookings!A2:L,"select A, B, C where H = 'confirmed'",0),{"yyyy-mm-dd","HH:mm","HH:mm"})),"")
```

`H` is the `status` column. If you reorder the Bookings columns, this
letter changes — that is the one place column ORDER still matters.

Leave the rest of the tab empty. The formula fills it.

> **Why the `TEXT(...)` wrapper, which looks like noise.** It is not.
> `QUERY` returns VALUES, not what you see on screen. A cell showing
> `2026-09-15` is really the number `46280` (days since 1899), and
> `14:00` is really `0.58333` (a fraction of a day). The Bookings tab
> formats them back into something readable; the Busy tab does not, so a
> bare `QUERY` fills Busy with `46280`, `0.5833`, `0.6667` — and that is
> what gets published as CSV.
>
> The site would then reject every row as unparseable, drop every busy
> block, and **offer clients times she is already booked for.** Silently.
> No error anywhere.
>
> `TEXT(...)` forces real strings out, so the CSV says `2026-09-15` and
> `14:00` no matter how anyone has formatted the Bookings tab. This was
> caught by building the sheet and looking at it, not by reasoning about
> it — the bare `QUERY` version was in this document first.

---

## 2. Publish only the Busy tab

**File → Share → Publish to web.**

- First dropdown: pick **Busy**. *Not* "Entire Document."
- Second dropdown: **Comma-separated values (.csv)**
- Publish. Copy the URL.

It looks like:

```
https://docs.google.com/spreadsheets/d/e/2PACX-1vR....../pub?gid=123456&single=true&output=csv
```

> **The trap.** There is another way to get CSV out of a Sheet, a URL
> with `/gviz/tq?tqx=out:csv` in it. It works, it is shorter, and every
> tutorial suggests it — but it only works if the whole document is
> shared, and "whole document" includes the Bookings tab. Using it would
> put every client's name, email and phone number on the open web.
> Publish-to-web on a single tab is the entire privacy design. Do not
> swap it for gviz.

Check it: paste the URL into a private window. You should see three
columns of times and nothing else. If you see a name or an email
address, stop — you published the wrong thing. Go back to Publish to web
and hit **Stop publishing** before doing anything else.

---

## 3. The Apps Script

> **Do NOT use Extensions → Apps Script.** It does not work on this
> machine. Two Google accounts are signed into Chrome —
> `calipxavier@gmail.com` and `calipxj@gmail.com` — and the Sheet is
> owned by the second. Sheets builds a `/macros/u/1/` link and
> `script.google.com` answers it with *"Sorry, unable to open the file
> at this time."* Signing in to the right account on
> `script.google.com` first does not fix it; neither does calling the
> redirect target directly. That is why the script opens the sheet by
> ID instead of being bound to it.

Go to **[script.google.com/u/1/home](https://script.google.com/u/1/home)**
— note the `/u/1/`, that is the `calipxj` account — and click
**New project**.

Delete whatever is in `Code.gs` and paste the whole of
[`sheets/Code.gs`](../sheets/Code.gs) from this repo. Rename the project
to something you will recognise (top left, "Untitled project"). Save.

`SHEET_ID` at the top is already filled in with the real sheet.
`NOTIFY_EMAIL` is pointed at X while testing — switch it to
`liznloya@gmail.com` once a real booking has gone through, or `''` for
no email.

### Run `checkSetup` first

In the toolbar, pick **checkSetup** from the function dropdown and press
**Run**. Authorise when asked (*"Google hasn't verified this app"* →
**Advanced** → **Go to … (unsafe)** → **Allow** — it is your own script,
written a minute ago).

The execution log should say the spreadsheet name, the tab, and
`Headers: all 12 correct`. If it says MISMATCH it tells you exactly
which column is wrong.

Doing this before deploying means the authorisation prompt happens while
you are looking at the editor, and any wrong ID or renamed tab shows up
in two seconds instead of as a client's booking silently vanishing.

### Deploy it

**Deploy → New deployment → gear icon → Web app.**

- Description: anything
- **Execute as: Me**
- **Who has access: Anyone**

"Anyone" sounds alarming and is not. It means anyone can POST a booking
request — which is the point, clients are strangers. They cannot read
the Sheet; the script only ever appends.

Authorise it. Google will show an "unverified app" warning because you
wrote it five minutes ago: **Advanced → Go to (project) (unsafe)**. It
is your own script.

Copy the Web app URL. It ends in **`/exec`**.

> If it ends in `/dev` you copied the test URL. That one only works
> while *you* are signed in, so it will look perfect to you and fail for
> every client. It must be `/exec`.

Check it: open the `/exec` URL in a browser. You should see
`{"ok":true,"service":"Loya booking intake","method":"POST only"}`.

**Every time you edit the script you must Deploy → Manage deployments →
edit → Version: New version.** Saving alone changes nothing that is
live. This is the single most common way to spend an hour confused.

---

## 4. Paste both URLs in

`site/src/lib/booking-api.ts`, near the top:

```ts
export const BUSY_CSV_URL     = "https://docs.google.com/.../pub?gid=...&output=csv";
export const BOOKING_ENDPOINT = "https://script.google.com/macros/s/.../exec";
```

Both are safe in the public repo. The CSV shows only busy times, which
the calendar draws anyway. The `/exec` URL can only append a row.

Then run `PUSHTOGITHUB.bat`. GitHub Actions builds it; the local build
is blocked by Application Control and always will be.

Pasting the endpoint is what enables the **Send request** button. Until
then the page says so plainly rather than pretending to work.

---

## 5. Test it end to end

On the live site:

1. Choose **Consult call** — free, so no money is involved in the test.
2. Fill it in with your own email.
3. **Review request** — check the preview.
4. **Send request** — you should get "Request sent."
5. Look at the Bookings tab. There should be a new row, `status`
   `pending`, `quoted` empty.
6. Check the notification email arrived.
7. Change that row's `status` to `confirmed`. The Busy tab should grow a
   row within seconds.
8. Reload the booking page, pick **Recording session**, and that time
   should now be missing from the calendar.

Step 8 is the one that proves the loop closed.

---

## Things that will bite

**The calendar means "she's probably free then". It does not mean the
slot is yours.** Liz confirms every booking by hand and the deposit is
what actually holds a date. The page is written to say exactly that and
nothing stronger. Do not let a future edit turn "Request sent" into
"You're booked" — there is no lock behind it, so two people can ask for
the same hour and both will be told it went through. That is fine
*because a human is the conflict resolver.* It stops being fine the
moment the page claims otherwise.

**If booking ever becomes instant self-service, this has to go back to a
real database.** `supabase/schema.sql` is kept for that reason — the
exclusion constraint in it is the thing that makes two people getting
the same slot impossible. Do not delete it.

**Never mark a new request `confirmed` automatically.** The Busy tab
pulls confirmed rows, so it would remove one of her real openings before
she had read it. The script forces `pending` on the way in and ignores
whatever the browser sent.

**Editing `Code.gs` in this repo changes nothing by itself.** It is not
built or deployed by Actions. Paste it into the Apps Script editor and
redeploy a new version.

**Adding a column to Bookings is a change in two files:** `COLUMNS` in
`sheets/Code.gs` and `BOOKING_COLUMNS` in `site/src/lib/booking-api.ts`.
They must match. `src/lib/booking-api.test.ts` checks the site half.

---

## Still open, and not a code problem

- **Her hours.** She said 8am–midnight, seven days (Q32). She also said
  the problem is *"I want to be able to rest knowing ppl won't blow up
  my phone"* (Q22). Those fight, and the second one is why this site
  exists. Needs a text to her. `booking.ts` currently reflects what she
  actually said, not what we think she meant.
- **Consult call length** is a 30-minute placeholder. She never gave a
  number. It is the only figure on the booking page that is not hers,
  and it is marked as such in the code.
- **Mixing and production get the full studio intake** — "do you have
  your beats ready?", "reference tracks" — half of which makes no sense
  to someone sending a finished recording for a mix.
