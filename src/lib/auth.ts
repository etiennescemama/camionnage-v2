import { createClient } from '@/lib/supabase/server';
import type { Role, Utilisateur } from '@/lib/types';
export async function currentUser(): Promise<Utilisateur | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from('utilisateurs').select('*').eq('id', user.id).single();
  return (data as Utilisateur) ?? null;
}
export async function requireRole(roles: Role[]): Promise<Utilisateur | null> {
  const u = await currentUser();
  if (!u || !roles.includes(u.role)) return null;
  return u;
}
