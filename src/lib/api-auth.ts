import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createClient } from './supabase/server';
import type { NextRequest } from 'next/server';
export async function apiContext(req: NextRequest) {
  const header = req.headers.get('authorization');
  if (header && !/^Bearer \S+$/i.test(header)) return null;
  const token = header?.slice(7);
  const db = token ? createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false },
  }) : await createClient();
  const { data: { user }, error } = token ? await db.auth.getUser(token) : await db.auth.getUser();
  if (error || !user) return null;
  const { data: profile } = await db.from('utilisateurs').select('id,role,actif').eq('id',user.id).single();
  if (!profile?.actif || !['coordinateur','dispatcheur','direction','admin','gm','emballage'].includes(profile.role)) return null;
  return { db, user };
}
