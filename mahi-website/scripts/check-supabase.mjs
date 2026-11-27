// MAHI – read-only check of the real Supabase project, using only the PUBLIC values in .env.local.
// It never signs in, never writes, and refuses to run with a secret / service-role key.
// Checks: URL + key format, project reachable, public sign-up disabled, anonymous sign-in disabled,
// anonymous visitors cannot read any MAHI table, and the sync functions refuse callers who are not signed in.
// Usage: node scripts/check-supabase.mjs        (reads .env.local in the project folder)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const envFile = path.join(root, '.env.local');
if (!fs.existsSync(envFile)) { console.error('No .env.local found. It must contain VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'); process.exit(2); }
const env = Object.fromEntries(fs.readFileSync(envFile, 'utf8').split(/\r?\n/).filter((l) => /^\s*[A-Z_]+=/.test(l)).map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; }));
const url = (env.VITE_SUPABASE_URL || '').replace(/\/+$/, ''), key = env.VITE_SUPABASE_ANON_KEY || '';

let ok = 0, bad = 0;
const check = (name, pass, detail) => { pass ? ok++ : bad++; console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? '  → ' + detail : ''}`); };

// ---- the key must be public ----
const jwtRole = (() => { try { return JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role; } catch (e) { return null; } })();
if (/^sb_secret_/.test(key) || jwtRole === 'service_role') { console.error('STOP: this is a SECRET / service-role key. Remove it from .env.local and rotate it in Supabase. Only the publishable or anon key belongs here.'); process.exit(3); }
check('Project URL looks like https://<ref>.supabase.co', /^https:\/\/[a-z0-9]{15,30}\.supabase\.co$/.test(url), url.replace(/^(https:\/\/[a-z0-9]{4})[a-z0-9]+/, '$1…'));
check('Key is a public key (publishable or anon)', /^sb_publishable_/.test(key) || jwtRole === 'anon', /^sb_publishable_/.test(key) ? 'publishable' : jwtRole ? 'legacy ' + jwtRole : 'unrecognised');
if (bad) process.exit(1);

const H = { apikey: key, 'Content-Type': 'application/json' };
if (!/^sb_publishable_/.test(key)) H.Authorization = 'Bearer ' + key;
const get = async (p, opt = {}) => { const r = await fetch(url + p, Object.assign({ headers: H }, opt)); let body = null; try { body = await r.json(); } catch (e) { /* not json */ } return { status: r.status, body }; };

// ---- auth settings ----
const s = await get('/auth/v1/settings');
check('Project reachable (auth settings)', s.status === 200, 'HTTP ' + s.status);
if (s.status === 200) {
  check('Public sign-up is disabled', s.body.disable_signup === true, 'disable_signup=' + s.body.disable_signup);
  check('Anonymous sign-in is disabled', s.body.anonymous_users !== true && !(s.body.external && s.body.external.anonymous_users), 'anonymous_users=' + s.body.anonymous_users);
  check('Email sign-in is enabled', !!(s.body.external && s.body.external.email), 'email=' + (s.body.external && s.body.external.email));
}
// ---- a sign-up attempt with an address that is not on the allow-list must be refused ----
const su = await get('/auth/v1/signup', { method: 'POST', body: JSON.stringify({ email: 'mahi-registration-check@example.invalid', password: 'Not-a-real-account-' + Date.now() }) });
check('A sign-up attempt is refused', su.status >= 400, `HTTP ${su.status} ${(su.body && (su.body.msg || su.body.message || su.body.error_code)) || ''}`);

// ---- anonymous visitors see nothing ----
const tables = ['mahi_profiles', 'mahi_brands', 'mahi_campaigns', 'mahi_sets', 'mahi_deliverables', 'mahi_tasks', 'mahi_work_reports', 'mahi_work_sessions', 'mahi_focus_sessions', 'mahi_achievements',
  'mahi_notifications', 'mahi_notes', 'mahi_status_history', 'mahi_audit_log', 'mahi_sync_ops', 'mahi_legacy_records', 'mahi_allowed_emails', 'mahi_docs', 'mahi_reports'];
for (const t of tables) {
  const r = await get(`/rest/v1/${t}?select=*&limit=1`);
  const blocked = r.status === 401 || r.status === 403 || r.status === 404 || (r.status === 200 && Array.isArray(r.body) && r.body.length === 0);
  check(`Anonymous read blocked: ${t}`, blocked, `HTTP ${r.status}${r.status === 200 ? ' rows=' + (r.body || []).length : ''}`);
}
const w = await get('/rest/v1/mahi_tasks', { method: 'POST', body: JSON.stringify({ id: 'X1', title: 'x', task_date: '2026-11-27' }) });
check('Anonymous direct write refused', w.status >= 400, 'HTTP ' + w.status);
// ---- sync functions refuse callers who are not signed in ----
for (const [fn, body] of [['mahi_pull', { p_cursor: null, p_limit: 1 }], ['mahi_push', { p_op_id: 'op-check-anon-0001', p_device: 'check', p_ops: [{ table: 'tasks', id: 'X1', row: { title: 'x', task_date: '2026-11-27' } }] }]]) {
  const r = await get('/rest/v1/rpc/' + fn, { method: 'POST', body: JSON.stringify(body) });
  check(`${fn} refuses a visitor who is not signed in`, r.status >= 400, `HTTP ${r.status} ${(r.body && (r.body.message || r.body.code)) || ''}`);
}
console.log(`\n${ok}/${ok + bad} checks passed (read-only, public key only)`);
process.exit(bad ? 1 : 0);
