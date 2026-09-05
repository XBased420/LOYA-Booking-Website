/* ═══════════════════════════════════════════════════════════════
   Workspace styling. Run by hand; never called by doPost.

   PASTE THIS AS A SECOND FILE in the Apps Script project, alongside
   Code.gs. Then: select `setupWorkspace` in the function dropdown and
   press Run. No deployment needed — nothing here is on the request
   path, so a bug in this file cannot cost a booking.

   It reads COLUMNS from Code.gs on purpose, so the layout can never
   drift from the column order the site and the script agree on.

   ── WHY THIS IS CODE AND NOT A MENU ──────────────────────────────
   Formatting applied through Format > Number does not survive.
   appendRow re-derives a cell's number format from the value it
   parses, so a hand-set column format is wiped by the next booking.
   It looked fixed, then silently reverted. Everything visual now
   lives here, in version control, and re-running this repairs it.

   ── WHAT THIS MUST NEVER DO ──────────────────────────────────────
   Three structural facts the booking system depends on. Breaking any
   of them takes the site down silently, not loudly:

   1. Bookings row 1 IS the header, in COLUMNS order, lowercase.
      checkSetup() reads getRange(1,1,1,COLUMNS.length) and compares
      exactly. No title row above it, no renaming, no reordering.

   2. NOTHING may sit below the data on Bookings. appendRow writes at
      getLastRow()+1, so a note or a total parked at the bottom means
      the next client's booking lands underneath it. That is why the
      dashboard is its own tab and not a section of this one.

   3. Busy row 1 IS the CSV header the site parses, and the tab is
      published to the web. Inserting a row, adding a title, or
      putting anything in column D changes what the site downloads.
      Only column widths, colours and fonts are touched there — the
      formula in A2 is not read, written or moved.

   So: presentation only. No data is created, moved or deleted.
   ═══════════════════════════════════════════════════════════════ */

/* ── Brand, lifted from site/src/styles/tokens.css ───────────────
   Same values the website renders, so the sheet reads as part of it
   rather than as a spreadsheet someone coloured in. */
var BRAND = {
  ground:     '#fdf9f8',   // --ground-0, warm white
  groundAlt:  '#fbeef2',   // --ground-1, banding stripe
  paper:      '#ffffff',   // tiles
  ink:        '#1f1720',   // --text-1 / --ink-900
  inkSoft:    '#4e3f4a',   // --text-2
  inkFaint:   '#695764',   // --text-3
  onInk:      '#fdf9f8',   // --on-ink
  pink:       '#d4488f',   // --pink
  pinkDeep:   '#ad2c6d',   // --pink-deep, the primary
  pinkSoft:   '#f7d3e4',   // --pink-soft
  mintBg:     '#d7f0e6',
  mintDeep:   '#226c55',   // --mint-deep
  amberBg:    '#fdf1dc',
  amberDeep:  '#8a5a00',   // the warning colour book.astro already uses
  mutedBg:    '#eeeaec',
  mutedText:  '#8a8189',
  rule:       '#e7dae0',   // --rule-1 flattened to a solid hairline
  ruleStrong: '#cbb9c3',
};

/* The three faces the site loads. Sheets resolves Google Font names,
   and falls back silently if one is unavailable — nothing breaks. */
var FONT_DISPLAY = 'Anton';        // --font-display, numbers and titles
var FONT_SANS    = 'Archivo';      // --font-sans, body
var FONT_TYPE    = 'Courier Prime'; // --font-type, labels

/** How far down formatting is pre-applied. Rows past this still
 *  accept bookings — formatRow_() styles each row as it is written —
 *  this is just how far the banding and rules are painted up front. */
var STYLE_ROWS = 1000;

/** How many body rows actually exist below the header.
 *
 *  ⚠ A sheet has exactly 1000 rows by default, so getRange(2, c, 1000, 1)
 *  asks for rows 2..1001 and throws "range exceeds grid limits" — which
 *  would abort the whole styling run partway through, leaving the sheet
 *  half-formatted. Everything below is clamped through here. */
function bodyRows_(sh) {
  return Math.max(1, Math.min(STYLE_ROWS, sh.getMaxRows() - 1));
}

/* ═══════════════════════════════════════════════════════════════
   THE ONE FUNCTION TO RUN
   ═══════════════════════════════════════════════════════════════ */

function setupWorkspace() {
  var ss = SpreadsheetApp.openById(SHEET_ID);

  var bookings = ss.getSheetByName(SHEET_NAME);
  if (!bookings) throw new Error('No tab named "' + SHEET_NAME + '".');

  var busy = ss.getSheetByName('Busy');

  styleBookings_(bookings);
  if (busy) styleBusy_(busy);
  buildDashboard_(ss);

  /* Dashboard first, so opening the file lands on the summary rather
     than on a wall of columns. Tab ORDER is cosmetic: the script finds
     sheets by name and the Busy CSV is published by gid. */
  var dash = ss.getSheetByName('Dashboard');
  if (dash) { ss.setActiveSheet(dash); ss.moveActiveSheet(1); }

  SpreadsheetApp.flush();
  return 'Workspace styled. Data untouched.';
}

/* ═══════════════════════════════════════════════════════════════
   BOOKINGS — the working surface
   ═══════════════════════════════════════════════════════════════ */

function styleBookings_(sh) {
  var rows  = bodyRows_(sh);
  var nCols = COLUMNS.length + 1;             // + the `received` stamp
  var col = function (name) { return COLUMNS.indexOf(name) + 1; };

  /* Widths, chosen by what each column actually holds. notes is wide
     because it carries the whole intake; everything else is sized to
     stop truncation without wasting horizontal room. */
  var widths = {
    date: 105, start: 92, end: 92, service: 150, name: 180,
    email: 215, phone: 130, status: 115, quoted: 95,
    deposit_paid: 115, balance_paid: 115, notes: 380,
  };
  for (var k in widths) {
    if (col(k) > 0) sh.setColumnWidth(col(k), widths[k]);
  }
  sh.setColumnWidth(nCols, 165);              // received

  /* A calm ground everywhere, so the sheet does not end in a hard
     edge of grey halfway across the screen. */
  sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns())
    .setBackground(BRAND.ground)
    .setFontFamily(FONT_SANS)
    .setFontSize(10)
    .setVerticalAlignment('middle');

  /* Header. Ink block, same anchor the site's nav and footer use.
     The TEXT is not touched — checkSetup compares it exactly. */
  var header = sh.getRange(1, 1, 1, nCols);
  header
    .setBackground(BRAND.ink)
    .setFontColor(BRAND.onInk)
    .setFontFamily(FONT_TYPE)
    .setFontSize(9)
    .setFontWeight('bold')
    .setVerticalAlignment('middle')
    .setHorizontalAlignment('left');
  sh.setRowHeight(1, 34);
  sh.setFrozenRows(1);

  /* Banding for the data area. Removed and re-applied so re-running
     this does not stack a second set of stripes on the first. */
  var body = sh.getRange(2, 1, rows, nCols);
  var existing = sh.getBandings();
  for (var i = 0; i < existing.length; i++) existing[i].remove();
  var band = body.applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY, false, false);
  band.setFirstRowColor(BRAND.ground)
      .setSecondRowColor(BRAND.groundAlt)
      .setHeaderRowColor(null)
      .setFooterRowColor(null);

  sh.setRowHeights(2, rows, 26);

  /* Alignment by kind of value: times and counts centred so they form
     a clean column, words left so they read. */
  var centre = ['date', 'start', 'end', 'status', 'quoted', 'deposit_paid', 'balance_paid'];
  for (var c = 0; c < centre.length; c++) {
    if (col(centre[c]) > 0) {
      sh.getRange(2, col(centre[c]), rows, 1).setHorizontalAlignment('center');
    }
  }
  sh.getRange(2, nCols, rows, 1)
    .setHorizontalAlignment('center')
    .setFontFamily(FONT_TYPE)
    .setFontSize(9)
    .setFontColor(BRAND.inkFaint);           // `received` is metadata, not content

  /* notes holds the entire intake. CLIP, not WRAP: wrapping makes row
     heights jump around and the grid stops being scannable. Click the
     cell to read it in full. */
  if (col('notes') > 0) {
    sh.getRange(2, col('notes'), rows, 1)
      .setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP)
      .setFontColor(BRAND.inkSoft);
  }
  /* The client's own name is what she scans for. */
  if (col('name') > 0) {
    sh.getRange(2, col('name'), rows, 1).setFontWeight('bold');
  }

  /* Strategic rules only — one under the header, and one vertical
     hairline where the meaning changes: WHEN | WHO | MONEY | NOTES. */
  sh.getRange(1, 1, 1, nCols)
    .setBorder(null, null, true, null, null, null, BRAND.pinkDeep, SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
  var seams = ['service', 'quoted', 'notes'];
  for (var s = 0; s < seams.length; s++) {
    if (col(seams[s]) > 0) {
      sh.getRange(1, col(seams[s]), rows + 1, 1)
        .setBorder(null, true, null, null, null, null, BRAND.ruleStrong, SpreadsheetApp.BorderStyle.SOLID);
    }
  }

  /* ── Status: readable at a glance, without reading ──────────────
     Values are the ones the system already uses. `pending` is what
     doPost forces on every new request; `confirmed` is what the Busy
     tab filters on. Changing either would break the site, so these
     rules colour them rather than touching them. */
  var statusCol = col('status');
  var rules = [];
  var statusRange = sh.getRange(2, statusCol, rows, 1);

  var palette = [
    ['pending',   BRAND.pinkSoft, '#8c1f56'],
    ['confirmed', BRAND.mintBg,   BRAND.mintDeep],
    ['paid',      '#cdeade',      '#14493a'],
    ['completed', '#ece7ef',      BRAND.inkSoft],
    ['cancelled', BRAND.mutedBg,  BRAND.mutedText],
  ];
  for (var p = 0; p < palette.length; p++) {
    rules.push(SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo(palette[p][0])
      .setBackground(palette[p][1])
      .setFontColor(palette[p][2])
      .setBold(true)
      .setRanges([statusRange])
      .build());
  }

  /* Confirmed but no deposit recorded — the one state that costs her
     money if it slips. Amber is the same warning colour the booking
     page already uses. */
  var depCol = col('deposit_paid');
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=AND($' + colLetter_(statusCol) + '2="confirmed",$' +
                          colLetter_(depCol) + '2="")')
    .setBackground(BRAND.amberBg)
    .setFontColor(BRAND.amberDeep)
    .setRanges([sh.getRange(2, depCol, rows, 1)])
    .build());

  /* Cancelled rows recede instead of shouting. Listed last so the
     status cell's own colours win where they overlap. */
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=$' + colLetter_(statusCol) + '2="cancelled"')
    .setFontColor(BRAND.mutedText)
    .setRanges([sh.getRange(2, 1, rows, nCols)])
    .build());

  sh.setConditionalFormatRules(rules);

  /* A dropdown so status is picked, not typed — one misspelling in
     this column and a confirmed booking stops reaching the calendar.
     setAllowInvalid(true) ON PURPOSE: it warns a human, and it can
     never reject a write from doPost. */
  statusRange.setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(['pending', 'confirmed', 'paid', 'completed', 'cancelled'], true)
      .setAllowInvalid(true)
      .setHelpText('Busy (and the site calendar) only reacts to "confirmed".')
      .build());

  sh.getRange(1, statusCol).setNote(
    'Set to "confirmed" once the date is agreed — that is what puts the\n' +
    'slot on the public calendar. Anything else leaves her showing as free.');
  sh.getRange(1, nCols).setNote('Written by the booking script. Not sent by the website.');

  sh.setTabColor(BRAND.ink);
}

/* ═══════════════════════════════════════════════════════════════
   BUSY — machine feed. Look, do not touch.
   ═══════════════════════════════════════════════════════════════ */

function styleBusy_(sh) {
  var rows = bodyRows_(sh);
  sh.setColumnWidth(1, 130);
  sh.setColumnWidth(2, 110);
  sh.setColumnWidth(3, 110);

  sh.getRange(1, 1, sh.getMaxRows(), 3)
    .setBackground(BRAND.ground)
    .setFontFamily(FONT_TYPE)
    .setFontSize(10)
    .setVerticalAlignment('middle');

  sh.getRange(1, 1, 1, 3)
    .setBackground(BRAND.inkSoft)
    .setFontColor(BRAND.onInk)
    .setFontSize(9)
    .setFontWeight('bold');
  sh.setRowHeight(1, 30);
  sh.setFrozenRows(1);
  sh.setTabColor(BRAND.mutedText);

  sh.getRange('A1').setNote(
    'GENERATED — do not type in this tab.\n\n' +
    'A2 holds one formula that pulls every confirmed booking out of the\n' +
    'Bookings tab. This tab is published to the web as CSV and the\n' +
    'website reads it to work out when she is busy.\n\n' +
    'Deleting or editing A2 makes the site think she is free at every\n' +
    'hour of every day. Only this tab is published — Bookings is not,\n' +
    'which is what keeps client names, emails and phone numbers off\n' +
    'the open web.');

  /* Warning-only: it interrupts an accidental edit but locks nobody
     out. That formula has already been deleted by accident once. */
  var prot = sh.getProtections(SpreadsheetApp.ProtectionType.RANGE);
  for (var i = 0; i < prot.length; i++) {
    if (prot[i].getDescription() === 'Busy feed — generated') prot[i].remove();
  }
  sh.getRange(2, 1, rows, 3)
    .protect()
    .setDescription('Busy feed — generated')
    .setWarningOnly(true);
}

/* ═══════════════════════════════════════════════════════════════
   DASHBOARD — read-only summary, built from formulas
   ═══════════════════════════════════════════════════════════════ */

function buildDashboard_(ss) {
  /* Deleted and rebuilt rather than patched: it holds no source data,
     only formulas, so this is the cheapest way to stay idempotent. */
  var old = ss.getSheetByName('Dashboard');
  if (old) ss.deleteSheet(old);
  var sh = ss.insertSheet('Dashboard', 0);

  sh.setHiddenGridlines(true);
  sh.setTabColor(BRAND.pinkDeep);

  var W = [28, 120, 120, 120, 120, 120, 120, 28];
  for (var i = 0; i < W.length; i++) sh.setColumnWidth(i + 1, W[i]);

  sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns())
    .setBackground(BRAND.ground)
    .setFontFamily(FONT_SANS)
    .setVerticalAlignment('middle');

  /* ── Masthead ── */
  sh.setRowHeight(1, 14);
  sh.getRange('B2').setValue('LOYA')
    .setFontFamily(FONT_DISPLAY).setFontSize(28).setFontColor(BRAND.ink);
  sh.getRange('B3').setValue('Booking management')
    .setFontFamily(FONT_SANS).setFontSize(11).setFontColor(BRAND.inkFaint);
  sh.getRange('B4').setValue('Read-only summary. Every number below is pulled from the Bookings tab.')
    .setFontFamily(FONT_TYPE).setFontSize(8).setFontColor(BRAND.inkFaint);
  sh.setRowHeight(2, 38);
  sh.setRowHeight(3, 20);
  sh.setRowHeight(4, 18);
  sh.setRowHeight(5, 16);

  var B = 'Bookings!';
  var tiles = [
    // row 6/7
    [['B', 'TOTAL BOOKINGS', '=COUNTA(' + B + 'A2:A' + STYLE_ROWS + ')', BRAND.ink],
     ['D', 'PENDING',        '=COUNTIF(' + B + 'H2:H' + STYLE_ROWS + ',"pending")', BRAND.pinkDeep],
     ['F', 'CONFIRMED',      '=COUNTIF(' + B + 'H2:H' + STYLE_ROWS + ',"confirmed")', BRAND.mintDeep]],
    // row 9/10
    [['B', 'TODAY',          '=COUNTIFS(' + B + 'A2:A' + STYLE_ROWS + ',TODAY(),' + B + 'H2:H' + STYLE_ROWS + ',"<>cancelled")', BRAND.ink],
     ['D', 'NEXT 7 DAYS',    '=COUNTIFS(' + B + 'A2:A' + STYLE_ROWS + ',">="&TODAY(),' + B + 'A2:A' + STYLE_ROWS + ',"<="&TODAY()+7,' + B + 'H2:H' + STYLE_ROWS + ',"<>cancelled")', BRAND.ink],
     ['F', 'AWAITING DEPOSIT', '=COUNTIFS(' + B + 'H2:H' + STYLE_ROWS + ',"confirmed",' + B + 'J2:J' + STYLE_ROWS + ',"")', BRAND.amberDeep]],
  ];

  sh.getRange('B5').setValue('AT A GLANCE')
    .setFontFamily(FONT_TYPE).setFontSize(9).setFontColor(BRAND.pinkDeep).setFontWeight('bold');

  var rowsFor = [[6, 7], [9, 10]];
  for (var t = 0; t < tiles.length; t++) {
    var labelRow = rowsFor[t][0], valueRow = rowsFor[t][1];
    sh.setRowHeight(labelRow, 22);
    sh.setRowHeight(valueRow, 46);
    if (t === 0) sh.setRowHeight(8, 10);

    for (var j = 0; j < tiles[t].length; j++) {
      var startCol = tiles[t][j][0];
      var endCol = String.fromCharCode(startCol.charCodeAt(0) + 1);
      var labelRange = sh.getRange(startCol + labelRow + ':' + endCol + labelRow);
      var valueRange = sh.getRange(startCol + valueRow + ':' + endCol + valueRow);

      safeMerge_(labelRange);
      safeMerge_(valueRange);

      labelRange.setValue(tiles[t][j][1])
        .setFontFamily(FONT_TYPE).setFontSize(8).setFontColor(BRAND.inkFaint)
        .setBackground(BRAND.paper).setHorizontalAlignment('center')
        .setVerticalAlignment('bottom');
      valueRange.setFormula(tiles[t][j][2])
        .setFontFamily(FONT_DISPLAY).setFontSize(26).setFontColor(tiles[t][j][3])
        .setBackground(BRAND.paper).setHorizontalAlignment('center')
        .setVerticalAlignment('top');

      sh.getRange(startCol + labelRow + ':' + endCol + valueRow)
        .setBorder(true, true, true, true, false, false,
                   BRAND.rule, SpreadsheetApp.BorderStyle.SOLID);
    }
  }

  /* ── Upcoming ── */
  sh.setRowHeight(11, 20);
  sh.getRange('B12').setValue('UPCOMING')
    .setFontFamily(FONT_TYPE).setFontSize(9).setFontColor(BRAND.pinkDeep).setFontWeight('bold');
  sh.setRowHeight(12, 24);

  var heads = ['date', 'start', 'service', 'client', 'status', 'notes'];
  sh.getRange(13, 2, 1, 6).setValues([heads])
    .setFontFamily(FONT_TYPE).setFontSize(8).setFontColor(BRAND.ink).setFontWeight('bold')
    .setBorder(null, null, true, null, null, null,
               BRAND.pinkDeep, SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
  sh.setRowHeight(13, 24);

  /* Bounded ranges, not open-ended: {} refuses to build an array from
     columns of different heights, and an open-ended range grows to
     whatever the sheet's max row happens to be. IFERROR covers the
     empty-sheet case, where FILTER legitimately matches nothing. */
  sh.getRange('B14').setFormula(
    '=IFERROR(SORT(FILTER({' + B + 'A2:B' + STYLE_ROWS + ',' + B + 'D2:E' + STYLE_ROWS +
    ',' + B + 'H2:H' + STYLE_ROWS + ',' + B + 'L2:L' + STYLE_ROWS + '},' +
    B + 'A2:A' + STYLE_ROWS + '<>"",' +
    B + 'A2:A' + STYLE_ROWS + '>=TODAY(),' +
    B + 'H2:H' + STYLE_ROWS + '<>"cancelled"),1,TRUE,2,TRUE),' +
    '"Nothing upcoming yet.")');

  var tableRows = Math.min(40, sh.getMaxRows() - 13);
  var table = sh.getRange(14, 2, tableRows, 6);
  table.setFontFamily(FONT_SANS).setFontSize(10).setFontColor(BRAND.inkSoft)
       .setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP);
  sh.setRowHeights(14, tableRows, 24);
  sh.getRange(14, 2, tableRows, 1).setNumberFormat('yyyy-mm-dd').setHorizontalAlignment('center');
  sh.getRange(14, 3, tableRows, 1).setNumberFormat('h:mm AM/PM').setHorizontalAlignment('center');
  sh.getRange(14, 5, tableRows, 1).setFontWeight('bold').setFontColor(BRAND.ink);
  sh.getRange(14, 6, tableRows, 1).setHorizontalAlignment('center').setFontFamily(FONT_TYPE).setFontSize(9);

  sh.setFrozenRows(13);
}

/* ── small helpers ─────────────────────────────────────────────── */

/** merge() throws on a range that is already merged, and this runs
 *  more than once. */
function safeMerge_(range) {
  try { range.merge(); } catch (err) { /* already merged */ }
}

/** 1 -> "A". Only ever used for single-letter columns here, but the
 *  loop keeps it honest past Z. */
function colLetter_(n) {
  var s = '';
  while (n > 0) {
    var m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = (n - m - 1) / 26;
  }
  return s;
}
