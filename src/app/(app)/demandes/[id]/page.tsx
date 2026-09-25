import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { currentUser } from '@/lib/auth';
import { Panel } from '@/components/panel';
import { EtatDemande } from '@/components/ui/badge';
import { fmtDate, fmtHeure } from '@/lib/utils';
import { CRENEAU_LABEL } from '@/lib/types';
import { ArrowLeft, MapPin, Phone, Mail } from 'lucide-react';
import { DemandeActions } from './actions';
import { OperationCard } from './operation-card';
import { EditDemande } from './edit';

export default async function DemandePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const me = await currentUser(); const supabase = await createClient();
  const { data: d, error } = await supabase.from('demandes').select('*, client:clients(*), coordinateur:utilisateurs!coordinateur_id(prenom, nom), dispatcheur:utilisateurs!dispatcheur_id(prenom, nom)').eq('id', id).single();
  if (error || !d) return <div className="p-6"><Link href="/demandes" className="text-sm text-mute">← Demandes</Link><p className="mt-4 rounded-md bg-brick-soft text-brick p-4 text-sm">Demande introuvable{error ? ` : ${error.message}` : ''}.</p></div>;
  const [{ data: ops }, { data: camions }, { data: equipiers }] = await Promise.all([
    supabase.from('operations').select('*, camion:camions(*), equipiers:operation_equipiers(equipier_id, chef, equipier:equipiers(*))').eq('demande_id', id).order('date_prevue').order('ordre'),
    supabase.from('camions').select('*').eq('actif', true).order('numero'),
    supabase.from('equipiers').select('*').eq('actif', true).order('prenom'),
  ]);
  const isDispatch = me?.role === 'dispatcheur' || me?.role === 'admin';
  const isOwner = me?.id === d.coordinateur_id;
  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <Link href="/demandes" className="inline-flex items-center gap-1 text-sm text-mute hover:text-ink mb-3"><ArrowLeft className="h-4 w-4" />Demandes</Link>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
        <div>
          <div className="flex items-center gap-3 flex-wrap"><h1 className="text-xl md:text-2xl font-semibold">{d.client?.nom ?? 'Sans client'}</h1><EtatDemande etat={d.etat} />{d.specifique && <span className="text-xs rounded-full bg-cobalt-soft text-cobalt-ink px-2 py-0.5">spécifique</span>}</div>
          <div className="text-sm text-mute mt-1 flex flex-wrap gap-x-3"><span className="font-mono">{d.numero}</span>{d.code_affaire && <span>Affaire {d.code_affaire}</span>}<span>{d.coordinateur ? `${d.coordinateur.prenom} ${d.coordinateur.nom}` : ''}</span>{d.dispatcheur && <span>Dispatch : {d.dispatcheur.prenom}</span>}</div>
        </div>
        <DemandeActions id={d.id} numero={d.numero} etat={d.etat} isDispatch={isDispatch} isOwner={isOwner} />
      </div>
      <div className="mb-5 flex gap-3"><Link href={`/demandes/${id}/document`} className="rounded-lg border border-line bg-paper px-4 py-2 text-sm hover:bg-fog">Fiche de mission · PDF / impression</Link></div>
      {d.etat === 'refusee' && d.motif_refus && <div className="mb-4 rounded-md border border-brick/30 bg-brick-soft p-3 text-sm text-brick"><strong>Refusée :</strong> {d.motif_refus}</div>}
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <Panel title={`Opérations (${(ops ?? []).length})`}>
            <div className="space-y-3">
              {Array.from(new Set((ops ?? []).map((o: any) => o.date_prevue ?? 'sans date'))).map((dt: any) => (
                <div key={dt} className="space-y-2">
                  {(ops ?? []).length > 1 && <div className="text-xs font-medium text-mute pt-1 capitalize">{dt === 'sans date' ? 'Sans date' : fmtDate(dt, { weekday: 'long', day: 'numeric', month: 'long' })}</div>}
                  {(ops ?? []).filter((o: any) => (o.date_prevue ?? 'sans date') === dt).map((o: any) => <OperationCard key={o.id} op={o} camions={camions ?? []} equipiers={equipiers ?? []} canPlan={isDispatch && !['refusee', 'annulee', 'envoyee'].includes(d.etat)} demandeNbHommes={d.nb_hommes} />)}
                </div>))}
              {(ops ?? []).length === 0 && <p className="text-sm text-mute">Aucune opération.</p>}
              {d.etat === 'envoyee' && isDispatch && <p className="text-xs text-mute">Acceptez la demande pour pouvoir la planifier.</p>}
            </div>
          </Panel>
          {(isOwner || isDispatch) && !['terminee', 'annulee'].includes(d.etat) && <EditDemande demande={d} />}
        </div>
        <div className="space-y-4">
          <Panel title="Quand">
            <div className="text-sm space-y-1">
              <div className="text-lg font-medium">{fmtDate(d.date_souhaitee, { weekday: 'long', day: 'numeric', month: 'long' })}</div>
              <div className="text-mute">{d.creneau ? CRENEAU_LABEL[d.creneau as keyof typeof CRENEAU_LABEL] : ''}{d.rdv_heure ? ` à ${fmtHeure(d.rdv_heure)}` : ''}{d.date_fin && d.date_fin !== d.date_souhaitee ? ` → ${fmtDate(d.date_fin)}` : ''}</div>
              {d.date_retour && <div className="text-mute">Retour le {fmtDate(d.date_retour)}{d.creneau_retour ? ` (${CRENEAU_LABEL[d.creneau_retour as keyof typeof CRENEAU_LABEL]})` : ''}</div>}
              <div className="pt-2 text-mute">{d.scenario_code ? d.scenario_code.replace(/_/g, ' ') + ' · ' : ''}{d.nb_camions ? `${d.nb_camions} × ${d.type_camion ?? '?'} m³` : 'sans camion'}{d.besoin_hayon ? ', hayon' : ''}{d.besoin_clim ? ', clim' : ''} · {d.nb_hommes} hommes{d.nb_jours > 1 ? ` · ${d.nb_jours} jours` : ''}</div>
            </div>
          </Panel>
          <Panel title="Où">
            <div className="text-sm space-y-3">
              {d.adresse_enlevement && <div className="flex gap-2"><MapPin className="h-4 w-4 text-mute mt-0.5 shrink-0" /><div><div className="text-xs text-mute">Enlèvement</div><div className="whitespace-pre-line">{d.adresse_enlevement}</div></div></div>}
              {d.adresse_livraison && <div className="flex gap-2"><MapPin className="h-4 w-4 text-mute mt-0.5 shrink-0" /><div><div className="text-xs text-mute">Livraison</div><div className="whitespace-pre-line">{d.adresse_livraison}</div></div></div>}
              {(d.contact_nom || d.contact_telephone || d.contact_email) && <div className="pt-2 border-t border-line space-y-1">{d.contact_nom && <div>{d.contact_nom}</div>}{d.contact_telephone && <a href={`tel:${d.contact_telephone}`} className="flex items-center gap-1.5 hover:underline"><Phone className="h-3.5 w-3.5" />{d.contact_telephone}</a>}{d.contact_email && <a href={`mailto:${d.contact_email}`} className="flex items-center gap-1.5 hover:underline"><Mail className="h-3.5 w-3.5" />{d.contact_email}</a>}</div>}
            </div>
          </Panel>
          <Panel title="Quoi">
            <div className="text-sm whitespace-pre-line">{d.objets ?? '—'}</div>
            <div className="text-xs text-mute mt-2">{d.nb_colis ? `${d.nb_colis} colis` : ''}{d.volume_m3 ? ` · ${d.volume_m3} m³` : ''}</div>
            {d.observations && <div className="mt-3 pt-3 border-t border-line text-sm whitespace-pre-line">{d.observations}</div>}
          </Panel>
        </div>
      </div>
    </div>
  );
}
