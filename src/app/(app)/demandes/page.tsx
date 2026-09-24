import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { currentUser } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { EtatDemande } from '@/components/ui/badge';
import { fmtDate } from '@/lib/utils';
import { CRENEAU_LABEL, ETAT_LABEL, type DemandeEtat } from '@/lib/types';
import { Plus } from 'lucide-react';

const FILTRES: { key: string; label: string; etats: DemandeEtat[] }[] = [
  { key: 'actives', label: 'Actives', etats: ['envoyee', 'acceptee', 'planifiee', 'en_cours'] },
  { key: 'a_traiter', label: 'À traiter', etats: ['envoyee'] },
  { key: 'planifiees', label: 'Planifiées', etats: ['planifiee', 'en_cours'] },
  { key: 'terminees', label: 'Terminées', etats: ['terminee'] },
  { key: 'refusees', label: 'Refusées / annulées', etats: ['refusee', 'annulee'] },
];

export default async function Demandes({ searchParams }: { searchParams: Promise<{ f?: string; mine?: string }> }) {
  const { f = 'actives', mine } = await searchParams;
  const me = await currentUser(); const supabase = await createClient();
  const filtre = FILTRES.find(x => x.key === f) ?? FILTRES[0];
  let q = supabase.from('demandes').select('*, client:clients(nom), coordinateur:utilisateurs!coordinateur_id(prenom, nom), operations(id, etat, camion_id, date_prevue, heure_debut)').in('etat', filtre.etats).order('date_souhaitee', { ascending: true });
  if (mine === '1' && me) q = q.eq('coordinateur_id', me.id);
  const { data } = await q;
  const rows = data ?? [];
  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h1 className="text-2xl font-semibold">Demandes</h1>
        <Link href="/demandes/nouvelle"><Button><Plus className="h-4 w-4" />Nouvelle demande</Button></Link>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 mb-4 text-sm">
        {FILTRES.map(x => <Link key={x.key} href={`/demandes?f=${x.key}${mine === '1' ? '&mine=1' : ''}`} className={`rounded-full px-3 py-1 ${x.key === filtre.key ? 'bg-ink text-white' : 'bg-paper border border-line hover:bg-fog'}`}>{x.label}</Link>)}
        <span className="mx-2 text-line">|</span>
        <Link href={`/demandes?f=${filtre.key}${mine === '1' ? '' : '&mine=1'}`} className={`rounded-full px-3 py-1 ${mine === '1' ? 'bg-cobalt-soft text-cobalt-ink' : 'bg-paper border border-line hover:bg-fog'}`}>Mes demandes</Link>
      </div>
      <div className="rounded-lg border border-line bg-paper overflow-hidden">
        {rows.length === 0 ? <p className="p-10 text-center text-sm text-mute">Aucune demande {ETAT_LABEL[filtre.etats[0]].toLowerCase()} pour le moment.</p> : (
          <table className="w-full text-sm">
            <thead className="bg-fog/60 text-xs text-mute"><tr><th className="text-left px-4 py-2 font-medium">N°</th><th className="text-left px-4 py-2 font-medium">Client</th><th className="text-left px-4 py-2 font-medium">Date</th><th className="text-left px-4 py-2 font-medium">Moyens</th><th className="text-left px-4 py-2 font-medium">Opérations</th><th className="text-left px-4 py-2 font-medium">Coordinateur</th><th className="text-left px-4 py-2 font-medium">État</th></tr></thead>
            <tbody className="divide-y divide-line">
              {rows.map((d: any) => { const planif = d.operations.filter((o: any) => o.camion_id).length; return (
                <tr key={d.id} className="hover:bg-fog/50">
                  <td className="px-4 py-2.5 font-mono text-xs"><Link href={`/demandes/${d.id}`} className="hover:underline">{d.numero}</Link></td>
                  <td className="px-4 py-2.5"><Link href={`/demandes/${d.id}`} className="font-medium hover:underline">{d.client?.nom ?? '—'}</Link>{d.specifique && <span className="ml-2 text-xs text-cobalt-ink">spécifique</span>}</td>
                  <td className="px-4 py-2.5">{fmtDate(d.date_souhaitee)} <span className="text-mute">{d.creneau ? CRENEAU_LABEL[d.creneau as keyof typeof CRENEAU_LABEL] : ''}{d.rdv_heure ? ' ' + d.rdv_heure.slice(0, 5) : ''}</span></td>
                  <td className="px-4 py-2.5 text-mute">{d.nb_camions ? `${d.nb_camions > 1 ? d.nb_camions + ' × ' : ''}${d.type_camion ?? '?'} m³` : 'sans camion'} · {d.nb_hommes} h.{d.nb_jours > 1 ? ` · ${d.nb_jours} j` : ''}{d.date_retour ? ' · A/R' : ''}</td>
                  <td className="px-4 py-2.5 text-mute">{planif}/{d.operations.length} planifiées</td>
                  <td className="px-4 py-2.5 text-mute">{d.coordinateur ? `${d.coordinateur.prenom} ${d.coordinateur.nom?.[0] ?? ''}.` : '—'}</td>
                  <td className="px-4 py-2.5"><EtatDemande etat={d.etat} /></td>
                </tr>); })}
            </tbody>
          </table>)}
      </div>
    </div>
  );
}
