/* MAHI – Excel workbook builder + importer (ExcelJS).
 * The SAME code generates the master .xlsx (Node) and the in-app "Export to Excel" (browser),
 * and parses workbooks back into application state on import.
 */
(function (root, factory) {
  root.MAHI_WB = factory(root.MAHI_DATA);
})(typeof self !== 'undefined' ? self : this, function (D) {
  'use strict';

  const LAST = 2000; // formulas cover rows up to this, so new rows remain counted
  const SHEETS = {
    dash: 'MAHI Dashboard', brand: 'Brand Master Plan', fest: 'Festival Calendar',
    poster: 'Poster Tracker', ai: 'AI Video Tracker', pub: 'Publishing Calendar', daily: 'My Daily Planner', weekly: 'My Weekly Planner',
    flow: 'Workflow Chart', alerts: 'Deadline Alerts', perf: 'Performance Reports', ach: 'Achievement History', notes: 'Personal Notes',
    annual: 'Annual Workflow 2027', settings: 'Settings', log: 'Platform Publishing Log', help: 'Instructions', lists: 'Lists', state: '_AppState',
  };
  const setSheetName = (s) => `${s.label} - ${s.festival}`;
  const vjSheetName = (id) => `${id} Tracker`;

  // ---------- colours & styles ----------
  const C = {
    navy: 'FF12263F', forest: 'FF1B5E20', emerald: 'FF2E9E4F', gold: 'FFC9A227', white: 'FFFFFFFF', soft: 'FFF4F6F5',
    grey: 'FF9E9E9E', ink: 'FF1F2A37', mint: 'FFE8F5EC', auto: 'FFE9EEF5',
  };
  const fill = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
  const cfFill = (argb) => ({ type: 'pattern', pattern: 'solid', bgColor: { argb } });
  const thin = { style: 'thin', color: { argb: 'FFD5DBD8' } };
  const box = { top: thin, left: thin, bottom: thin, right: thin };

  const STATUS_STYLE = [
    [['Not Started', 'Pending', 'None', 'Not Scheduled'], 'FFF0F0F0', 'FF616161'],
    [['Planning', 'In Progress', 'Content Ready', 'Script Completed', 'Shoot Scheduled', 'Shooting Completed', 'AI Generation Completed', 'Editing'], 'FFFFF4C2', 'FF7A5C00'],
    [['Scheduled'], 'FFDCEBFF', 'FF0D47A1'],
    [['Under Review'], 'FFEDE3FA', 'FF4A2A8A'],
    [['Correction Required', 'Required', 'Failed'], 'FFFFE3C7', 'FF8A4300'],
    [['Approved', 'Completed', 'Passed', 'Ready', 'Corrected', 'Done'], 'FFD7F2DF', 'FF1B5E20'],
    [['Published'], 'FF0B5D2A', 'FFFFFFFF'],
    [['On Hold'], 'FFE3E8EB', 'FF455A64'],
  ];

  // ---------- small helpers ----------
  function colLetter(n) { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }
  const q = (name) => `'${name.replace(/'/g, "''")}'`;
  const toDate = (iso) => { if (!iso) return null; const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
  const setLabel = (code) => 'Set ' + code.slice(1);
  const setCode = (label) => { const m = String(label || '').match(/(\d+)/); return m ? 'S' + D.pad2(Number(m[1])) : ''; };
  const S_IDX = (code) => D.SETS.findIndex((s) => s.code === code);
  const FC_ROW0 = 10; // first set row in Festival Calendar

  // ---------- tracker column specifications ----------
  // k: kind (text|date|int|set|brand|list key|formula); f: state field; fx: formula builder
  const LISTS = {
    prod: ['A', D.PROD_STATUSES], pub: ['B', D.PUB_STATUSES], step: ['C', D.STEP_STATUSES], appr: ['D', D.APPROVAL_STATUSES],
    qc: ['E', D.QC_STATUSES], corr: ['F', D.CORRECTION_STATUSES], ready: ['G', D.READY_STATUSES], prio: ['H', D.PRIORITIES],
    plat: ['I', D.PLATFORMS], brand: ['J', D.BRANDS.map((b) => b.name)], fest: ['K', D.FESTIVALS.map((f) => f.name)],
    type: ['L', D.CONTENT_TYPES], cat: ['M', ['Production', 'Planning', 'Meeting', 'Personal', 'Follow-up', 'Other']],
    tstat: ['N', ['Pending', 'In Progress', 'Completed', 'Moved']], ctype: ['O', ['New Festival Campaign', 'New Production Set', 'New Brand Campaign', 'New Service', 'Custom Target']],
    set: ['P', D.SETS.map((s) => s.label)],
  };
  const listRef = (key) => { const [col, arr] = LISTS[key]; return `Lists!$${col}$2:$${col}$${arr.length + 1}`; };

  const PUB_FIRST = 5;
  const pubRange = (col) => `${q(SHEETS.pub)}!$${col}$${PUB_FIRST}:$${col}$${LAST}`;
  const pubLookup = (col, isDate) => (ctx, r) => {
    const m = `MATCH($A${r},${pubRange('A')},0)`;
    const idx = `INDEX(${pubRange(col)},${m})`;
    return `IFERROR(IF(${idx}="","",${idx}),"")`;
  };
  const doneFx = (ctx, r) => `IF(OR(${ctx.c('status')}${r}="Approved",${ctx.c('status')}${r}="Completed"),1,0)`;
  const flagFx = (ctx, r) => {
    const dl = ctx.c('deadline') + r, dn = ctx.c('__done') + r, h = `((${dl}+1-NOW())*24)`;
    return `IF(${dn}=1,"Done",IF(${dl}="","",IF(${dl}<TODAY(),"OVERDUE",IF(${h}<=Alert_3,"DUE ≤"&Alert_3&"H",IF(${h}<=Alert_2,"DUE ≤"&Alert_2&"H",IF(${h}<=Alert_1,"DUE ≤"&Alert_1&"H","On Track"))))))`;
  };
  const act = (ctx, f, r) => `OR(${ctx.c(f)}${r}="In Progress",${ctx.c(f)}${r}="Completed")`;
  const stageFx = (type) => (ctx, r) => {
    const s = ctx.c('status') + r, dn = ctx.c('__done') + r;
    const head = `IF(${dn}=1,"Final Approval",IF(OR(${s}="Under Review",${s}="Correction Required"),"Quality Check",`;
    if (type === 'Poster') {
      return head + `IF(OR(${s}="Editing",${act(ctx, 'designStatus', r)}),"Graphic Designing",IF(OR(${s}="In Progress",${s}="Content Ready",${s}="Script Completed",${act(ctx, 'contentStatus', r)}),"Content Writing","Poster Topic"))))`;
    }
    if (type === 'AI Video') {
      return head + `IF(OR(${act(ctx, 'subtitleStatus', r)},${act(ctx, 'thumbStatus', r)}),"Subtitles and Thumbnail",IF(OR(${s}="Editing",${s}="AI Generation Completed",${act(ctx, 'editStatus', r)},${act(ctx, 'voStatus', r)}),"Voice-over and Editing",IF(${act(ctx, 'aiGenStatus', r)},"AI Video Generation",IF(OR(${s}="Script Completed",${act(ctx, 'promptStatus', r)}),"AI Prompt Creation",IF(OR(${s}="In Progress",${s}="Content Ready",${act(ctx, 'scriptStatus', r)}),"Script Writing","Video Concept")))))))`;
    }
    return head + `IF(OR(${act(ctx, 'subtitleStatus', r)},${act(ctx, 'thumbStatus', r)}),"Subtitles and Thumbnail",IF(OR(${s}="Editing",${act(ctx, 'editStatus', r)}),"Video Editing",IF(OR(${s}="Shoot Scheduled",${s}="Shooting Completed",${act(ctx, 'shootStatus', r)},${ctx.c('scriptApproval')}${r}="Approved"),"Video Shooting",IF(OR(${s}="Script Completed",${ctx.c('scriptStatus')}${r}="Completed"),"Script Approval",IF(OR(${s}="In Progress",${s}="Content Ready",${s}="Planning",${ctx.c('scriptStatus')}${r}="In Progress"),"Script Preparation","VJ Assignment")))))))`;
  };
  const F = (h, f, w, k, fx, extra) => Object.assign({ h, f, w, k, fx }, extra || {});
  const auto = (h, key, w, fx, isDate) => F(h, key, w, 'formula', fx, { date: !!isDate });

  const POSTER_SPEC = [
    F('Poster ID', 'id', 26, 'text'), F('Festival', 'festival', 11, 'fest'), F('Set Number', 'set', 9, 'set'), F('Brand Name', 'brand', 22, 'brand'),
    F('Poster Number', 'num', 8, 'int'), F('Poster Topic', 'topic', 26, 'text'), F('Poster Content', 'content', 30, 'text'), F('Design Concept', 'concept', 26, 'text'),
    F('Reference Link', 'refLink', 18, 'text'), F('Assigned Designer', 'designer', 16, 'text'), F('Content Status', 'contentStatus', 14, 'step'),
    F('Design Status', 'designStatus', 14, 'step'), F('Quality Check', 'qc', 12, 'qc'), F('Correction Status', 'correction', 13, 'corr'),
    F('Final Approval', 'finalApproval', 16, 'appr'), F('Production Start Date', 'prodStart', 13, 'date'), F('Production Deadline', 'deadline', 13, 'date'),
    F('Completion Date', 'completionDate', 13, 'date'), auto('Publishing Date', '__pubDate', 13, pubLookup('H'), true), auto('Publishing Status', '__pubStatus', 14, pubLookup('M')),
    F('Overall Production Status', 'status', 22, 'prod'), F('Creative File Link', 'fileLink', 20, 'text'), auto('Published Post Link', '__pubLink', 20, pubLookup('N')),
    F('Remarks', 'remarks', 24, 'text'), F('Priority', 'priority', 10, 'prio'),
    auto('Workflow Stage', '__stage', 20, stageFx('Poster')), auto('Done (Auto)', '__done', 9, doneFx), auto('Deadline Flag', '__flag', 13, flagFx),
  ];
  const AI_SPEC = [
    F('AI Video ID', 'id', 26, 'text'), F('Festival', 'festival', 11, 'fest'), F('Set Number', 'set', 9, 'set'), F('Brand Name', 'brand', 22, 'brand'),
    F('Video Number', 'num', 8, 'int'), F('Video Topic', 'topic', 26, 'text'), F('Video Concept', 'concept', 26, 'text'), F('Video Duration', 'duration', 10, 'text'),
    F('Script', 'script', 30, 'text'), F('AI Generation Prompt', 'prompt', 30, 'text'), F('Reference Image Link', 'refLink', 18, 'text'),
    F('Voice-over Status', 'voStatus', 13, 'step'), F('Script Status', 'scriptStatus', 13, 'step'), F('Prompt Status', 'promptStatus', 13, 'step'),
    F('AI Generation Status', 'aiGenStatus', 14, 'step'), F('Editing Status', 'editStatus', 13, 'step'), F('Subtitle Status', 'subtitleStatus', 13, 'step'),
    F('Thumbnail Status', 'thumbStatus', 13, 'step'), F('Quality Check', 'qc', 12, 'qc'), F('Final Approval', 'finalApproval', 16, 'appr'),
    F('Production Start Date', 'prodStart', 13, 'date'), F('Production Deadline', 'deadline', 13, 'date'), F('Completion Date', 'completionDate', 13, 'date'),
    auto('Publishing Date', '__pubDate', 13, pubLookup('H'), true), auto('Publishing Status', '__pubStatus', 14, pubLookup('M')),
    F('Overall Production Status', 'status', 22, 'prod'), F('Video File Link', 'fileLink', 20, 'text'), auto('Published Video Link', '__pubLink', 20, pubLookup('N')),
    F('Remarks', 'remarks', 24, 'text'), F('Priority', 'priority', 10, 'prio'),
    auto('Workflow Stage', '__stage', 22, stageFx('AI Video')), auto('Done (Auto)', '__done', 9, doneFx), auto('Deadline Flag', '__flag', 13, flagFx),
  ];
  const VJ_SPEC = (vjIdx) => [
    F('Video ID', 'id', 26, 'text'), auto('Assigned VJ', '__vj', 14, () => `VJ${vjIdx + 1}_Name`), F('Festival', 'festival', 11, 'fest'), F('Set Number', 'set', 9, 'set'),
    F('Brand', 'brand', 22, 'brand'), F('Video Topic', 'topic', 26, 'text'), F('Video Concept', 'concept', 26, 'text'), F('VJ Script', 'script', 30, 'text'),
    F('Video Duration', 'duration', 10, 'text'), F('Script Status', 'scriptStatus', 13, 'step'), F('Script Approval', 'scriptApproval', 16, 'appr'),
    F('Shoot Date', 'shootDate', 12, 'date'), F('Shooting Location', 'location', 18, 'text'), F('Shooting Status', 'shootStatus', 13, 'step'),
    F('Editing Status', 'editStatus', 13, 'step'), F('Subtitle Status', 'subtitleStatus', 13, 'step'), F('Thumbnail Status', 'thumbStatus', 13, 'step'),
    F('Quality Check', 'qc', 12, 'qc'), F('Correction Status', 'correction', 13, 'corr'), F('Final Approval', 'finalApproval', 16, 'appr'),
    F('Production Start Date', 'prodStart', 13, 'date'), F('Production Deadline', 'deadline', 13, 'date'), F('Completion Date', 'completionDate', 13, 'date'),
    auto('Publishing Date', '__pubDate', 13, pubLookup('H'), true), auto('Publishing Status', '__pubStatus', 14, pubLookup('M')),
    F('Overall Production Status', 'status', 22, 'prod'), F('Video File Link', 'fileLink', 20, 'text'), auto('Published Video Link', '__pubLink', 20, pubLookup('N')),
    F('Remarks', 'remarks', 24, 'text'), F('Priority', 'priority', 10, 'prio'),
    auto('Workflow Stage', '__stage', 22, stageFx('VJ Video')), auto('Done (Auto)', '__done', 9, doneFx), auto('Deadline Flag', '__flag', 13, flagFx),
  ];

  // Tracker descriptors (sheet, first data row, spec)
  function trackers() {
    const t = [
      { key: 'poster', type: 'Poster', sheet: SHEETS.poster, hdr: 4, spec: POSTER_SPEC },
      { key: 'ai', type: 'AI Video', sheet: SHEETS.ai, hdr: 4, spec: AI_SPEC },
    ];
    D.VJ_IDS.forEach((id, i) => t.push({ key: 'vj' + (i + 1), type: 'VJ Video', vj: id, sheet: vjSheetName(id), hdr: 8, spec: VJ_SPEC(i) }));
    t.forEach((tr) => {
      tr.first = tr.hdr + 1;
      tr.colOf = {}; tr.spec.forEach((c, i) => { tr.colOf[c.f] = colLetter(i + 1); });
      tr.c = (f) => tr.colOf[f];
      tr.rng = (f) => `${q(tr.sheet)}!$${tr.colOf[f]}$${tr.first}:$${tr.colOf[f]}$${LAST}`;
    });
    return t;
  }
  const TR = trackers();
  const trackerFor = (a) => a.type === 'Poster' ? TR[0] : a.type === 'AI Video' ? TR[1] : TR[2 + D.VJ_IDS.indexOf(a.vj)];

  // Sum one aggregate across all five trackers. build(tr) returns the inner argument list.
  const across = (fn, build, list) => (list || TR).map((t) => `${fn}(${build(t)})`).join('+');
  const vjOnly = TR.slice(2);

  const PUB_SPEC = [
    F('Content ID', 'id', 26, 'text'), F('Festival', 'festival', 11, 'fest'), F('Set Number', 'set', 9, 'set'), F('Brand', 'brand', 22, 'brand'),
    F('Content Type', 'type', 11, 'type'), auto('Content Title', '__title', 28, null), auto('Production Status', '__prod', 20, null),
    F('Scheduled Publishing Date', 'pubDate', 14, 'date'), F('Publishing Time', 'pubTime', 10, 'text'), F('Social Media Platform', 'platform', 14, 'plat'),
    F('Caption Status', 'captionStatus', 11, 'ready'), F('Hashtag Status', 'hashtagStatus', 11, 'ready'), F('Publishing Status', 'pubStatus', 14, 'pub'),
    F('Published URL', 'pubLink', 24, 'text'), F('Remarks', 'pubRemarks', 22, 'text'),
    auto('Set Window Start', '__ws', 12, null, true), auto('Set Window End', '__we', 12, null, true), auto('Approval Check', '__chk', 26, null),
  ];

  // ---------- generic writers ----------
  function banner(ws, title, sub, span) {
    const end = colLetter(span || 12);
    ws.mergeCells(`A1:${end}1`);
    const t = ws.getCell('A1'); t.value = title;
    t.font = { name: 'Calibri', size: 18, bold: true, color: { argb: C.white } }; t.fill = fill(C.navy); t.alignment = { vertical: 'middle', indent: 1 };
    ws.getRow(1).height = 34;
    ws.mergeCells(`A2:${end}2`);
    const s = ws.getCell('A2'); s.value = sub || '';
    s.font = { size: 10, italic: true, color: { argb: 'FF2F3E4E' } }; s.fill = fill('FFE7EFEA'); s.alignment = { indent: 1 };
    const back = ws.getCell(`${colLetter((span || 12) + 1)}1`);
    back.value = { text: '◀ Dashboard', hyperlink: `#${q(SHEETS.dash)}!A1` }; back.font = { color: { argb: 'FF1E6FD9' }, underline: true, bold: true };
  }
  function header(ws, row, labels, opts) {
    const r = ws.getRow(row);
    labels.forEach((l, i) => {
      const c = r.getCell(i + 1 + ((opts && opts.offset) || 0));
      c.value = l; c.font = { bold: true, color: { argb: C.white }, size: 10 };
      c.fill = fill((opts && opts.color) || C.forest); c.alignment = { wrapText: true, vertical: 'middle', horizontal: 'center' }; c.border = box;
    });
    r.height = (opts && opts.height) || 32;
  }
  const fx = (cell, formula, fmt) => { cell.value = { formula }; if (fmt) cell.numFmt = fmt; return cell; };
  const DATE_FMT = 'dd-mmm-yyyy';
  const PCT = '0.0%';
  const bar = (ref, n) => `REPT("█",ROUND(${ref}*${n || 20},0))&REPT("░",${n || 20}-ROUND(${ref}*${n || 20},0))`;

  function addStatusCF(ws, ref) {
    const rules = [];
    STATUS_STYLE.forEach(([vals, bg, fg]) => vals.forEach((v) => rules.push({ type: 'cellIs', operator: 'equal', formulae: [`"${v}"`], style: { fill: cfFill(bg), font: { color: { argb: fg } } } })));
    ws.addConditionalFormatting({ ref, rules });
  }
  function addFlagCF(ws, ref) {
    ws.addConditionalFormatting({ ref, rules: [
      { type: 'cellIs', operator: 'equal', formulae: ['"OVERDUE"'], style: { fill: cfFill('FFFFD6D6'), font: { color: { argb: 'FFB71C1C' }, bold: true } } },
      { type: 'containsText', operator: 'containsText', text: 'DUE ≤', style: { fill: cfFill('FFFFE3C7'), font: { color: { argb: 'FF8A4300' } } } },
      { type: 'cellIs', operator: 'equal', formulae: ['"Done"'], style: { fill: cfFill('FFD7F2DF'), font: { color: { argb: 'FF1B5E20' } } } },
    ] });
  }
  function pctCF(ws, ref) {
    ws.addConditionalFormatting({ ref, rules: [{ type: 'dataBar', minLength: 0, maxLength: 100, cfvo: [{ type: 'num', value: 0 }, { type: 'num', value: 1 }], color: { argb: 'FF2E9E4F' }, gradient: false }] });
  }
  function validate(ws, ref, key) { ws.dataValidations.add(ref, { type: 'list', allowBlank: true, formulae: [listRef(key)], showErrorMessage: true, errorTitle: 'Invalid value', error: 'Please choose a value from the dropdown list.' }); }
  function validateDate(ws, ref) { ws.dataValidations.add(ref, { type: 'date', operator: 'greaterThan', allowBlank: true, formulae: [new Date(Date.UTC(2020, 0, 1))], showErrorMessage: true, error: 'Enter a valid date.' }); }

  function writeSpecRows(ws, spec, hdr, rows, extraBlank, ctx) {
    header(ws, hdr, spec.map((c) => c.h));
    spec.forEach((c, i) => { ws.getColumn(i + 1).width = c.w; if (c.k === 'formula') ws.getRow(hdr).getCell(i + 1).fill = fill('FF3D5A80'); });
    const first = hdr + 1;
    rows.forEach((a, ri) => {
      const r = first + ri, row = ws.getRow(r);
      spec.forEach((c, i) => {
        const cell = row.getCell(i + 1);
        if (c.k === 'formula') { fx(cell, c.fx(ctx, r, a), c.date ? DATE_FMT : undefined); cell.fill = fill(C.auto); return; }
        let v = a[c.f];
        if (c.k === 'date') { cell.value = toDate(v); cell.numFmt = DATE_FMT; return; }
        if (c.k === 'set') v = v ? setLabel(v) : '';
        if (c.k === 'int') v = v === '' || v == null ? null : Number(v);
        cell.value = v === '' ? null : v;
      });
    });
    const lastData = first + rows.length - 1 + (extraBlank || 0);
    // validations + formats on input columns (including blank rows for future additions)
    spec.forEach((c, i) => {
      const L = colLetter(i + 1), ref = `${L}${first}:${L}${Math.max(lastData, first)}`;
      if (LISTS[c.k]) validate(ws, ref, c.k);
      if (c.k === 'date') { validateDate(ws, ref); for (let r = first + rows.length; r <= lastData; r++) ws.getCell(`${L}${r}`).numFmt = DATE_FMT; }
      if (['prod', 'pub', 'step', 'appr', 'qc', 'corr', 'ready'].includes(c.k) || ['__pubStatus', '__prod', '__stage'].includes(c.f)) addStatusCF(ws, ref);
      if (c.f === '__flag') addFlagCF(ws, ref);
    });
    ws.autoFilter = { from: { row: hdr, column: 1 }, to: { row: hdr, column: spec.length } };
    return lastData;
  }

  // ---------- builder ----------
  async function build(ExcelJS, state, opts) {
    opts = opts || {};
    const st = state;
    const S = st.settings;
    const wb = new ExcelJS.Workbook();
    wb.creator = S.owner; wb.company = S.organization; wb.title = "MAHI – VJ.Nathan's Personal Workflow Control Center";
    wb.calcProperties.fullCalcOnLoad = true;

    const order = [SHEETS.dash, SHEETS.brand, SHEETS.fest, ...D.SETS.map(setSheetName), ...D.VJ_IDS.map(vjSheetName), SHEETS.poster, SHEETS.ai, SHEETS.pub,
      SHEETS.daily, SHEETS.weekly, SHEETS.flow, SHEETS.alerts, SHEETS.perf, SHEETS.ach, SHEETS.notes, SHEETS.annual, SHEETS.settings, SHEETS.log, SHEETS.help, SHEETS.lists, SHEETS.state];
    const ws = {};
    const tabColor = (n) => n.includes('Christmas') ? 'FFC62828' : n.includes('New Year') ? 'FF1A3E8C' : n.includes('Pongal') ? 'FFE0A800' : n.startsWith('VJ') ? 'FF7E57C2' : n === SHEETS.dash ? 'FFC9A227' : 'FF1B5E20';
    order.forEach((n) => { ws[n] = wb.addWorksheet(n, { properties: { tabColor: { argb: tabColor(n) } }, views: [{ showGridLines: n.startsWith('_') }] }); });

    // ---- Lists (hidden) ----
    const Ls = ws[SHEETS.lists];
    Object.keys(LISTS).forEach((k) => { const [col, arr] = LISTS[k]; Ls.getCell(`${col}1`).value = k; arr.forEach((v, i) => { Ls.getCell(`${col}${i + 2}`).value = v; }); });
    Ls.state = 'hidden';

    // ---- Settings & defined names ----
    const Sg = ws[SHEETS.settings];
    banner(Sg, 'SETTINGS', 'Edit the yellow cells. Names flow automatically into every tracker, report and chart.', 7);
    [4, 28, 34, 22, 18, 30, 14].forEach((w, i) => { Sg.getColumn(i + 1).width = w; });
    const inp = (cell, v, fmt) => { cell.value = v; cell.fill = fill('FFFFF8D6'); cell.border = box; cell.protection = { locked: false }; if (fmt) cell.numFmt = fmt; return cell; };
    const lab = (cell, v) => { cell.value = v; cell.font = { bold: true }; return cell; };
    header(Sg, 3, ['', 'Owner', 'Value'], { height: 20 });
    const ownerRows = [['Owner Name', S.owner, 'OwnerName'], ['MAHI calls me', S.callName, 'CallName'], ['Organization', S.organization, 'OrgName'], ['Department', S.department, 'DeptName'], ['Profile Picture (file path / URL)', S.ownerPic && !S.ownerPic.startsWith('data:') ? S.ownerPic : '', 'OwnerPic']];
    ownerRows.forEach(([l, v, nm], i) => { lab(Sg.getCell(`B${4 + i}`), l); inp(Sg.getCell(`C${4 + i}`), v); wb.definedNames.add(`${q(SHEETS.settings)}!$C$${4 + i}`, nm); });
    header(Sg, 10, ['', 'VJ Member', 'Display Name', 'Profile Picture (path / URL)', 'Assigned Brands', 'Assigned Videos', ''], { height: 20 });
    D.VJ_IDS.forEach((id, i) => {
      const r = 11 + i, v = S.vjs[i] || { name: id, pic: '' };
      lab(Sg.getCell(`B${r}`), id); inp(Sg.getCell(`C${r}`), v.name); inp(Sg.getCell(`D${r}`), v.pic && !v.pic.startsWith('data:') ? v.pic : '');
      Sg.getCell(`E${r}`).value = D.BRANDS.filter((b) => b.vjMember === id).map((b) => b.name).join(', '); Sg.getCell(`E${r}`).alignment = { wrapText: true };
      fx(Sg.getCell(`F${r}`), `COUNTA(${TR[2 + i].rng('id')})`);
      wb.definedNames.add(`${q(SHEETS.settings)}!$C$${r}`, `VJ${i + 1}_Name`);
    });
    header(Sg, 15, ['', 'Deadline alert thresholds', 'Hours before deadline'], { height: 20 });
    const th = (S.thresholds || [72, 48, 24]).slice().sort((a, b) => b - a);
    ['First alert (largest)', 'Second alert', 'Final alert (smallest)'].forEach((l, i) => { lab(Sg.getCell(`B${16 + i}`), l); inp(Sg.getCell(`C${16 + i}`), th[i]); wb.definedNames.add(`${q(SHEETS.settings)}!$C$${16 + i}`, `Alert_${i + 1}`); });
    Sg.getCell('D16').value = 'Keep the three values in descending order (e.g. 72 / 48 / 24).';
    header(Sg, 20, ['', 'Status', 'Colour meaning'], { height: 20 });
    const legend = [['Not Started', 'Grey'], ['In Progress', 'Yellow'], ['Scheduled', 'Blue'], ['Under Review', 'Purple'], ['Correction Required', 'Orange'], ['Approved', 'Green'], ['Completed', 'Green'], ['Published', 'Dark Green'], ['OVERDUE', 'Red']];
    legend.forEach(([s, m], i) => { Sg.getCell(`B${21 + i}`).value = s; Sg.getCell(`C${21 + i}`).value = m; });
    addStatusCF(Sg, 'B21:B29'); addFlagCF(Sg, 'B21:B29');
    header(Sg, 31, ['', 'Web-app preference', 'Value'], { height: 20 });
    [['Theme', S.theme], ['Reduced motion', S.reducedMotion ? 'On' : 'Off'], ['Sound effects', S.sound ? 'On' : 'Off'], ['Decorative animations', S.decor ? 'On' : 'Off'], ['Festival mode', S.festivalMode]].forEach(([l, v], i) => { Sg.getCell(`B${32 + i}`).value = l; Sg.getCell(`C${32 + i}`).value = String(v); });
    Sg.getCell('B38').value = 'Web-app preferences are managed inside the MAHI app (Settings page) and stored here for reference.';

    // ---- Festival Calendar ----
    const Fc = ws[SHEETS.fest];
    banner(Fc, 'FESTIVAL CALENDAR', 'Confirmed production schedule (fixed) with editable 7-day publishing windows (yellow).', 13);
    [10, 13, 15, 15, 15, 12, 15, 15, 14, 11, 11, 11, 12].forEach((w, i) => { Fc.getColumn(i + 1).width = w; });
    header(Fc, 3, ['Festival', 'Festival Date', 'Production Start', 'Production End', 'Sets', 'Target', 'Completed', 'Pending', 'Completion %']);
    const allDone = (crit) => across('SUMIFS', (t) => `${t.rng('__done')},${crit(t)}`);
    const allCount = (crit) => across('COUNTIFS', (t) => crit(t));
    D.FESTIVALS.forEach((f, i) => {
      const r = 4 + i;
      Fc.getCell(`A${r}`).value = f.name; Fc.getCell(`B${r}`).value = f.dateLabel;
      Fc.getCell(`C${r}`).value = toDate(f.prodStart); Fc.getCell(`C${r}`).numFmt = DATE_FMT;
      Fc.getCell(`D${r}`).value = toDate(f.prodEnd); Fc.getCell(`D${r}`).numFmt = DATE_FMT;
      fx(Fc.getCell(`E${r}`), `COUNTIF($B$${FC_ROW0}:$B$${FC_ROW0 + 6},$A${r})`);
      fx(Fc.getCell(`F${r}`), allCount((t) => `${t.rng('festival')},$A${r}`));
      fx(Fc.getCell(`G${r}`), allDone((t) => `${t.rng('festival')},$A${r}`));
      fx(Fc.getCell(`H${r}`), `F${r}-G${r}`); fx(Fc.getCell(`I${r}`), `IF(F${r}=0,0,G${r}/F${r})`, PCT);
    });
    fx(Fc.getCell('F7'), 'SUM(F4:F6)'); fx(Fc.getCell('G7'), 'SUM(G4:G6)'); fx(Fc.getCell('H7'), 'SUM(H4:H6)'); fx(Fc.getCell('I7'), 'IF(F7=0,0,G7/F7)', PCT); Fc.getCell('A7').value = 'TOTAL';
    Fc.getRow(7).font = { bold: true };
    header(Fc, FC_ROW0 - 1, ['Set', 'Festival', 'Production Start', 'Production End', 'Production Days', 'Publishing Start', 'Publishing End', 'Schedule Type', 'Target', 'Completed', 'Pending', 'Completion %', 'Status']);
    D.SETS.forEach((s, i) => {
      const r = FC_ROW0 + i, w = (S.pubWindows || {})[s.code] || D.defaultPubWindows()[s.code];
      Fc.getCell(`A${r}`).value = { text: s.label, hyperlink: `#${q(setSheetName(s))}!A1` }; Fc.getCell(`A${r}`).font = { color: { argb: 'FF1E6FD9' }, underline: true };
      Fc.getCell(`B${r}`).value = s.festival;
      Fc.getCell(`C${r}`).value = toDate(s.start); Fc.getCell(`C${r}`).numFmt = DATE_FMT;
      Fc.getCell(`D${r}`).value = toDate(s.end); Fc.getCell(`D${r}`).numFmt = DATE_FMT;
      fx(Fc.getCell(`E${r}`), `D${r}-C${r}+1`);
      inp(Fc.getCell(`F${r}`), toDate(w.start), DATE_FMT); inp(Fc.getCell(`G${r}`), toDate(w.end), DATE_FMT);
      Fc.getCell(`H${r}`).value = s.compressed ? 'COMPRESSED – prepare in advance' : 'Standard';
      if (s.compressed) Fc.getCell(`H${r}`).font = { bold: true, color: { argb: 'FFB71C1C' } };
      fx(Fc.getCell(`I${r}`), allCount((t) => `${t.rng('set')},"${s.label}"`));
      fx(Fc.getCell(`J${r}`), allDone((t) => `${t.rng('set')},"${s.label}"`));
      fx(Fc.getCell(`K${r}`), `I${r}-J${r}`); fx(Fc.getCell(`L${r}`), `IF(I${r}=0,0,J${r}/I${r})`, PCT);
      fx(Fc.getCell(`M${r}`), `IF(AND(I${r}>0,J${r}=I${r}),"Completed",IF(TODAY()<C${r},"Upcoming",IF(TODAY()<=D${r},"Active","Ended – "&K${r}&" pending")))`);
    });
    pctCF(Fc, `L${FC_ROW0}:L${FC_ROW0 + 6}`); pctCF(Fc, 'I4:I6');
    Fc.getCell(`A${FC_ROW0 + 8}`).value = 'Production dates are confirmed and never change automatically. Publishing windows default to the 7 days after each production end – edit them as needed.';
    Fc.getCell(`A${FC_ROW0 + 9}`).value = 'Set 03 (New Year) and Set 05 (Pongal) are COMPRESSED 3-day schedules – start scripts, prompts and shoots in advance.';
    Fc.getCell(`A${FC_ROW0 + 9}`).font = { bold: true, color: { argb: 'FFB71C1C' } };
    Fc.views = [{ state: 'frozen', ySplit: 3, showGridLines: false }];
    const fcCell = (code, col) => `${q(SHEETS.fest)}!$${col}$${FC_ROW0 + S_IDX(code)}`;

    // ---- Trackers ----
    const byTracker = TR.map(() => []);
    st.assets.forEach((a) => { byTracker[TR.indexOf(trackerFor(a))].push(a); });
    for (let ti = 0; ti < TR.length; ti++) {
      const t = TR[ti], w = ws[t.sheet];
      const isVJ = t.type === 'VJ Video';
      banner(w, (isVJ ? `${t.vj} VIDEO TRACKER` : t.type === 'Poster' ? 'POSTER PRODUCTION TRACKER' : 'AI VIDEO PRODUCTION TRACKER'),
        'One authoritative record per asset. Change "Overall Production Status" to Approved/Completed to count it. Blue-grey columns are automatic.', 14);
      if (isVJ) {
        const vi = D.VJ_IDS.indexOf(t.vj);
        fx(w.getCell('A3'), `"Assigned VJ: "&VJ${vi + 1}_Name&"   |   Brands: ${D.BRANDS.filter((b) => b.vjMember === t.vj).map((b) => b.name).join(', ')}"`);
        w.getCell('A3').font = { bold: true, color: { argb: 'FF4A2A8A' } };
        const R = (f) => `${t.c(f)}${t.first}:${t.c(f)}${LAST}`;
        const stats = [['Assigned Videos', `COUNTA(${R('id')})`], ['Completed Scripts', `COUNTIF(${R('scriptStatus')},"Completed")`], ['Completed Shoots', `COUNTIF(${R('shootStatus')},"Completed")`],
          ['Completed Edits', `COUNTIF(${R('editStatus')},"Completed")`], ['Approved Videos', `COUNTIF(${R('finalApproval')},"Approved")`], ['Published Videos', `COUNTIF(${R('__pubStatus')},"Published")`],
          ['Production Completed', `SUM(${R('__done')})`], ['Pending Assignments', `A6-G6`], ['Overdue Assignments', `COUNTIF(${R('__flag')},"OVERDUE")`], ['Completion %', `IF(A6=0,0,G6/A6)`]];
        stats.forEach(([l, f], i) => {
          const L = colLetter(i + 1), lc = w.getCell(`${L}5`), vc = w.getCell(`${L}6`);
          lc.value = l; lc.font = { bold: true, size: 9, color: { argb: C.white } }; lc.fill = fill('FF7E57C2'); lc.alignment = { wrapText: true, horizontal: 'center' };
          fx(vc, f, i === 9 ? PCT : undefined); vc.font = { bold: true, size: 14, color: { argb: 'FF4A2A8A' } }; vc.alignment = { horizontal: 'center' }; vc.border = box;
        });
        w.getRow(5).height = 28;
      }
      writeSpecRows(w, t.spec, t.hdr, byTracker[ti], 60, t);
      w.views = [{ state: 'frozen', xSplit: 1, ySplit: t.hdr, showGridLines: false }];
    }

    // ---- Publishing Calendar ----
    const Pc = ws[SHEETS.pub];
    banner(Pc, 'SOCIAL MEDIA PUBLISHING CALENDAR', 'One row per production asset (440). Production totals never double-count: extra platforms go to the Platform Publishing Log.', 16);
    const pubCtx = { c: (f) => colLetter(PUB_SPEC.findIndex((x) => x.f === f) + 1) };
    PUB_SPEC.find((x) => x.f === '__title').fx = (ctx, r, a) => { const t = trackerFor(a); const m = `MATCH($A${r},${t.rng('id')},0)`; return `IFERROR(IF(INDEX(${t.rng('topic')},${m})="",$A${r},INDEX(${t.rng('topic')},${m})),$A${r})`; };
    PUB_SPEC.find((x) => x.f === '__prod').fx = (ctx, r, a) => { const t = trackerFor(a); return `IFERROR(INDEX(${t.rng('status')},MATCH($A${r},${t.rng('id')},0)),"")`; };
    PUB_SPEC.find((x) => x.f === '__ws').fx = (ctx, r) => `IFERROR(INDEX(${q(SHEETS.fest)}!$F$${FC_ROW0}:$F$${FC_ROW0 + 6},MATCH($C${r},${q(SHEETS.fest)}!$A$${FC_ROW0}:$A$${FC_ROW0 + 6},0)),"")`;
    PUB_SPEC.find((x) => x.f === '__we').fx = (ctx, r) => `IFERROR(INDEX(${q(SHEETS.fest)}!$G$${FC_ROW0}:$G$${FC_ROW0 + 6},MATCH($C${r},${q(SHEETS.fest)}!$A$${FC_ROW0}:$A$${FC_ROW0 + 6},0)),"")`;
    PUB_SPEC.find((x) => x.f === '__chk').fx = (ctx, r) => `IF(AND($M${r}="Published",$G${r}<>"Approved",$G${r}<>"Completed"),"⚠ Published before approval",IF(AND($H${r}<>"",$P${r}<>"",OR($H${r}<$P${r},$H${r}>$Q${r})),"Outside set window",""))`;
    writeSpecRows(Pc, PUB_SPEC, 4, st.assets, 0, pubCtx);
    Pc.addConditionalFormatting({ ref: `R5:R${4 + st.assets.length}`, rules: [{ type: 'containsText', operator: 'containsText', text: '⚠', style: { fill: cfFill('FFFFD6D6'), font: { bold: true, color: { argb: 'FFB71C1C' } } } }] });
    Pc.views = [{ state: 'frozen', xSplit: 1, ySplit: 4, showGridLines: false }];

    // ---- Platform publishing log ----
    const Pl = ws[SHEETS.log];
    banner(Pl, 'PLATFORM PUBLISHING LOG', 'Log each extra platform a creative is posted to. These rows never change production totals.', 8);
    const LOG_SPEC = [F('Log ID', 'id', 14, 'text'), F('Content ID', 'contentId', 26, 'text'), F('Platform', 'platform', 14, 'plat'), F('Date', 'date', 13, 'date'), F('Time', 'time', 10, 'text'), F('Status', 'status', 14, 'pub'), F('URL', 'url', 30, 'text'), F('Remarks', 'remarks', 28, 'text')];
    writeSpecRows(Pl, LOG_SPEC, 4, st.platformLogs || [], 300, {});
    Pl.views = [{ state: 'frozen', ySplit: 4, showGridLines: false }];

    // ---- Set sheets ----
    const P = TR[0], A = TR[1];
    D.SETS.forEach((s, si) => {
      const w = ws[setSheetName(s)], L = s.label;
      banner(w, `${s.label.toUpperCase()} – ${s.festival.toUpperCase()} CAMPAIGN`, `Production ${D.fmtDate(s.start)} → ${D.fmtDate(s.end)}. 15 brands · 62 posters · 14 AI videos · 12 VJ videos · 88 deliverables. All counts update from the asset trackers.`, 22);
      [6, 22, 11, 8, 9, 8, 8, 9, 8, 8, 14, 9, 8, 8, 9, 8, 11, 12, 12, 16, 13, 24].forEach((x, i) => { w.getColumn(i + 1).width = x; });
      const info = [['Festival', s.festival], ['Production Start', { formula: fcCell(s.code, 'C') }, DATE_FMT], ['Production Deadline', { formula: fcCell(s.code, 'D') }, DATE_FMT],
        ['Publishing Window', { formula: `TEXT(${fcCell(s.code, 'F')},"dd-mmm")&" → "&TEXT(${fcCell(s.code, 'G')},"dd-mmm-yyyy")` }],
        ['Days to Deadline', { formula: `${fcCell(s.code, 'D')}-TODAY()` }], ['Set Completion', { formula: 'IF(N22=0,0,O22/N22)' }, PCT], ['Status', { formula: fcCell(s.code, 'M') }]];
      info.forEach(([l, v, f], i) => {
        const col = colLetter(1 + i * 3), lc = w.getCell(`${col}3`), vc = w.getCell(`${col}4`);
        w.mergeCells(`${col}3:${colLetter(3 + i * 3)}3`); w.mergeCells(`${col}4:${colLetter(3 + i * 3)}4`);
        lc.value = l; lc.font = { bold: true, size: 9, color: { argb: C.white } }; lc.fill = fill(s.festival === 'Christmas' ? 'FFC62828' : s.festival === 'New Year' ? 'FF1A3E8C' : 'FFB7860B'); lc.alignment = { horizontal: 'center' };
        vc.value = v; if (f) vc.numFmt = f; vc.font = { bold: true, size: 12 }; vc.alignment = { horizontal: 'center' }; vc.border = box;
      });
      if (s.compressed) { w.getCell('A5').value = '⚠ COMPRESSED 3-DAY PRODUCTION SCHEDULE – prepare scripts, prompts and shoots in advance.'; w.getCell('A5').font = { bold: true, color: { argb: 'FFB71C1C' } }; }
      header(w, 6, ['S.No', 'Brand', 'Festival', 'Poster Target', 'Poster Completed', 'Poster Pending', 'AI Video Target', 'AI Video Completed', 'AI Video Pending', 'VJ Video Target', 'Assigned VJ',
        'VJ Video Completed', 'VJ Video Pending', 'Total Target', 'Total Completed', 'Total Pending', 'Completion %', 'Production Start Date', 'Production Deadline', 'Publishing Status', 'Overall Status', 'Remarks'], { height: 42 });
      D.BRANDS.forEach((b, bi) => {
        const r = 7 + bi, B = `$B${r}`;
        w.getCell(`A${r}`).value = bi + 1; w.getCell(`B${r}`).value = b.name; w.getCell(`C${r}`).value = s.festival;
        fx(w.getCell(`D${r}`), `COUNTIFS(${P.rng('set')},"${L}",${P.rng('brand')},${B})`);
        fx(w.getCell(`E${r}`), `SUMIFS(${P.rng('__done')},${P.rng('set')},"${L}",${P.rng('brand')},${B})`);
        fx(w.getCell(`F${r}`), `D${r}-E${r}`);
        fx(w.getCell(`G${r}`), `COUNTIFS(${A.rng('set')},"${L}",${A.rng('brand')},${B})`);
        fx(w.getCell(`H${r}`), `SUMIFS(${A.rng('__done')},${A.rng('set')},"${L}",${A.rng('brand')},${B})`);
        fx(w.getCell(`I${r}`), `G${r}-H${r}`);
        fx(w.getCell(`J${r}`), across('COUNTIFS', (t) => `${t.rng('set')},"${L}",${t.rng('brand')},${B}`, vjOnly));
        fx(w.getCell(`K${r}`), b.vjMember ? `IF(J${r}=0,"—",VJ${D.VJ_IDS.indexOf(b.vjMember) + 1}_Name)` : '"—"');
        fx(w.getCell(`L${r}`), across('SUMIFS', (t) => `${t.rng('__done')},${t.rng('set')},"${L}",${t.rng('brand')},${B}`, vjOnly));
        fx(w.getCell(`M${r}`), `J${r}-L${r}`);
        fx(w.getCell(`N${r}`), `D${r}+G${r}+J${r}`); fx(w.getCell(`O${r}`), `E${r}+H${r}+L${r}`); fx(w.getCell(`P${r}`), `N${r}-O${r}`);
        fx(w.getCell(`Q${r}`), `IF(N${r}=0,0,O${r}/N${r})`, PCT);
        fx(w.getCell(`R${r}`), fcCell(s.code, 'C'), DATE_FMT); fx(w.getCell(`S${r}`), fcCell(s.code, 'D'), DATE_FMT);
        fx(w.getCell(`T${r}`), `COUNTIFS(${pubRange('C')},"${L}",${pubRange('D')},${B},${pubRange('M')},"Published")&" / "&N${r}&" published"`);
        fx(w.getCell(`U${r}`), `IF(N${r}=0,"—",IF(O${r}=N${r},"Completed",IF(AND(TODAY()>S${r},O${r}<N${r}),"Overdue",IF(O${r}>0,"In Progress","Not Started"))))`);
        const rc = w.getCell(`V${r}`); rc.protection = { locked: false }; rc.fill = fill('FFFFF8D6');
      });
      const tr = 22;
      w.getCell(`B${tr}`).value = 'TOTAL';
      ['D', 'E', 'F', 'G', 'H', 'I', 'J', 'L', 'M', 'N', 'O', 'P'].forEach((c) => fx(w.getCell(`${c}${tr}`), `SUM(${c}7:${c}21)`));
      fx(w.getCell(`Q${tr}`), `IF(N${tr}=0,0,O${tr}/N${tr})`, PCT);
      w.getRow(tr).font = { bold: true }; w.getRow(tr).eachCell((c) => { c.fill = fill(C.mint); c.border = box; });
      pctCF(w, 'Q7:Q21');
      addStatusCF(w, 'U7:U21');
      w.addConditionalFormatting({ ref: 'U7:U21', rules: [{ type: 'cellIs', operator: 'equal', formulae: ['"Overdue"'], style: { fill: cfFill('FFFFD6D6'), font: { bold: true, color: { argb: 'FFB71C1C' } } } }] });
      w.autoFilter = 'A6:V21';
      w.views = [{ state: 'frozen', xSplit: 2, ySplit: 6, showGridLines: false }];
    });

    // ---- Brand Master Plan ----
    const Bm = ws[SHEETS.brand];
    banner(Bm, 'BRAND-WISE PRODUCTION MASTER PLAN', 'Per-set allocation (baseline, repeated across all 5 sets) and live progress across the whole festival phase.', 13);
    [6, 24, 10, 10, 10, 10, 14, 8, 12, 12, 12, 12, 22].forEach((x, i) => { Bm.getColumn(i + 1).width = x; });
    header(Bm, 3, ['S.No', 'Brand', 'Posters / Set', 'AI Videos / Set', 'VJ Videos / Set', 'Total / Set', 'Assigned VJ', 'Sets', 'All-Set Target', 'Completed', 'Pending', 'Completion %', 'Progress']);
    D.BRANDS.forEach((b, i) => {
      const r = 4 + i;
      Bm.getCell(`A${r}`).value = i + 1;
      Bm.getCell(`B${r}`).value = { text: b.name, hyperlink: `#${q(SHEETS.poster)}!A1` }; Bm.getCell(`B${r}`).value = b.name;
      Bm.getCell(`C${r}`).value = b.posters; Bm.getCell(`D${r}`).value = b.ai; Bm.getCell(`E${r}`).value = b.vj;
      fx(Bm.getCell(`F${r}`), `C${r}+D${r}+E${r}`);
      fx(Bm.getCell(`G${r}`), b.vjMember ? `VJ${D.VJ_IDS.indexOf(b.vjMember) + 1}_Name` : '"—"');
      fx(Bm.getCell(`H${r}`), `COUNTA(${q(SHEETS.fest)}!$A$${FC_ROW0}:$A$${FC_ROW0 + 6})`);
      fx(Bm.getCell(`I${r}`), allCount((t) => `${t.rng('brand')},$B${r}`));
      fx(Bm.getCell(`J${r}`), allDone((t) => `${t.rng('brand')},$B${r}`));
      fx(Bm.getCell(`K${r}`), `I${r}-J${r}`); fx(Bm.getCell(`L${r}`), `IF(I${r}=0,0,J${r}/I${r})`, PCT);
      fx(Bm.getCell(`M${r}`), bar(`L${r}`, 15));
    });
    Bm.getCell('B19').value = 'TOTAL';
    ['C', 'D', 'E', 'F', 'I', 'J', 'K'].forEach((c) => fx(Bm.getCell(`${c}19`), `SUM(${c}4:${c}18)`));
    fx(Bm.getCell('L19'), 'IF(I19=0,0,J19/I19)', PCT); Bm.getRow(19).font = { bold: true };
    pctCF(Bm, 'L4:L18');
    header(Bm, 22, ['', 'Festival', 'Sets', 'Posters', 'AI Videos', 'VJ Videos', 'Total', 'Completed', 'Completion %']);
    D.FESTIVALS.forEach((f, i) => {
      const r = 23 + i, cnt = (type) => across('COUNTIFS', (t) => `${t.rng('festival')},$B${r}`, TR.filter((t) => t.type === type));
      Bm.getCell(`B${r}`).value = f.name;
      fx(Bm.getCell(`C${r}`), `COUNTIF(${q(SHEETS.fest)}!$B$${FC_ROW0}:$B$${FC_ROW0 + 6},$B${r})`);
      fx(Bm.getCell(`D${r}`), cnt('Poster')); fx(Bm.getCell(`E${r}`), cnt('AI Video')); fx(Bm.getCell(`F${r}`), cnt('VJ Video'));
      fx(Bm.getCell(`G${r}`), `D${r}+E${r}+F${r}`); fx(Bm.getCell(`H${r}`), allDone((t) => `${t.rng('festival')},$B${r}`));
      fx(Bm.getCell(`I${r}`), `IF(G${r}=0,0,H${r}/G${r})`, PCT);
    });
    Bm.getCell('B26').value = 'TOTAL'; ['C', 'D', 'E', 'F', 'G', 'H'].forEach((c) => fx(Bm.getCell(`${c}26`), `SUM(${c}23:${c}25)`)); fx(Bm.getCell('I26'), 'IF(G26=0,0,H26/G26)', PCT);
    Bm.getRow(26).font = { bold: true };
    Bm.getCell('B28').value = 'Baseline: every set = 62 posters + 14 AI videos + 12 VJ videos = 88 deliverables. Columns C–E are the confirmed allocation; production records themselves live in the trackers.';
    Bm.views = [{ state: 'frozen', ySplit: 3, showGridLines: false }];

    // ---- Dashboard ----
    const Db = ws[SHEETS.dash];
    [3, 22, 22, 22, 22, 22, 22, 3].forEach((x, i) => { Db.getColumn(i + 1).width = x; });
    Db.mergeCells('B1:G1'); Db.mergeCells('B2:G2'); Db.mergeCells('B3:G3');
    const t1 = Db.getCell('B1'); t1.value = 'MAHI'; t1.font = { size: 30, bold: true, color: { argb: C.gold } }; t1.fill = fill(C.navy); t1.alignment = { horizontal: 'center', vertical: 'middle' };
    const t2 = Db.getCell('B2'); t2.value = "VJ.NATHAN'S PERSONAL WORKFLOW CONTROL CENTER"; t2.font = { size: 15, bold: true, color: { argb: C.white } }; t2.fill = fill(C.forest); t2.alignment = { horizontal: 'center' };
    const t3 = Db.getCell('B3'); t3.value = 'IGO Group of Companies | Digital Marketing   ·   One Vision. One Workflow. One Digital Companion.'; t3.font = { italic: true, color: { argb: 'FF2F3E4E' } }; t3.fill = fill('FFE7EFEA'); t3.alignment = { horizontal: 'center' };
    Db.getRow(1).height = 44; Db.getRow(2).height = 24;
    const currentSetIdx = `MATCH(TRUE,INDEX(${q(SHEETS.fest)}!$D$${FC_ROW0}:$D$${FC_ROW0 + 6}>=TODAY(),0),0)`;
    const fcIdx = (col) => `INDEX(${q(SHEETS.fest)}!$${col}$${FC_ROW0}:$${col}$${FC_ROW0 + 6},${currentSetIdx})`;
    fx(Db.getCell('B4'), '"Owner: "&OwnerName'); fx(Db.getCell('C4'), '"Today: "&TEXT(TODAY(),"dd-mmm-yyyy")');
    fx(Db.getCell('D4'), `"Current campaign: "&IFERROR(${fcIdx('B')}&" ("&${fcIdx('A')}&")","Festival phase complete")`);
    fx(Db.getCell('F4'), 'IF(OwnerPic="","Profile picture: set it in Settings","Profile picture: "&OwnerPic)');
    Db.getRow(4).font = { bold: true, color: { argb: C.ink } };
    // navigation
    const nav = [SHEETS.brand, SHEETS.fest, ...D.SETS.map(setSheetName), ...D.VJ_IDS.map(vjSheetName), SHEETS.poster, SHEETS.ai, SHEETS.pub, SHEETS.daily, SHEETS.weekly, SHEETS.flow, SHEETS.alerts, SHEETS.perf, SHEETS.ach, SHEETS.notes, SHEETS.annual, SHEETS.settings, SHEETS.log, SHEETS.help];
    Db.getCell('B6').value = 'QUICK NAVIGATION'; Db.getCell('B6').font = { bold: true, color: { argb: C.forest } };
    nav.forEach((n, i) => { const c = Db.getCell(`${colLetter(2 + (i % 6))}${7 + Math.floor(i / 6)}`); c.value = { text: '▸ ' + n, hyperlink: `#${q(n)}!A1` }; c.font = { color: { argb: 'FF1E6FD9' }, underline: true }; });
    const allTarget = across('COUNTA', (t) => t.rng('id'));
    const allDoneSum = across('SUM', (t) => t.rng('__done'));
    const cards = [
      ['Total Brands', `COUNTA(${q(SHEETS.brand)}!$B$4:$B$18)`], ['Total Sets', `COUNTA(${q(SHEETS.fest)}!$A$${FC_ROW0}:$A$${FC_ROW0 + 6})`], ['Overall Target', allTarget],
      ['Completed Tasks', allDoneSum], ['Pending Tasks', 'D13-E13'], ['Overall Completion %', 'IF(D13=0,0,E13/D13)', PCT],
      ['Poster Target', `COUNTA(${P.rng('id')})`], ['AI Video Target', `COUNTA(${A.rng('id')})`], ['VJ Video Target', across('COUNTA', (t) => t.rng('id'), vjOnly)],
      ['Current Set', `IFERROR(${fcIdx('A')}&" · "&${fcIdx('B')},"All sets ended")`], ['Current Set Progress', `IFERROR(${fcIdx('L')},0)`, PCT], ["Today's Tasks", allCount((t) => `${t.rng('prodStart')},"<="&TODAY(),${t.rng('deadline')},">="&TODAY()`)],
      ["Today's Completed Tasks", allCount((t) => `${t.rng('completionDate')},TODAY()`)], ["Today's Pending Tasks", allCount((t) => `${t.rng('prodStart')},"<="&TODAY(),${t.rng('deadline')},">="&TODAY(),${t.rng('__done')},0`)],
      ['Upcoming Deadlines', across('COUNTIF', (t) => `${t.rng('__flag')},"DUE*"`)], ['Overdue Assignments', across('COUNTIF', (t) => `${t.rng('__flag')},"OVERDUE"`)],
      ['Waiting for Approval', across('COUNTIF', (t) => `${t.rng('status')},"Under Review"`)], ['Scheduled Content', `COUNTIF(${pubRange('M')},"Scheduled")`],
      ['Published Content', `COUNTIF(${pubRange('M')},"Published")`], ['Correction Required', across('COUNTIF', (t) => `${t.rng('status')},"Correction Required"`)],
    ];
    // card grid: label row / value row, 6 per row starting B12
    cards.forEach(([l, f, fmt], i) => {
      const col = colLetter(2 + (i % 6)), lr = 12 + Math.floor(i / 6) * 3;
      const lc = Db.getCell(`${col}${lr}`), vc = Db.getCell(`${col}${lr + 1}`);
      lc.value = l.toUpperCase(); lc.font = { bold: true, size: 9, color: { argb: 'FF5B6B7B' } }; lc.fill = fill(C.soft); lc.alignment = { horizontal: 'center' }; lc.border = { top: { style: 'medium', color: { argb: C.emerald } }, left: thin, right: thin };
      fx(vc, f, fmt); vc.font = { bold: true, size: 20, color: { argb: l.startsWith('Overdue') ? 'FFB71C1C' : C.forest } }; vc.fill = fill(C.soft); vc.alignment = { horizontal: 'center', vertical: 'middle' }; vc.border = { bottom: thin, left: thin, right: thin };
      Db.getRow(lr + 1).height = 32;
    });
    // Card positions used above: D13 = Overall Target, E13 = Completed.
    let r0 = 25;
    const section = (row, title) => { const c = Db.getCell(`B${row}`); c.value = title; c.font = { bold: true, size: 13, color: { argb: C.forest } }; };
    section(r0, 'FESTIVAL CAMPAIGN PROGRESS');
    header(Db, r0 + 1, ['Festival', 'Target', 'Completed', 'Pending', 'Completion %', 'Progress'], { offset: 1, height: 20 });
    D.FESTIVALS.forEach((f, i) => {
      const r = r0 + 2 + i;
      Db.getCell(`B${r}`).value = f.name;
      fx(Db.getCell(`C${r}`), `${q(SHEETS.fest)}!F${4 + i}`); fx(Db.getCell(`D${r}`), `${q(SHEETS.fest)}!G${4 + i}`);
      fx(Db.getCell(`E${r}`), `C${r}-D${r}`); fx(Db.getCell(`F${r}`), `IF(C${r}=0,0,D${r}/C${r})`, PCT); fx(Db.getCell(`G${r}`), bar(`F${r}`, 20));
      Db.getCell(`B${r}`).font = { bold: true, color: { argb: f.name === 'Christmas' ? 'FFC62828' : f.name === 'New Year' ? 'FF1A3E8C' : 'FFB7860B' } };
    });
    r0 = 31; section(r0, 'VJ MONITORING');
    header(Db, r0 + 1, ['VJ', 'Assigned', 'Completed', 'Pending', 'Overdue', 'Completion %'], { offset: 1, height: 20 });
    D.VJ_IDS.forEach((id, i) => {
      const r = r0 + 2 + i, t = TR[2 + i];
      fx(Db.getCell(`B${r}`), `"${id} · "&VJ${i + 1}_Name`);
      fx(Db.getCell(`C${r}`), `COUNTA(${t.rng('id')})`); fx(Db.getCell(`D${r}`), `SUM(${t.rng('__done')})`); fx(Db.getCell(`E${r}`), `C${r}-D${r}`);
      fx(Db.getCell(`F${r}`), `COUNTIF(${t.rng('__flag')},"OVERDUE")`); fx(Db.getCell(`G${r}`), `IF(C${r}=0,0,D${r}/C${r})`, PCT);
    });
    pctCF(Db, `G${r0 + 2}:G${r0 + 4}`);
    r0 = 37; section(r0, 'SET COMPLETION');
    header(Db, r0 + 1, ['Set', 'Festival', 'Target', 'Completed', 'Completion %', 'Status'], { offset: 1, height: 20 });
    D.SETS.forEach((s, i) => {
      const r = r0 + 2 + i, fr = FC_ROW0 + i;
      Db.getCell(`B${r}`).value = { text: s.label, hyperlink: `#${q(setSheetName(s))}!A1` }; Db.getCell(`B${r}`).font = { color: { argb: 'FF1E6FD9' }, underline: true };
      Db.getCell(`C${r}`).value = s.festival + (s.compressed ? ' (compressed)' : '');
      fx(Db.getCell(`D${r}`), `${q(SHEETS.fest)}!I${fr}`); fx(Db.getCell(`E${r}`), `${q(SHEETS.fest)}!J${fr}`);
      fx(Db.getCell(`F${r}`), `${q(SHEETS.fest)}!L${fr}`, PCT); fx(Db.getCell(`G${r}`), `${q(SHEETS.fest)}!M${fr}`);
    });
    pctCF(Db, `F${r0 + 2}:F${r0 + 8}`);
    r0 = 48; section(r0, 'CONTENT TYPE PROGRESS');
    header(Db, r0 + 1, ['Content Type', 'Target', 'Completed', 'Pending', 'Completion %', 'Progress'], { offset: 1, height: 20 });
    [['Posters', [P]], ['AI Videos', [A]], ['VJ Videos', vjOnly]].forEach(([n, list], i) => {
      const r = r0 + 2 + i;
      Db.getCell(`B${r}`).value = n;
      fx(Db.getCell(`C${r}`), across('COUNTA', (t) => t.rng('id'), list)); fx(Db.getCell(`D${r}`), across('SUM', (t) => t.rng('__done'), list));
      fx(Db.getCell(`E${r}`), `C${r}-D${r}`); fx(Db.getCell(`F${r}`), `IF(C${r}=0,0,D${r}/C${r})`, PCT); fx(Db.getCell(`G${r}`), bar(`F${r}`, 20));
    });
    // completed vs pending data for chart
    Db.getCell('B54').value = 'Completed'; fx(Db.getCell('C54'), 'E13');
    Db.getCell('B55').value = 'Pending'; fx(Db.getCell('C55'), 'F13');
    Db.getRow(54).font = { color: { argb: 'FF8A97A3' } }; Db.getRow(55).font = { color: { argb: 'FF8A97A3' } };
    r0 = 57; section(r0, 'HOW TO USE THIS WORKBOOK');
    [
      '1. Update each asset in Poster Tracker, AI Video Tracker or the VJ 01/02/03 Trackers – use the dropdowns (yellow/grey cells show statuses).',
      '2. An asset counts as COMPLETED only when "Overall Production Status" is Approved or Completed. Each asset is counted exactly once.',
      '3. Publishing is tracked separately in Publishing Calendar (one row per asset). Extra platforms go to Platform Publishing Log.',
      '4. Overdue / due-soon flags are calculated automatically from the Production Deadline and today\'s date (thresholds in Settings).',
      '5. Rename VJ members or the owner in Settings – every tracker, report and dashboard updates automatically.',
      '6. Set sheets, dashboard, reports and charts are formula-driven and protected (no password) – Review ▸ Unprotect Sheet if you need to edit them.',
      '7. To use the MAHI web app: open MAHI_Personal_Workflow_Control_Center → Excel Import & Export → Import this workbook.',
      '   Editing this file separately does NOT sync automatically – re-import it into the app after editing.',
    ].forEach((t, i) => { Db.getCell(`B${r0 + 1 + i}`).value = t; });
    Db.views = [{ showGridLines: false }];

    // ---- Workflow Chart ----
    const Wf = ws[SHEETS.flow];
    banner(Wf, 'WORKFLOW CHART – LIVE STAGE DISTRIBUTION', 'Every asset sits in exactly one stage (see "Workflow Stage" column in each tracker). Counts update automatically.', 8);
    [4, 30, 12, 12, 16, 26, 4, 4].forEach((x, i) => { Wf.getColumn(i + 1).width = x; });
    let wr = 4;
    const stageCount = (stage, list) => across('COUNTIF', (t) => `${t.rng('__stage')},"${stage}"`, list);
    const stageOver = (stage, list) => across('COUNTIFS', (t) => `${t.rng('__stage')},"${stage}",${t.rng('__flag')},"OVERDUE"`, list);
    const stateFx = (r, beyondExpr) => `IF(D${r}>0,"⚠ OVERDUE",IF(C${r}>0,"● ACTIVE",IF(${beyondExpr},"✔ COMPLETED","○ PENDING")))`;
    header(Wf, wr, ['', 'Main workflow stage', 'Tasks', 'Overdue', 'State', 'Flow'], { height: 20 }); wr++;
    const mainStages = [
      ['FESTIVAL PLANNING', allTarget, '0'],
      ['BRAND CONTENT PLANNING', ['Poster Topic', 'Video Concept', 'VJ Assignment'].map((s) => stageCount(s)).join('+'), ['Poster Topic', 'Video Concept', 'VJ Assignment'].map((s) => stageOver(s)).join('+')],
      ['CONTENT AND SCRIPT PREPARATION', ['Content Writing', 'Script Writing', 'Script Preparation'].map((s) => stageCount(s)).join('+'), ['Content Writing', 'Script Writing', 'Script Preparation'].map((s) => stageOver(s)).join('+')],
      ['CONCEPT APPROVAL', ['Script Approval', 'AI Prompt Creation'].map((s) => stageCount(s)).join('+'), ['Script Approval', 'AI Prompt Creation'].map((s) => stageOver(s)).join('+')],
    ];
    mainStages.forEach(([n, c, o]) => { Wf.getCell(`B${wr}`).value = n; fx(Wf.getCell(`C${wr}`), c); fx(Wf.getCell(`D${wr}`), o); fx(Wf.getCell(`E${wr}`), stateFx(wr, 'FALSE')); fx(Wf.getCell(`F${wr}`), `REPT("▮",MIN(40,ROUND(C${wr}/16,0)))`); wr++; });
    const branchStart = {};
    Object.keys(D.BRANCH_STAGES).forEach((type) => {
      wr++;
      const list = TR.filter((t) => t.type === type);
      header(Wf, wr, ['', `BRANCH – ${type === 'Poster' ? '01 POSTER' : type === 'AI Video' ? '02 AI VIDEO' : '03 VJ VIDEO'} PRODUCTION`, 'Tasks', 'Overdue', 'State', 'Flow'], { height: 20, color: type === 'Poster' ? 'FF2E9E4F' : type === 'AI Video' ? 'FF1E6FD9' : 'FF7E57C2' }); wr++;
      branchStart[type] = wr;
      const stages = D.BRANCH_STAGES[type];
      stages.forEach((sname, si) => {
        Wf.getCell(`B${wr}`).value = sname; fx(Wf.getCell(`C${wr}`), stageCount(sname, list)); fx(Wf.getCell(`D${wr}`), sname === 'Final Approval' ? '0' : stageOver(sname, list));
        const beyond = si === stages.length - 1 ? `C${wr}=${across('COUNTA', (t) => t.rng('id'), list)}` : `SUM(C${wr - si}:C${wr})=0`;
        fx(Wf.getCell(`E${wr}`), stateFx(wr, si === stages.length - 1 ? beyond : `SUM(C${wr - si}:C${wr})=0`));
        fx(Wf.getCell(`F${wr}`), `REPT("▮",MIN(40,ROUND(C${wr}/8,0)))`);
        wr++;
      });
    });
    wr++;
    header(Wf, wr, ['', 'MERGED HANDOVER & PUBLISHING', 'Tasks', 'Overdue', 'State', 'Flow'], { height: 20 }); wr++;
    const weekStart = 'TODAY()-WEEKDAY(TODAY(),2)+1';
    const post = [
      ['ALL THREE BRANCHES MERGE (approved)', allDoneSum],
      ['FINAL CONTENT HANDOVER', `COUNTIFS(${pubRange('G')},"Approved",${pubRange('M')},"Not Scheduled")+COUNTIFS(${pubRange('G')},"Completed",${pubRange('M')},"Not Scheduled")`],
      ['SOCIAL MEDIA SCHEDULING', `COUNTIF(${pubRange('M')},"Scheduled")`],
      ['PUBLISHING', `COUNTIF(${pubRange('M')},"Published")`],
      ['PERFORMANCE MONITORING', `COUNTIF(${pubRange('M')},"Published")`],
      ['WEEKLY REPORT (published this week)', `COUNTIFS(${pubRange('M')},"Published",${pubRange('H')},">="&${weekStart},${pubRange('H')},"<="&(${weekStart}+6))`],
    ];
    post.forEach(([n, c]) => { Wf.getCell(`B${wr}`).value = n; fx(Wf.getCell(`C${wr}`), c); Wf.getCell(`D${wr}`).value = 0; fx(Wf.getCell(`E${wr}`), `IF(C${wr}>0,"● ACTIVE","○ PENDING")`); fx(Wf.getCell(`F${wr}`), `REPT("▮",MIN(40,ROUND(C${wr}/16,0)))`); wr++; });
    Wf.addConditionalFormatting({ ref: `E5:E${wr}`, rules: [
      { type: 'containsText', operator: 'containsText', text: 'OVERDUE', style: { fill: cfFill('FFFFD6D6'), font: { bold: true, color: { argb: 'FFB71C1C' } } } },
      { type: 'containsText', operator: 'containsText', text: 'ACTIVE', style: { fill: cfFill('FFFFF4C2'), font: { color: { argb: 'FF7A5C00' } } } },
      { type: 'containsText', operator: 'containsText', text: 'COMPLETED', style: { fill: cfFill('FFD7F2DF'), font: { color: { argb: 'FF1B5E20' } } } },
      { type: 'containsText', operator: 'containsText', text: 'PENDING', style: { fill: cfFill('FFF0F0F0'), font: { color: { argb: 'FF616161' } } } },
    ] });
    Wf.getColumn(6).font = { color: { argb: C.emerald } };
    Wf.views = [{ showGridLines: false }];
    const flowMeta = { branchStart };

    // ---- Deadline Alerts ----
    const Da = ws[SHEETS.alerts];
    banner(Da, 'DEADLINE ALERTS', 'Calculated from each asset\'s Production Deadline, completion status and TODAY(). Filter any tracker\'s "Deadline Flag" column for the exact list.', 11);
    [12, 14, 14, 12, 11, 11, 11, 11, 11, 30, 4].forEach((x, i) => { Da.getColumn(i + 1).width = x; });
    fx(Da.getCell('A3'), '"Alert thresholds: "&Alert_1&"h / "&Alert_2&"h / "&Alert_3&"h before deadline"'); Da.getCell('A3').font = { italic: true };
    header(Da, 5, ['Set', 'Festival', 'Deadline', 'Days Left', 'Pending', 'Overdue', `Due ≤ Final`, 'Due ≤ 2nd', 'Due ≤ 1st', 'Alert']);
    D.SETS.forEach((s, i) => {
      const r = 6 + i, L = s.label;
      Da.getCell(`A${r}`).value = { text: L, hyperlink: `#${q(setSheetName(s))}!A1` }; Da.getCell(`B${r}`).value = s.festival;
      fx(Da.getCell(`C${r}`), fcCell(s.code, 'D'), DATE_FMT); fx(Da.getCell(`D${r}`), `C${r}-TODAY()`);
      fx(Da.getCell(`E${r}`), `${q(SHEETS.fest)}!K${FC_ROW0 + i}`);
      const flagCnt = (pat) => across('COUNTIFS', (t) => `${t.rng('set')},"${L}",${t.rng('__flag')},${pat}`);
      fx(Da.getCell(`F${r}`), flagCnt('"OVERDUE"'));
      fx(Da.getCell(`G${r}`), flagCnt('"DUE ≤"&Alert_3&"H"')); fx(Da.getCell(`H${r}`), flagCnt('"DUE ≤"&Alert_2&"H"')); fx(Da.getCell(`I${r}`), flagCnt('"DUE ≤"&Alert_1&"H"'));
      fx(Da.getCell(`J${r}`), `IF(E${r}=0,"✔ All complete",IF(F${r}>0,"⚠ "&F${r}&" overdue – prioritise",IF(G${r}+H${r}+I${r}>0,"⏰ "&(G${r}+H${r}+I${r})&" due soon",IF(D${r}<0,"","On track"))))`);
    });
    Da.addConditionalFormatting({ ref: 'F6:F12', rules: [{ type: 'cellIs', operator: 'greaterThan', formulae: ['0'], style: { fill: cfFill('FFFFD6D6'), font: { bold: true, color: { argb: 'FFB71C1C' } } } }] });
    Da.addConditionalFormatting({ ref: 'G6:I12', rules: [{ type: 'cellIs', operator: 'greaterThan', formulae: ['0'], style: { fill: cfFill('FFFFE3C7') } }] });
    Da.getCell('A15').value = 'OVERDUE MATRIX – brand × set (number of overdue assets)'; Da.getCell('A15').font = { bold: true, color: { argb: 'FFB71C1C' } };
    header(Da, 16, ['Brand', ...D.SETS.map((s) => s.label), 'Total']);
    Da.getColumn(1).width = 24;
    D.BRANDS.forEach((b, bi) => {
      const r = 17 + bi; Da.getCell(`A${r}`).value = b.name;
      D.SETS.forEach((s, si) => fx(Da.getCell(`${colLetter(2 + si)}${r}`), across('COUNTIFS', (t) => `${t.rng('set')},"${s.label}",${t.rng('brand')},$A${r},${t.rng('__flag')},"OVERDUE"`)));
      fx(Da.getCell(`I${r}`), `SUM(B${r}:H${r})`);
    });
    Da.addConditionalFormatting({ ref: 'B17:I31', rules: [{ type: 'cellIs', operator: 'greaterThan', formulae: ['0'], style: { fill: cfFill('FFFFD6D6'), font: { bold: true, color: { argb: 'FFB71C1C' } } } }] });
    Da.views = [{ showGridLines: false }];

    // ---- Performance Reports ----
    const Pr = ws[SHEETS.perf];
    [4, 26, 13, 13, 13, 13, 14, 14, 4].forEach((x, i) => { Pr.getColumn(i + 1).width = x; });
    Pr.mergeCells('B1:H1'); Pr.mergeCells('B2:H2'); Pr.mergeCells('B3:H3');
    Pr.getCell('B1').value = 'IGO GROUP OF COMPANIES'; Pr.getCell('B1').font = { size: 18, bold: true, color: { argb: C.white } }; Pr.getCell('B1').fill = fill(C.navy); Pr.getCell('B1').alignment = { horizontal: 'center' };
    Pr.getCell('B2').value = 'DIGITAL MARKETING PRODUCTION REPORT'; Pr.getCell('B2').font = { size: 13, bold: true, color: { argb: C.white } }; Pr.getCell('B2').fill = fill(C.forest); Pr.getCell('B2').alignment = { horizontal: 'center' };
    fx(Pr.getCell('B3'), '"Prepared and Managed by "&OwnerName'); Pr.getCell('B3').alignment = { horizontal: 'center' }; Pr.getCell('B3').font = { italic: true };
    Pr.getCell('I1').value = { text: '◀ Dashboard', hyperlink: `#${q(SHEETS.dash)}!A1` };
    lab(Pr.getCell('B5'), 'Report period from'); inp(Pr.getCell('C5'), toDate(D.WORKFLOW_START), DATE_FMT);
    lab(Pr.getCell('B6'), 'Report period to'); inp(Pr.getCell('C6'), toDate('2027-01-19'), DATE_FMT);
    wb.definedNames.add(`${q(SHEETS.perf)}!$C$5`, 'ReportFrom'); wb.definedNames.add(`${q(SHEETS.perf)}!$C$6`, 'ReportTo');
    const inRange = (t) => `${t.rng('completionDate')},">="&ReportFrom,${t.rng('completionDate')},"<="&ReportTo`;
    let pr = 8;
    const tbl = (title, cols) => { Pr.getCell(`B${pr}`).value = title; Pr.getCell(`B${pr}`).font = { bold: true, size: 12, color: { argb: C.forest } }; pr++; header(Pr, pr, cols, { offset: 1, height: 30 }); pr++; };
    const perfMeta = {};
    tbl('1. OVERALL PROJECT COMPLETION', ['Measure', 'Target', 'Completed', 'Pending', 'Completion %', 'Done in period', 'Published in period']);
    perfMeta.overall = pr;
    Pr.getCell(`B${pr}`).value = 'All festival deliverables'; fx(Pr.getCell(`C${pr}`), allTarget); fx(Pr.getCell(`D${pr}`), allDoneSum); fx(Pr.getCell(`E${pr}`), `C${pr}-D${pr}`);
    fx(Pr.getCell(`F${pr}`), `IF(C${pr}=0,0,D${pr}/C${pr})`, PCT); fx(Pr.getCell(`G${pr}`), across('COUNTIFS', inRange));
    fx(Pr.getCell(`H${pr}`), `COUNTIFS(${pubRange('M')},"Published",${pubRange('H')},">="&ReportFrom,${pubRange('H')},"<="&ReportTo)`); pr += 2;
    const groupTable = (title, rows, critFor, listFor) => {
      tbl(title, ['Group', 'Target', 'Completed', 'Pending', 'Completion %', 'Done in period', 'Overdue']);
      const start = pr;
      rows.forEach((g) => {
        const list = listFor ? listFor(g) : TR;
        Pr.getCell(`B${pr}`).value = g.label;
        fx(Pr.getCell(`C${pr}`), across('COUNTIFS', (t) => critFor(t, g), list));
        fx(Pr.getCell(`D${pr}`), across('SUMIFS', (t) => `${t.rng('__done')},${critFor(t, g)}`, list));
        fx(Pr.getCell(`E${pr}`), `C${pr}-D${pr}`); fx(Pr.getCell(`F${pr}`), `IF(C${pr}=0,0,D${pr}/C${pr})`, PCT);
        fx(Pr.getCell(`G${pr}`), across('COUNTIFS', (t) => `${critFor(t, g)},${inRange(t)}`, list));
        fx(Pr.getCell(`H${pr}`), across('COUNTIFS', (t) => `${critFor(t, g)},${t.rng('__flag')},"OVERDUE"`, list));
        pr++;
      });
      pctCF(Pr, `F${start}:F${pr - 1}`);
      const out = { start, end: pr - 1 }; pr++; return out;
    };
    perfMeta.type = groupTable('2. CONTENT TYPE REPORT (Posters / AI Videos / VJ Videos)', [{ label: 'Posters', l: [P] }, { label: 'AI Videos', l: [A] }, { label: 'VJ Videos', l: vjOnly }], (t) => `${t.rng('id')},"<>"`, (g) => g.l);
    perfMeta.fest = groupTable('3. FESTIVAL PRODUCTION REPORT', D.FESTIVALS.map((f) => ({ label: f.name })), (t, g) => `${t.rng('festival')},"${g.label}"`);
    perfMeta.set = groupTable('4. SET PRODUCTION REPORT', D.SETS.map((s) => ({ label: s.label })), (t, g) => `${t.rng('set')},"${g.label}"`);
    perfMeta.brand = groupTable('5. BRAND-WISE REPORT', D.BRANDS.map((b) => ({ label: b.name })), (t, g) => `${t.rng('brand')},"${g.label}"`);
    perfMeta.vj = groupTable('6. VJ PERFORMANCE REPORT', D.VJ_IDS.map((id, i) => ({ label: id, i })), (t) => `${t.rng('id')},"<>"`, (g) => [TR[2 + g.i]]);
    perfMeta.vj.names = true;
    D.VJ_IDS.forEach((id, i) => fx(Pr.getCell(`B${perfMeta.vj.start + i}`), `"${id} · "&VJ${i + 1}_Name`));
    // Daily trend
    tbl('7. DAILY PRODUCTIVITY TREND', ['Date', 'Completed', 'Cumulative', 'Published', 'Due that day', '', '']);
    perfMeta.daily = { start: pr };
    const nDays = D.daysBetween(D.WORKFLOW_START, '2027-01-19') + 1;
    for (let i = 0; i < nDays; i++) {
      const r = pr; Pr.getCell(`B${r}`).value = toDate(D.addDays(D.WORKFLOW_START, i)); Pr.getCell(`B${r}`).numFmt = 'ddd dd-mmm-yy';
      fx(Pr.getCell(`C${r}`), across('COUNTIF', (t) => `${t.rng('completionDate')},$B${r}`));
      fx(Pr.getCell(`D${r}`), i === 0 ? `C${r}` : `D${r - 1}+C${r}`);
      fx(Pr.getCell(`E${r}`), `COUNTIFS(${pubRange('M')},"Published",${pubRange('H')},$B${r})`);
      fx(Pr.getCell(`F${r}`), across('COUNTIF', (t) => `${t.rng('deadline')},$B${r}`));
      pr++;
    }
    perfMeta.daily.end = pr - 1; pr++;
    tbl('8. WEEKLY PRODUCTION REPORT', ['Week starting (Mon)', 'Completed', 'Published', 'Due that week', '', '', '']);
    perfMeta.weekly = { start: pr };
    for (let i = 0; i < 9; i++) {
      const r = pr; Pr.getCell(`B${r}`).value = toDate(D.addDays('2026-11-23', i * 7)); Pr.getCell(`B${r}`).numFmt = DATE_FMT;
      fx(Pr.getCell(`C${r}`), across('COUNTIFS', (t) => `${t.rng('completionDate')},">="&$B${r},${t.rng('completionDate')},"<="&($B${r}+6)`));
      fx(Pr.getCell(`D${r}`), `COUNTIFS(${pubRange('M')},"Published",${pubRange('H')},">="&$B${r},${pubRange('H')},"<="&($B${r}+6))`);
      fx(Pr.getCell(`E${r}`), across('COUNTIFS', (t) => `${t.rng('deadline')},">="&$B${r},${t.rng('deadline')},"<="&($B${r}+6)`));
      pr++;
    }
    perfMeta.weekly.end = pr - 1; pr++;
    tbl('9. PUBLISHING REPORT', ['Publishing status', 'Assets', '', '', '', '', '']);
    perfMeta.pub = { start: pr };
    D.PUB_STATUSES.forEach((p) => { Pr.getCell(`B${pr}`).value = p; fx(Pr.getCell(`C${pr}`), `COUNTIF(${pubRange('M')},"${p}")`); pr++; });
    perfMeta.pub.end = pr - 1;
    Pr.views = [{ state: 'frozen', ySplit: 6, showGridLines: false }];
    Pr.pageSetup = { orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: '1:3' };

    // ---- Achievement History ----
    const Ah = ws[SHEETS.ach];
    banner(Ah, 'ACHIEVEMENT HISTORY', 'Unlocks are calculated from the actual production records. Unlock dates are recorded by the MAHI app (or type them in).', 8);
    [5, 6, 34, 40, 12, 10, 14, 15].forEach((x, i) => { Ah.getColumn(i + 1).width = x; });
    header(Ah, 4, ['#', 'Icon', 'Achievement', 'Completion condition', 'Current', 'Target', 'Status', 'Unlock Date']);
    const festRow = (n) => 4 + D.FESTIVALS.findIndex((f) => f.name === n);
    const metric = {
      'first-task': [allDoneSum, '1'], 'first-poster': [`SUM(${P.rng('__done')})`, '1'], 'first-ai': [`SUM(${A.rng('__done')})`, '1'], 'first-vj': [across('SUM', (t) => t.rng('__done'), vjOnly), '1'],
      'ten': [allDoneSum, '10'], 'twentyfive': [allDoneSum, '25'], 'fifty': [allDoneSum, '50'], 'hundred': [allDoneSum, '100'],
      'first-brand': [D.SETS.map((s) => `COUNTIF(${q(setSheetName(s))}!$Q$7:$Q$21,1)`).join('+'), '1'],
      'first-set': [`COUNTIF(${q(SHEETS.fest)}!$L$${FC_ROW0}:$L$${FC_ROW0 + 6},1)`, '1'],
      'christmas': [`${q(SHEETS.fest)}!G${festRow('Christmas')}`, `${q(SHEETS.fest)}!F${festRow('Christmas')}`],
      'newyear': [`${q(SHEETS.fest)}!G${festRow('New Year')}`, `${q(SHEETS.fest)}!F${festRow('New Year')}`],
      'pongal': [`${q(SHEETS.fest)}!G${festRow('Pongal')}`, `${q(SHEETS.fest)}!F${festRow('Pongal')}`],
      'all': [allDoneSum, allTarget],
    };
    D.ACHIEVEMENTS.forEach((a, i) => {
      const r = 5 + i;
      Ah.getCell(`A${r}`).value = i + 1; Ah.getCell(`B${r}`).value = a.icon; Ah.getCell(`C${r}`).value = a.name; Ah.getCell(`D${r}`).value = a.cond;
      fx(Ah.getCell(`E${r}`), metric[a.key][0]); fx(Ah.getCell(`F${r}`), metric[a.key][1]);
      fx(Ah.getCell(`G${r}`), `IF(AND(F${r}>0,E${r}>=F${r}),"UNLOCKED","Locked")`);
      const u = (st.achievements || {})[a.key];
      inp(Ah.getCell(`H${r}`), u ? toDate(String(u).slice(0, 10)) : null, DATE_FMT);
    });
    Ah.addConditionalFormatting({ ref: 'G5:G18', rules: [{ type: 'cellIs', operator: 'equal', formulae: ['"UNLOCKED"'], style: { fill: cfFill('FFFFF1C1'), font: { bold: true, color: { argb: 'FF8A6D00' } } } }] });
    Ah.getCell('C21').value = 'MILESTONE LOG (from the MAHI app)'; Ah.getCell('C21').font = { bold: true, color: { argb: C.forest } };
    header(Ah, 22, ['', '', 'Milestone', 'Scope', 'Reached on', '', '', ''], { height: 20 });
    Object.keys(st.milestones || {}).forEach((k, i) => { const r = 23 + i; Ah.getCell(`C${r}`).value = k; Ah.getCell(`E${r}`).value = String(st.milestones[k]).slice(0, 10); });
    Ah.views = [{ state: 'frozen', ySplit: 4, showGridLines: false }];

    // ---- Personal Notes ----
    const Pn = ws[SHEETS.notes];
    banner(Pn, 'PERSONAL NOTES', 'Your private notes. Link a note to any Content ID if useful.', 7);
    const NOTE_SPEC = [F('Date', 'date', 13, 'date'), F('Title', 'title', 28, 'text'), F('Category', 'category', 14, 'cat'), F('Note', 'text', 70, 'text'), F('Linked Content ID', 'linkedId', 24, 'text'), F('Pinned', 'pinned', 8, 'text')];
    writeSpecRows(Pn, NOTE_SPEC, 4, (st.notes || []).map((n) => Object.assign({}, n, { date: (n.date || '').slice(0, 10), pinned: n.pinned ? 'Yes' : '' })), 200, {});
    Pn.getColumn(4).alignment = { wrapText: true, vertical: 'top' };
    Pn.views = [{ state: 'frozen', ySplit: 4, showGridLines: false }];

    // ---- My Daily Planner ----
    const Dp = ws[SHEETS.daily];
    banner(Dp, 'MY DAY – DAILY WORK PLANNER', 'Production figures update from the trackers. Custom tasks below are tracked separately and never change the 440 festival target.', 9);
    [4, 30, 14, 12, 13, 13, 13, 24, 30].forEach((x, i) => { Dp.getColumn(i + 1).width = x; });
    lab(Dp.getCell('B4'), 'Planner date'); inp(Dp.getCell('C4'), null, DATE_FMT); Dp.getCell('C4').value = { formula: 'TODAY()' }; Dp.getCell('D4').value = '← defaults to today; type any date to plan ahead';
    header(Dp, 6, ['', 'Production on this date', 'Posters', 'AI Videos', 'VJ Videos', 'Total'], { height: 20 });
    const dRows = [
      ['Active assignments (in production window, not done)', (t) => `COUNTIFS(${t.rng('prodStart')},"<="&$C$4,${t.rng('deadline')},">="&$C$4,${t.rng('__done')},0)`],
      ['Deadlines on this date', (t) => `COUNTIFS(${t.rng('deadline')},$C$4,${t.rng('__done')},0)`],
      ['Completed on this date', (t) => `COUNTIF(${t.rng('completionDate')},$C$4)`],
      ['Previous days\' pending (overdue)', (t) => `COUNTIFS(${t.rng('deadline')},"<"&$C$4,${t.rng('__done')},0)`],
      ['High-priority pending', (t) => `COUNTIFS(${t.rng('priority')},"High",${t.rng('__done')},0)`],
    ];
    dRows.forEach(([l, f], i) => {
      const r = 7 + i; Dp.getCell(`B${r}`).value = l;
      fx(Dp.getCell(`C${r}`), f(P)); fx(Dp.getCell(`D${r}`), f(A)); fx(Dp.getCell(`E${r}`), vjOnly.map(f).join('+')); fx(Dp.getCell(`F${r}`), `SUM(C${r}:E${r})`);
    });
    lab(Dp.getCell('B13'), 'Daily completion %'); fx(Dp.getCell('C13'), 'IF(F7+F9=0,0,F9/(F7+F9))', PCT);
    const TASK_SPEC = [F('Task ID', 'id', 12, 'text'), F('Task', 'title', 30, 'text'), F('Category', 'category', 14, 'cat'), F('Priority', 'priority', 12, 'prio'), F('Date', 'date', 13, 'date'),
      F('Reminder', 'reminder', 13, 'text'), F('Status', 'status', 13, 'tstat'), F('Linked Content ID', 'linkedId', 24, 'text'), F('Notes', 'notes', 30, 'text')];
    Dp.getCell('B15').value = 'MY CUSTOM TASKS'; Dp.getCell('B15').font = { bold: true, color: { argb: C.forest } };
    writeSpecRows(Dp, TASK_SPEC, 16, st.customTasks || [], 150, {});
    Dp.autoFilter = 'A16:I16';
    Dp.views = [{ state: 'frozen', ySplit: 4, showGridLines: false }];
    [4, 30, 14, 12, 13, 13, 13, 24, 30].forEach((x, i) => { Dp.getColumn(i + 1).width = Math.max(x, TASK_SPEC[i].w); });

    // ---- My Weekly Planner ----
    const Wp = ws[SHEETS.weekly];
    banner(Wp, 'MY WEEKLY PLANNER', 'Pick a week start (Monday). Production numbers come from the trackers; custom tasks from My Daily Planner.', 9);
    [4, 14, 14, 16, 14, 14, 14, 16, 40].forEach((x, i) => { Wp.getColumn(i + 1).width = x; });
    lab(Wp.getCell('B4'), 'Week starting'); inp(Wp.getCell('C4'), null, DATE_FMT); Wp.getCell('C4').value = { formula: 'TODAY()-WEEKDAY(TODAY(),2)+1' };
    header(Wp, 6, ['', 'Day', 'Date', 'Active production', 'Deadlines', 'Completed', 'Published', 'Custom tasks', 'My plan / notes'], { height: 22 });
    for (let i = 0; i < 7; i++) {
      const r = 7 + i;
      fx(Wp.getCell(`B${r}`), `TEXT(C${r},"dddd")`); fx(Wp.getCell(`C${r}`), `$C$4+${i}`, DATE_FMT);
      fx(Wp.getCell(`D${r}`), across('COUNTIFS', (t) => `${t.rng('prodStart')},"<="&$C${r},${t.rng('deadline')},">="&$C${r},${t.rng('__done')},0`));
      fx(Wp.getCell(`E${r}`), across('COUNTIF', (t) => `${t.rng('deadline')},$C${r}`));
      fx(Wp.getCell(`F${r}`), across('COUNTIF', (t) => `${t.rng('completionDate')},$C${r}`));
      fx(Wp.getCell(`G${r}`), `COUNTIFS(${pubRange('M')},"Published",${pubRange('H')},$C${r})`);
      fx(Wp.getCell(`H${r}`), `COUNTIF(${q(SHEETS.daily)}!$E$17:$E$${LAST},$C${r})`);
      const n = Wp.getCell(`I${r}`); n.protection = { locked: false }; n.fill = fill('FFFFF8D6');
    }
    Wp.getCell('B14').value = 'WEEK TOTAL'; ['E', 'F', 'G', 'H'].forEach((c) => fx(Wp.getCell(`${c}14`), `SUM(${c}7:${c}13)`)); Wp.getRow(14).font = { bold: true };
    Wp.getCell('B17').value = 'WEEKLY GOALS'; Wp.getCell('B17').font = { bold: true, color: { argb: C.forest } };
    header(Wp, 18, ['', 'Goal', '', '', 'Target', 'Achieved', 'Status', '', 'Notes'], { height: 20 });
    for (let i = 0; i < 8; i++) { const r = 19 + i; ['B', 'E', 'F', 'I'].forEach((c) => { const x = Wp.getCell(`${c}${r}`); x.fill = fill('FFFFF8D6'); x.protection = { locked: false }; }); fx(Wp.getCell(`G${r}`), `IF(E${r}="","",IF(F${r}>=E${r},"Achieved","In progress"))`); }
    Wp.views = [{ showGridLines: false }];

    // ---- Annual Workflow 2027 ----
    const Aw = ws[SHEETS.annual];
    banner(Aw, 'ANNUAL WORKFLOW 27 NOV 2026 – 11 NOV 2027', 'The 5 confirmed sets are the locked baseline (440). Add new campaigns / sets / brands / services below – their targets are kept separate.', 13);
    [16, 18, 22, 13, 13, 9, 9, 9, 9, 10, 9, 14, 24].forEach((x, i) => { Aw.getColumn(i + 1).width = x; });
    header(Aw, 4, ['Month', 'Confirmed campaigns', 'Baseline due (assets)', 'Baseline completed', 'New campaign targets', 'Notes']);
    const months = [];
    for (let i = 0; i < 13; i++) { const y = 2026 + Math.floor((10 + i) / 12), m = (10 + i) % 12; months.push([y, m]); }
    months.forEach(([y, m], i) => {
      const r = 5 + i;
      Aw.getCell(`A${r}`).value = new Date(Date.UTC(y, m, 1)); Aw.getCell(`A${r}`).numFmt = 'mmm yyyy';
      const inMonth = D.SETS.filter((s) => { const d = new Date(s.end); return d.getUTCFullYear() === y && d.getUTCMonth() === m; });
      Aw.getCell(`B${r}`).value = inMonth.map((s) => `${s.label} ${s.festival}`).join(', ') || '—';
      const mc = (t) => `${t.rng('deadline')},">="&$A${r},${t.rng('deadline')},"<"&EDATE($A${r},1)`;
      fx(Aw.getCell(`C${r}`), across('COUNTIFS', mc)); fx(Aw.getCell(`D${r}`), across('SUMIFS', (t) => `${t.rng('__done')},${mc(t)}`));
      fx(Aw.getCell(`E${r}`), `SUMIFS($I$23:$I$${LAST},$D$23:$D$${LAST},">="&$A${r},$D$23:$D$${LAST},"<"&EDATE($A${r},1),$B$23:$B$${LAST},"<>Confirmed Set")`);
      const n = Aw.getCell(`F${r}`); n.fill = fill('FFFFF8D6'); n.protection = { locked: false };
    });
    Aw.getCell('A18').value = 'TOTAL'; ['C', 'D', 'E'].forEach((c) => fx(Aw.getCell(`${c}18`), `SUM(${c}5:${c}17)`)); Aw.getRow(18).font = { bold: true };
    Aw.getCell('A20').value = 'CAMPAIGN & SET PLANNER (baseline rows are formula-locked; add your own rows below them)'; Aw.getCell('A20').font = { bold: true, color: { argb: C.forest } };
    header(Aw, 22, ['Item', 'Type', 'Festival / Campaign', 'Prod. Start', 'Prod. End', 'Posters', 'AI Videos', 'VJ Videos', 'Total', 'Completed', 'Pending', 'Status', 'Notes']);
    D.SETS.forEach((s, i) => {
      const r = 23 + i;
      Aw.getCell(`A${r}`).value = s.label; Aw.getCell(`B${r}`).value = 'Confirmed Set'; Aw.getCell(`C${r}`).value = s.festival;
      fx(Aw.getCell(`D${r}`), fcCell(s.code, 'C'), DATE_FMT); fx(Aw.getCell(`E${r}`), fcCell(s.code, 'D'), DATE_FMT);
      fx(Aw.getCell(`F${r}`), `COUNTIFS(${P.rng('set')},"${s.label}")`); fx(Aw.getCell(`G${r}`), `COUNTIFS(${A.rng('set')},"${s.label}")`);
      fx(Aw.getCell(`H${r}`), across('COUNTIFS', (t) => `${t.rng('set')},"${s.label}"`, vjOnly));
      fx(Aw.getCell(`I${r}`), `F${r}+G${r}+H${r}`); fx(Aw.getCell(`J${r}`), `${q(SHEETS.fest)}!J${FC_ROW0 + i}`); fx(Aw.getCell(`K${r}`), `I${r}-J${r}`);
      fx(Aw.getCell(`L${r}`), `${q(SHEETS.fest)}!M${FC_ROW0 + i}`);
      Aw.getRow(r).font = { color: { argb: 'FF1B5E20' } };
    });
    const camps = st.campaigns || [];
    const CAMP_FIRST = 30, CAMP_ROWS = 60;
    for (let i = 0; i < CAMP_ROWS; i++) {
      const r = CAMP_FIRST + i, c = camps[i] || {};
      const vals = [c.name, c.type, c.festival, toDate(c.start), toDate(c.end), c.posters, c.ai, c.vj];
      ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].forEach((col, ci) => { const x = Aw.getCell(`${col}${r}`); x.value = vals[ci] == null || vals[ci] === '' ? null : vals[ci]; x.fill = fill('FFFFF8D6'); x.protection = { locked: false }; if (ci === 3 || ci === 4) x.numFmt = DATE_FMT; });
      fx(Aw.getCell(`I${r}`), `IF(A${r}="","",N(F${r})+N(G${r})+N(H${r}))`);
      const cc = Aw.getCell(`J${r}`); cc.value = c.completed == null || c.completed === '' ? null : Number(c.completed); cc.fill = fill('FFFFF8D6'); cc.protection = { locked: false };
      fx(Aw.getCell(`K${r}`), `IF(A${r}="","",I${r}-N(J${r}))`);
      fx(Aw.getCell(`L${r}`), `IF(A${r}="","",IF(AND(I${r}>0,N(J${r})>=I${r}),"Completed",IF(D${r}="","Planned",IF(TODAY()<D${r},"Upcoming",IF(E${r}<>"",IF(TODAY()>E${r},"Ended","Active"),"Active")))))`);
      const nn = Aw.getCell(`M${r}`); nn.value = c.notes || null; nn.fill = fill('FFFFF8D6'); nn.protection = { locked: false };
    }
    validate(Aw, `B${CAMP_FIRST}:B${CAMP_FIRST + CAMP_ROWS - 1}`, 'ctype');
    validateDate(Aw, `D${CAMP_FIRST}:E${CAMP_FIRST + CAMP_ROWS - 1}`);
    // Gantt (weeks) to the right
    const G0 = 15, nW = 52;
    for (let i = 0; i < nW; i++) {
      const L = colLetter(G0 + i); Aw.getColumn(G0 + i).width = 3.2;
      const c = Aw.getCell(`${L}22`); c.value = toDate(D.addDays('2026-11-23', i * 7)); c.numFmt = 'dd-mmm'; c.alignment = { textRotation: 90 }; c.font = { size: 8 };
    }
    Aw.getRow(22).height = 48;
    Aw.getCell(`${colLetter(G0)}21`).value = 'GANTT TIMELINE (weeks, Mon start)'; Aw.getCell(`${colLetter(G0)}21`).font = { bold: true };
    const gRef = `${colLetter(G0)}23:${colLetter(G0 + nW - 1)}${CAMP_FIRST + CAMP_ROWS - 1}`, gTL = `${colLetter(G0)}23`, gTop = `${colLetter(G0)}$22`;
    Aw.addConditionalFormatting({ ref: gRef, rules: [
      { type: 'expression', formulae: [`AND($B23="Confirmed Set",$D23<>"",${gTop}<=$E23,${gTop}+6>=$D23)`], style: { fill: cfFill('FF2E9E4F') } },
      { type: 'expression', formulae: [`AND($A23<>"",$D23<>"",${gTop}<=IF($E23="",$D23,$E23),${gTop}+6>=$D23)`], style: { fill: cfFill('FF1E6FD9') } },
    ] });
    Aw.views = [{ state: 'frozen', xSplit: 1, ySplit: 4, showGridLines: false }];

    // ---- Instructions ----
    const Hp = ws[SHEETS.help];
    banner(Hp, 'INSTRUCTIONS', 'How to operate this workbook and how it connects to the MAHI web app.', 3);
    Hp.getColumn(1).width = 120;
    [
      'WORKBOOK STRUCTURE',
      '• MAHI Dashboard – live KPIs, festival / VJ / set progress, charts and quick navigation.',
      '• Poster Tracker (310), AI Video Tracker (70), VJ 01/02/03 Trackers (20 each) = the 440 authoritative production records.',
      '• Set 01–07 sheets, Brand Master Plan, Festival Calendar, Reports, Alerts, Workflow Chart and Achievements are all formula-driven from those records.',
      '• Publishing Calendar holds one publishing record per asset (440). Platform Publishing Log holds additional per-platform posts – never counted in production totals.',
      '',
      'DAILY USE',
      '1. Find the asset (filter by Set / Brand / Status) in its tracker and update the dropdowns.',
      '2. Set "Overall Production Status" to Approved or Completed when the asset is finished, and type the Completion Date (used by daily / weekly reports).',
      '3. Schedule it in Publishing Calendar (date, time, platform, caption, hashtags) and set Publishing Status to Scheduled / Published.',
      '4. "Approval Check" warns when something is marked Published before production approval.',
      '',
      'COLOUR SYSTEM',
      'Grey = Not Started · Yellow = In Progress · Blue = Scheduled · Purple = Under Review · Orange = Correction Required · Green = Approved / Completed · Dark Green = Published · Red = Overdue',
      'Campaign colours: Christmas red & forest green · New Year royal blue & gold · Pongal golden yellow & harvest green. Posters green · AI videos blue · VJ videos purple.',
      '',
      'PROTECTION',
      'Calculated sheets are protected WITHOUT a password to prevent accidental formula damage. Use Review ▸ Unprotect Sheet if you need to change them. Trackers are unprotected so you can sort, filter and type freely.',
      'Blue-grey columns in trackers (Publishing Date/Status, Workflow Stage, Done, Deadline Flag) are formulas – do not overwrite them.',
      '',
      'EXPANDING THE PLAN',
      '• Add new festival campaigns, sets, brands, services or custom targets in "Annual Workflow 2027" (rows below the 5 confirmed sets). They are reported separately from the 616 baseline.',
      '• Formulas cover rows up to ' + LAST + ', so new rows you add at the bottom of a tracker are counted automatically.',
      '',
      'MAHI WEB APP',
      '• The app is the active editing interface: Excel Import & Export ▸ Import this workbook, update work in the app, then Export to get a fresh workbook.',
      '• Editing an exported workbook does NOT automatically sync with the app – import the updated workbook to bring changes in (the app shows a preview and asks for confirmation).',
      '• The hidden "_AppState" sheet carries app-only data (notifications, achievements dates, focus sessions) so a round-trip loses nothing.',
    ].forEach((t, i) => { const c = Hp.getCell(`A${4 + i}`); c.value = t; c.alignment = { wrapText: true }; if (t && t === t.toUpperCase() && !t.startsWith('•')) c.font = { bold: true, color: { argb: C.forest } }; });

    // ---- App state (hidden) ----
    const As = ws[SHEETS.state];
    const payload = JSON.stringify({
      schema: D.SCHEMA_VERSION, exportedAt: new Date().toISOString(),
      settings: Object.assign({}, S, { ownerPic: '', vjs: S.vjs.map((v) => ({ id: v.id, name: v.name, pic: '' })), logo: '' }),
      notifications: (st.notifications || []).slice(0, 300), history: (st.history || []).slice(-2000), focusSessions: st.focusSessions || [],
      achievements: st.achievements || {}, milestones: st.milestones || {}, extraBrands: st.extraBrands || [], welcomed: !!st.welcomed,
    });
    As.getCell('A1').value = 'MAHI_APP_STATE';
    const CH = 30000; for (let i = 0; i * CH < payload.length; i++) As.getCell(`A${i + 2}`).value = payload.slice(i * CH, (i + 1) * CH);
    As.state = 'veryHidden';

    // ---- Protection for calculated sheets ----
    const protectOpts = { selectLockedCells: true, selectUnlockedCells: true, formatColumns: true, formatRows: true, autoFilter: true, sort: false };
    const toProtect = [SHEETS.dash, SHEETS.brand, SHEETS.fest, ...D.SETS.map(setSheetName), SHEETS.flow, SHEETS.alerts, SHEETS.perf, SHEETS.ach, SHEETS.weekly, SHEETS.annual, SHEETS.settings];
    // Unlock editable inputs on the brand plan
    for (let r = 4; r <= 18; r++) ['C', 'D', 'E'].forEach((c) => { const x = Bm.getCell(`${c}${r}`); x.protection = { locked: false }; x.fill = fill('FFFFF8D6'); });
    if (opts.protect !== false) for (const n of toProtect) await ws[n].protect('', protectOpts);

    wb.__meta = { perfMeta, flowMeta, setSheetName, SHEETS };
    return wb;
  }

  // =================== IMPORT ===================
  function norm(v) {
    if (v == null) return '';
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    if (typeof v === 'object') {
      if (v.result !== undefined) return norm(v.result);
      if (v.richText) return v.richText.map((t) => t.text).join('');
      if (v.text !== undefined) return norm(v.text);
      if (v.formula !== undefined || v.sharedFormula !== undefined) return '';
      if (v.error) return '';
    }
    return typeof v === 'string' ? v.trim() : v;
  }
  function normDate(v) {
    const x = norm(v);
    if (x === '' || x == null) return '';
    if (typeof x === 'number') { const d = new Date(Math.round((x - 25569) * 86400000)); return d.toISOString().slice(0, 10); }
    const s = String(x);
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    const m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
    if (m) return `${m[3]}-${D.pad2(m[2])}-${D.pad2(m[1])}`;
    return s; // left as-is → validation will flag it
  }
  function readTable(ws, spec, idHeader) {
    // locate header row
    let hdrRow = 0;
    for (let r = 1; r <= 15 && !hdrRow; r++) { const row = ws.getRow(r); row.eachCell((c) => { if (norm(c.value) === idHeader) hdrRow = r; }); }
    if (!hdrRow) return null;
    const map = {}; // field -> column index
    ws.getRow(hdrRow).eachCell((c, col) => { const h = norm(c.value); const s = spec.find((x) => x.h === h); if (s && s.k !== 'formula') map[s.f] = { col, k: s.k }; });
    const out = [];
    for (let r = hdrRow + 1; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const first = norm(row.getCell(map[spec[0].f] ? map[spec[0].f].col : 1).value);
      if (first === '' || first == null) continue;
      const rec = {};
      Object.keys(map).forEach((f) => {
        const { col, k } = map[f]; const raw = row.getCell(col).value;
        if (k === 'date') rec[f] = normDate(raw);
        else if (k === 'set') rec[f] = setCode(norm(raw));
        else if (k === 'int') { const n = Number(norm(raw)); rec[f] = Number.isFinite(n) ? n : 0; }
        else { const v = norm(raw); rec[f] = v == null ? '' : String(v); }
      });
      rec.__row = r; out.push(rec);
    }
    return { rows: out, hdrRow, mapped: Object.keys(map) };
  }

  const REQUIRED_SHEETS = () => [SHEETS.poster, SHEETS.ai, ...D.VJ_IDS.map(vjSheetName), SHEETS.pub];

  // ExcelJS cannot read worksheets that contain native chart drawings (it crashes in reconcile).
  // Charts are never needed for import, so the drawing references are removed first.
  async function stripDrawings(buffer) {
    const Z = (typeof JSZip !== 'undefined' && JSZip) || (typeof self !== 'undefined' && self.JSZip) || null;
    if (!Z) return buffer;
    const zip = await Z.loadAsync(buffer);
    let changed = false;
    const names = Object.keys(zip.files).filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n));
    for (const n of names) {
      const txt = await zip.file(n).async('string');
      if (/<drawing\b/.test(txt)) { zip.file(n, txt.replace(/<drawing\b[^>]*\/>/g, '')); changed = true; }
    }
    Object.keys(zip.files).filter((n) => /^xl\/(drawings|charts)\//.test(n)).forEach((n) => { zip.remove(n); changed = true; });
    const rels = Object.keys(zip.files).filter((n) => /^xl\/worksheets\/_rels\/sheet\d+\.xml\.rels$/.test(n));
    for (const n of rels) {
      const txt = await zip.file(n).async('string');
      if (/drawing/.test(txt)) zip.file(n, txt.replace(/<Relationship\b[^>]*Target="[^"]*drawings\/[^"]*"[^>]*\/>/g, ''));
    }
    return changed ? zip.generateAsync({ type: typeof Buffer !== 'undefined' && typeof window === 'undefined' ? 'nodebuffer' : 'arraybuffer' }) : buffer;
  }

  async function parse(ExcelJS, buffer) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await stripDrawings(buffer));
    const errors = [], warnings = [];
    const missing = REQUIRED_SHEETS().filter((n) => !wb.getWorksheet(n));
    if (missing.length) return { ok: false, errors: [`Workbook structure invalid – missing sheet(s): ${missing.join(', ')}`], warnings };
    const assets = [];
    TR.forEach((t) => {
      const tb = readTable(wb.getWorksheet(t.sheet), t.spec, t.spec[0].h);
      if (!tb) { errors.push(`${t.sheet}: header row with "${t.spec[0].h}" not found`); return; }
      const required = ['id', 'brand', 'status', 'set'];
      required.forEach((f) => { if (!tb.mapped.includes(f)) errors.push(`${t.sheet}: required column for "${f}" missing`); });
      tb.rows.forEach((r) => {
        const a = Object.assign(D.blankAsset(), r, { type: t.type });
        if (t.vj) a.vj = t.vj;
        if (!a.num) { const mm = String(a.id).match(/(\d+)$/); a.num = mm ? Number(mm[1]) : 0; }
        if (!a.status) a.status = 'Not Started';
        delete a.__row; assets.push(a);
      });
    });
    // publishing data
    const pub = readTable(wb.getWorksheet(SHEETS.pub), PUB_SPEC, 'Content ID');
    const byId = {}; assets.forEach((a) => { byId[a.id] = a; });
    if (pub) {
      const seen = new Set();
      pub.rows.forEach((p) => {
        if (seen.has(p.id)) errors.push(`Publishing Calendar: duplicate Content ID ${p.id}`); seen.add(p.id);
        const a = byId[p.id]; if (!a) { errors.push(`Publishing Calendar: ${p.id} has no matching production record`); return; }
        ['pubDate', 'pubTime', 'platform', 'captionStatus', 'hashtagStatus', 'pubStatus', 'pubLink', 'pubRemarks'].forEach((f) => { if (p[f] !== undefined) a[f] = p[f]; });
        if (!a.pubStatus) a.pubStatus = 'Not Scheduled';
      });
    } else errors.push('Publishing Calendar: header row not found');
    assets.forEach((a) => { if (!a.pubStatus) a.pubStatus = 'Not Scheduled'; ['captionStatus', 'hashtagStatus'].forEach((f) => { if (!a[f]) a[f] = 'Pending'; }); if (!a.priority) a.priority = 'Medium'; });
    // status value validation beyond the core ones
    const listCheck = { step: D.STEP_STATUSES, appr: D.APPROVAL_STATUSES, qc: D.QC_STATUSES, corr: D.CORRECTION_STATUSES, ready: D.READY_STATUSES, prio: D.PRIORITIES, plat: D.PLATFORMS };
    TR.concat([{ spec: PUB_SPEC }]).forEach((t) => t.spec.forEach((c) => {
      if (!listCheck[c.k]) return;
      assets.forEach((a) => { const v = a[c.f]; if (v && !listCheck[c.k].includes(v)) errors.push(`${a.id}: invalid value "${v}" for ${c.h}`); });
    }));
    const v = D.validateAssets(assets);
    errors.push(...v.errors); warnings.push(...v.warnings);

    // Settings
    const settings = {};
    const Sg = wb.getWorksheet(SHEETS.settings);
    if (Sg) {
      settings.owner = String(norm(Sg.getCell('C4').value) || 'VJ.Nathan'); settings.callName = String(norm(Sg.getCell('C5').value) || 'Nathan');
      settings.organization = String(norm(Sg.getCell('C6').value) || ''); settings.department = String(norm(Sg.getCell('C7').value) || '');
      const pic = String(norm(Sg.getCell('C8').value) || ''); if (pic) settings.ownerPic = pic;
      settings.vjs = D.VJ_IDS.map((id, i) => ({ id, name: String(norm(Sg.getCell(`C${11 + i}`).value) || id), pic: String(norm(Sg.getCell(`D${11 + i}`).value) || '') }));
      const th = [16, 17, 18].map((r) => Number(norm(Sg.getCell(`C${r}`).value))).filter((n) => n > 0);
      if (th.length === 3) settings.thresholds = th;
    }
    const Fc = wb.getWorksheet(SHEETS.fest);
    if (Fc) {
      settings.pubWindows = {};
      D.SETS.forEach((s, i) => {
        const st = normDate(Fc.getCell(`F${FC_ROW0 + i}`).value), en = normDate(Fc.getCell(`G${FC_ROW0 + i}`).value);
        settings.pubWindows[s.code] = (st && en) ? { start: st, end: en } : D.defaultPubWindows()[s.code];
      });
    }
    // notes, custom tasks, platform log, campaigns
    const NOTE_SPEC = [F('Date', 'date', 0, 'date'), F('Title', 'title', 0, 'text'), F('Category', 'category', 0, 'text'), F('Note', 'text', 0, 'text'), F('Linked Content ID', 'linkedId', 0, 'text'), F('Pinned', 'pinned', 0, 'text')];
    const notesT = wb.getWorksheet(SHEETS.notes) ? readTable(wb.getWorksheet(SHEETS.notes), NOTE_SPEC, 'Date') : null;
    const notes = [];
    if (notesT) {
      // re-read allowing rows whose first column is blank but title/note present
      const ws2 = wb.getWorksheet(SHEETS.notes);
      for (let r = notesT.hdrRow + 1; r <= ws2.rowCount; r++) {
        const row = ws2.getRow(r); const title = norm(row.getCell(2).value), text = norm(row.getCell(4).value);
        if (!title && !text) continue;
        notes.push({ id: 'N' + r + '-' + Date.now().toString(36), date: normDate(row.getCell(1).value) || D.localISO(), title: String(title || ''), category: String(norm(row.getCell(3).value) || 'Personal'), text: String(text || ''), linkedId: String(norm(row.getCell(5).value) || ''), pinned: String(norm(row.getCell(6).value)).toLowerCase() === 'yes' });
      }
    }
    const TASK_SPEC = [F('Task ID', 'id', 0, 'text'), F('Task', 'title', 0, 'text'), F('Category', 'category', 0, 'text'), F('Priority', 'priority', 0, 'text'), F('Date', 'date', 0, 'date'), F('Reminder', 'reminder', 0, 'text'), F('Status', 'status', 0, 'text'), F('Linked Content ID', 'linkedId', 0, 'text'), F('Notes', 'notes', 0, 'text')];
    const customTasks = [];
    const Dp = wb.getWorksheet(SHEETS.daily);
    if (Dp) {
      let hdr = 0; for (let r = 1; r <= 30 && !hdr; r++) if (norm(Dp.getRow(r).getCell(1).value) === 'Task ID') hdr = r;
      if (hdr) for (let r = hdr + 1; r <= Dp.rowCount; r++) {
        const row = Dp.getRow(r); const title = norm(row.getCell(2).value); if (!title) continue;
        const t = {}; TASK_SPEC.forEach((c, i) => { t[c.f] = c.k === 'date' ? normDate(row.getCell(i + 1).value) : String(norm(row.getCell(i + 1).value) || ''); });
        if (!t.id) t.id = 'T' + r + '-' + Date.now().toString(36); if (!t.status) t.status = 'Pending'; if (!t.priority) t.priority = 'Medium';
        customTasks.push(t);
      }
    }
    const platformLogs = [];
    const Pl = wb.getWorksheet(SHEETS.log);
    if (Pl) for (let r = 5; r <= Pl.rowCount; r++) {
      const row = Pl.getRow(r); const cid = norm(row.getCell(2).value); if (!cid) continue;
      platformLogs.push({ id: String(norm(row.getCell(1).value) || 'L' + r), contentId: String(cid), platform: String(norm(row.getCell(3).value) || ''), date: normDate(row.getCell(4).value), time: String(norm(row.getCell(5).value) || ''), status: String(norm(row.getCell(6).value) || 'Not Scheduled'), url: String(norm(row.getCell(7).value) || ''), remarks: String(norm(row.getCell(8).value) || '') });
    }
    const campaigns = [];
    const Aw = wb.getWorksheet(SHEETS.annual);
    if (Aw) for (let r = 30; r < 90; r++) {
      const row = Aw.getRow(r); const name = norm(row.getCell(1).value); if (!name) continue;
      const num = (c) => { const n = Number(norm(row.getCell(c).value)); return Number.isFinite(n) ? n : 0; };
      campaigns.push({ id: 'C' + r, name: String(name), type: String(norm(row.getCell(2).value) || 'Custom Target'), festival: String(norm(row.getCell(3).value) || ''), start: normDate(row.getCell(4).value), end: normDate(row.getCell(5).value), posters: num(6), ai: num(7), vj: num(8), completed: num(10), notes: String(norm(row.getCell(13).value) || '') });
    }
    // achievements unlock dates typed in the sheet
    const achievements = {};
    const Ah = wb.getWorksheet(SHEETS.ach);
    if (Ah) D.ACHIEVEMENTS.forEach((a, i) => { const d = normDate(Ah.getCell(`H${5 + i}`).value); if (d) achievements[a.key] = d; });
    // hidden app state
    let appState = null;
    const As = wb.getWorksheet(SHEETS.state);
    if (As && norm(As.getCell('A1').value) === 'MAHI_APP_STATE') {
      let s = ''; for (let r = 2; r <= As.rowCount; r++) { const v = As.getCell(`A${r}`).value; if (v) s += String(v); }
      try { appState = JSON.parse(s); } catch (e) { warnings.push('Hidden _AppState sheet could not be read – notifications/history will be kept from the current app.'); }
    }
    // reorder assets to canonical order
    const order = {}; D.buildAssets().forEach((a, i) => { order[a.id] = i; });
    assets.sort((x, y) => (order[x.id] ?? 1e9) - (order[y.id] ?? 1e9));
    return { ok: errors.length === 0, errors, warnings, assets, settings, notes, customTasks, platformLogs, campaigns, achievements, appState };
  }

  async function toBuffer(ExcelJS, state, opts) { const wb = await build(ExcelJS, state, opts); return wb.xlsx.writeBuffer(); }

  return { build, parse, toBuffer, SHEETS, setSheetName, vjSheetName, TR, colLetter };
});
