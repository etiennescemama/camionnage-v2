import { createClient } from '@supabase/supabase-js';
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquante sur Vercel');
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}
