import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { currentUser } from '@/lib/auth';
import { Panel } from '@/components/panel';
import { EtatDemande, EtatOp } from '@/components/ui/badge';
import { addDays, fmtDate, fmtHeure, todayYmd } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

export default async function Programme() {
  const me = await currentUser(); const supabase = await createClient();
  const today = todayYmd(), tomorrow = addDays(today, 1), weekEnd = addDays(today, 7);
  const isDispatch = me?.role === 'dispatcheur' || me?.role === 'admin';
  const [{ data: opsSemaine }, { data: aTraiter }, { data: mesDemandes }, { data: notifs }] = await Promise.all([
    supabase.from('operations').select('*, camion:camions(numero), demande:demandes!inner(id, numero, etat, coordinateur_id, client:clients(nom)), equipiers:operation_equipiers(equipier:equipiers(prenom))').gte('date_prevue', today).lte('date_prevue', weekEnd).neq('etat', 'annulee').not('demande.etat', 'in', '("refusee","annulee")').order('date_prevue').order('heure_debut'),
    isDispatch ? supabase.from('demandes').select('id, numero, date_souhaitee, creneau, nb_hommes, type_camion, client:clients(nom), coordinateur:utilisateurs!coordinateur_id(prenom)').eq('etat', 'envoyee').order('date_souhaitee') : Promise.resolve({ data: [] as any[] }),
    me ? supabase.from('demandes').select('id, numero, etat, date_souhaitee, client:clients(nom), operations(etat, camion_id, date_prevue, heure_debut, camion:camions(numero))').eq('coordinateur_id', me.id).in('etat', ['envoyee', 'acceptee', 'planifiee', 'en_cours', 'refusee']).order('date_souhaitee') : Promise.resolve({ data: [] as any[] }),
    me ? supabase.from('notifications').select('*').eq('destinataire_id', me.id).is('lu_le', null).order('created_at', { ascending: false }).limit(5) : Promise.resolve({ data: [] as any[] }),
  ]);
  const ops = opsSemaine ?? [];
  const groups = [{ label: "Aujourd'hui", items: ops.filter((o: any) => o.date_prevue === today) }, { label: 'Demain', items: ops.filter((o: any) => o.date_prevue === tomorrow) }, { label: 'Cette semaine', items: ops.filter((o: any) => o.date_prevue > tomorrow) }];
  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-5"><div><h1 className="text-2xl font-semibold">Bonjour {me?.prenom}</h1><p className="text-sm text-mute">{fmtDate(today, { weekday: 'long', day: 'numeric', month: 'long' })}</p></div><Link href="/demandes/nouvelle"><Button><Plus className="h-4 w-4" />Nouvelle demande</Button></Link></div>
      {(notifs ?? []).length > 0 && <div className="mb-4 rounded-lg border border-cobalt/30 bg-cobalt-soft/50 p-3 text-sm space-y-1">{(notifs ?? []).map((n: any) => <Link key={n.id} href={n.demande_id ? `/demandes/${n.demande_id}` : '#'} className="block hover:underline"><strong>{n.titre}</strong>{n.message ? ` — ${n.message}` : ''}</Link>)}</div>}
      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          {groups.map(g => (
            <Panel key={g.label} title={g.label} aside={<span className="text-sm text-mute">{g.items.length} opération{g.items.length > 1 ? 's' : ''}</span>}>
              {g.items.length === 0 ? <p className="text-sm text-mute">Rien de planifié.</p> : (
                <div className="divide-y divide-line">
                  {g.items.map((o: any) => (
                    <Link key={o.id} href={`/demandes/${o.demande.id}`} className="flex items-center gap-4 py-2 text-sm hover:bg-fog -mx-2 px-2 rounded">
                      <div className="w-24 shrink-0 text-mute">{g.label === 'Cette semaine' ? fmtDate(o.date_prevue) : ''} {fmtHeure(o.heure_debut)}</div>
                      <div className="min-w-0 flex-1"><div className="font-medium truncate">{o.demande.client?.nom ?? '—'} <span className="text-mute font-normal">· {o.libelle}</span></div><div className="text-xs text-mute">{o.camion?.numero ?? 'sans camion'}{o.equipiers?.length ? ' · ' + o.equipiers.map((e: any) => e.equipier?.prenom).join(', ') : ''}</div></div>
                      <EtatOp etat={o.etat} />
                    </Link>))}
                </div>)}
            </Panel>))}
        </div>
        <div className="space-y-4">
          {isDispatch && <Panel title="À traiter" aside={<span className="text-sm text-mute">{(aTraiter ?? []).length}</span>}>
            {(aTraiter ?? []).length === 0 ? <p className="text-sm text-mute">Aucune demande en attente.</p> : <div className="divide-y divide-line">{(aTraiter ?? []).map((d: any) => <Link key={d.id} href={`/demandes/${d.id}`} className="block py-2 text-sm hover:underline"><div className="font-medium">{d.client?.nom ?? '—'}</div><div className="text-xs text-mute">{fmtDate(d.date_souhaitee)} · {d.type_camion ?? '?'} m³ · {d.nb_hommes} h. · {d.coordinateur?.prenom}</div></Link>)}</div>}
          </Panel>}
          {(mesDemandes ?? []).length > 0 && <Panel title="Mes demandes">
            <div className="divide-y divide-line">{(mesDemandes ?? []).map((d: any) => { const p = d.operations.find((o: any) => o.camion_id); return (
              <Link key={d.id} href={`/demandes/${d.id}`} className="flex items-center justify-between gap-2 py-2 text-sm hover:underline"><div className="min-w-0"><div className="font-medium truncate">{d.client?.nom ?? '—'}</div><div className="text-xs text-mute">{fmtDate(d.date_souhaitee)}{p ? ` · ${p.camion?.numero} ${fmtHeure(p.heure_debut)}` : ''}</div></div><EtatDemande etat={d.etat} /></Link>); })}</div>
          </Panel>}
        </div>
      </div>
    </div>
  );
}
