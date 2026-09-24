'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea, Input } from '@/components/ui/input';
import { EtatOp } from '@/components/ui/badge';
import { fmtDate, fmtHeure, minToH } from '@/lib/utils';
import { ChevronLeft, ChevronRight, MapPin, Phone, LogOut, Navigation } from 'lucide-react';

export function MobileOps({ ops, date, prev, next, isChauffeur, prenom, filtered }: { ops: any[]; date: string; prev: string; next: string; isChauffeur: boolean; prenom: string; filtered: boolean }) {
  const r = useRouter();
  return (
    <div className="max-w-md mx-auto p-4 pb-24" style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}>
      <div className="flex items-center justify-between mb-3">
        <div><div className="text-lg font-semibold">Mes ordres</div><div className="text-xs text-mute">{prenom}{!filtered && ' · toutes les opérations (compte non lié à un équipier)'}</div></div>
        {isChauffeur ? <button onClick={async () => { await createClient().auth.signOut(); r.push('/login'); }} className="text-mute"><LogOut className="h-5 w-5" /></button> : <Link href="/planning" className="text-xs text-cobalt">Planning</Link>}
      </div>
      <div className="flex items-center justify-between mb-4 rounded-md border border-line bg-paper px-2 py-1.5">
        <Link href={`/mobile?date=${prev}`} className="p-2"><ChevronLeft className="h-5 w-5" /></Link>
        <div className="font-medium capitalize">{fmtDate(date, { weekday: 'long', day: 'numeric', month: 'long' })}</div>
        <Link href={`/mobile?date=${next}`} className="p-2"><ChevronRight className="h-5 w-5" /></Link>
      </div>
      {ops.length === 0 && <p className="rounded-lg border border-line bg-paper p-6 text-center text-sm text-mute">Aucun ordre ce jour.</p>}
      <div className="space-y-3">{ops.map(o => <Ordre key={o.id} op={o} />)}</div>
    </div>
  );
}

function Ordre({ op }: { op: any }) {
  const r = useRouter(); const [busy, setBusy] = useState(false); const [cr, setCr] = useState(op.compte_rendu ?? ''); const [sig, setSig] = useState(op.signature_nom ?? ''); const [open, setOpen] = useState(op.etat !== 'terminee');
  async function patch(body: any) { setBusy(true); await fetch(`/api/operations/${op.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); setBusy(false); r.refresh(); }
  const now = () => new Date().toISOString();
  const adr = op.adresse ?? '';
  return (
    <div className="rounded-lg border border-line bg-paper overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full text-left p-4">
        <div className="flex items-center justify-between gap-2"><div className="text-2xl font-semibold">{fmtHeure(op.heure_debut)}</div><EtatOp etat={op.etat} /></div>
        <div className="font-medium mt-1">{op.demande.client?.nom ?? '—'}</div>
        <div className="text-sm text-mute">{op.libelle} · {minToH(op.duree_min ?? 120)} · {op.camion?.numero ?? '—'}</div>
      </button>
      {open && <div className="border-t border-line p-4 space-y-3 text-sm">
        {adr && <div className="flex gap-2"><MapPin className="h-4 w-4 shrink-0 mt-0.5 text-mute" /><div className="flex-1 whitespace-pre-line">{adr}</div><a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(adr)}`} target="_blank" rel="noreferrer" className="h-9 w-9 shrink-0 grid place-items-center rounded-md bg-cobalt-soft text-cobalt-ink"><Navigation className="h-4 w-4" /></a></div>}
        {(op.demande.contact_nom || op.demande.contact_telephone) && <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-mute" /><span>{op.demande.contact_nom}</span>{op.demande.contact_telephone && <a href={`tel:${op.demande.contact_telephone}`} className="text-cobalt underline">{op.demande.contact_telephone}</a>}</div>}
        {op.demande.objets && <div><div className="text-xs text-mute">Objets{op.demande.nb_colis ? ` · ${op.demande.nb_colis} colis` : ''}</div><div className="whitespace-pre-line">{op.demande.objets}</div></div>}
        {(op.consignes || op.demande.observations) && <div className="rounded-md bg-ochre-soft p-2.5 whitespace-pre-line"><div className="text-xs text-ochre mb-0.5">Consignes</div>{op.consignes}{op.consignes && op.demande.observations ? '\n' : ''}{op.demande.observations}</div>}
        {op.equipiers?.length > 0 && <div className="text-xs text-mute">Équipe : {op.equipiers.map((e: any) => `${e.equipier?.prenom}${e.chef ? ' (chef)' : ''}`).join(', ')}</div>}
        <div className="grid grid-cols-2 gap-2 pt-1">
          {op.etat === 'planifiee' && <Button className="col-span-2 h-12" onClick={() => patch({ etat: 'en_route' })} disabled={busy}>Je pars</Button>}
          {op.etat === 'en_route' && <Button className="col-span-2 h-12" onClick={() => patch({ etat: 'sur_site', heure_arrivee: now() })} disabled={busy}>Arrivé sur site</Button>}
          {op.etat === 'sur_site' && <>
            <Input placeholder="Nom du signataire" value={sig} onChange={e => setSig(e.target.value)} className="col-span-2" />
            <Textarea placeholder="Compte rendu, réserves, incident…" value={cr} onChange={e => setCr(e.target.value)} className="col-span-2" />
            <Button variant="success" className="col-span-2 h-12" onClick={() => patch({ etat: 'terminee', heure_depart: now(), compte_rendu: cr || null, signature_nom: sig || null })} disabled={busy}>Terminé, je repars</Button>
          </>}
          {op.etat === 'terminee' && <div className="col-span-2 text-xs text-moss">Arrivée {op.heure_arrivee ? new Date(op.heure_arrivee).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—'} · Départ {op.heure_depart ? new Date(op.heure_depart).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—'}{op.signature_nom ? ` · signé ${op.signature_nom}` : ''}</div>}
        </div>
      </div>}
    </div>
  );
}
