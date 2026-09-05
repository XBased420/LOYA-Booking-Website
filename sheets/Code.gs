/* ═══════════════════════════════════════════════════════════════
   Apps Script Web App — the only thing that writes to the Sheet.

   Lives in the repo so the server side is not stored solely inside a
   Google account nobody can diff. THIS FILE IS NOT BUILT OR DEPLOYED
   BY GITHUB ACTIONS — you paste it into the Apps Script editor
   attached to the Sheet. When you change it here, you must paste it
   there again and redeploy. See docs/sheet-setup.md.

   Why Apps Script and not Make: Make is deferred, and this needs no
   third platform. It runs inside the Sheet, it is free, and it can
   email Liz without another integration. If Make comes back later for
   payments, point BOOKING_ENDPOINT at the Make webhook instead and
   this file stops being used — nothing else changes.
   ═══════════════════════════════════════════════════════════════ */

/* ── SETTINGS ──────────────────────────────────────────────────── */

/** The spreadsheet this writes to, by ID — the long string in its URL.
 *
 *  WHY BY ID AND NOT getActiveSpreadsheet(): a script created through
 *  Extensions > Apps Script is "bound" to its sheet and can just ask for
 *  the active one. That menu is unusable on an account setup like X's —
 *  two Google accounts signed in, the Sheet owned by the second one, and
 *  Sheets builds a /macros/u/1/ link that script.google.com answers with
 *  "Sorry, unable to open the file at this time." Three ways round it
 *  all hit the same wall.
 *
 *  Opening by ID needs no binding, so the script can be a STANDALONE
 *  project created straight from script.google.com/u/1/home, which does
 *  work. It behaves identically — the owner has edit access either way —
 *  and it survives someone duplicating or re-binding the sheet later. */
var SHEET_ID = '1-dShzzhGAPyl2OJunaF8RpZ9JVAQMyrQ7EKNPHNb8c8';

var SHEET_NAME = 'Bookings';

/** Her timezone, and the one every timestamp in the sheet is written in.
 *
 *  ⚠ THIS EXISTS BECAUSE OF A REAL BUG. The first live booking arrived
 *  at 12:29 AM and the sheet logged it as "9/4/2026 22:29:31" — two
 *  hours early. A sheet created through the Drive API defaults to
 *  PACIFIC time, and `new Date()` written into a cell renders in the
 *  SHEET's timezone, not hers.
 *
 *  Rather than depend on a settings menu nobody will remember to check,
 *  the timestamp is formatted to a STRING here, in this timezone,
 *  explicitly. Same reasoning as the TEXT() wrapper on the Busy tab:
 *  make the value say what it means instead of trusting how something
 *  else will render it. Changing the sheet's timezone now affects
 *  nothing this script writes. */
var STUDIO_TZ = 'America/Chicago';

/** Where the "you have a new request" email goes. Empty string = no
 *  email is sent and the row is still written.
 *
 *  LIVE as of 2026-09-05: this is Liz. It was pointed at X while the
 *  write path was being proven, and switched over once a real booking
 *  had gone through end to end.
 *
 *  If you point it back at yourself to test something, POINT IT BACK
 *  AFTERWARDS — and remember this file is only a copy. Nothing deploys
 *  it. The address that actually matters is the one in the Apps Script
 *  editor, and only after Deploy > Manage deployments > New version. */
var NOTIFY_EMAIL = 'liznloya@gmail.com';

/** Column order. MUST match BOOKING_COLUMNS in
 *  site/src/lib/booking-api.ts. Adding a column is a change in exactly
 *  these two places. Order here is what decides where a value lands in
 *  the row, so this is read as the source of truth, not the header row
 *  in the sheet — that way a header someone renamed cannot silently
 *  shift everyone's phone number into the notes column. */
var COLUMNS = [
  'date', 'start', 'end', 'service', 'name', 'email', 'phone',
  'status', 'quoted', 'deposit_paid', 'balance_paid', 'notes'
];

/** Fields that must be non-empty or the request is rejected. The
 *  browser already enforces this; so does this, because the browser is
 *  not where security lives and anyone can POST here with curl. */
var REQUIRED = ['date', 'start', 'service', 'name', 'email'];

/** Most requests one IP-less caller can file per rolling hour. A real
 *  client sends one. This is a spam brake, not a security control. */
var MAX_PER_HOUR = 20;

/* ── ENTRY POINTS ──────────────────────────────────────────────── */

/** A GET is not how bookings arrive. Answer politely so that opening
 *  the /exec URL in a browser tells you the deployment is alive —
 *  that is the fastest way to check you deployed the right thing. */
function doGet() {
  return json({ ok: true, service: 'Loya booking intake', method: 'POST only' });
}

/** Run this ONCE from the editor, before deploying.
 *
 *  Two jobs. It triggers the authorisation prompt while you are looking
 *  at the editor and can read it, instead of mid-deploy. And it proves
 *  the script can actually reach the sheet — if SHEET_ID is wrong or the
 *  tab is not named exactly "Bookings", you find out here in two seconds
 *  rather than from a client whose booking silently vanished.
 *
 *  Check the execution log. It should name the file and the columns. */
function checkSetup() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    throw new Error('No tab named "' + SHEET_NAME + '" in "' + ss.getName() +
      '". Tabs found: ' + ss.getSheets().map(function (s) {
        return s.getName();
      }).join(', '));
  }
  var header = sheet.getRange(1, 1, 1, COLUMNS.length).getValues()[0];
  var wrong = [];
  for (var i = 0; i < COLUMNS.length; i++) {
    if (String(header[i]).trim() !== COLUMNS[i]) {
      wrong.push('column ' + (i + 1) + ': expected "' + COLUMNS[i] +
        '", found "' + header[i] + '"');
    }
  }
  console.log('Spreadsheet: ' + ss.getName());
  console.log('Tab:         ' + sheet.getName());
  console.log('Headers:     ' + (wrong.length ? 'MISMATCH\n  ' + wrong.join('\n  ')
                                              : 'all ' + COLUMNS.length + ' correct'));
  console.log('Notify:      ' + (NOTIFY_EMAIL || '(off)'));

  /* Smoke-test every helper doPost depends on. Reading headers proved
     the sheet was reachable but said nothing about the code, which is
     how a deleted function shipped. Anything missing throws HERE. */
  console.log('stamp_:      ' + stamp_(new Date()));
  console.log('to12h_:      14:30 -> ' + to12h_('14:30') +
              ', 00:00 -> ' + to12h_('00:00') +
              ', 12:00 -> ' + to12h_('12:00'));
  console.log('rate limit:  ' + (overRateLimit_() ? 'TRIPPED' : 'clear'));
  /* Re-format the last existing row, which also proves formatRow_ runs.
     Harmless on an empty sheet: row 1 is the header and has no times. */
  formatRow_(sheet, Math.max(2, sheet.getLastRow()));
  console.log('formatRow_:  ok');

  return wrong.length ? 'FIX THE HEADERS' : 'OK';
}

function doPost(e) {
  try {
    /* The site sends Content-Type: text/plain holding a JSON string,
       deliberately: application/json triggers a CORS preflight OPTIONS
       request, and an Apps Script web app cannot answer OPTIONS at all.
       Either way the body is here. Form-encoded posts are accepted too
       so a plain <form> fallback would still work. */
    var raw = (e && e.postData && e.postData.contents) || '';
    var data = {};

    if (raw.charAt(0) === '{') {
      data = JSON.parse(raw);
    } else if (e && e.parameter) {
      data = e.parameter;
    }

    /* Honeypot: a field the page never renders. A human cannot fill it
       in; a bot fills every input it finds. Answer ok so the bot has
       nothing to learn from, and write nothing. */
    if (String(data.website || '').trim() !== '') {
      return json({ ok: true });
    }

    var missing = [];
    for (var i = 0; i < REQUIRED.length; i++) {
      if (String(data[REQUIRED[i]] || '').trim() === '') missing.push(REQUIRED[i]);
    }
    if (missing.length) {
      return json({ ok: false, error: 'Missing: ' + missing.join(', ') });
    }

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(data.email).trim())) {
      return json({ ok: false, error: 'That email address does not look right.' });
    }

    /* Never trust a status off the wire. A caller who sent
       status:"confirmed" would take one of her real openings off the
       public calendar, because the Busy tab pulls confirmed rows. */
    data.status = 'pending';

    /* Same reasoning for money: these are hers to fill in by hand. */
    data.quoted = '';
    data.deposit_paid = '';
    data.balance_paid = '';

    /* One lock around read-count-and-append. Two people submitting in
       the same second would otherwise both compute the same next row
       and one would overwrite the other. Thirty seconds is far longer
       than an append takes; if it cannot be had, the caller is told to
       retry rather than being told it worked. */
    var lock = LockService.getScriptLock();
    if (!lock.tryLock(30000)) {
      return json({ ok: false, error: 'Busy right now — please try again.' });
    }

    try {
      var sheet = SpreadsheetApp.openById(SHEET_ID)
        .getSheetByName(SHEET_NAME);
      if (!sheet) {
        return json({ ok: false, error: 'Sheet "' + SHEET_NAME + '" not found.' });
      }

      if (overRateLimit_()) {
        return json({ ok: false, error: 'Too many requests. Try again later.' });
      }

      var row = [];
      for (var c = 0; c < COLUMNS.length; c++) {
        row.push(String(data[COLUMNS[c]] == null ? '' : data[COLUMNS[c]]));
      }
      /* One extra cell past the named columns: when it arrived, in HER
         timezone, as text. Not in COLUMNS because the site does not
         send it and must not be able to forge it. */
      row.push(stamp_(new Date()));

      sheet.appendRow(row);
      formatRow_(sheet, sheet.getLastRow());
    } finally {
      lock.releaseLock();
    }

    notify_(data);
    return json({ ok: true });

  } catch (err) {
    /* `error` is what a stranger might see, so it stays generic.
       `detail` carries the real reason: the site logs it to the console
       and never displays it. Without this a server-side fault looks
       identical to a network drop from the outside, which cost a full
       debugging round trip once already. */
    console.error(err);
    return json({
      ok: false,
      error: 'Could not save the request.',
      detail: String((err && err.message) || err),
    });
  }
}

/* ── HELPERS ───────────────────────────────────────────────────── */

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/** Spam brake: has this endpoint taken MAX_PER_HOUR requests in the last
 *  rolling hour? A real client sends one. This is a brake, not security.
 *
 *  ⚠ THIS USED TO READ THE `received` COLUMN AND WAS BROKEN. Sheets
 *  does not store what you hand it — it PARSES it. The timestamp is
 *  written as the string "2026-09-05 00:55:12" and Sheets silently
 *  turns that into a datetime VALUE, so getValues() hands back a Date
 *  object, not the text. Comparing String(thatDate) against a
 *  "yyyy-MM-dd..." cutoff compares "Fri Sep 05 2026…" with "2026-09…",
 *  and "F" sorts after "2", so the comparison was false every time.
 *
 *  Nothing would have gone wrong until the 21st row, at which point
 *  this would have started returning true forever and every real
 *  booking would have been rejected with "Too many requests." Months
 *  from now, with no obvious cause.
 *
 *  So it no longer asks the spreadsheet anything. Script properties
 *  hold plain epoch milliseconds — no cell, no parsing, no timezone,
 *  and nothing Google can reinterpret. This runs inside the same lock
 *  as the append, so the read-modify-write cannot race either. */
function overRateLimit_() {
  var props = PropertiesService.getScriptProperties();
  var now = Date.now();
  var cutoff = now - 3600 * 1000;

  var recent = [];
  try {
    recent = JSON.parse(props.getProperty('recent') || '[]');
    if (!Array.isArray(recent)) recent = [];
  } catch (err) {
    recent = [];                       // corrupt value must not block bookings
  }

  recent = recent.filter(function (t) {
    return typeof t === 'number' && t > cutoff;
  });

  if (recent.length >= MAX_PER_HOUR) {
    props.setProperty('recent', JSON.stringify(recent));
    return true;
  }

  recent.push(now);
  props.setProperty('recent', JSON.stringify(recent));
  return false;
}

/** Make the row Liz just received readable: 12-hour clock with AM/PM.
 *
 *  ⚠ SETTING THE COLUMN FORMAT BY HAND DOES NOT SURVIVE. appendRow
 *  re-derives each cell's number format from the value it parses, so a
 *  format applied through Format > Number is wiped the moment the script
 *  writes the next booking. It looked fixed, then silently reverted to
 *  24-hour on the very next row. Setting it here is deterministic, and
 *  it lives in version control instead of in a menu nobody remembers.
 *
 *  This is DISPLAY ONLY. The cells still hold real date/time values, so
 *  the Busy tab's TEXT(value,"HH:mm") is unaffected and the published
 *  CSV the site reads stays 24-hour. Verify that after changing this:
 *  Bookings should read 3:40 PM while Busy reads 15:40.
 *
 *  Indices come from COLUMNS rather than being hardcoded, so reordering
 *  the sheet cannot quietly format the wrong cells. */
function formatRow_(sheet, r) {
  var col = function (name) { return COLUMNS.indexOf(name) + 1; };
  try {
    sheet.getRange(r, col('date')).setNumberFormat('yyyy-mm-dd');
    sheet.getRange(r, col('start')).setNumberFormat('h:mm AM/PM');
    sheet.getRange(r, col('end')).setNumberFormat('h:mm AM/PM');
    /* `received` sits one past the named columns. */
    sheet.getRange(r, COLUMNS.length + 1)
         .setNumberFormat('yyyy-mm-dd h:mm AM/PM');
  } catch (err) {
    /* Cosmetics must never cost a booking that is already written. */
    console.error('formatRow_ failed', err);
  }
}

/** A Date -> "2026-09-08 14:30:00" in her timezone.
 *
 *  ⚠ THIS WAS DELETED ONCE AND IT COST A LIVE OUTAGE. Rewriting
 *  overRateLimit_() replaced a range of text that happened to contain
 *  this function too, so `row.push(stamp_(new Date()))` was left calling
 *  something that no longer existed. A missing function is a RUNTIME
 *  error, not a syntax one, so the file still parsed, still deployed,
 *  and still answered GET — and then threw on every real booking, where
 *  the catch-all turned it into "Could not save the request."
 *
 *  checkSetup() now calls this, so the same mistake fails in the editor
 *  in two seconds instead of in front of a client. */
function stamp_(d) {
  return Utilities.formatDate(d, STUDIO_TZ, 'yyyy-MM-dd HH:mm:ss');
}

/** "14:30" -> "2:30 PM". For humans only.
 *
 *  The sheet gets the 24-hour string and a 12-hour DISPLAY FORMAT on the
 *  column, so the stored value stays unambiguous while Liz reads it the
 *  way she thinks. The email has no cell to format, so it converts here.
 *
 *  Deliberately NOT applied to what the site reads. The Busy tab pulls
 *  TEXT(value,"HH:mm") straight off the time value, which ignores the
 *  display format, so the published CSV stays 24-hour. The site's parser
 *  does understand "2:30 PM" — that is tested — but there is no reason
 *  to put an AM/PM ambiguity into a machine feed nobody reads.
 *
 *  Anything it cannot parse is handed back untouched rather than
 *  mangled: a half-readable time in her inbox beats a wrong one. */
function to12h_(clock) {
  var s = String(clock == null ? '' : clock).trim();
  var m = s.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return s;

  var h = Number(m[1]);
  if (!isFinite(h) || h > 24) return s;

  /* 24:00 and 00:00 are both midnight, and both must read 12:00 AM —
     not "0:00 AM", and not "12:00 PM". */
  var suffix = (h < 12 || h === 24) ? 'AM' : 'PM';
  var h12 = h % 12;
  if (h12 === 0) h12 = 12;

  return h12 + ':' + m[2] + ' ' + suffix;
}

/** Tell Liz. Wrapped so a mail failure can never lose a row that was
 *  already written — the booking is the thing that matters. */
function notify_(d) {
  if (!NOTIFY_EMAIL) return;
  try {
    var subject = 'New booking request — ' + d.name + ' — ' +
      d.service + ' — ' + d.date + ' ' + to12h_(d.start);

    var body =
      d.name + ' asked for ' + d.service + '.\n\n' +
      'When:   ' + d.date + '  ' + to12h_(d.start) +
        (d.end ? ' to ' + to12h_(d.end) : '') + '\n' +
      'Email:  ' + d.email + '\n' +
      'Phone:  ' + (d.phone || '—') + '\n\n' +
      (d.notes ? d.notes + '\n\n' : '') +
      '─────────────\n' +
      'Nothing is held yet. Open the Bookings tab, set status to\n' +
      '"confirmed" once you have agreed the time, and it will drop off\n' +
      'your public calendar automatically.\n';

    MailApp.sendEmail({
      to: NOTIFY_EMAIL,
      subject: subject,
      body: body,
      replyTo: String(d.email || '')     // hitting reply answers the client
    });
  } catch (err) {
    console.error('notify failed', err);
  }
}
