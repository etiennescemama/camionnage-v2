'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input, Select, Textarea } from '@/components/ui/input';
import { EtatOp } from '@/components/ui/badge';
import { fmtDate, fmtHeure, minToH } from '@/lib/utils';
import type { Camion, Equipier } from '@/lib/types';
import { Truck, Users, Clock, ChevronDown } from 'lucide-react';

export function OperationCard({ op, camions, equipiers, canPlan, demandeNbHommes }: { op: any; camions: Camion[]; equipiers: Equipier[]; canPlan: boolean; demandeNbHommes: number }) {
  const r = useRouter();
  const [open, setOpen] = useState(canPlan && op.etat === 'a_planifier');
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState({ date_prevue: op.date_prevue ?? '', heure_debut: op.heure_debut?.slice(0, 5) ?? '08:00', duree_min: op.duree_min ?? 120, camion_id: op.camion_id ?? '', consignes: op.consignes ?? '', equipiers: (op.equipiers ?? []).map((e: any) => e.equipier_id) as string[] });
  const set = (k: string, v: any) => setF(p => ({ ...p, [k]: v }));
  async function save(extra?: any) {
    setBusy(true); setErr(null);
    const body = { date_prevue: f.date_prevue || null, heure_debut: f.heure_debut ? f.heure_debut + ':00' : null, duree_min: Number(f.duree_min) || null, camion_id: f.camion_id || null, consignes: f.consignes || null, equipiers: f.equipiers, ...extra };
    const res = await fetch(`/api/operations/${op.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    setBusy(false); if (!res.ok) { setErr((await res.json()).error ?? 'Erreur'); return; }
    r.refresh();
  }
  const eqNames = (op.equipiers ?? []).map((e: any) => e.equipier?.prenom).filter(Boolean).join(', ');
  return (
    <div className="rounded-md border border-line">
      <div className="flex items-start justify-between gap-3 p-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap"><span className="font-medium">{op.ordre}. {op.libelle}</span><EtatOp etat={op.etat} /></div>
          <div className="mt-1 text-sm text-mute flex flex-wrap gap-x-4 gap-y-1">
            <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{fmtDate(op.date_prevue)} {op.heure_debut ? fmtHeure(op.heure_debut) : ''} · {op.duree_min ? minToH(op.duree_min) : '—'}</span>
            <span className="inline-flex items-center gap-1"><Truck className="h-3.5 w-3.5" />{op.camion?.numero ?? 'aucun camion'}</span>
            <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />{eqNames || `0/${demandeNbHommes}`}</span>
          </div>
          {op.adresse && <div className="mt-1 text-xs text-mute truncate">{op.adresse.split('\n')[0]}</div>}
          {op.heure_arrivee && <div className="mt-1 text-xs text-moss">Arrivée {new Date(op.heure_arrivee).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}{op.heure_depart ? ` · départ ${new Date(op.heure_depart).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : ''}{op.signature_nom ? ` · signé ${op.signature_nom}` : ''}</div>}
        </div>
        {canPlan && <button onClick={() => setOpen(!open)} className="shrink-0 h-8 w-8 grid place-items-center rounded-md hover:bg-fog" aria-label="Planifier"><ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} /></button>}
      </div>
      {open && canPlan && (
        <div className="border-t border-line bg-fog/50 p-3 grid gap-3 sm:grid-cols-4">
          <label className="text-xs text-mute space-y-1"><span>Date</span><Input type="date" value={f.date_prevue} onChange={e => set('date_prevue', e.target.value)} /></label>
          <label className="text-xs text-mute space-y-1"><span>Début</span><Input type="time" value={f.heure_debut} onChange={e => set('heure_debut', e.target.value)} /></label>
          <label className="text-xs text-mute space-y-1"><span>Durée (min)</span><Input type="number" step={15} value={f.duree_min} onChange={e => set('duree_min', e.target.value)} /></label>
          <label className="text-xs text-mute space-y-1"><span>Camion</span><Select value={f.camion_id} onChange={e => set('camion_id', e.target.value)}><option value="">— aucun —</option>{camions.map(c => <option key={c.id} value={c.id}>{c.numero} · {c.volume_m3 ?? '?'} m³{c.hayon ? ' hayon' : ''}{c.climatise ? ' clim' : ''}</option>)}</Select></label>
          <div className="sm:col-span-4">
            <div className="text-xs text-mute mb-1">Équipe ({f.equipiers.length}/{demandeNbHommes}) — le premier coché est chef d'équipe</div>
            <div className="flex flex-wrap gap-1.5">{equipiers.map(e => { const on = f.equipiers.includes(e.id); return <button type="button" key={e.id} onClick={() => set('equipiers', on ? f.equipiers.filter(x => x !== e.id) : [...f.equipiers, e.id])} className={`rounded-full px-2.5 py-1 text-xs border ${on ? 'bg-cobalt text-white border-cobalt' : 'bg-paper border-line hover:bg-fog'}`}>{e.prenom} {e.nom?.[0] ?? ''}{e.permis === 'C' || e.permis === 'CE' ? ' · PL' : ''}</button>; })}</div>
          </div>
          <label className="sm:col-span-4 text-xs text-mute space-y-1"><span>Consignes chauffeur</span><Textarea value={f.consignes} onChange={e => set('consignes', e.target.value)} className="min-h-[56px]" /></label>
          {err && <p className="sm:col-span-4 text-sm text-brick">{err}</p>}
          <div className="sm:col-span-4 flex justify-end gap-2">
            {op.camion_id && <Button variant="secondary" size="sm" onClick={() => save({ camion_id: null, etat: 'a_planifier', equipiers: [] })} disabled={busy}>Désaffecter</Button>}
            <Button size="sm" onClick={() => save()} disabled={busy}>{busy ? 'Enregistrement…' : 'Planifier'}</Button>
          </div>
        </div>
      )}
    </div>
  );
}
