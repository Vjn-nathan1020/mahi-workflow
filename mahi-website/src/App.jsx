import { useEffect, useState } from 'react';
import { supabase, localMode } from './lib/supabase.js';
import Login from './components/Login.jsx';
import ResetPassword from './components/ResetPassword.jsx';
import Splash from './components/Splash.jsx';
import MahiApp from './components/MahiApp.jsx';

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = still checking
  const [recovery, setRecovery] = useState(false);

  useEffect(() => {
    if (localMode) return undefined;
    supabase.auth.getSession().then(({ data }) => setSession(data.session || null));
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      if (event === 'SIGNED_OUT') { setSession(null); return; }
      // Only switch screens on real sign-in changes; token refreshes must not remount MAHI.
      setSession((prev) => (prev && s && prev.user.id === s.user.id ? prev : s || null));
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Default: no login, no database – MAHI opens straight away and saves in this browser.
  if (localMode) return <MahiApp session={null} />;
  if (recovery) return <ResetPassword onDone={() => setRecovery(false)} />;
  if (session === undefined) return <Splash text="Checking your secure session…" />;
  if (!session) return <Login />;
  return <MahiApp key={session.user.id} session={session} />;
}
