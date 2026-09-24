import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Users } from './users';
export default async function Page() {
  const me = await requireRole(['admin']); if (!me) redirect('/programme');
  const s = await createClient();
  const [{ data: users }, { data: equipiers }] = await Promise.all([s.from('utilisateurs').select('*').order('role').order('nom'), s.from('equipiers').select('id, prenom, nom, utilisateur_id').eq('actif', true).order('prenom')]);
  return <Users users={users ?? []} equipiers={equipiers ?? []} meId={me.id} />;
}
