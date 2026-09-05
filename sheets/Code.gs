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

/** Where the "you have a new request" email goes. Empty string = no
 *  email is sent and the row is still written.
 *
 *  ⚠ POINTED AT X WHILE TESTING. Change to 'liznloya@gmail.com' once a
 *  real booking has gone through end to end — otherwise the first thing
 *  Liz sees is a test request from someone called "TEST" asking for a
 *  session that does not exist, and she has no way to know it is fake. */
var NOTIFY_EMAIL = 'calipxj@gmail.com';

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

      if (overRateLimit_(sheet)) {
        return json({ ok: false, error: 'Too many requests. Try again later.' });
      }

      var row = [];
      for (var c = 0; c < COLUMNS.length; c++) {
        row.push(String(data[COLUMNS[c]] == null ? '' : data[COLUMNS[c]]));
      }
      /* One extra cell past the named columns: when it arrived. Not in
         COLUMNS because the site does not send it and must not be able
         to forge it. */
      row.push(new Date());

      sheet.appendRow(row);
    } finally {
      lock.releaseLock();
    }

    notify_(data);
    return json({ ok: true });

  } catch (err) {
    /* Log the detail, return a generic message. A stack trace in a
       stranger's browser helps nobody. */
    console.error(err);
    return json({ ok: false, error: 'Could not save the request.' });
  }
}

/* ── HELPERS ───────────────────────────────────────────────────── */

function json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/** True if the last MAX_PER_HOUR rows all arrived within the hour.
 *  Reads only the timestamp column, so it stays cheap as the sheet
 *  grows. */
function overRateLimit_(sheet) {
  var last = sheet.getLastRow();
  if (last <= MAX_PER_HOUR) return false;

  var col = COLUMNS.length + 1;                 // the appended timestamp
  var values = sheet
    .getRange(last - MAX_PER_HOUR + 1, col, MAX_PER_HOUR, 1)
    .getValues();

  var cutoff = Date.now() - 3600 * 1000;
  for (var i = 0; i < values.length; i++) {
    var t = values[i][0];
    if (!(t instanceof Date) || t.getTime() < cutoff) return false;
  }
  return true;
}

/** Tell Liz. Wrapped so a mail failure can never lose a row that was
 *  already written — the booking is the thing that matters. */
function notify_(d) {
  if (!NOTIFY_EMAIL) return;
  try {
    var subject = 'New booking request — ' + d.name + ' — ' +
      d.service + ' — ' + d.date + ' ' + d.start;

    var body =
      d.name + ' asked for ' + d.service + '.\n\n' +
      'When:   ' + d.date + '  ' + d.start +
        (d.end ? ' to ' + d.end : '') + '\n' +
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
