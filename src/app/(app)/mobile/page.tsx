import { createClient } from '@/lib/supabase/server';
import { currentUser } from '@/lib/auth';
import { addDays, todayYmd } from '@/lib/utils';
import { MobileOps } from './ops';
export default async function Mobile({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { date = todayYmd() } = await searchParams;
  const me = await currentUser(); const supabase = await createClient();
  const { data: eq } = me ? await supabase.from('equipiers').select('id').eq('utilisateur_id', me.id).maybeSingle() : { data: null };
  let q = supabase.from('operations').select('*, camion:camions(numero, immatriculation), demande:demandes!inner(id, numero, etat, contact_nom, contact_telephone, objets, nb_colis, observations, client:clients(nom)), equipiers:operation_equipiers(chef, equipier:equipiers(id, prenom, nom, telephone))').eq('date_prevue', date).in('etat', ['planifiee', 'en_route', 'sur_site', 'terminee']).order('heure_debut');
  const { data: all } = await q;
  const ops = (all ?? []).filter((o: any) => !eq || o.equipiers.some((e: any) => e.equipier?.id === eq.id));
  return <MobileOps ops={ops} date={date} prev={addDays(date, -1)} next={addDays(date, 1)} isChauffeur={me?.role === 'chauffeur'} prenom={me?.prenom ?? ''} filtered={!!eq} />;
}
