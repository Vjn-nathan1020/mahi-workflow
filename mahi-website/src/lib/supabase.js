import { createClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Storage modes
//   LOCAL (default): no login, no database. Everything is saved automatically in the
//          visitor's own browser (localStorage). Works with zero configuration.
//   CLOUD (optional): set VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY (and leave
//          VITE_STORAGE_MODE unset or "cloud") to add secure login and sync across devices.
// ---------------------------------------------------------------------------
// Only the PUBLIC project URL and PUBLIC "anon" key ever belong here; Row Level Security
// (supabase/schema.sql) protects the data. NEVER put the service_role key in a VITE_ variable.
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const requested = String(import.meta.env.VITE_STORAGE_MODE || '').toLowerCase();

export const isConfigured = Boolean(url && anonKey && !String(url).includes('YOUR-PROJECT'));
export const storageMode = isConfigured && requested !== 'local' ? 'cloud' : 'local';
export const localMode = storageMode === 'local';
export const allowSignup = String(import.meta.env.VITE_ALLOW_SIGNUP || 'false') === 'true';

export const supabase = storageMode === 'cloud'
  ? createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
      realtime: { params: { eventsPerSecond: 5 } },
    })
  : null;
