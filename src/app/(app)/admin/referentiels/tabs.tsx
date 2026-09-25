'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Plus, Trash2, Check, X, Pencil } from 'lucide-react';

type Col = { key: string; label: string; type?: 'text' | 'number' | 'bool' | 'select' | 'date'; options?: { value: string; label: string }[]; width?: string };
const TABS = ['camions', 'equipiers', 'temps_standards', 'scenarios', 'indisponibilites', 'clients'] as const;
const LABELS: Record<typeof TABS[number], string> = { camions: 'Camions', equipiers: 'Équipiers', temps_standards: 'Temps standards', scenarios: 'Scénarios', indisponibilites: 'Indisponibilités', clients: 'Clients' };

export function Referentiels(p: { camions: any[]; equipiers: any[]; ts: any[]; indispos: any[]; clients: any[]; scenarios: any[] }) {
  const [tab, setTab] = useState<typeof TABS[number]>('camions');
  const camOpts = p.camions.map(c => ({ value: c.id, label: c.numero })), eqOpts = p.equipiers.map(e => ({ value: e.id, label: `${e.prenom} ${e.nom ?? ''}` }));
  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <h1 className="text-xl md:text-2xl font-semibold mb-1">Référentiels</h1>
      <p className="text-sm text-mute mb-4">Flotte, équipes, temps standards et absences : c'est ce qui alimente la capacité et les créneaux disponibles.</p>
      <div className="flex flex-wrap gap-1.5 mb-4 text-sm">{TABS.map(t => <button key={t} onClick={() => setTab(t)} className={cn('rounded-full px-3 py-1', tab === t ? 'bg-ink text-white' : 'bg-paper border border-line hover:bg-fog')}>{LABELS[t]}</button>)}</div>
      {tab === 'camions' && <Table table="camions" rows={p.camions} pk="id" deleteMode="soft" cols={[
        { key: 'numero', label: 'N°', width: '110px' }, { key: 'immatriculation', label: 'Immat.', width: '120px' }, { key: 'volume_m3', label: 'm³', type: 'number', width: '80px' },
        { key: 'hayon', label: 'Hayon', type: 'bool' }, { key: 'climatise', label: 'Clim', type: 'bool' }, { key: 'poids_lourd', label: 'PL', type: 'bool' }, { key: 'rampe', label: 'Rampe', type: 'bool' }, { key: 'actif', label: 'Actif', type: 'bool' }]}
        blank={{ numero: '', immatriculation: '', volume_m3: 20, hayon: true, climatise: false, poids_lourd: false, rampe: false, actif: true }} />}
      {tab === 'equipiers' && <Table table="equipiers" rows={p.equipiers} pk="id" deleteMode="soft" cols={[
        { key: 'prenom', label: 'Prénom' }, { key: 'nom', label: 'Nom' }, { key: 'permis', label: 'Permis', type: 'select', options: [{ value: '', label: '—' }, { value: 'B', label: 'B' }, { value: 'C', label: 'C (PL)' }, { value: 'CE', label: 'CE' }], width: '110px' },
        { key: 'role', label: 'Rôle', type: 'select', options: [{ value: 'chauffeur', label: 'Chauffeur' }, { value: 'manutentionnaire', label: 'Manutentionnaire' }, { value: 'emballeur', label: 'Emballeur' }, { value: 'chef_equipe', label: "Chef d'équipe" }], width: '150px' },
        { key: 'telephone', label: 'Téléphone', width: '130px' }, { key: 'actif', label: 'Actif', type: 'bool' }]}
        blank={{ prenom: '', nom: '', permis: 'B', role: 'chauffeur', telephone: '', actif: true }} />}
      {tab === 'temps_standards' && <Table table="temps_standards" rows={p.ts} pk="type_operation" deleteMode="none" cols={[
        { key: 'libelle', label: 'Opération' }, { key: 'duree_base_min', label: 'Base (min)', type: 'number', width: '110px' }, { key: 'min_par_m3', label: '+ min / m³', type: 'number', width: '110px' }, { key: 'hommes_defaut', label: 'Hommes', type: 'number', width: '90px' }]}
        hint="Durée = base + (min/m³ × volume). Ajustez avec vos cadences réelles : c'est ce qui fixe la charge des camions et les créneaux proposés." />}
      {tab === 'scenarios' && <Table table="scenarios" rows={p.scenarios} pk="code" deleteMode="soft" cols={[
        { key: 'code', label: 'Code', width: '120px' }, { key: 'libelle', label: 'Libellé' }, { key: 'description', label: 'Description' },
        { key: 'ops_aller', label: 'Opérations aller', width: '180px' }, { key: 'ops_retour', label: 'Opérations retour', width: '150px' },
        { key: 'nb_jours', label: 'Jours', type: 'number', width: '70px' }, { key: 'nb_camions', label: 'Camions', type: 'number', width: '80px' }, { key: 'nb_hommes', label: 'Hommes', type: 'number', width: '80px' },
        { key: 'type_camion', label: 'Type', type: 'select', options: [{ value: '', label: '—' }, { value: '14', label: '14' }, { value: '20', label: '20' }, { value: '27', label: '27' }, { value: '35', label: '35' }, { value: '50', label: '50' }], width: '80px' },
        { key: 'besoin_hayon', label: 'Hayon', type: 'bool' }, { key: 'besoin_clim', label: 'Clim', type: 'bool' }, { key: 'creneau_fixe', label: 'RDV', type: 'bool' }, { key: 'profils', label: 'Profils' }, { key: 'actif', label: 'Actif', type: 'bool' }]}
        blank={{ code: '', libelle: '', description: '', ops_aller: 'enlevement,livraison', ops_retour: '', nb_jours: 1, nb_camions: 1, nb_hommes: 2, type_camion: '20', besoin_hayon: true, besoin_clim: false, creneau_fixe: false, profils: '', actif: true }}
        hint="Codes d'opérations séparés par des virgules : enlevement, livraison, transfert, reception_gm, sortie_gm, emballage, installation, visite." />}
      {tab === 'indisponibilites' && <Table table="indisponibilites" rows={p.indispos} pk="id" deleteMode="hard" cols={[
        { key: 'camion_id', label: 'Camion', type: 'select', options: [{ value: '', label: '—' }, ...camOpts] }, { key: 'equipier_id', label: 'Équipier', type: 'select', options: [{ value: '', label: '—' }, ...eqOpts] },
        { key: 'date_debut', label: 'Du', type: 'date', width: '150px' }, { key: 'date_fin', label: 'Au', type: 'date', width: '150px' }, { key: 'motif', label: 'Motif' }]}
        blank={{ camion_id: '', equipier_id: '', date_debut: '', date_fin: '', motif: '' }} hint="Congés, maladie, contrôle technique, location : retirés de la capacité." />}
      {tab === 'clients' && <Table table="clients" rows={p.clients} pk="id" deleteMode="hard" cols={[
        { key: 'nom', label: 'Nom' }, { key: 'code_akanea', label: 'Code Akanea', width: '140px' }, { key: 'email', label: 'Email' }, { key: 'telephone', label: 'Téléphone', width: '130px' }]}
        blank={{ nom: '', code_akanea: '', email: '', telephone: '' }} />}
    </div>
  );
}

function Table({ table, rows, cols, pk, blank, deleteMode, hint }: { table: string; rows: any[]; cols: Col[]; pk: string; blank?: any; deleteMode: 'soft' | 'hard' | 'none'; hint?: string }) {
  const r = useRouter(); const supabase = createClient();
  const [edit, setEdit] = useState<string | null>(null); const [creating, setCreating] = useState(false); const [draft, setDraft] = useState<any>({}); const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  function clean(d: any) { const o: any = {}; for (const c of cols) { let v = d[c.key]; if (c.type === 'number') v = v === '' || v == null ? null : Number(v); if ((c.type === 'select' || c.type === 'text' || c.type === 'date' || !c.type) && v === '') v = null; o[c.key] = v; } return o; }
  async function save() {
    setBusy(true); setErr(null);
    const q = creating ? supabase.from(table).insert(clean(draft)) : supabase.from(table).update(clean(draft)).eq(pk, edit!);
    const { error } = await q; setBusy(false); if (error) { setErr(error.message); return; }
    setEdit(null); setCreating(false); r.refresh();
  }
  async function del(row: any) {
    if (!confirm(deleteMode === 'soft' ? 'Désactiver cet élément ?' : 'Supprimer définitivement ?')) return;
    const { error } = deleteMode === 'soft' ? await supabase.from(table).update({ actif: false }).eq(pk, row[pk]) : await supabase.from(table).delete().eq(pk, row[pk]);
    if (error) setErr(error.message); else r.refresh();
  }
  const Cell = ({ c }: { c: Col }) => {
    const v = draft[c.key] ?? '';
    if (c.type === 'bool') return <input type="checkbox" checked={!!draft[c.key]} onChange={e => setDraft({ ...draft, [c.key]: e.target.checked })} />;
    if (c.type === 'select') return <Select className="h-8" value={v} onChange={e => setDraft({ ...draft, [c.key]: e.target.value })}>{c.options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</Select>;
    return <Input className="h-8" type={c.type === 'number' ? 'number' : c.type === 'date' ? 'date' : 'text'} value={v} onChange={e => setDraft({ ...draft, [c.key]: e.target.value })} />;
  };
  const Row = () => <tr className="bg-cobalt-soft/40">{cols.map(c => <td key={c.key} className="px-2 py-1.5"><Cell c={c} /></td>)}<td className="px-2 py-1.5 text-right whitespace-nowrap"><button onClick={save} disabled={busy} className="p-1 text-moss"><Check className="h-4 w-4" /></button><button onClick={() => { setEdit(null); setCreating(false); }} className="p-1 text-mute"><X className="h-4 w-4" /></button></td></tr>;
  return (
    <div className="rounded-lg border border-line bg-paper overflow-x-auto">
      <div className="flex items-center justify-between gap-3 px-4 py-2 border-b border-line"><span className="text-xs text-mute">{hint ?? `${rows.length} élément${rows.length > 1 ? 's' : ''}`}</span>{blank && !creating && <Button size="sm" onClick={() => { setDraft(blank); setCreating(true); setEdit(null); }}><Plus className="h-4 w-4" />Ajouter</Button>}</div>
      {err && <p className="px-4 py-2 text-sm text-brick">{err}</p>}
      <table className="w-full text-sm">
        <thead className="text-xs text-mute"><tr>{cols.map(c => <th key={c.key} className="text-left px-2 py-2 font-medium" style={{ width: c.width }}>{c.label}</th>)}<th /></tr></thead>
        <tbody className="divide-y divide-line">
          {creating && <Row />}
          {rows.map(row => edit === row[pk] ? <Row key={row[pk]} /> : (
            <tr key={row[pk]} className={cn('hover:bg-fog/50', row.actif === false && 'opacity-50')}>
              {cols.map(c => <td key={c.key} className="px-2 py-2">{c.type === 'bool' ? (row[c.key] ? '✓' : '—') : c.type === 'select' ? (c.options?.find(o => o.value === (row[c.key] ?? ''))?.label ?? (row.camion?.numero ?? row.equipier?.prenom ?? '—')) : (row[c.key] ?? '—')}</td>)}
              <td className="px-2 py-2 text-right whitespace-nowrap"><button onClick={() => { setDraft({ ...row }); setEdit(row[pk]); setCreating(false); }} className="p-1 text-mute hover:text-ink"><Pencil className="h-4 w-4" /></button>{deleteMode !== 'none' && (row.actif !== false) && <button onClick={() => del(row)} className="p-1 text-mute hover:text-brick"><Trash2 className="h-4 w-4" /></button>}</td>
            </tr>))}
          {rows.length === 0 && !creating && <tr><td colSpan={cols.length + 1} className="p-6 text-center text-mute">Aucun élément. Cliquez sur Ajouter.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
