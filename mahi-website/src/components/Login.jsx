import { useState } from 'react';
import { supabase, allowSignup } from '../lib/supabase.js';
import AuthLayout, { inputCls, btnCls, linkCls } from './AuthLayout.jsx';

export default function Login({ notice }) {
  const [mode, setMode] = useState('signin'); // signin | forgot | signup
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(notice || null); // {type, text}

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      } else if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin + '/' });
        if (error) throw error;
        setMsg({ type: 'ok', text: 'If this email has a MAHI account, a reset link is on its way. Check your inbox and spam folder, and open the link in this same browser. The link works once and expires after about an hour.' });
      } else {
        if (password.length < 10) throw new Error('Use at least 10 characters for your password.');
        const { error } = await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: window.location.origin + '/' } });
        if (error) throw error;
        setMsg({ type: 'ok', text: 'Account created. Confirm the link sent to your email, then sign in.' });
        setMode('signin');
      }
    } catch (err) {
      const t = err && err.message ? err.message : String(err);
      const friendly = /Invalid login/i.test(t) ? 'Email or password is incorrect. If you are not sure of the password, use “Forgot password?”.'
        : /not confirmed/i.test(t) ? 'This account is not confirmed yet. Confirm it from the email link, or ask the owner to confirm it in Supabase.'
        : /rate limit|too many|security purposes/i.test(t) ? 'Too many attempts or emails in a short time. Please wait a few minutes and try again.'
        : /fetch|network/i.test(t) ? 'Cannot reach the MAHI server. Check your internet connection and try again.' : t;
      setMsg({ type: 'bad', text: friendly });
    } finally { setBusy(false); }
  };

  const titles = { signin: ['Welcome back, Nathan', 'Sign in to your personal workflow control center.'], forgot: ['Reset your password', 'We will email you a secure reset link.'], signup: ['Create your MAHI account', 'Owner registration.'] };
  return (
    <AuthLayout title={titles[mode][0]} subtitle={titles[mode][1]}>
      <form onSubmit={submit} className="flex flex-col gap-3" autoComplete="on">
        <label className="flex flex-col gap-1 text-sm font-semibold text-[#3b4a59]">Email
          <input className={inputCls} type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        </label>
        {mode !== 'forgot' && (
          <label className="flex flex-col gap-1 text-sm font-semibold text-[#3b4a59]">Password
            <input className={inputCls} type="password" required minLength={mode === 'signup' ? 10 : 6} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••••" />
          </label>
        )}
        {msg && <div role="alert" className={`rounded-xl px-4 py-3 text-sm ${msg.type === 'ok' ? 'bg-[#E3F5E9] text-[#1B5E20]' : 'bg-[#FFE6E6] text-[#8E1B1B]'}`}>{msg.text}</div>}
        <button className={btnCls} disabled={busy} type="submit">{busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : mode === 'forgot' ? 'Send reset link' : 'Create account'}</button>
      </form>
      <div className="flex justify-between items-center mt-4 gap-3 flex-wrap">
        {mode === 'signin'
          ? <button type="button" className={linkCls} onClick={() => { setMode('forgot'); setMsg(null); }}>Forgot password?</button>
          : <button type="button" className={linkCls} onClick={() => { setMode('signin'); setMsg(null); }}>Back to sign in</button>}
        {allowSignup && mode === 'signin' && <button type="button" className={linkCls} onClick={() => { setMode('signup'); setMsg(null); }}>Create account</button>}
      </div>
      <p className="mt-5 mb-0 text-xs text-[#8a97a3]">🔒 Secure sign-in over HTTPS. Your workflow data is private to your account.</p>
    </AuthLayout>
  );
}
