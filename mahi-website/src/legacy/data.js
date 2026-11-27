/* MAHI – shared production data model.
 * Used by the web app (browser global MAHI_DATA) and by the Node workbook generator / tests.
 * Every figure in the system is derived from the asset records produced here.
 */
(function (root, factory) {
  root.MAHI_DATA = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Plan v2 (27 Nov 2026): Christmas Set 03 and Set 04 were removed; New Year and Pongal renumbered.
  const SCHEMA_VERSION = 2;

  // ---- Brand master plan (per set) -------------------------------------------------
  const BRANDS = [
    { name: 'Valluvam', posters: 3, ai: 2, vj: 1, vjMember: 'VJ 01' },
    { name: 'Farmers Factory', posters: 3, ai: 2, vj: 1, vjMember: 'VJ 02' },
    { name: 'Protein Cuts', posters: 3, ai: 2, vj: 1, vjMember: 'VJ 03' },
    { name: 'Palm Cafe', posters: 3, ai: 2, vj: 1, vjMember: 'VJ 02' },
    { name: 'IGO Academy', posters: 5, ai: 0, vj: 1, vjMember: 'VJ 01' },
    { name: 'IGO Franchise', posters: 3, ai: 2, vj: 1, vjMember: 'VJ 03' },
    { name: 'I FIN TECH', posters: 5, ai: 0, vj: 1, vjMember: 'VJ 02' },
    { name: 'IGO Farm Gate Mandi', posters: 5, ai: 0, vj: 1, vjMember: 'VJ 01' },
    { name: 'IGO Farm Land Estates', posters: 4, ai: 0, vj: 1, vjMember: 'VJ 03' },
    { name: 'IGO Crop Care', posters: 6, ai: 0, vj: 0, vjMember: '' },
    { name: 'IGO Nursery', posters: 3, ai: 2, vj: 1, vjMember: 'VJ 01' },
    { name: 'IGO Farm Factories', posters: 5, ai: 0, vj: 1, vjMember: 'VJ 02' },
    { name: 'IGO Farm Loans', posters: 6, ai: 0, vj: 0, vjMember: '' },
    { name: 'IGO Agri Mart', posters: 5, ai: 0, vj: 0, vjMember: '' },
    { name: 'IGO Green Energy', posters: 3, ai: 2, vj: 1, vjMember: 'VJ 03' },
  ];

  const VJ_IDS = ['VJ 01', 'VJ 02', 'VJ 03'];

  const FESTIVALS = [
    { name: 'Christmas', date: '2026-12-25', dateLabel: '25 December 2026', prodStart: '2026-11-27', prodEnd: '2026-12-10', sets: 2, colors: ['#C62828', '#1B5E20'] },
    { name: 'New Year', date: '2027-01-01', dateLabel: '1 January 2027', prodStart: '2026-12-28', prodEnd: '2026-12-30', sets: 1, colors: ['#1A3E8C', '#C9A227'] },
    { name: 'Pongal', date: '2027-01-14', dateEnd: '2027-01-17', dateLabel: '14–17 January 2027', prodStart: '2027-01-03', prodEnd: '2027-01-12', sets: 2, colors: ['#E0A800', '#2E7D32'] },
  ];

  // Confirmed production set calendar – never altered automatically.
  const SETS = [
    { no: 1, code: 'S01', label: 'Set 01', festival: 'Christmas', start: '2026-11-27', end: '2026-12-03', compressed: false },
    { no: 2, code: 'S02', label: 'Set 02', festival: 'Christmas', start: '2026-12-04', end: '2026-12-10', compressed: false },
    { no: 3, code: 'S03', label: 'Set 03', festival: 'New Year', start: '2026-12-28', end: '2026-12-30', compressed: true },
    { no: 4, code: 'S04', label: 'Set 04', festival: 'Pongal', start: '2027-01-03', end: '2027-01-09', compressed: false },
    { no: 5, code: 'S05', label: 'Set 05', festival: 'Pongal', start: '2027-01-10', end: '2027-01-12', compressed: true },
  ];

  // ---- Upgrade saved data from plan v1 (7 sets) to plan v2 (5 sets) ----------------------
  // v1 → v2 set codes. The removed Christmas sets become "OLD-S03" / "OLD-S04" so their IDs can
  // never be mistaken for the new Set 03 / Set 04.
  const SET_MAP_V1 = { S01: 'S01', S02: 'S02', S03: 'OLD-S03', S04: 'OLD-S04', S05: 'S03', S06: 'S04', S07: 'S05' };
  const mapRef = (v) => (typeof v === 'string' ? v.replace(/(^|[^A-Za-z0-9-])S0([1-7])(?![0-9])/g, (m, pre, n) => pre + SET_MAP_V1['S0' + n]) : v);
  const mapKeys = (o) => { const r = {}; Object.keys(o || {}).forEach((k) => { r[mapRef(k)] = o[k]; }); return r; };
  const hasWork = (a) => !!a && ((a.status && a.status !== 'Not Started') || (a.pubStatus && a.pubStatus !== 'Not Scheduled')
    || ['topic', 'content', 'concept', 'script', 'prompt', 'refLink', 'fileLink', 'pubLink', 'remarks', 'pubRemarks', 'shootDate', 'location', 'completionDate']
      .some((f) => a[f]));
  // Returns a copy of a saved v1 state with every set code and content ID renumbered.
  // Records of the removed sets that hold any work are kept in removedAssets (never silently lost).
  // Records that cannot be placed in the new plan (duplicates, unknown IDs) holding any work go to
  // `quarantine`, also never lost. `out.planReport` is the migration preview shown before anything is saved.
  function upgradeV1(s) {
    const out = Object.assign({}, s);
    const assets = [], removed = [], quarantine = [], seen = new Set();
    const plan = new Set(buildAssets().map((b) => b.id));
    const R = { original: 0, originalWithWork: 0, migrated: 0, migratedWithWork: 0, completedRetained: 0, inProgressRetained: 0,
      archivedWithWork: 0, archivedCompleted: 0, archivedEmpty: 0, duplicates: 0, quarantined: 0, droppedEmptyUnknown: 0, unresolved: 0 };
    const done = (a) => a.status === 'Approved' || a.status === 'Completed';
    (s.assets || []).forEach((a) => {
      if (!a || !a.id) { R.unresolved++; return; }
      R.original++; const work = hasWork(a); if (work) R.originalWithWork++;
      const id = mapRef(a.id);
      if (seen.has(a.id)) { R.duplicates++; if (work) { R.quarantined++; quarantine.push(Object.assign({}, a, { quarantineReason: 'duplicate ID in saved data' })); } return; }
      seen.add(a.id);
      if (id.indexOf('OLD-') === 0) {
        if (work) { R.archivedWithWork++; if (done(a)) R.archivedCompleted++; removed.push(Object.assign({}, a, { id, set: mapRef(a.set), removedOn: '2026-11-27', removedReason: 'Christmas Set 03/04 removed from the plan' })); } else R.archivedEmpty++;
        return;
      }
      if (!plan.has(id)) { if (work) { R.quarantined++; quarantine.push(Object.assign({}, a, { quarantineReason: 'ID not in the 5-set plan' })); } else R.droppedEmptyUnknown++; return; }
      assets.push(Object.assign({}, a, { id, set: mapRef(a.set) }));
      R.migrated++; if (work) R.migratedWithWork++; if (done(a)) R.completedRetained++; else if (work) R.inProgressRetained++;
    });
    R.activeAfter = plan.size; R.newEmpty = plan.size - R.migrated;
    out.assets = assets;
    out.removedAssets = (Array.isArray(s.removedAssets) ? s.removedAssets : []).concat(removed);
    out.quarantine = (Array.isArray(s.quarantine) ? s.quarantine : []).concat(quarantine);
    out.planReport = R;
    const pw = mapKeys((s.settings || {}).pubWindows); Object.keys(pw).forEach((k) => { if (k.indexOf('OLD-') === 0) delete pw[k]; });
    out.settings = Object.assign({}, s.settings || {}, { pubWindows: pw });
    out.milestones = mapKeys(s.milestones);
    if (Array.isArray(s.history)) out.history = s.history.map((h) => (h && h.id ? Object.assign({}, h, { id: mapRef(h.id) }) : h));
    if (Array.isArray(s.platformLogs)) out.platformLogs = s.platformLogs.map((l) => (l && l.contentId ? Object.assign({}, l, { contentId: mapRef(l.contentId) }) : l));
    if (Array.isArray(s.mahiReports)) out.mahiReports = s.mahiReports.map((r) => (r ? Object.assign({}, r, { deliverables: (r.deliverables || []).map(mapRef), prev: mapKeys(r.prev) }) : r));
    out.schema = 2;
    out.planChange = { on: '2026-11-27', removedSets: ['Christmas Set 03', 'Christmas Set 04'], keptRecords: removed.length };
    return out;
  }

  // ---- Seasonal themes (visual only: never change records, dates, deadlines or targets) ----
  // Month-day windows in Asia/Kolkata. Diwali moves every year, so it stays empty until set in Settings.
  const SEASON_WINDOWS = { christmas: '12-01..12-26', newyear: '12-27..01-02', pongal: '01-12..01-17', diwali: '' };
  const SEASON_NAMES = { christmas: 'Christmas', newyear: 'New Year', pongal: 'Pongal', diwali: 'Diwali' };
  function inSeasonWindow(win, iso) {
    const m = /^(\d{2})-(\d{2})\.\.(\d{2})-(\d{2})$/.exec(String(win || '').trim()); if (!m) return false;
    const x = Number(iso.slice(5, 7)) * 100 + Number(iso.slice(8, 10)), a = +m[1] * 100 + +m[2], b = +m[3] * 100 + +m[4];
    return a <= b ? x >= a && x <= b : x >= a || x <= b;
  }
  // settings.season: 'auto' | 'off' | one of SEASON_NAMES. Returns the active festival key or ''.
  function seasonFor(settings, iso) {
    const pick = (settings && settings.season) || 'auto';
    if (pick === 'off') return '';
    if (SEASON_NAMES[pick]) return pick;
    const w = Object.assign({}, SEASON_WINDOWS, (settings && settings.seasonWindows) || {});
    const day = iso || localISO();
    const byDate = ['newyear', 'christmas', 'pongal', 'diwali'].find((k) => inSeasonWindow(w[k], day));
    if (byDate) return byDate;
    // Otherwise follow the active campaign: the production set running today.
    const set = SETS.find((s) => s.start <= day && day <= s.end);
    return set ? ({ Christmas: 'christmas', 'New Year': 'newyear', Pongal: 'pongal' })[set.festival] || '' : '';
  }

  const WORKFLOW_START = '2026-11-27';
  const WORKFLOW_END = '2027-11-11';

  // ---- Status vocabularies --------------------------------------------------------
  const PROD_STATUSES = ['Not Started', 'Planning', 'In Progress', 'Content Ready', 'Script Completed', 'Shoot Scheduled',
    'Shooting Completed', 'AI Generation Completed', 'Editing', 'Under Review', 'Correction Required', 'Approved', 'Completed', 'On Hold'];
  const PUB_STATUSES = ['Not Scheduled', 'Scheduled', 'Published', 'On Hold'];
  const STEP_STATUSES = ['Not Started', 'In Progress', 'Completed', 'On Hold'];
  const APPROVAL_STATUSES = ['Pending', 'Approved', 'Correction Required'];
  const QC_STATUSES = ['Pending', 'Passed', 'Failed'];
  const CORRECTION_STATUSES = ['None', 'Required', 'Corrected'];
  const READY_STATUSES = ['Pending', 'Ready'];
  const PRIORITIES = ['High', 'Medium', 'Low'];
  const PLATFORMS = ['Instagram', 'Facebook', 'LinkedIn', 'YouTube', 'X', 'WhatsApp'];
  const CONTENT_TYPES = ['Poster', 'AI Video', 'VJ Video'];
  const DONE_STATUSES = ['Approved', 'Completed'];

  // Status colour system (label always shown alongside colour)
  const STATUS_COLORS = {
    'Not Started': '#9E9E9E', 'Planning': '#F4C430', 'In Progress': '#F4C430', 'Content Ready': '#F4C430',
    'Script Completed': '#F4C430', 'Shoot Scheduled': '#F4C430', 'Shooting Completed': '#F4C430',
    'AI Generation Completed': '#F4C430', 'Editing': '#F4C430', 'Under Review': '#7E57C2',
    'Correction Required': '#EF7D00', 'Approved': '#2E9E4F', 'Completed': '#2E9E4F', 'On Hold': '#78909C',
    'Scheduled': '#1E6FD9', 'Published': '#0B5D2A', 'Not Scheduled': '#9E9E9E', 'Overdue': '#D32F2F',
  };
  const TYPE_COLORS = { 'Poster': '#2E9E4F', 'AI Video': '#1E6FD9', 'VJ Video': '#7E57C2' };

  // ---- Helpers ---------------------------------------------------------------------
  const slug = (s) => String(s).toUpperCase().replace(/[^A-Z0-9]/g, '');
  const pad2 = (n) => String(n).padStart(2, '0');

  function addDays(iso, n) {
    const [y, m, d] = iso.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d + n));
    return dt.toISOString().slice(0, 10);
  }
  // Every "today", day, week, month and year in MAHI is the Asia/Kolkata calendar date,
  // whatever time zone the device is set to. India has no daylight saving, so IST = UTC+05:30.
  const IST_OFFSET_MS = 330 * 60000;
  function localISO(date) {
    const d = date || new Date();
    return new Date(d.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
  }
  // Start of the IST day after `iso`, as a timestamp (used for "hours left" on deadlines).
  function istEndOfDay(iso) { const [y, m, d] = iso.split('-').map(Number); return Date.UTC(y, m - 1, d + 1) - IST_OFFSET_MS; }
  // IST hour and minute of a moment (for reminder times).
  function istHM(date) { const t = new Date((date || new Date()).getTime() + IST_OFFSET_MS); return [t.getUTCHours(), t.getUTCMinutes()]; }
  // Monday of the week containing `iso` (weeks run Monday–Sunday).
  function weekStart(iso) { const [y, m, d] = iso.split('-').map(Number); const dow = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7; return addDays(iso, -dow); }
  function daysBetween(a, b) { // b - a in days
    const pa = a.split('-').map(Number), pb = b.split('-').map(Number);
    return Math.round((Date.UTC(pb[0], pb[1] - 1, pb[2]) - Date.UTC(pa[0], pa[1] - 1, pa[2])) / 86400000);
  }
  const fmtDate = (iso) => {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return d + '-' + m + '-' + y;
  };

  // Default editable publishing window: the 7 days immediately after production ends.
  function defaultPubWindows() {
    const w = {};
    SETS.forEach((s) => { const st = addDays(s.end, 1); w[s.code] = { start: st, end: addDays(st, 6) }; });
    return w;
  }

  function setByCode(code) { return SETS.find((s) => s.code === code); }

  // ---- Asset records ---------------------------------------------------------------
  function blankAsset() {
    return {
      id: '', type: '', festival: '', set: '', brand: '', num: 0, vj: '', designer: '', priority: 'Medium',
      topic: '', content: '', concept: '', duration: '', script: '', prompt: '', refLink: '',
      contentStatus: 'Not Started', designStatus: 'Not Started', scriptStatus: 'Not Started', promptStatus: 'Not Started',
      aiGenStatus: 'Not Started', voStatus: 'Not Started', editStatus: 'Not Started', subtitleStatus: 'Not Started',
      thumbStatus: 'Not Started', shootStatus: 'Not Started', scriptApproval: 'Pending', shootDate: '', location: '',
      qc: 'Pending', correction: 'None', finalApproval: 'Pending',
      status: 'Not Started', prodStart: '', deadline: '', completionDate: '',
      pubStatus: 'Not Scheduled', pubDate: '', pubTime: '', platform: '', captionStatus: 'Pending', hashtagStatus: 'Pending',
      fileLink: '', pubLink: '', remarks: '', pubRemarks: '',
    };
  }

  function buildAssets() {
    const out = [];
    SETS.forEach((s) => {
      BRANDS.forEach((b) => {
        const base = { festival: s.festival, set: s.code, brand: b.name, prodStart: s.start, deadline: s.end };
        for (let i = 1; i <= b.posters; i++) out.push(Object.assign(blankAsset(), base, { id: `${s.code}-${slug(b.name)}-P${pad2(i)}`, type: 'Poster', num: i }));
        for (let i = 1; i <= b.ai; i++) out.push(Object.assign(blankAsset(), base, { id: `${s.code}-${slug(b.name)}-AI${pad2(i)}`, type: 'AI Video', num: i }));
        for (let i = 1; i <= b.vj; i++) out.push(Object.assign(blankAsset(), base, { id: `${s.code}-${slug(b.name)}-VJ${pad2(i)}`, type: 'VJ Video', num: i, vj: b.vjMember }));
      });
    });
    return out;
  }

  function initialState() {
    return {
      schema: SCHEMA_VERSION,
      createdAt: new Date().toISOString(),
      settings: {
        owner: 'VJ.Nathan', callName: 'Nathan', ownerPic: '', organization: 'IGO Group of Companies', department: 'Digital Marketing',
        vjs: VJ_IDS.map((id) => ({ id, name: id, pic: '' })),
        thresholds: [72, 48, 24], theme: 'light', reducedMotion: false, sound: false, decor: true,
        mahiVisible: true, mahiMinimized: false, mahiPaused: false, festivalMode: 'auto', boardMode: 'corporate',
        pubWindows: defaultPubWindows(), logo: '',
      },
      assets: buildAssets(),
      customTasks: [], notes: [], notifications: [], history: [], focusSessions: [],
      achievements: {}, milestones: {}, campaigns: [], extraBrands: [], platformLogs: [],
      welcomed: false,
    };
  }

  // ---- Derived logic (mirrors the Excel formulas exactly) ---------------------------
  const isDone = (a) => DONE_STATUSES.includes(a.status);
  const isActive = (v) => v === 'In Progress' || v === 'Completed';

  // Deadline flag: deadline is the END of the deadline day.
  function deadlineFlag(a, now, thresholds) {
    if (isDone(a)) return 'Done';
    if (!a.deadline) return '';
    const n = now || new Date();
    const today = localISO(n);
    if (a.deadline < today) return 'OVERDUE';
    const hours = (istEndOfDay(a.deadline) - n.getTime()) / 3600000;
    const th = (thresholds || [72, 48, 24]).slice().sort((x, y2) => x - y2);
    for (const t of th) if (hours <= t) return `DUE ≤${t}H`;
    return 'On Track';
  }

  const BRANCH_STAGES = {
    'Poster': ['Poster Topic', 'Content Writing', 'Graphic Designing', 'Quality Check', 'Final Approval'],
    'AI Video': ['Video Concept', 'Script Writing', 'AI Prompt Creation', 'AI Video Generation', 'Voice-over and Editing', 'Subtitles and Thumbnail', 'Quality Check', 'Final Approval'],
    'VJ Video': ['VJ Assignment', 'Script Preparation', 'Script Approval', 'Video Shooting', 'Video Editing', 'Subtitles and Thumbnail', 'Quality Check', 'Final Approval'],
  };

  // Current workflow stage of an asset (same rules as the Excel "Workflow Stage" column).
  function stageOf(a) {
    const s = a.status;
    if (isDone(a)) return 'Final Approval';
    if (s === 'Under Review' || s === 'Correction Required') return 'Quality Check';
    if (a.type === 'Poster') {
      if (s === 'Editing' || isActive(a.designStatus)) return 'Graphic Designing';
      if (['In Progress', 'Content Ready', 'Script Completed'].includes(s) || isActive(a.contentStatus)) return 'Content Writing';
      return 'Poster Topic';
    }
    if (a.type === 'AI Video') {
      if (isActive(a.subtitleStatus) || isActive(a.thumbStatus)) return 'Subtitles and Thumbnail';
      if (s === 'Editing' || s === 'AI Generation Completed' || isActive(a.editStatus) || isActive(a.voStatus)) return 'Voice-over and Editing';
      if (isActive(a.aiGenStatus)) return 'AI Video Generation';
      if (s === 'Script Completed' || isActive(a.promptStatus)) return 'AI Prompt Creation';
      if (['In Progress', 'Content Ready'].includes(s) || isActive(a.scriptStatus)) return 'Script Writing';
      return 'Video Concept';
    }
    // VJ Video
    if (isActive(a.subtitleStatus) || isActive(a.thumbStatus)) return 'Subtitles and Thumbnail';
    if (s === 'Editing' || isActive(a.editStatus)) return 'Video Editing';
    if (s === 'Shoot Scheduled' || s === 'Shooting Completed' || isActive(a.shootStatus) || a.scriptApproval === 'Approved') return 'Video Shooting';
    if (s === 'Script Completed' || a.scriptStatus === 'Completed') return 'Script Approval';
    if (['In Progress', 'Content Ready', 'Planning'].includes(s) || a.scriptStatus === 'In Progress') return 'Script Preparation';
    return 'VJ Assignment';
  }

  // Kanban column of an asset
  const KANBAN_COLUMNS = ['Not Started', 'Planning', 'Content Ready', 'In Production', 'Editing', 'Under Review', 'Correction Required', 'Approved', 'Scheduled', 'Published', 'On Hold'];
  function kanbanColumn(a) {
    if (a.pubStatus === 'Published') return 'Published';
    if (a.pubStatus === 'Scheduled') return 'Scheduled';
    switch (a.status) {
      case 'Not Started': return 'Not Started';
      case 'Planning': return 'Planning';
      case 'Content Ready': case 'Script Completed': return 'Content Ready';
      case 'In Progress': case 'Shoot Scheduled': case 'Shooting Completed': case 'AI Generation Completed': return 'In Production';
      case 'Editing': return 'Editing';
      case 'Under Review': return 'Under Review';
      case 'Correction Required': return 'Correction Required';
      case 'Approved': case 'Completed': return 'Approved';
      case 'On Hold': return 'On Hold';
      default: return 'Not Started';
    }
  }
  // What a drop into a column changes
  const KANBAN_DROP = {
    'Not Started': { status: 'Not Started' }, 'Planning': { status: 'Planning' }, 'Content Ready': { status: 'Content Ready' },
    'In Production': { status: 'In Progress' }, 'Editing': { status: 'Editing' }, 'Under Review': { status: 'Under Review' },
    'Correction Required': { status: 'Correction Required' }, 'Approved': { status: 'Approved' },
    'Scheduled': { pubStatus: 'Scheduled' }, 'Published': { pubStatus: 'Published' }, 'On Hold': { status: 'On Hold' },
  };

  const ACHIEVEMENTS = [
    { key: 'first-task', name: 'First Task Completed', icon: '✅', cond: 'Complete any 1 deliverable' },
    { key: 'first-poster', name: 'First Poster Completed', icon: '🖼️', cond: 'Complete 1 poster' },
    { key: 'first-ai', name: 'First AI Video Completed', icon: '🤖', cond: 'Complete 1 AI video' },
    { key: 'first-vj', name: 'First VJ Video Completed', icon: '🎬', cond: 'Complete 1 VJ video' },
    { key: 'ten', name: '10 Deliverables Completed', icon: '🔟', cond: 'Complete 10 deliverables' },
    { key: 'twentyfive', name: '25 Deliverables Completed', icon: '🥉', cond: 'Complete 25 deliverables' },
    { key: 'fifty', name: '50 Deliverables Completed', icon: '🥈', cond: 'Complete 50 deliverables' },
    { key: 'hundred', name: '100 Deliverables Completed', icon: '🥇', cond: 'Complete 100 deliverables' },
    { key: 'first-brand', name: 'First Brand Completed', icon: '🏷️', cond: 'All deliverables of one brand in one set' },
    { key: 'first-set', name: 'First Set Completed', icon: '📦', cond: 'All 88 deliverables of one set' },
    { key: 'christmas', name: 'Christmas Campaign Completed', icon: '🎄', cond: 'All 352 Christmas deliverables' },
    { key: 'newyear', name: 'New Year Campaign Completed', icon: '🎆', cond: 'All 88 New Year deliverables' },
    { key: 'pongal', name: 'Pongal Campaign Completed', icon: '🍯', cond: 'All 176 Pongal deliverables' },
    { key: 'all', name: 'All Deliverables Completed', icon: '🏆', cond: 'Complete the entire festival workflow' },
  ];

  // Evaluate which achievements are currently satisfied by the records
  function achievementStatus(assets) {
    const done = assets.filter(isDone);
    const byType = (t) => done.filter((a) => a.type === t).length;
    const groupComplete = (keyFn) => {
      const g = {};
      assets.forEach((a) => { const k = keyFn(a); g[k] = g[k] || [0, 0]; g[k][0]++; if (isDone(a)) g[k][1]++; });
      return Object.keys(g).filter((k) => g[k][0] === g[k][1] && g[k][0] > 0);
    };
    const festComplete = groupComplete((a) => a.festival);
    return {
      'first-task': done.length >= 1, 'first-poster': byType('Poster') >= 1, 'first-ai': byType('AI Video') >= 1, 'first-vj': byType('VJ Video') >= 1,
      'ten': done.length >= 10, 'twentyfive': done.length >= 25, 'fifty': done.length >= 50, 'hundred': done.length >= 100,
      'first-brand': groupComplete((a) => a.set + '|' + a.brand).length >= 1,
      'first-set': groupComplete((a) => a.set).length >= 1,
      'christmas': festComplete.includes('Christmas'), 'newyear': festComplete.includes('New Year'), 'pongal': festComplete.includes('Pongal'),
      'all': assets.length > 0 && done.length === assets.length,
    };
  }

  // Validate a set of asset records (used by import + tests)
  function validateAssets(assets) {
    const errors = [], warnings = [];
    const ids = new Set();
    const expected = new Set(buildAssets().map((a) => a.id));
    assets.forEach((a, i) => {
      const where = `row ${i + 1} (${a.id || 'no ID'})`;
      if (!a.id) errors.push(`${where}: missing Content ID`);
      else if (ids.has(a.id)) errors.push(`${where}: duplicate Content ID`);
      else ids.add(a.id);
      if (a.id && !expected.has(a.id)) errors.push(`${where}: unknown Content ID (not part of the confirmed plan)`);
      if (!CONTENT_TYPES.includes(a.type)) errors.push(`${where}: invalid content type "${a.type}"`);
      if (!PROD_STATUSES.includes(a.status)) errors.push(`${where}: invalid production status "${a.status}"`);
      if (!PUB_STATUSES.includes(a.pubStatus)) errors.push(`${where}: invalid publishing status "${a.pubStatus}"`);
      if (!a.brand) errors.push(`${where}: missing brand`);
      ['prodStart', 'deadline', 'completionDate', 'pubDate', 'shootDate'].forEach((f) => {
        if (a[f] && !/^\d{4}-\d{2}-\d{2}$/.test(a[f])) errors.push(`${where}: invalid date in ${f}`);
      });
      if (a.pubStatus === 'Published' && !isDone(a)) warnings.push(`${where}: published before production approval`);
    });
    expected.forEach((id) => { if (!ids.has(id)) errors.push(`missing record ${id}`); });
    return { errors, warnings, count: assets.length };
  }

  return {
    SCHEMA_VERSION, BRANDS, VJ_IDS, FESTIVALS, SETS, WORKFLOW_START, WORKFLOW_END,
    PROD_STATUSES, PUB_STATUSES, STEP_STATUSES, APPROVAL_STATUSES, QC_STATUSES, CORRECTION_STATUSES, READY_STATUSES,
    PRIORITIES, PLATFORMS, CONTENT_TYPES, DONE_STATUSES, STATUS_COLORS, TYPE_COLORS, BRANCH_STAGES, KANBAN_COLUMNS, KANBAN_DROP,
    ACHIEVEMENTS,
    slug, pad2, addDays, localISO, istEndOfDay, istHM, weekStart, daysBetween, fmtDate, defaultPubWindows, setByCode, blankAsset, buildAssets, initialState, upgradeV1, SET_MAP_V1, SEASON_WINDOWS, SEASON_NAMES, seasonFor,
    isDone, deadlineFlag, stageOf, kanbanColumn, achievementStatus, validateAssets,
  };
});
