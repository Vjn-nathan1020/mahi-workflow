/* MAHI – shared UI toolkit: router, modals, drawer editor, toasts, effects, sound. */
(function (root) {
  'use strict';
  const D = root.MAHI_DATA, S = root.MAHI_STORE, CH = root.MAHI_CHARTS;
  const esc = CH.esc;
  const UI = {};
  UI.esc = esc;
  UI.$ = (s, r) => (r || document).querySelector(s);
  UI.$$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  UI.pct = CH.pctTxt;
  UI.fmt = D.fmtDate;
  UI.typeColor = (t) => D.TYPE_COLORS[t] || '#888';
  UI.festColor = (f) => (D.FESTIVALS.find((x) => x.name === f) || { colors: ['#2E9E4F'] }).colors[0];
  UI.statusChip = (s) => `<span class="chip st" style="--c:${D.STATUS_COLORS[s] || '#9E9E9E'}">${esc(s || '—')}</span>`;
  UI.flagChip = (f) => !f || f === 'On Track' ? `<span class="chip flag ok">${esc(f || '')}</span>` : f === 'Done' ? '<span class="chip flag done">Done</span>' : f === 'OVERDUE' ? '<span class="chip flag over">OVERDUE</span>' : `<span class="chip flag due">${esc(f)}</span>`;
  UI.typeChip = (t) => `<span class="chip type" style="--c:${UI.typeColor(t)}">${esc(t)}</span>`;
  UI.options = (list, val, blank) => (blank ? `<option value="">${esc(blank)}</option>` : '') + list.map((o) => { const v = typeof o === 'object' ? o.v : o, l = typeof o === 'object' ? o.l : o; return `<option value="${esc(v)}"${String(v) === String(val) ? ' selected' : ''}>${esc(l)}</option>`; }).join('');
  UI.avatar = (pic, name, cls) => pic ? `<img class="avatar ${cls || ''}" src="${esc(pic)}" alt="${esc(name)}">` : `<span class="avatar ${cls || ''}">${esc((name || '?').replace(/[^A-Za-z0-9 ]/g, '').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() || '?')}</span>`;
  UI.setLabel = (code) => (D.setByCode(code) || { label: code }).label;
  UI.vjName = (id) => S.vjName(id);

  // ---------- routing ----------
  UI.route = { name: 'home', params: {} };
  UI.parseHash = () => {
    const h = (location.hash || '#/home').slice(2);
    const [name, qs] = h.split('?');
    const params = {}; (qs || '').split('&').filter(Boolean).forEach((kv) => { const [k, v] = kv.split('='); params[decodeURIComponent(k)] = decodeURIComponent(v || ''); });
    return { name: name || 'home', params };
  };
  UI.go = (r) => { const target = '#/' + r; if (location.hash === target) UI.render(); else location.hash = target; };

  // ---------- toast ----------
  UI.toast = (msg, kind) => {
    const t = document.createElement('div'); t.className = 'toast ' + (kind || ''); t.textContent = msg;
    UI.$('#toasts').appendChild(t); setTimeout(() => t.classList.add('out'), 2600); setTimeout(() => t.remove(), 3100);
  };

  // ---------- modal ----------
  UI.modal = (title, body, buttons, opts) => new Promise((resolve) => {
    const wrap = document.createElement('div'); wrap.className = 'modal-wrap';
    wrap.innerHTML = `<div class="modal ${opts && opts.wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="modal-h"><h3>${esc(title)}</h3><button class="icon-btn" data-x aria-label="Close">✕</button></div><div class="modal-b">${body}</div><div class="modal-f">${(buttons || [{ label: 'Close', value: null }]).map((b, i) => `<button class="btn ${b.cls || (i === 0 ? '' : 'ghost')}" data-i="${i}">${esc(b.label)}</button>`).join('')}</div></div>`;
    document.body.appendChild(wrap);
    const close = (v) => { wrap.remove(); document.removeEventListener('keydown', key); resolve(v); };
    const key = (e) => { if (e.key === 'Escape') close(null); };
    document.addEventListener('keydown', key);
    wrap.addEventListener('click', (e) => {
      if (e.target === wrap || e.target.closest('[data-x]')) return close(null);
      const b = e.target.closest('[data-i]'); if (b) { const btn = buttons[Number(b.dataset.i)]; close(btn.value === undefined ? btn.label : (typeof btn.value === 'function' ? btn.value(wrap) : btn.value)); }
    });
    if (opts && opts.onOpen) opts.onOpen(wrap, close);
  });
  UI.confirm = (title, msg, okLabel, danger) => UI.modal(title, `<p>${msg}</p>`, [{ label: okLabel || 'Confirm', value: true, cls: danger ? 'danger' : '' }, { label: 'Cancel', value: false }]).then((v) => v === true);

  // ---------- download ----------
  // Hosted on claude.ai the page must save through the `downloads` capability; locally a normal link works.
  UI.download = async (blob, name) => {
    if (window.claude && typeof window.claude.use === 'function') {
      let dl = null;
      try { dl = await window.claude.use('downloads'); } catch (e) { dl = null; }
      if (dl) {
        try { await dl.save({ filename: name, data: blob }); UI.toast('Saved ' + name, 'ok'); }
        catch (e) { UI.toast(e && e.code === 'declined' ? 'Download cancelled' : 'Download not available here (' + ((e && e.code) || 'error') + ')', e && e.code === 'declined' ? '' : 'bad'); }
        return;
      }
    }
    UI.legacyDownload(blob, name);
  };
  UI.legacyDownload = (blob, name) => { if (/\.(json|xlsx)$/i.test(name)) { try { localStorage.setItem('mahi.lastBackup', String(Date.now())); } catch (e) { /* ignore */ } } const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); };
  UI.readFile = (file, as) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; if (as === 'text') r.readAsText(file); else if (as === 'url') r.readAsDataURL(file); else r.readAsArrayBuffer(file); });
  UI.resizeImage = (dataUrl, max) => new Promise((res) => { const img = new Image(); img.onload = () => { const s = Math.min(1, max / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); res(c.toDataURL('image/jpeg', 0.85)); }; img.onerror = () => res(''); img.src = dataUrl; });

  // ---------- asset editor drawer ----------
  const STEP_FIELDS = {
    'Poster': [['contentStatus', 'Content Status', 'step'], ['designStatus', 'Design Status', 'step'], ['qc', 'Quality Check', 'qc'], ['correction', 'Correction Status', 'corr'], ['finalApproval', 'Final Approval', 'appr']],
    'AI Video': [['scriptStatus', 'Script Status', 'step'], ['promptStatus', 'Prompt Status', 'step'], ['aiGenStatus', 'AI Generation Status', 'step'], ['voStatus', 'Voice-over Status', 'step'], ['editStatus', 'Editing Status', 'step'], ['subtitleStatus', 'Subtitle Status', 'step'], ['thumbStatus', 'Thumbnail Status', 'step'], ['qc', 'Quality Check', 'qc'], ['finalApproval', 'Final Approval', 'appr']],
    'VJ Video': [['scriptStatus', 'Script Status', 'step'], ['scriptApproval', 'Script Approval', 'appr'], ['shootStatus', 'Shooting Status', 'step'], ['editStatus', 'Editing Status', 'step'], ['subtitleStatus', 'Subtitle Status', 'step'], ['thumbStatus', 'Thumbnail Status', 'step'], ['qc', 'Quality Check', 'qc'], ['correction', 'Correction Status', 'corr'], ['finalApproval', 'Final Approval', 'appr']],
  };
  const LISTS = { step: D.STEP_STATUSES, qc: D.QC_STATUSES, corr: D.CORRECTION_STATUSES, appr: D.APPROVAL_STATUSES, ready: D.READY_STATUSES };
  UI.STEP_FIELDS = STEP_FIELDS;

  UI.openEditor = (id, tab) => {
    const a = S.asset(id); if (!a) return;
    const dr = UI.$('#drawer');
    const fld = (k, l, type, extra) => {
      const v = a[k] == null ? '' : a[k];
      if (type === 'textarea') return `<label class="f"><span>${l}</span><textarea name="${k}" rows="${(extra && extra.rows) || 3}">${esc(v)}</textarea></label>`;
      if (Array.isArray(type)) return `<label class="f"><span>${l}</span><select name="${k}">${UI.options(type, v, extra && extra.blank)}</select></label>`;
      return `<label class="f"><span>${l}</span><input name="${k}" type="${type || 'text'}" value="${esc(v)}"></label>`;
    };
    const logs = S.state.platformLogs.filter((l) => l.contentId === id);
    const vj = a.vj ? ` · ${esc(UI.vjName(a.vj))}` : '';
    dr.innerHTML = `<div class="drawer-h"><div><div class="muted small">${esc(a.festival)} · ${esc(UI.setLabel(a.set))}${vj}</div><h3>${esc(a.id)}</h3><div>${UI.typeChip(a.type)} ${UI.statusChip(a.status)} ${UI.flagChip(D.deadlineFlag(a, new Date(), S.state.settings.thresholds))}</div></div><button class="icon-btn" data-close aria-label="Close editor">✕</button></div>
    <form class="drawer-b" autocomplete="off">
      <div class="tabs small" role="tablist"><button type="button" data-tab="work" class="on">Production</button><button type="button" data-tab="content">Content</button><button type="button" data-tab="pub">Publishing</button></div>
      <section data-pane="work">
        ${fld('status', 'Overall Production Status', D.PROD_STATUSES)}
        <div class="grid2">${STEP_FIELDS[a.type].map(([k, l, t]) => fld(k, l, LISTS[t])).join('')}</div>
        <div class="grid2">${fld('prodStart', 'Production Start', 'date')}${fld('deadline', 'Production Deadline', 'date')}${fld('completionDate', 'Completion Date', 'date')}${fld('priority', 'Priority', D.PRIORITIES)}</div>
        ${a.type === 'VJ Video' ? `<div class="grid2">${fld('shootDate', 'Shoot Date', 'date')}${fld('location', 'Shooting Location')}</div>` : ''}
        ${a.type === 'Poster' ? fld('designer', 'Assigned Designer') : ''}
        ${fld('fileLink', a.type === 'Poster' ? 'Creative File Link' : 'Video File Link', 'url')}
        ${fld('remarks', 'Remarks', 'textarea', { rows: 2 })}
      </section>
      <section data-pane="content" hidden>
        ${fld('topic', a.type === 'Poster' ? 'Poster Topic' : 'Video Topic')}
        ${a.type === 'Poster' ? fld('content', 'Poster Content', 'textarea') : ''}
        ${fld('concept', a.type === 'Poster' ? 'Design Concept' : 'Video Concept', 'textarea')}
        ${a.type !== 'Poster' ? fld('duration', 'Video Duration') : ''}
        ${a.type !== 'Poster' ? fld('script', a.type === 'VJ Video' ? 'VJ Script' : 'Script', 'textarea', { rows: 5 }) : ''}
        ${a.type === 'AI Video' ? fld('prompt', 'AI Generation Prompt', 'textarea', { rows: 4 }) : ''}
        ${fld('refLink', a.type === 'AI Video' ? 'Reference Image Link' : 'Reference Link', 'url')}
      </section>
      <section data-pane="pub" hidden>
        <div class="grid2">${fld('pubDate', 'Scheduled Publishing Date', 'date')}${fld('pubTime', 'Publishing Time', 'time')}${fld('platform', 'Primary Platform', D.PLATFORMS, { blank: '—' })}${fld('pubStatus', 'Publishing Status', D.PUB_STATUSES)}${fld('captionStatus', 'Caption Status', D.READY_STATUSES)}${fld('hashtagStatus', 'Hashtag Status', D.READY_STATUSES)}</div>
        ${fld('pubLink', 'Published URL', 'url')}
        ${fld('pubRemarks', 'Publishing Remarks', 'textarea', { rows: 2 })}
        <p class="muted small">Set publishing window: ${UI.fmt(S.state.settings.pubWindows[a.set].start)} → ${UI.fmt(S.state.settings.pubWindows[a.set].end)}</p>
        <h4>Additional platform logs <span class="muted small">(never counted as extra production)</span></h4>
        <div class="loglist">${logs.map((l) => `<div class="logrow"><b>${esc(l.platform)}</b> ${UI.fmt(l.date)} ${esc(l.time || '')} · ${esc(l.status)} ${l.url ? `<a href="${esc(l.url)}" target="_blank" rel="noopener">link</a>` : ''}<button type="button" class="icon-btn" data-dellog="${l.id}" aria-label="Delete log">🗑</button></div>`).join('') || '<p class="muted small">No extra platform posts logged.</p>'}</div>
        <div class="addlog"><select data-lp>${UI.options(D.PLATFORMS)}</select><input type="date" data-ld value="${S.today()}"><select data-ls>${UI.options(D.PUB_STATUSES, 'Published')}</select><input data-lu placeholder="URL"><button type="button" class="btn small" data-addlog>Add log</button></div>
      </section>
    </form>
    <div class="drawer-f"><button class="btn" data-save>Save changes</button><button class="btn ghost" data-quick="Completed">Mark Completed</button><button class="btn ghost" data-close>Cancel</button></div>`;
    dr.classList.add('open'); UI.$('#scrim').classList.add('show');
    const form = dr.querySelector('form');
    const switchTab = (t) => { UI.$$('[data-tab]', dr).forEach((b) => b.classList.toggle('on', b.dataset.tab === t)); UI.$$('[data-pane]', dr).forEach((p) => { p.hidden = p.dataset.pane !== t; }); };
    if (tab) switchTab(tab);
    dr.onclick = async (e) => {
      const t = e.target;
      if (t.closest('[data-close]')) return UI.closeDrawer();
      if (t.dataset.tab) return switchTab(t.dataset.tab);
      if (t.dataset.dellog) { if (await UI.confirm('Delete platform log', 'Remove this platform log entry?', 'Delete', true)) { S.deletePlatformLog(t.dataset.dellog); UI.openEditor(id, 'pub'); } return; }
      if (t.matches('[data-addlog]')) { S.addPlatformLog({ contentId: id, platform: dr.querySelector('[data-lp]').value, date: dr.querySelector('[data-ld]').value, status: dr.querySelector('[data-ls]').value, url: dr.querySelector('[data-lu]').value }); UI.toast('Platform log added'); UI.openEditor(id, 'pub'); return; }
      if (t.matches('[data-save]') || t.dataset.quick) {
        const patch = {}; new FormData(form).forEach((v, k) => { patch[k] = v; });
        if (t.dataset.quick) patch.status = t.dataset.quick;
        if (patch.pubStatus === 'Published' && !D.DONE_STATUSES.includes(patch.status) && a.pubStatus !== 'Published') {
          if (!(await UI.confirm('Publish unapproved content?', `<b>${esc(id)}</b> is not Approved/Completed yet (status: ${esc(patch.status)}). Publishing before approval is not recommended. Continue anyway?`, 'Mark as Published', true))) return;
        }
        S.updateAssets([id], patch);
        UI.toast('Saved ' + id, 'ok'); UI.closeDrawer();
      }
    };
  };
  UI.closeDrawer = () => { UI.$('#drawer').classList.remove('open'); UI.$('#scrim').classList.remove('show'); };

  // Shared guarded status change (inline selects, kanban, bulk)
  UI.changeAssets = async (ids, patch) => {
    if (patch.pubStatus === 'Published' || patch.pubStatus === 'Scheduled') {
      const bad = ids.filter((id) => !D.isDone(S.asset(id)));
      if (bad.length) {
        const ok = await UI.confirm(`Content not approved`, `${bad.length} item(s) (${esc(bad.slice(0, 4).join(', '))}${bad.length > 4 ? '…' : ''}) are not Approved/Completed. Marking them <b>${esc(patch.pubStatus)}</b> before approval is not recommended. Continue?`, `Yes, mark ${patch.pubStatus}`, true);
        if (!ok) return false;
      }
    }
    S.updateAssets(ids, patch); return true;
  };

  // ---------- effects: confetti & fireworks ----------
  const fx = {};
  let cv, ctx, parts = [], raf = 0;
  function ensureCanvas() { if (cv) return; cv = document.createElement('canvas'); cv.id = 'fx'; document.body.appendChild(cv); ctx = cv.getContext('2d'); const rs = () => { cv.width = innerWidth; cv.height = innerHeight; }; rs(); addEventListener('resize', rs); }
  function loop() {
    ctx.clearRect(0, 0, cv.width, cv.height);
    parts = parts.filter((p) => p.life > 0);
    parts.forEach((p) => {
      p.life--; p.x += p.vx; p.y += p.vy; p.vy += p.g; p.vx *= 0.99; p.rot += p.vr;
      ctx.save(); ctx.globalAlpha = Math.min(1, p.life / 40); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.c;
      if (p.spark) { ctx.beginPath(); ctx.arc(0, 0, p.s, 0, 6.3); ctx.fill(); } else ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
      ctx.restore();
    });
    if (parts.length) raf = requestAnimationFrame(loop); else { raf = 0; ctx.clearRect(0, 0, cv.width, cv.height); }
  }
  const COLORS = ['#2E9E4F', '#C9A227', '#1E6FD9', '#E53935', '#7E57C2', '#FFD54F', '#43B864'];
  fx.confetti = (n) => {
    ensureCanvas();
    for (let i = 0; i < (n || 120); i++) parts.push({ x: innerWidth * (0.2 + Math.random() * 0.6), y: innerHeight * 0.35, vx: (Math.random() - 0.5) * 14, vy: -Math.random() * 13 - 3, g: 0.32, s: 6 + Math.random() * 6, c: COLORS[i % COLORS.length], rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3, life: 140 + Math.random() * 60 });
    if (!raf) loop();
  };
  fx.fireworks = () => {
    ensureCanvas();
    for (let b = 0; b < 7; b++) setTimeout(() => {
      const x = innerWidth * (0.15 + Math.random() * 0.7), y = innerHeight * (0.15 + Math.random() * 0.3), c = COLORS[b % COLORS.length];
      for (let i = 0; i < 70; i++) { const a = (i / 70) * Math.PI * 2, sp = 2 + Math.random() * 4; parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 0.05, s: 2.2, c, rot: 0, vr: 0, life: 70 + Math.random() * 30, spark: true }); }
      if (!raf) loop();
    }, b * 450);
  };
  UI.fx = fx;

  // ---------- sound (WebAudio, generated tones – off by default) ----------
  let actx;
  UI.sound = (kind) => {
    if (!S.state.settings.sound) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const notes = kind === 'celebrate' ? [523, 659, 784, 1047] : kind === 'alert' ? [440, 349] : [660, 880];
      notes.forEach((f, i) => { const o = actx.createOscillator(), g = actx.createGain(); o.type = 'sine'; o.frequency.value = f; g.gain.setValueAtTime(0.0001, actx.currentTime + i * 0.12); g.gain.exponentialRampToValueAtTime(0.12, actx.currentTime + i * 0.12 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + i * 0.12 + 0.25); o.connect(g).connect(actx.destination); o.start(actx.currentTime + i * 0.12); o.stop(actx.currentTime + i * 0.12 + 0.3); });
    } catch (e) { /* audio unavailable */ }
  };

  // ---------- celebration overlays ----------
  UI.banner = (title, sub) => {
    const b = document.createElement('div'); b.className = 'celebrate-banner';
    b.innerHTML = `<div class="cb-trophy">🏆</div><div><div class="cb-t">${esc(title)}</div><div class="cb-s">${esc(sub || '')}</div></div><div class="cb-badge">ACHIEVEMENT</div>`;
    document.body.appendChild(b); setTimeout(() => b.classList.add('out'), 6500); setTimeout(() => b.remove(), 7200);
  };
  UI.certificate = () => {
    const s = S.state.settings;
    UI.modal('Achievement Certificate', `<div class="certificate"><div class="cert-top">IGO GROUP OF COMPANIES · DIGITAL MARKETING</div><div class="cert-trophy">🏆</div><h2>Certificate of Achievement</h2><p>This certifies that</p><div class="cert-name">${esc(s.owner)}</div><p>successfully completed the entire festival production workflow</p><div class="cert-big">${S.state.assets.length} / ${S.state.assets.length} DELIVERABLES COMPLETED</div><p class="muted">Christmas · New Year · Pongal — 15 brands · 7 production sets</p><div class="cert-sign">MAHI · ${UI.fmt(S.today())}</div></div>`, [{ label: 'Wonderful!', value: true }], { wide: true });
  };

  root.MAHI_UI = UI;
})(window);
