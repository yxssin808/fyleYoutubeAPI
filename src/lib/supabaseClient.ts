import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cachedSupabase: SupabaseClient | null = null;
let warnedMissingSupabase = false;

export const getSupabaseClient = (): SupabaseClient | null => {
  if (cachedSupabase) {
    return cachedSupabase;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    if (!warnedMissingSupabase) {
      console.warn('⚠️ SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set. YouTube uploads will fail.');
      warnedMissingSupabase = true;
    }
    return null;
  }

  cachedSupabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false },
  });

  return cachedSupabase;
};

