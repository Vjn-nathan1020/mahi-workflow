/* MAHI – "Report to MAHI": turn a plain-language work report into real, saved record updates.
 *   "I completed five posters today"  →  picks the 5 right open posters  →  user confirms  →
 *   status Completed + IST completion date on those records  →  saved (browser + cloud when signed in).
 * Rule-based and deterministic (no AI service, nothing leaves the device). Works in the browser and in Node tests.
 */
(function (root) {
  'use strict';
  const D = root.MAHI_DATA, S = root.MAHI_STORE;

  const NUM = { a: 1, an: 1, one: 1, single: 1, two: 2, couple: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20 };
  const NUM_RE = '(\\d{1,3}|' + Object.keys(NUM).join('|') + ')';
  // Deliverable types (the 616 festival records). Order matters: the most specific pattern first.
  const TYPES = [
    { type: 'VJ Video', re: /\bvj[\s-]?videos?\b|\bvj\b|\bshoots?\b|\bshooting\b|\bshot\b/ },
    { type: 'AI Video', re: /\bai[\s-]?videos?\b|\bai[\s-]?reels?\b|\bvideo[\s-]?edits?\b|\bedited videos?\b|\bvideo[\s-]?editing\b|\bvideos?\b|\breels?\b|\bedits?\b/, generic: /\bvideo[\s-]?edits?\b|\bedited videos?\b|\bvideo[\s-]?editing\b|\bvideos?\b|\breels?\b|\bedits?\b/ },
    { type: 'Poster', re: /\bposters?\b|\bcreatives?\b|\bbanners?\b|\bdesigns?\b/ },
  ];
  // Work that is not one of the 616 deliverables is saved as completed personal tasks.
  const OTHER = [
    { title: 'SEO blog', re: /\bseo\b|\bblogs?\b|\barticles?\b/ },
    { title: 'Meta Ads management', re: /\bmeta[\s-]?ads?\b|\bfacebook ads?\b|\binstagram ads?\b|\bad campaigns?\b|\bads?\b/ },
    { title: 'Website analysis', re: /\bwebsite\b|\bsite audit\b|\banalytics\b/ },
    { title: 'Social media scheduling', re: /\bsocial media\b|\bscheduled? posts?\b|\bscheduling\b/ },
    { title: 'Email newsletter', re: /\bnewsletters?\b|\bemail campaigns?\b|\bmailers?\b/ },
  ];
  const DONE_WORDS = /\b(completed?|finished|done|delivered|made|designed|created|edited|shot|wrapped|submitted|published|uploaded|ready)\b/;
  const NEG_WORDS = /\b(not|no|never|didn'?t|did not|haven'?t|have not|hasn'?t|has not|couldn'?t|won'?t|pending|yet|still working|in progress|tomorrow|will)\b|n't\b/;

  const lower = (s) => String(s || '').toLowerCase();
  function brandIn(text) {
    const t = ' ' + lower(text).replace(/[^a-z0-9 ]+/g, ' ') + ' ';
    const hits = D.BRANDS.filter((b) => {
      const n = lower(b.name);
      if (t.includes(' ' + n + ' ')) return true;
      const short = n.replace(/^igo /, '');
      return short !== n && t.includes(' ' + short + ' ');
    });
    return hits.sort((a, b) => b.name.length - a.name.length)[0] || null; // longest name wins (Farm Land Estates vs Farm Loans)
  }
  function countIn(clause) {
    const m = lower(clause).match(new RegExp('\\b' + NUM_RE + '\\b'));
    if (!m) return null;
    const v = /^\d+$/.test(m[1]) ? Number(m[1]) : NUM[m[1]];
    return v > 0 ? v : null;
  }

  // ---------- 1. understand ----------
  function parse(text) {
    const src = String(text || '').trim();
    const out = { text: src, ids: [], parts: [], warnings: [] };
    if (!src) { out.warnings.push('Tell MAHI what you completed, for example "I completed five posters today".'); return out; }
    // explicit content IDs always win
    (src.match(/\bS0[1-9]-[A-Z0-9]+-(?:P|AI|VJ)\d{1,2}\b/gi) || []).forEach((id) => { const u = id.toUpperCase(); if (!out.ids.includes(u)) out.ids.push(u); });
    const rest = src.replace(/\bS0[1-9]-[A-Z0-9]+-(?:P|AI|VJ)\d{1,2}\b/gi, ' ');
    const NUM_NC = NUM_RE.replace(/^\(/, '(?:'); // non-capturing: split() must not inject captured pieces
    const clauses = lower(rest).split(new RegExp('[,;.\\n]+|\\band\\b(?=\\s+(?:also\\s+)?' + NUM_NC + '\\b)|\\bplus\\b')).filter((c) => typeof c === 'string');
    const globalNeg = NEG_WORDS.test(lower(rest)) && !DONE_WORDS.test(lower(rest));
    clauses.forEach((c) => {
      const clause = c.trim(); if (!clause) return;
      const neg = NEG_WORDS.test(clause) && !/\bnot only\b/.test(clause);
      const set = (clause.match(/\bset\s*0?([1-7])\b/) || [])[1];
      const fest = (clause.match(/\b(christmas|new year|pongal)\b/) || [])[1];
      const brand = brandIn(clause);
      const t = TYPES.find((x) => x.re.test(clause));
      // every kind of non-deliverable work named in the clause ("Meta Ads campaigns and website audit")
      const others = OTHER.filter((x) => x.re.test(clause) && !(t && x.title === 'Meta Ads management' && !/\bmeta|facebook|instagram|campaign/.test(clause)));
      if (!t && !others.length) return;
      const n = countIn(clause) || 1;
      if (neg || globalNeg) { out.warnings.push(`Skipped "${clause}" – it sounds unfinished.`); return; }
      if (t) out.parts.push({ kind: 'deliverable', type: t.type, count: n, brand: brand ? brand.name : '', set: set ? 'S0' + set : '', festival: fest ? (fest === 'new year' ? 'New Year' : fest[0].toUpperCase() + fest.slice(1)) : '', assumed: !!(t.generic && t.generic.test(clause) && !/\bai\b/.test(clause)), phrase: clause });
      // the count belongs to the first item named; any further kinds of work in the same clause count once
      others.forEach((o, i) => out.parts.push({ kind: 'task', title: o.title, count: !t && i === 0 ? n : 1, brand: brand ? brand.name : '', phrase: clause }));
    });
    if (!out.ids.length && !out.parts.length) out.warnings.push('MAHI could not find any posters, videos or other work in that message. Try "I completed 5 posters and 3 AI videos for Valluvam".');
    if ((out.ids.length || out.parts.length) && !DONE_WORDS.test(lower(src))) out.warnings.push('No completion word found ("completed", "finished", "done"…). Check the list before saving.');
    return out;
  }

  // ---------- 2. choose the right records ----------
  // Open records of that type, narrowed by brand / set / festival, in this order:
  // in production today → overdue → earliest deadline → set → brand order.
  function plan(parsed, at) {
    const t = at || S.today();
    const p = { text: parsed.text, date: t, items: [], ids: [], tasks: [], warnings: parsed.warnings.slice() };
    const taken = new Set();
    parsed.ids.forEach((id) => {
      const a = S.asset(id);
      if (!a) { p.warnings.push(`${id} is not one of the ${S.state.assets.length} deliverables.`); return; }
      if (D.isDone(a)) { p.warnings.push(`${id} is already ${a.status} (on ${D.fmtDate(a.completionDate) || 'an earlier day'}) – left unchanged.`); return; }
      taken.add(id); p.items.push({ label: id, type: a.type, requested: 1, picked: [id], shortfall: 0 });
    });
    const brandOrder = {}; D.BRANDS.forEach((b, i) => { brandOrder[b.name] = i; });
    const rank = (a) => (a.prodStart <= t && a.deadline >= t ? 0 : a.deadline < t ? 1 : 2);
    parsed.parts.forEach((part) => {
      if (part.kind === 'task') {
        for (let i = 0; i < part.count; i++) p.tasks.push({ title: part.title + (part.brand ? ' – ' + part.brand : '') + ' (reported to MAHI)' });
        return;
      }
      const pool = S.state.assets.filter((a) => a.type === part.type && !D.isDone(a) && !taken.has(a.id)
        && (!part.brand || a.brand === part.brand) && (!part.set || a.set === part.set) && (!part.festival || a.festival === part.festival))
        .sort((a, b) => rank(a) - rank(b) || a.deadline.localeCompare(b.deadline) || a.set.localeCompare(b.set) || (brandOrder[a.brand] - brandOrder[b.brand]) || a.id.localeCompare(b.id));
      const picked = pool.slice(0, part.count).map((a) => a.id);
      picked.forEach((id) => taken.add(id));
      const scope = [part.brand, part.set && D.setByCode(part.set).label, part.festival].filter(Boolean).join(' · ');
      const label = `${part.count} ${part.type}${part.count > 1 ? 's' : ''}${scope ? ' · ' + scope : ''}`;
      p.items.push({ label, type: part.type, requested: part.count, picked, shortfall: part.count - picked.length, assumed: part.assumed });
      if (part.assumed) p.warnings.push(`"${part.phrase}" was read as AI videos. Say "VJ videos" if you meant VJ shoots.`);
      if (picked.length < part.count) p.warnings.push(`Only ${picked.length} open ${part.type.toLowerCase()}(s) match "${part.phrase}".`);
    });
    p.items.forEach((x) => x.picked.forEach((id) => { if (!p.ids.includes(id)) p.ids.push(id); }));
    return p;
  }

  // ---------- 3. save, then prove it was saved ----------
  // Updates the real records through the store (same path as the record editor). MAHI's celebration
  // reactions are held back and returned; the caller shows them only when result.ok is true,
  // i.e. after the saved browser copy has been read back and contains every change.
  function apply(pl, chosenIds) {
    const ids = (chosenIds || pl.ids).filter((id) => { const a = S.asset(id); return a && !D.isDone(a); });
    const prev = {}; ids.forEach((id) => { prev[id] = S.asset(id).status; });
    const reactions = ids.length ? S.updateAssets(ids, { status: 'Completed' }, { defer: true }).reactions.slice() : [];
    const taskIds = pl.tasks.map((x) => {
      const tk = S.addCustomTask({ title: x.title, category: 'Reported to MAHI', priority: 'Medium' });
      reactions.push(...S.updateCustomTask(tk.id, { status: 'Completed' }, { defer: true }));
      return tk.id;
    });
    const rec = { id: S.uid('R'), ts: new Date().toISOString(), date: S.today(), text: pl.text, deliverables: ids, tasks: taskIds, prev };
    S.state.mahiReports = S.state.mahiReports || [];
    S.state.mahiReports.unshift(rec);
    if (S.state.mahiReports.length > 500) S.state.mahiReports.length = 500;
    S.notify('report', 'Work report saved', `${ids.length} deliverable(s) and ${taskIds.length} other task(s) marked completed from: "${pl.text.slice(0, 120)}"`);
    S.changed({ report: rec.id });
    const v = verify(rec);
    return { rec, ok: v.ok, reason: v.reason, reactions: reactions.sort((a, b) => b.priority - a.priority) };
  }
  function verify(rec) {
    return S.verifySaved((saved) => (saved.mahiReports || []).some((r) => r.id === rec.id)
      && rec.deliverables.every((id) => { const a = (saved.assets || []).find((x) => x.id === id); return a && D.DONE_STATUSES.includes(a.status) && !!a.completionDate; })
      && rec.tasks.every((id) => (saved.customTasks || []).some((t) => t.id === id && t.status === 'Completed')));
  }
  // Try the browser save again (e.g. after freeing storage) and re-verify.
  function retry(rec) { S.save(true); return verify(rec); }
  // Browser copy verified → also push to the cloud account when signed in. Resolves to 'synced', 'pending' or 'local'.
  async function cloudConfirm() {
    const Y = root.MAHI_SYNC;
    if (!Y || Y.status === 'local' || !Y.pushNow) return 'local';
    try { await Y.pushNow(); } catch (e) { /* status tells */ }
    return Y.status === 'synced' ? 'synced' : 'pending';
  }

  // Reverse one saved report (only records it changed and that are still completed).
  function undo(reportId) {
    const r = (S.state.mahiReports || []).find((x) => x.id === reportId); if (!r || r.undone) return null;
    const back = r.deliverables.filter((id) => { const a = S.asset(id); return a && a.status === 'Completed'; });
    back.forEach((id) => S.updateAssets([id], { status: (r.prev && r.prev[id]) || 'Not Started' }, { silent: true }));
    r.tasks.forEach((id) => S.deleteCustomTask(id));
    r.undone = new Date().toISOString();
    S.notify('report', 'Work report undone', `${back.length} deliverable(s) returned to their earlier status.`);
    S.changed({ report: r.id }); S.flush();
    return r;
  }

  root.MAHI_REPORT = { parse, plan, apply, verify, retry, cloudConfirm, undo };
})(typeof self !== 'undefined' ? self : this);
