import { createClient } from '@/lib/supabase/server';
import { currentUser } from '@/lib/auth';
import { addDays, mondayOf, todayYmd } from '@/lib/utils';
import { PlanningWorkspace } from './workspace';

export default async function Planning({ searchParams }: { searchParams: Promise<{ date?: string; vue?: string }> }) {
  const sp = await searchParams;
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) && !Number.isNaN(Date.parse(sp.date)) ? sp.date : todayYmd();
  const vue = (['jour','semaine','mois'].includes(sp.vue??'') ? sp.vue : 'jour') as 'jour' | 'semaine' | 'mois';
  const me = await currentUser();
  const supabase = await createClient();

  let from = date, to = date;
  if (vue === 'semaine') { from = mondayOf(date); to = addDays(from, 6); }
  if (vue === 'mois') { const d = new Date(date + 'T12:00:00'); from = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`; const last = new Date(d.getFullYear(), d.getMonth() + 1, 0); to = `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`; }

  const [{ data: camions }, { data: ops }, { data: aPlanifier }, { data: indispos }, { data: capacite }, { data: equipiers }] = await Promise.all([
    supabase.from('camions').select('*').eq('actif', true).order('numero'),
    supabase.from('operations').select('*, demande:demandes!inner(*, client:clients(nom)), equipiers:operation_equipiers(equipier_id, equipier:equipiers(prenom))').gte('date_prevue', from).lte('date_prevue', to).neq('etat', 'annulee').not('demande.etat', 'in', '("refusee","annulee")'),
    supabase.from('operations').select('*, demande:demandes!inner(*, client:clients(nom)),equipiers:operation_equipiers(equipier_id)').eq('etat', 'a_planifier').in('demande.etat', ['acceptee', 'planifiee', 'en_cours']).order('date_prevue'),
    supabase.from('indisponibilites').select('*').lte('date_debut', to).gte('date_fin', from),
    supabase.rpc('creneaux_disponibles', { p_from: from, p_to: to, p_volume_min: 0, p_hayon: false, p_clim: false, p_duree_min: 120 }),
    supabase.from('equipiers').select('*').eq('actif', true),
  ]);

  return (
    <PlanningWorkspace
      date={date} vue={vue} from={from} to={to}
      camions={camions ?? []} ops={ops ?? []} aPlanifier={aPlanifier ?? []} indispos={indispos ?? []} capacite={capacite ?? []}
      equipiers={equipiers ?? []}
      nbEquipiers={(equipiers ?? []).length}
      canEdit={me?.role === 'dispatcheur' || me?.role === 'admin'}
    />
  );
}
