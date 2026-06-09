// Supabase browser client for the dndbnb account integration. Configured via
// VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY (see .env.local.example), pointing
// at the SAME project dndbnb uses so accounts (and later, characters) are
// shared. The anon key is safe in the client bundle; row-level security on the
// database enforces per-user access. The session persists in localStorage, so a
// signed-in player skips the sign-in gate on their next visit.

import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    'Missing Supabase env vars. Copy .env.local.example to .env.local and fill ' +
      'in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (the same values dndbnb uses).',
  );
}

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
