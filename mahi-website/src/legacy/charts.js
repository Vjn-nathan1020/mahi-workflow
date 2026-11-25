/* Lightweight animated SVG charts (no external library). Every chart has native tooltips and text labels. */
(function (root) {
  'use strict';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const pctTxt = (v) => (Math.round(v * 1000) / 10).toFixed(v === 0 || v === 1 ? 0 : 1) + '%';

  function donut(parts, o) {
    o = o || {};
    const size = o.size || 170, r = size / 2 - 14, c = 2 * Math.PI * r, total = parts.reduce((s, p) => s + p.value, 0) || 1;
    let off = 0;
    const segs = parts.map((p, i) => {
      const len = (p.value / total) * c;
      const s = `<circle class="dn-seg" style="--len:${len.toFixed(2)};--c:${c.toFixed(2)};animation-delay:${i * 120}ms" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${p.color}" stroke-width="18" stroke-dasharray="${len.toFixed(2)} ${(c - len).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}" transform="rotate(-90 ${size / 2} ${size / 2})"${p.click ? ` data-click="${esc(p.click)}"` : ''}><title>${esc(p.label)}: ${p.value} (${pctTxt(p.value / total)})</title></circle>`;
      off += len; return s;
    }).join('');
    const legend = o.legend === false ? '' : `<div class="legend">${parts.map((p) => `<span><i style="background:${p.color}"></i>${esc(p.label)} <b>${p.value}</b></span>`).join('')}</div>`;
    return `<div class="chart donut"><svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--track)" stroke-width="18"/>${segs}<text x="50%" y="48%" text-anchor="middle" class="dn-big">${esc(o.center || '')}</text><text x="50%" y="62%" text-anchor="middle" class="dn-sub">${esc(o.sub || '')}</text></svg>${legend}</div>`;
  }

  function ring(pct, color, size, label) {
    size = size || 64; const r = size / 2 - 6, c = 2 * Math.PI * r, len = Math.max(0, Math.min(1, pct)) * c;
    return `<svg class="ring" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--track)" stroke-width="7"/><circle class="dn-seg" style="--len:${len.toFixed(2)};--c:${c.toFixed(2)}" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="7" stroke-linecap="round" stroke-dasharray="${len.toFixed(2)} ${(c - len).toFixed(2)}" transform="rotate(-90 ${size / 2} ${size / 2})"/><text x="50%" y="56%" text-anchor="middle" class="ring-t">${label != null ? esc(label) : pctTxt(pct)}</text></svg>`;
  }

  // rows: [{label, values:[n...], click}], series: [{name,color}]
  function hbars(rows, series, o) {
    o = o || {};
    const max = o.max || Math.max(1, ...rows.map((r) => r.values.reduce((a, b) => a + b, 0)));
    const legend = series.length > 1 ? `<div class="legend">${series.map((s) => `<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join('')}</div>` : '';
    return `<div class="chart hbars">${legend}${rows.map((r, ri) => {
      const tot = r.values.reduce((a, b) => a + b, 0);
      let acc = 0;
      const segs = r.values.map((v, i) => { const w = (v / max) * 100; const s = `<div class="hb-seg" style="left:${acc}%;width:${w}%;background:${series[i].color};animation-delay:${ri * 40}ms" title="${esc(r.label)} · ${esc(series[i].name)}: ${v}"></div>`; acc += w; return s; }).join('');
      return `<div class="hb-row"${r.click ? ` data-click="${esc(r.click)}"` : ''}><div class="hb-label" title="${esc(r.label)}">${esc(r.label)}</div><div class="hb-track">${segs}</div><div class="hb-val">${o.fmt ? o.fmt(r) : r.values.length > 1 ? `${r.values[0]}/${tot}` : tot}</div></div>`;
    }).join('')}</div>`;
  }

  // rows: [{label, value, color, click, title}]
  function vbars(rows, o) {
    o = o || {};
    const H = o.height || 160, W = Math.max(rows.length * (o.bw || 44), 200), max = o.max || Math.max(1, ...rows.map((r) => r.value));
    const bw = W / rows.length;
    const bars = rows.map((r, i) => {
      const h = (r.value / max) * (H - 34), x = i * bw + bw * 0.18, y = H - 20 - h;
      return `<g${r.click ? ` data-click="${esc(r.click)}"` : ''}><rect class="vb" style="animation-delay:${i * 50}ms" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(bw * 0.64).toFixed(1)}" height="${Math.max(h, 0).toFixed(1)}" rx="4" fill="${r.color || 'var(--emerald)'}"><title>${esc(r.title || r.label + ': ' + (o.pct ? pctTxt(r.value) : r.value))}</title></rect><text x="${(x + bw * 0.32).toFixed(1)}" y="${(y - 4).toFixed(1)}" text-anchor="middle" class="vb-v">${o.pct ? pctTxt(r.value) : r.value}</text><text x="${(x + bw * 0.32).toFixed(1)}" y="${H - 5}" text-anchor="middle" class="vb-l">${esc(r.label)}</text></g>`;
    }).join('');
    return `<div class="chart vbars"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet"><line x1="0" x2="${W}" y1="${H - 20}" y2="${H - 20}" stroke="var(--line)"/>${bars}</svg></div>`;
  }

  // series: [{name,color,points:[n]}], labels: [str]
  function line(series, labels, o) {
    o = o || {};
    const H = o.height || 170, W = 560, pad = 28, n = labels.length;
    const max = Math.max(1, ...series.flatMap((s) => s.points));
    const X = (i) => pad + (i * (W - pad * 2)) / Math.max(1, n - 1), Y = (v) => H - 22 - (v / max) * (H - 40);
    const paths = series.map((s) => {
      const d = s.points.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join(' ');
      const dots = s.points.map((v, i) => v ? `<circle cx="${X(i).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="3" fill="${s.color}"><title>${esc(labels[i])} · ${esc(s.name)}: ${v}</title></circle>` : '').join('');
      return `<path class="ln" d="${d}" fill="none" stroke="${s.color}" stroke-width="2.5" stroke-linejoin="round"/>${dots}`;
    }).join('');
    const step = Math.ceil(n / 8);
    const xl = labels.map((l, i) => (i % step === 0 ? `<text x="${X(i).toFixed(1)}" y="${H - 6}" text-anchor="middle" class="vb-l">${esc(l)}</text>` : '')).join('');
    const legend = `<div class="legend">${series.map((s) => `<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join('')}</div>`;
    return `<div class="chart line">${legend}<svg viewBox="0 0 ${W} ${H}"><line x1="${pad}" x2="${W - pad}" y1="${H - 22}" y2="${H - 22}" stroke="var(--line)"/><text x="4" y="14" class="vb-l">max ${max}</text>${paths}${xl}</svg></div>`;
  }

  // items: [{label, start, end, color, sub, click}] ISO dates
  function gantt(items, o) {
    const D = root.MAHI_DATA;
    const from = o.from, to = o.to, span = D.daysBetween(from, to) + 1;
    const pos = (d) => (Math.max(0, Math.min(span, D.daysBetween(from, d))) / span) * 100;
    const months = [];
    let [y, m] = from.split('-').map(Number);
    while (true) { const iso = `${y}-${String(m).padStart(2, '0')}-01`; if (iso > to) break; if (iso >= from) months.push(iso); m++; if (m > 12) { m = 1; y++; } }
    const mNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const todayPos = o.today && o.today >= from && o.today <= to ? pos(o.today) : null;
    return `<div class="chart gantt"><div class="gt-head"><div class="gt-l"></div><div class="gt-track">${months.map((d) => `<span style="left:${pos(d)}%">${mNames[Number(d.slice(5, 7)) - 1]} ${d.slice(2, 4)}</span>`).join('')}</div></div>${items.map((it, i) => {
      const l = pos(it.start), w = Math.max(0.6, pos(D.addDays(it.end || it.start, 1)) - l);
      return `<div class="gt-row"${it.click ? ` data-click="${esc(it.click)}"` : ''}><div class="gt-l" title="${esc(it.label)}">${esc(it.label)}</div><div class="gt-track">${todayPos != null ? `<i class="gt-today" style="left:${todayPos}%"></i>` : ''}<div class="gt-bar" style="left:${l}%;width:${w}%;background:${it.color};animation-delay:${i * 40}ms" title="${esc(it.label)}: ${D.fmtDate(it.start)} → ${D.fmtDate(it.end || it.start)}${it.sub ? ' · ' + esc(it.sub) : ''}">${it.pct != null ? `<b style="width:${it.pct * 100}%"></b>` : ''}</div></div></div>`;
    }).join('')}</div>`;
  }

  function progress(pct, color, label) {
    return `<div class="pbar" title="${pctTxt(pct)}"><div class="pbar-fill" style="width:${(pct * 100).toFixed(1)}%;background:${color || 'var(--emerald)'}"></div>${label ? `<span>${esc(label)}</span>` : ''}</div>`;
  }

  root.MAHI_CHARTS = { donut, ring, hbars, vbars, line, gantt, progress, pctTxt, esc };
})(window);
