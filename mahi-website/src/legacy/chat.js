/* MAHI – chat brain. Answers questions and suggestions from the SAVED records only, and turns
 * natural-language work reports into a confirm-then-save plan (via MAHI_REPORT).
 * Pure logic: no DOM, no network – the dock UI in app.js renders the replies.
 * Reply shape: { emotion, text, detail?, lines?: [string], confirm?: plan }
 */
(function (root) {
  'use strict';
  const D = root.MAHI_DATA, S = root.MAHI_STORE, R = root.MAHI_REPORT;
  const lower = (s) => String(s || '').toLowerCase();
  const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0) + '%';
  const nameOf = () => (S.state.settings.callName || 'Nathan');
  const short = (a) => `${a.id} · ${a.brand} · due ${D.fmtDate(a.deadline)}`;

  function suggestions(limit) {
    const t = S.today(), m = S.metrics();
    const overdue = m.overdue.slice().sort((a, b) => a.deadline.localeCompare(b.deadline));
    const today = m.todayPending.filter((a) => a.__flag !== 'OVERDUE').sort((a, b) => a.deadline.localeCompare(b.deadline));
    const tasks = S.state.customTasks.filter((x) => x.status !== 'Completed' && x.date <= t).sort((a, b) => ({ High: 0, Medium: 1, Low: 2 }[a.priority] - { High: 0, Medium: 1, Low: 2 }[b.priority]));
    const out = [];
    overdue.slice(0, 3).forEach((a) => out.push(`Overdue: ${short(a)}`));
    tasks.filter((x) => x.priority === 'High').slice(0, 2).forEach((x) => out.push(`High-priority task: ${x.title}${x.carriedFrom ? ` (carried from ${D.fmtDate(x.carriedFrom)})` : ''}`));
    today.slice(0, 3).forEach((a) => out.push(`In production today: ${short(a)}`));
    tasks.filter((x) => x.priority !== 'High').slice(0, 2).forEach((x) => out.push(`Task: ${x.title}`));
    if (!out.length && m.current) {
      const next = S.state.assets.filter((a) => !D.isDone(a) && a.set === m.current.code).sort((a, b) => a.deadline.localeCompare(b.deadline)).slice(0, 3);
      next.forEach((a) => out.push(`Get ahead on ${m.current.label}: ${short(a)}`));
    }
    return out.slice(0, limit || 5);
  }

  function typeBreakdown(from, to) {
    const c = { Poster: 0, 'AI Video': 0, 'VJ Video': 0 };
    S.state.assets.forEach((a) => { if (D.isDone(a) && a.completionDate >= from && a.completionDate <= to) c[a.type]++; });
    return `${c.Poster} posters · ${c['AI Video']} AI videos · ${c['VJ Video']} VJ videos`;
  }

  function answer(input) {
    const text = String(input || '').trim(), q = lower(text), name = nameOf();
    if (!text) return { emotion: 'confused', text: `I'm listening, ${name}. Ask me about your progress, or tell me what you finished.` };
    const p = S.performance(), m = S.metrics(), t = p.today;

    // 1. Work reports ("I completed five posters today") → plan and ask to confirm.
    const looksLikeReport = /\b(completed?|finished|done|delivered|wrapped|made|designed|edited|shot|submitted|published)\b/.test(q) && !/\?\s*$/.test(q) && !/\b(how many|what|which|did i)\b/.test(q);
    if (looksLikeReport) {
      const parsed = R.parse(text);
      if (parsed.ids.length || parsed.parts.length) {
        const plan = R.plan(parsed);
        if (!plan.ids.length && !plan.tasks.length) return { emotion: 'confused', text: `I couldn't find open records that match, ${name}.`, lines: plan.warnings };
        return { emotion: 'clipboard', text: `Let me confirm before I save, ${name}:`, confirm: plan };
      }
    }
    if (/^(hi|hello|hey|good (morning|afternoon|evening)|namaste|vanakkam)\b/.test(q)) {
      return { emotion: 'waving', text: `Hello, ${name}! You've completed ${p.day.total} item(s) today and ${p.week.total} this week.`, detail: 'Tell me what you finished, or ask "what should I do next?"' };
    }
    if (/\b(bye|good ?night|see you|logging off|log ?out|sign ?out)\b/.test(q)) {
      const open = S.state.customTasks.filter((x) => x.status !== 'Completed' && x.date <= t).length;
      return { emotion: 'goodbye', text: `Goodbye, ${name}! Today: ${p.day.total} completed. Everything is saved.`, detail: open ? `${open} unfinished task(s) will move to tomorrow automatically.` : 'Nothing left open for today.' };
    }
    if (/\b(thank|thanks|great job|good job|love you)\b/.test(q)) return { emotion: 'heart', text: `Always happy to help, ${name}!` };
    if (/\b(tired|stress|stressed|overwhelm|bored|lazy|motivat|sad)\b/.test(q)) {
      const s = suggestions(1)[0];
      return { emotion: 'motivating', text: `You've got this, ${name}. ${p.week.total} done this week already!`, detail: s ? `One small step: ${s}` : 'Take a short break, then pick one task.' };
    }
    if (/\bweek/.test(q)) {
      const ws = p.weekStart, lastWs = D.addDays(ws, -7), lastWe = D.addDays(ws, -1);
      const last = S.performance(lastWe).week.total;
      return { emotion: p.week.total ? 'trophy' : 'clipboard', text: `Weekly report (${D.fmtDate(ws)} – ${D.fmtDate(t)}): ${p.week.total} completed.`, lines: [`Deliverables: ${p.week.deliverables} (${typeBreakdown(ws, t)})`, `Other tasks: ${p.week.tasks}`, `Last week: ${last}`, `Overall: ${m.done}/${m.total} deliverables (${pct(m.done, m.total)})`] };
    }
    if (/\bmonth/.test(q)) return { emotion: 'clipboard', text: `This month: ${p.month.total} completed (${p.month.deliverables} deliverables, ${p.month.tasks} tasks).`, lines: [typeBreakdown(t.slice(0, 7) + '-01', t)] };
    if (/\byear/.test(q)) return { emotion: 'clipboard', text: `This year: ${p.year.total} completed (${p.year.deliverables} deliverables, ${p.year.tasks} tasks).` };
    if (/\b(today|daily|day report|so far today)\b/.test(q) && !/\bdeadline|due\b/.test(q)) {
      const open = m.todayPending.length + m.customToday.filter((x) => x.status !== 'Completed').length;
      const carried = m.customToday.filter((x) => x.carriedFrom && x.status !== 'Completed').length;
      return { emotion: p.day.total ? 'happy' : 'clipboard', text: `Today (${D.fmtDate(t)}): ${p.day.total} completed, ${open} still open.`, lines: [`Deliverables: ${p.day.deliverables} (${typeBreakdown(t, t)})`, `Other tasks: ${p.day.tasks}`, carried ? `${carried} task(s) carried forward from earlier days` : 'No carried-forward tasks', `Yesterday: ${p.yesterday.total}`] };
    }
    if (/\b(overdue|late|missed)\b/.test(q)) {
      const od = m.overdue.slice().sort((a, b) => a.deadline.localeCompare(b.deadline));
      const odTasks = S.state.customTasks.filter((x) => x.status !== 'Completed' && x.carriedFrom);
      if (!od.length && !odTasks.length) return { emotion: 'thumbsUp', text: `Nothing overdue, ${name}. Great control!` };
      return { emotion: 'warning', text: `${od.length} overdue deliverable(s) and ${odTasks.length} carried-forward task(s).`, lines: od.slice(0, 5).map(short).concat(odTasks.slice(0, 3).map((x) => `Task from ${D.fmtDate(x.carriedFrom)}: ${x.title}`)) };
    }
    if (/\b(deadlines?|due|upcoming)\b/.test(q)) {
      const due = m.dueSoon.slice().sort((a, b) => a.deadline.localeCompare(b.deadline));
      if (!due.length) return { emotion: 'thumbsUp', text: 'No deadlines inside your alert window right now.', detail: m.current ? `${m.current.label} production ends ${D.fmtDate(m.current.end)}.` : '' };
      return { emotion: 'clock', text: `${due.length} deliverable(s) are due soon.`, lines: due.slice(0, 5).map(short) };
    }
    if (/\b(achievements?|badges?|troph(y|ies)|unlocked)\b/.test(q)) {
      const un = D.ACHIEVEMENTS.filter((a) => S.state.achievements[a.key]);
      return { emotion: un.length ? 'trophy' : 'motivating', text: `${un.length} of ${D.ACHIEVEMENTS.length} achievements unlocked.`, lines: un.map((a) => `${a.icon} ${a.name}`).slice(0, 8) };
    }
    if (/\b(next|suggest|priorit|what should|plan my|focus on|pending|to ?do|left)\b/.test(q)) {
      const s = suggestions(5);
      if (!s.length) return { emotion: 'celebrating', text: `Everything due is done, ${name}!` };
      return { emotion: 'searching', text: 'Here is what I suggest, in order:', lines: s };
    }
    if (/\b(progress|status|how am i|how are we|overall|summary|report)\b/.test(q)) {
      const cs = m.currentStats;
      return { emotion: m.pct >= 0.5 ? 'excited' : 'happy', text: `Overall: ${m.done}/${m.total} deliverables (${pct(m.done, m.total)}).`, lines: [cs && m.current ? `${m.current.label} (${m.current.festival}): ${cs.done}/${cs.target} done` : 'No active set', `Today ${p.day.total} · this week ${p.week.total} · all time ${p.all.total}`, `${m.overdue.length} overdue · ${m.dueSoon.length} due soon`] };
    }
    if (/\b(help|what can you)\b/.test(q)) return { emotion: 'happy', text: 'I can save your finished work and answer questions from your records.', lines: ['"I completed five posters today"', '"Finished 2 AI videos for Valluvam and 1 SEO blog"', '"How am I doing?" · "Weekly report" · "What should I do next?"', '"What is overdue?" · "Any deadlines?" · "Achievements"'] };
    if (looksLikeReport) return { emotion: 'confused', text: `I couldn't tell which work you finished, ${name}.`, detail: 'Try "I completed 3 posters" or give a content ID like S01-VALLUVAM-P01.' };
    return { emotion: 'confused', text: `Sorry ${name}, I didn't get that.`, detail: 'Try "how am I doing?", "what should I do next?" or tell me what you completed.' };
  }

  root.MAHI_CHAT = { answer, suggestions };
})(typeof self !== 'undefined' ? self : this);
