import { redirect } from 'next/navigation';
import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Referentiels } from './tabs';
export default async function Page() {
  const me = await requireRole(['admin', 'dispatcheur']); if (!me) redirect('/programme');
  const s = await createClient();
  const [{ data: camions }, { data: equipiers }, { data: ts }, { data: indispos }, { data: clients }, { data: scenarios },{data:utilisateurs}] = await Promise.all([
    s.from('camions').select('*').order('numero'), s.from('equipiers').select('*').order('prenom'), s.from('temps_standards').select('*').order('ordre'),
    s.from('indisponibilites').select('*, camion:camions(numero), equipier:equipiers(prenom, nom)').order('date_debut', { ascending: false }).limit(100), s.from('clients').select('*').order('nom'), s.from('scenarios').select('*').order('ordre'),s.from('utilisateurs').select('id,prenom,nom').eq('actif',true).order('prenom'),
  ]);
  return <Referentiels utilisateurs={utilisateurs ?? []} camions={camions ?? []} equipiers={equipiers ?? []} ts={ts ?? []} indispos={indispos ?? []} clients={clients ?? []} scenarios={scenarios ?? []} />;
}
