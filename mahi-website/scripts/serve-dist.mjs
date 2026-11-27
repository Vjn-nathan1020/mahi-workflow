// Serves a built folder locally WITH the headers from public/_headers (so the CSP is tested before deploying).
// Usage: node scripts/serve-dist.mjs <dir> <port>
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const dir = path.resolve(process.argv[2] || 'dist'), port = Number(process.argv[3] || 8792);
const rules = []; let cur = null;
for (const line of fs.readFileSync(path.join(dir, '_headers'), 'utf8').split(/\r?\n/)) {
  if (!line.trim() || line.trim().startsWith('#')) continue;
  if (!/^\s/.test(line)) { cur = { pat: line.trim(), h: {} }; rules.push(cur); } else { const i = line.indexOf(':'); cur.h[line.slice(0, i).trim()] = line.slice(i + 1).trim(); }
}
const match = (pat, p) => pat === p || (pat.endsWith('*') && p.startsWith(pat.slice(0, -1)));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.woff2': 'font/woff2' };
http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let f = path.join(dir, p); if (!f.startsWith(dir) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(dir, 'index.html');
  const h = {}; rules.forEach((r) => { if (match(r.pat, p)) Object.assign(h, r.h); });
  delete h['Strict-Transport-Security']; h['Content-Security-Policy'] = (h['Content-Security-Policy'] || '').replace('; upgrade-insecure-requests', ''); // plain http on localhost
  res.writeHead(200, Object.assign({ 'Content-Type': types[path.extname(f)] || 'application/octet-stream' }, h)); fs.createReadStream(f).pipe(res);
}).listen(port, '127.0.0.1', () => console.log('serving ' + dir + ' on http://127.0.0.1:' + port));
