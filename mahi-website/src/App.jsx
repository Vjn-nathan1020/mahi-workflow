import { useEffect, useState } from 'react';
import { supabase, localMode } from './lib/supabase.js';
import Login from './components/Login.jsx';
import ResetPassword from './components/ResetPassword.jsx';
import Splash from './components/Splash.jsx';
import MahiApp from './components/MahiApp.jsx';

// Reads what Supabase put in the address after an email link, then removes it from the address bar.
//  ?token_hash=…&type=recovery   works in ANY browser (recommended email template)
//  ?code=…                       PKCE: only in the browser that asked for the email (supabase-js exchanges it)
//  ?error=…&error_description=…  or the same in the #fragment (expired / already used link)
function readAuthLink() {
  const q = new URLSearchParams(window.location.search);
  const h = new URLSearchParams(window.location.hash.startsWith('#') && window.location.hash.includes('=') ? window.location.hash.slice(1) : '');
  const get = (k) => q.get(k) || h.get(k);
  return { tokenHash: get('token_hash'), type: get('type'), code: q.get('code'), error: get('error_description') || get('error') };
}
function cleanAddress() { window.history.replaceState(null, '', window.location.pathname + (window.location.hash.includes('=') ? '' : window.location.hash)); }

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = still checking
  const [recovery, setRecovery] = useState(false);
  const [notice, setNotice] = useState(null);         // message shown on the sign-in page

  useEffect(() => {
    if (localMode) return undefined;
    const link = readAuthLink();
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      if (event === 'SIGNED_OUT') { setSession(null); return; }
      // Only switch screens on real sign-in changes; token refreshes must not remount MAHI.
      setSession((prev) => (prev && s && prev.user.id === s.user.id ? prev : s || null));
    });
    (async () => {
      if (link.error) {
        setNotice({ type: 'bad', text: /expired|invalid/i.test(link.error) ? 'That email link has expired or was already used. Request a new one below.' : link.error.replace(/\+/g, ' ') });
        cleanAddress();
      } else if (link.tokenHash && link.type) {
        const { error } = await supabase.auth.verifyOtp({ token_hash: link.tokenHash, type: link.type });
        cleanAddress();
        if (error) setNotice({ type: 'bad', text: 'That link could not be used (' + error.message + '). Request a new one below.' });
        else if (link.type === 'recovery') setRecovery(true);
      } else if (link.code) {
        const { data } = await supabase.auth.getSession();
        if (!data.session) setNotice({ type: 'bad', text: 'This reset link must be opened in the same browser where it was requested. Request a new link here, then open it in this browser.' });
        cleanAddress();
      }
      const { data } = await supabase.auth.getSession();
      setSession(data.session || null);
    })();
    return () => sub.subscription.unsubscribe();
  }, []);

  // Default: no login, no database – MAHI opens straight away and saves in this browser.
  if (localMode) return <MahiApp session={null} />;
  if (recovery && session) return <ResetPassword onDone={() => setRecovery(false)} />;
  if (session === undefined) return <Splash text="Checking your secure session…" />;
  if (!session) return <Login notice={notice} />;
  return <MahiApp key={session.user.id} session={session} />;
}
