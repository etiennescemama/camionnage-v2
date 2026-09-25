'use client';
import { useEffect, useMemo, useState } from 'react';
import {AddressFields} from '@/components/address-fields';
import {RoutePlanner} from '@/components/route-planner';
import {emptyAddress,addressText,addressColumns} from '@/lib/address';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/input';
import { Panel } from '@/components/panel';
import { CreneauxGrid, useCreneaux, type Creneau } from '@/components/creneaux';
import { TYPES_CAMION, type Client, type Scenario, type TempsStandard } from '@/lib/types';
import { addDays, cn, minToH, todayYmd } from '@/lib/utils';
import { ArrowLeft, Truck, Users, CalendarDays, Repeat, Clock } from 'lucide-react';

const split = (s?: string | null) => (s ?? '').split(',').map(x => x.trim()).filter(Boolean);

export default function NouvelleDemande() {
  const r = useRouter(); const supabase = useMemo(() => createClient(), []);
  const [origin,setOrigin]=useState(emptyAddress); const [destination,setDestination]=useState(emptyAddress); const [fleet,setFleet]=useState<any[]>([]);
  const [referenceLoading, setReferenceLoading] = useState(true);
  const [clientSearch, setClientSearch] = useState('');
  const [clients, setClients] = useState<Client[]>([]); const [ts, setTs] = useState<TempsStandard[]>([]); const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [sc, setSc] = useState<Scenario | null>(null);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState({
    client_id: '', nouveau_client: '', code_affaire: '', contact_nom: '', contact_email: '', contact_telephone: '',
    adresse_enlevement: '', adresse_livraison: '', objets: '', nb_colis: '', volume_m3: '',
    type_camion: '20', besoin_hayon: true, besoin_clim: false, nb_hommes: 2, nb_camions: 1, nb_jours: 1,
    date_souhaitee: addDays(todayYmd(), 1), creneau: 'matin', rdv_heure: '', date_retour: '', creneau_retour: 'matin', observations: '',
  });
  const [opsAller, setOpsAller] = useState<string[]>([]); const [opsRetour, setOpsRetour] = useState<string[]>([]);
  const set = (k: string, v: any) => setF(p => ({ ...p, [k]: v }));

  useEffect(() => {
    let alive = true;
    Promise.all([
      supabase.from('clients').select('*').order('nom'),
      supabase.from('temps_standards').select('*').order('ordre'),
      supabase.from('scenarios').select('*').eq('actif', true).order('ordre'),
      supabase.from('camions').select('*').eq('actif',true).order('numero'),
    ]).then(([c,t,s,v]) => {
      if (!alive) return;
      if (c.error || t.error || s.error) throw new Error('Les référentiels ne sont pas disponibles. Actualisez pour réessayer.');
      setFleet(v.data ?? []);
      setClients((c.data ?? []) as Client[]); setTs((t.data ?? []) as TempsStandard[]); setScenarios((s.data ?? []) as Scenario[]);
    }).catch(e => { if (alive) setErr(e.message); }).finally(() => { if (alive) setReferenceLoading(false); });
    return () => { alive = false; };
  }, [supabase]);

  function selectClient(id: string) {
    const client = clients.find(c => c.id === id);
    setF(p => ({ ...p, client_id: id, nouveau_client: '', contact_email: client?.email ?? '', contact_telephone: client?.telephone ?? '' }));
  }

  function choose(s: Scenario) {
    setSc(s);
    setOpsAller(split(s.ops_aller)); setOpsRetour(split(s.ops_retour));
    setF(p => ({ ...p, type_camion: s.type_camion ?? '', besoin_hayon: s.besoin_hayon, besoin_clim: s.besoin_clim, nb_hommes: s.nb_hommes, nb_camions: s.nb_camions, nb_jours: s.nb_jours,
      creneau: s.creneau_fixe ? 'rdv' : 'matin', date_retour: s.ops_retour ? addDays(p.date_souhaitee, 7) : '' }));
  }

  const volume = Number(f.volume_m3) || 0, camionVol = Number(f.type_camion) || 0;
  const dur = (code: string) => { const x = ts.find(a => a.type_operation === code); return x ? Math.ceil(x.duree_base_min + x.min_par_m3 * volume) : 120; };
  const dureeAller = useMemo(() => opsAller.reduce((s, c) => s + dur(c), 0), [opsAller, ts, volume]); // eslint-disable-line
  const dureeRetour = useMemo(() => opsRetour.reduce((s, c) => s + dur(c), 0), [opsRetour, ts, volume]); // eslint-disable-line
  const { data: cren, loading, error: capacityError } = useCreneaux(addDays(f.date_souhaitee, -2), addDays(f.date_souhaitee, 6), camionVol, f.besoin_hayon, f.besoin_clim, dureeAller || 120);
  const { data: crenR, loading: loadingR, error: capacityErrorR } = useCreneaux(f.date_retour ? addDays(f.date_retour, -2) : '', f.date_retour ? addDays(f.date_retour, 6) : '', camionVol, f.besoin_hayon, f.besoin_clim, dureeRetour || 120);
  const nbOps = opsAller.length * f.nb_jours * Math.max(1, f.nb_camions) + opsRetour.length * Math.max(1, f.nb_camions);
  const specifique = f.nb_jours > 1 || f.nb_camions > 1 || f.nb_hommes > 2 || volume > 20 || camionVol > 20;

  function toggle(list: string[], setList: (v: string[]) => void, code: string) { setList(list.includes(code) ? list.filter(x => x !== code) : [...list, code]); }

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(null);
    if (busy) return;
    if ((opsAller.some(c=>['enlevement','transfert'].includes(c)) && (!origin.rue || !origin.ville || !origin.pays)) || (opsAller.some(c=>['livraison','installation','transfert'].includes(c)) && (!destination.rue || !destination.ville || !destination.pays))) { setErr('Complétez les rues, villes et pays de départ et d’arrivée.'); return; }
    if (!f.client_id && !f.nouveau_client.trim()) { setErr('Choisissez un client ou indiquez son nom.'); return; }
    if (f.date_retour && f.date_retour < f.date_souhaitee) { setErr('Le retour doit suivre le départ.'); return; }
    if (opsAller.some(c => !ts.some(t => t.type_operation === c)) || opsRetour.some(c => !ts.some(t => t.type_operation === c))) { setErr('Une opération du scénario manque dans les référentiels.'); return; }
    if (opsAller.length === 0) { setErr('Ajoutez au moins une opération.'); return; }
    if (opsRetour.length > 0 && !f.date_retour) { setErr('Indiquez la date de retour.'); return; }
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      let client_id = f.client_id || null;
      if (!client_id && f.nouveau_client.trim()) { const { data: c, error } = await supabase.from('clients').insert({ nom: f.nouveau_client.trim() }).select().single(); if (error) throw error; client_id = c.id; }
      const rotations = Math.max(1, f.nb_camions);
      const { data: d, error: e1 } = await supabase.from('demandes').insert({
        client_id, scenario_code: sc?.code ?? null, code_affaire: f.code_affaire || null, contact_nom: f.contact_nom || null, contact_email: f.contact_email || null, contact_telephone: f.contact_telephone || null,
        ...addressColumns(origin,'enlevement'), ...addressColumns(destination,'livraison'), objets: f.objets || null, nb_colis: f.nb_colis ? Number(f.nb_colis) : null, volume_m3: volume || null,
        date_souhaitee: f.date_souhaitee, creneau: f.creneau, rdv_heure: f.creneau === 'rdv' && f.rdv_heure ? f.rdv_heure : null, date_fin: f.nb_jours > 1 ? addDays(f.date_souhaitee, f.nb_jours - 1) : null,
        date_retour: opsRetour.length ? f.date_retour : null, creneau_retour: opsRetour.length ? f.creneau_retour : null,
        nb_hommes: f.nb_hommes, nb_camions: f.nb_camions, nb_jours: f.nb_jours, type_camion: f.type_camion || null, besoin_hayon: f.besoin_hayon, besoin_clim: f.besoin_clim, observations: f.observations || null,
        coordinateur_id: user?.id ?? null, etat: 'envoyee',
      }).select().single();
      if (e1) throw e1;
      const rows: any[] = []; let ordre = 0;
      const push = (periode: 'aller' | 'retour', codes: string[], baseDate: string, jours: number) => {
        for (let j = 1; j <= jours; j++) for (let rot = 1; rot <= rotations; rot++) for (const code of codes) {
          const t = ts.find(a => a.type_operation === code); if (!t) continue;
          const suffixe = [jours > 1 ? `J${j}` : '', rotations > 1 ? `camion ${rot}/${rotations}` : '', periode === 'retour' ? 'retour' : ''].filter(Boolean).join(' · ');
          rows.push({ demande_id: d.id, type_operation: code, ordre: ++ordre, periode, jour: j, rotation: rot, libelle: suffixe ? `${t.libelle} — ${suffixe}` : t.libelle,
            adresse: ['livraison','installation'].includes(code) ? (periode === 'retour' ? addressText(origin) : addressText(destination)) || null : ['enlevement', 'visite', 'transfert'].includes(code) ? (periode === 'retour' ? addressText(destination) : addressText(origin)) || null : null,
            date_prevue: addDays(baseDate, j - 1), duree_min: dur(code), etat: 'a_planifier' });
        }
      };
      push('aller', opsAller, f.date_souhaitee, f.nb_jours);
      if (opsRetour.length) push('retour', opsRetour, f.date_retour, 1);
      const { error: e2 } = await supabase.from('operations').insert(rows); if (e2) throw e2;
      r.push('/demandes/' + d.id); r.refresh();
    } catch (x: any) { setErr(x.message ?? 'Erreur'); setBusy(false); }
  }

  if (!sc) return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <Link href="/demandes" className="inline-flex items-center gap-1 text-sm text-mute hover:text-ink mb-3"><ArrowLeft className="h-4 w-4" />Demandes</Link>
      <h1 className="text-xl md:text-2xl font-semibold mb-1">Nouvelle demande</h1>
      <p className="text-sm text-mute mb-5">Quel type d'opération ? Le scénario pré-remplit les opérations, les moyens et les durées — vous ajustez ensuite.</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {scenarios.map(s => (
          <button key={s.code} type="button" onClick={() => choose(s)} className="rounded-lg border border-line bg-paper p-4 text-left hover:border-cobalt hover:bg-cobalt-soft/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cobalt">
            <div className="font-semibold">{s.libelle}</div>
            <div className="text-sm text-mute mt-0.5 min-h-[40px]">{s.description}</div>
            <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-mute">
              <span className="inline-flex items-center gap-1"><Truck className="h-3.5 w-3.5" />{s.nb_camions ? `${s.nb_camions} × ${s.type_camion} m³` : 'sans camion'}</span>
              <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />{s.nb_hommes} h.</span>
              {s.nb_jours > 1 && <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{s.nb_jours} jours</span>}
              {s.ops_retour && <span className="inline-flex items-center gap-1"><Repeat className="h-3.5 w-3.5" />retour</span>}
              {s.creneau_fixe && <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />horaire imposé</span>}
            </div>
          </button>))}
        {err && <p role="alert" className="text-brick">{err}</p>}
        {scenarios.length === 0 && !err && <p className="text-sm text-mute">{referenceLoading ? 'Chargement des scénarios…' : 'Aucun scénario actif. Demandez au dispatch de compléter les référentiels.'}</p>}
      </div>
    </div>
  );

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto pb-28">
      <button type="button" onClick={() => setSc(null)} className="inline-flex items-center gap-1 text-sm text-mute hover:text-ink mb-3"><ArrowLeft className="h-4 w-4" />Changer de scénario</button>
      <h1 className="text-xl md:text-2xl font-semibold mb-1">{sc.libelle}</h1>
      <p className="text-sm text-mute mb-5">{sc.description}{specifique && <span className="ml-2 text-cobalt-ink font-medium">Opération spécifique.</span>}</p>
      <form id="demande-form" onSubmit={submit} className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <Panel title="Client et contact">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Client"><Input aria-label="Rechercher un client" placeholder="Rechercher un client…" value={clientSearch} onChange={e => setClientSearch(e.target.value)} /><Select aria-label="Choisir le client" value={f.client_id} onChange={e => selectClient(e.target.value)}><option value="">— Choisir —</option>{clients.filter(c => c.id === f.client_id || c.nom.toLocaleLowerCase('fr').includes(clientSearch.toLocaleLowerCase('fr'))).map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}</Select></Field>
              <Field label="ou nouveau client"><Input value={f.nouveau_client} onChange={e => set('nouveau_client', e.target.value)} disabled={!!f.client_id} /></Field>
              <Field label="Code affaire Akanea"><Input value={f.code_affaire} onChange={e => set('code_affaire', e.target.value)} placeholder="ex. 26-00091" /></Field>
              <Field label="Contact sur place"><Input value={f.contact_nom} onChange={e => set('contact_nom', e.target.value)} /></Field>
              <Field label="Email"><Input type="email" value={f.contact_email} onChange={e => set('contact_email', e.target.value)} /></Field>
              <Field label="Téléphone"><Input value={f.contact_telephone} onChange={e => set('contact_telephone', e.target.value)} /></Field>
            </div>
          </Panel>
          <Panel title="Adresses et objets">
            <div className="grid gap-3 sm:grid-cols-2">
              <AddressFields title="A · Enlèvement" value={origin} onChange={setOrigin}/>
              <AddressFields title="B · Livraison" value={destination} onChange={setDestination}/>
              <div className="sm:col-span-2"><Field label="Objets"><Textarea value={f.objets} onChange={e => set('objets', e.target.value)} placeholder="ex. 3 caisses toiles 120×90, 1 sculpture bronze 80 kg, cf. liste jointe" /></Field></div>
              <Field label="Nombre de colis"><Input type="number" min={0} value={f.nb_colis} onChange={e => set('nb_colis', e.target.value)} /></Field>
              <Field label="Volume estimé (m³)"><Input type="number" min={0} step={0.5} value={f.volume_m3} onChange={e => set('volume_m3', e.target.value)} /></Field>
            </div>
          </Panel>
          <RoutePlanner origin={origin} destination={destination} camions={fleet}/>
          <details className="rounded-xl border border-line bg-paper p-4">
            <summary className="font-medium text-sm">Ajuster les moyens et les opérations <span className="text-mute font-normal">· {f.nb_camions} camion(s), {f.nb_hommes} équipiers, {nbOps} opérations</span></summary>
            <div className="space-y-4 mt-4">
          <Panel title="Moyens" aside={<span className="text-xs text-mute">{sc.profils}</span>}>
            <div className="grid gap-3 sm:grid-cols-4">
              <Field label="Camion"><Select value={f.type_camion} onChange={e => { const v = e.target.value; set('type_camion', v); set('nb_camions', v ? Math.max(1, f.nb_camions) : 0); set('besoin_clim', Number(v) >= 27); set('besoin_hayon', v !== '14' && v !== ''); }}><option value="">Sans camion</option>{TYPES_CAMION.map(t => <option key={t.code} value={t.code}>{t.libelle}</option>)}</Select></Field>
              <Field label="Camions en parallèle"><Input type="number" min={0} max={20} value={f.nb_camions} onChange={e => set('nb_camions', Number(e.target.value) || 0)} /></Field>
              <Field label="Hommes par camion"><Input type="number" min={1} value={f.nb_hommes} onChange={e => set('nb_hommes', Number(e.target.value) || 1)} /></Field>
              <Field label="Jours consécutifs"><Input type="number" min={1} max={60} value={f.nb_jours} onChange={e => set('nb_jours', Math.max(1, Number(e.target.value) || 1))} /></Field>
              <div className="sm:col-span-4 flex gap-6 text-sm"><label className="flex items-center gap-2"><input type="checkbox" checked={f.besoin_hayon} onChange={e => set('besoin_hayon', e.target.checked)} />Hayon</label><label className="flex items-center gap-2"><input type="checkbox" checked={f.besoin_clim} onChange={e => set('besoin_clim', e.target.checked)} />Climatisation</label></div>
            </div>
          </Panel>
          <Panel title="Opérations" aside={<span className="text-xs text-mute">{nbOps} ordre{nbOps > 1 ? 's' : ''} de transport seront créés</span>}>
            <OpsPicker titre={opsRetour.length ? 'Aller' : undefined} ts={ts} list={opsAller} onToggle={c => toggle(opsAller, setOpsAller, c)} dur={dur} />
            <p className="mt-2 text-xs text-mute">Par jour et par camion : <strong className="text-ink">{minToH(dureeAller)}</strong>{f.nb_jours > 1 ? ` × ${f.nb_jours} jours` : ''}{f.nb_camions > 1 ? ` × ${f.nb_camions} camions` : ''}.</p>
            <div className="mt-4 pt-4 border-t border-line">
              <OpsPicker titre="Retour" ts={ts} list={opsRetour} onToggle={c => toggle(opsRetour, setOpsRetour, c)} dur={dur} />
              {opsRetour.length > 0 && <p className="mt-2 text-xs text-mute">Retour : <strong className="text-ink">{minToH(dureeRetour)}</strong>.</p>}
            </div>
          </Panel>
            </div>
          </details>
          <Panel title="Observations"><Textarea value={f.observations} onChange={e => set('observations', e.target.value)} placeholder="Accès, étage, horaires du site, fragilité, formalités douane…" /></Panel>
        </div>
        <div className="space-y-4 lg:sticky lg:top-6 self-start">
          <Panel title={opsRetour.length ? 'Aller' : 'Date et créneau'}>
            <div className="grid gap-3">
              <Field label={f.nb_jours > 1 ? 'Premier jour' : 'Date souhaitée'}><Input type="date" value={f.date_souhaitee} onChange={e => set('date_souhaitee', e.target.value)} required /></Field>
              {f.nb_jours > 1 && <p className="text-xs text-mute -mt-1">Jusqu'au {addDays(f.date_souhaitee, f.nb_jours - 1)} ({f.nb_jours} jours consécutifs).</p>}
              <Field label="Créneau"><Select value={f.creneau} onChange={e => set('creneau', e.target.value)}><option value="matin">Matin</option><option value="apres_midi">Après-midi</option><option value="journee">Journée</option><option value="rdv">Heure imposée</option></Select></Field>
              {f.creneau === 'rdv' && <Field label="Heure"><Input type="time" value={f.rdv_heure} onChange={e => set('rdv_heure', e.target.value)} required /></Field>}
            </div>
            <details className="mt-3"><summary className="text-sm text-cobalt-ink mb-2">Comparer les disponibilités proches</summary>{capacityError && <p role="alert" className="text-sm text-brick">{capacityError}</p>}<CreneauxGrid data={cren} loading={loading} selected={{ jour: f.date_souhaitee, demi: f.creneau }} onSelect={(c: Creneau) => { set('date_souhaitee', c.jour); if (f.creneau !== 'rdv') set('creneau', c.demi); }} hommes={f.nb_hommes * Math.max(1, f.nb_camions)} camions={f.nb_camions} /></details>
          </Panel>
          {opsRetour.length > 0 && (
            <Panel title="Retour">
              <div className="grid gap-3">
                <Field label="Date de retour"><Input type="date" value={f.date_retour} min={f.date_souhaitee} onChange={e => set('date_retour', e.target.value)} required /></Field>
                <Field label="Créneau"><Select value={f.creneau_retour} onChange={e => set('creneau_retour', e.target.value)}><option value="matin">Matin</option><option value="apres_midi">Après-midi</option><option value="journee">Journée</option></Select></Field>
              </div>
              <div className="mt-3">{capacityErrorR && <p role="alert" className="text-sm text-brick">{capacityErrorR}</p>}<CreneauxGrid data={crenR} loading={loadingR} selected={{ jour: f.date_retour, demi: f.creneau_retour }} onSelect={(c: Creneau) => { set('date_retour', c.jour); set('creneau_retour', c.demi); }} hommes={f.nb_hommes * Math.max(1, f.nb_camions)} camions={f.nb_camions} /></div>
            </Panel>)}
          {err && <p role="alert" className="rounded-md bg-brick-soft text-brick text-sm p-3">{err}</p>}
          <p className="text-xs text-mute">{nbOps} opérations · {minToH(dureeAller)} estimées par jour et par camion à l’aller. Les moyens restent à confirmer par le dispatch.</p>
          <Button type="submit" className="w-full" disabled={busy}>{busy ? 'Envoi…' : 'Envoyer au dispatch'}</Button>
        </div>
      </form>
    </div>
  );
}

function OpsPicker({ titre, ts, list, onToggle, dur }: { titre?: string; ts: TempsStandard[]; list: string[]; onToggle: (c: string) => void; dur: (c: string) => number }) {
  return (
    <div>
      {titre && <div className="text-sm font-medium mb-2">{titre}{list.length === 0 && titre === 'Retour' && <span className="text-mute font-normal"> — aucun (ajoutez-en pour un aller-retour)</span>}</div>}
      <div className="flex flex-wrap gap-1.5">
        {ts.map(t => { const on = list.includes(t.type_operation); const pos = list.indexOf(t.type_operation); return (
          <button type="button" key={t.type_operation} onClick={() => onToggle(t.type_operation)} className={cn('rounded-full border px-3 py-1 text-sm', on ? 'bg-cobalt text-white border-cobalt' : 'bg-paper border-line hover:bg-fog')}>
            {on && <span className="mr-1 opacity-70">{pos + 1}.</span>}{t.libelle}<span className={cn('ml-1.5 text-xs', on ? 'text-white/70' : 'text-mute')}>{minToH(dur(t.type_operation))}</span>
          </button>); })}
      </div>
    </div>
  );
}
