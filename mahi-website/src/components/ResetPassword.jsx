import { useState } from 'react';
import { supabase } from '../lib/supabase.js';
import AuthLayout, { inputCls, btnCls } from './AuthLayout.jsx';

export default function ResetPassword({ onDone }) {
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const submit = async (e) => {
    e.preventDefault(); setMsg(null);
    if (pw.length < 10) return setMsg({ type: 'bad', text: 'Use at least 10 characters.' });
    if (pw !== pw2) return setMsg({ type: 'bad', text: 'The two passwords do not match.' });
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return setMsg({ type: 'bad', text: error.message });
    setMsg({ type: 'ok', text: 'Password updated. Opening MAHI…' });
    setTimeout(onDone, 900);
  };
  return (
    <AuthLayout title="Choose a new password" subtitle="At least 10 characters.">
      <form onSubmit={submit} className="flex flex-col gap-3">
        <input className={inputCls} type="password" autoComplete="new-password" placeholder="New password" value={pw} onChange={(e) => setPw(e.target.value)} required />
        <input className={inputCls} type="password" autoComplete="new-password" placeholder="Repeat new password" value={pw2} onChange={(e) => setPw2(e.target.value)} required />
        {msg && <div role="alert" className={`rounded-xl px-4 py-3 text-sm ${msg.type === 'ok' ? 'bg-[#E3F5E9] text-[#1B5E20]' : 'bg-[#FFE6E6] text-[#8E1B1B]'}`}>{msg.text}</div>}
        <button className={btnCls} disabled={busy}>{busy ? 'Saving…' : 'Save new password'}</button>
      </form>
    </AuthLayout>
  );
}
