'use client';
import { useState } from 'react';
import {AddressFields} from '@/components/address-fields';
import {addressFrom,addressColumns} from '@/lib/address';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Panel } from '@/components/panel';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { TYPES_CAMION } from '@/lib/types';
export function EditDemande({ demande }: { demande: any }) {
  const r = useRouter(); const [open, setOpen] = useState(false); const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState({ date_souhaitee: demande.date_souhaitee ?? '', creneau: demande.creneau ?? 'matin', rdv_heure: demande.rdv_heure?.slice(0, 5) ?? '', date_fin: demande.date_fin ?? '', nb_hommes: demande.nb_hommes ?? 2, type_camion: demande.type_camion ?? '20', volume_m3: demande.volume_m3 ?? '', adresse_enlevement: demande.adresse_enlevement ?? '', adresse_livraison: demande.adresse_livraison ?? '', objets: demande.objets ?? '', observations: demande.observations ?? '', contact_nom: demande.contact_nom ?? '', contact_telephone: demande.contact_telephone ?? '', code_affaire: demande.code_affaire ?? '' });
  const [origin,setOrigin]=useState(()=>addressFrom(demande,'enlevement')); const [destination,setDestination]=useState(()=>addressFrom(demande,'livraison'));
  const set = (k: string, v: any) => setF(p => ({ ...p, [k]: v }));
  async function save() {
    setBusy(true); setErr(null);
    const { error } = await createClient().from('demandes').update({ ...f, ...addressColumns(origin,'enlevement'), ...addressColumns(destination,'livraison'), rdv_heure: f.creneau === 'rdv' && f.rdv_heure ? f.rdv_heure + ':00' : null, date_fin: f.date_fin || null, volume_m3: f.volume_m3 === '' ? null : Number(f.volume_m3), nb_hommes: Number(f.nb_hommes) || 1 }).eq('id', demande.id);
    setBusy(false); if (error) { setErr(error.message); return; }
    setOpen(false); r.refresh();
  }
  if (!open) return <Button variant="secondary" onClick={() => setOpen(true)}>Modifier la demande</Button>;
  return (
    <Panel title="Modifier la demande" aside={demande.etat === 'planifiee' ? <span className="text-xs text-ochre">Modifier une demande planifiée annule la planification et prévient le dispatch.</span> : null}>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Date"><Input type="date" value={f.date_souhaitee} onChange={e => set('date_souhaitee', e.target.value)} /></Field>
        <Field label="Créneau"><Select value={f.creneau} onChange={e => set('creneau', e.target.value)}><option value="matin">Matin</option><option value="apres_midi">Après-midi</option><option value="journee">Journée</option><option value="rdv">RDV</option></Select></Field>
        {f.creneau === 'rdv' ? <Field label="Heure"><Input type="time" value={f.rdv_heure} onChange={e => set('rdv_heure', e.target.value)} /></Field> : <Field label="Date de fin"><Input type="date" value={f.date_fin} onChange={e => set('date_fin', e.target.value)} /></Field>}
        <Field label="Camion"><Select value={f.type_camion} onChange={e => set('type_camion', e.target.value)}>{TYPES_CAMION.map(t => <option key={t.code} value={t.code}>{t.libelle}</option>)}</Select></Field>
        <Field label="Hommes"><Input type="number" min={1} value={f.nb_hommes} onChange={e => set('nb_hommes', e.target.value)} /></Field>
        <Field label="Volume (m³)"><Input type="number" step={0.5} value={f.volume_m3} onChange={e => set('volume_m3', e.target.value)} /></Field>
        <Field label="Code affaire"><Input value={f.code_affaire} onChange={e => set('code_affaire', e.target.value)} /></Field>
        <Field label="Contact"><Input value={f.contact_nom} onChange={e => set('contact_nom', e.target.value)} /></Field>
        <Field label="Téléphone"><Input value={f.contact_telephone} onChange={e => set('contact_telephone', e.target.value)} /></Field>
        <div className="sm:col-span-3 grid gap-3 sm:grid-cols-2">
          <AddressFields title="A · Enlèvement" value={origin} onChange={setOrigin}/>
          <AddressFields title="B · Livraison" value={destination} onChange={setDestination}/>

        </div>
        <div className="sm:col-span-3"><Field label="Objets"><Textarea value={f.objets} onChange={e => set('objets', e.target.value)} /></Field></div>
        <div className="sm:col-span-3"><Field label="Observations"><Textarea value={f.observations} onChange={e => set('observations', e.target.value)} /></Field></div>
      </div>
      {err && <p className="mt-3 text-sm text-brick">{err}</p>}
      <div className="mt-4 flex justify-end gap-2"><Button variant="secondary" onClick={() => setOpen(false)}>Annuler</Button><Button onClick={save} disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer'}</Button></div>
    </Panel>
  );
}
