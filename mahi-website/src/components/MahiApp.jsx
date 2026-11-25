import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase.js';
import { createSyncAdapter, createReportsApi } from '../lib/supabaseAdapter.js';

const IDLE_MIN = Number(import.meta.env.VITE_IDLE_SIGNOUT_MINUTES || 0);
const BACKUP_DAYS = 7;

// Mounts the MAHI engine (dashboard, pages, character).
// session = null  -> LOCAL mode: no login, saved automatically in this browser.
// session = {...} -> CLOUD mode: signed in, synced to Supabase.
export default function MahiApp({ session }) {
  const booted = useRef(false);

  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    const uid = session ? session.user.id : 'local';
    window.MAHI_STORAGE_KEY = 'mahi.state.' + uid; // browser copy (the only copy in LOCAL mode)
    window.MAHI_CLOUD = session ? createReportsApi(supabase, uid) : null;

    const signOut = async () => {
      try { localStorage.removeItem(window.MAHI_STORAGE_KEY); } catch (e) { /* ignore */ }
      await supabase.auth.signOut();
      window.location.replace('/');
    };

    window.MAHI_APP.boot({
      syncAdapter: session ? createSyncAdapter(supabase, uid) : null,
      onLogout: session ? signOut : null,
      userEmail: session ? session.user.email : '',
    });

    if (!session) {
      // LOCAL mode: the browser holds the only copy, so MAHI reminds about backups weekly.
      setTimeout(() => {
        try {
          const S = window.MAHI_STORE, st = S.state;
          const hasWork = st.assets.some((a) => a.status !== 'Not Started') || st.notes.length || st.customTasks.length;
          const last = Number(localStorage.getItem('mahi.lastBackup') || 0);
          const days = (Date.now() - last) / 86400000;
          const today = new Date().toISOString().slice(0, 10);
          if (hasWork && days > BACKUP_DAYS && localStorage.getItem('mahi.backupNag') !== today) {
            localStorage.setItem('mahi.backupNag', today);
            S.notify('reminder', 'Time for a backup', last ? `Last backup ${Math.floor(days)} days ago.` : 'No backup downloaded yet.');
            window.MAHI_CHAR.react({ kind: 'reminder', priority: 2, msg: `${st.settings.callName}, let's save a backup of your work.`, detail: 'Your work is stored in this browser only. A backup keeps it safe.', action: { label: 'Open backup page', route: 'excel' } });
          }
        } catch (e) { /* storage blocked – nothing to remind */ }
      }, 15000);
    }

    // Optional automatic sign-out after inactivity (cloud mode, VITE_IDLE_SIGNOUT_MINUTES, 0 = off).
    if (session && IDLE_MIN > 0) {
      let last = Date.now();
      const bump = () => { last = Date.now(); };
      ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'].forEach((ev) => document.addEventListener(ev, bump, { passive: true, capture: true }));
      setInterval(async () => {
        if (Date.now() - last > IDLE_MIN * 60000) {
          try { await window.MAHI_SYNC.pushNow(); } catch (e) { /* ignore */ }
          signOut();
        }
      }, 30000);
    }
  }, [session]);

  return <div id="app" />;
}
