'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/input';
import { Panel } from '@/components/panel';
import { ROLE_LABEL, type Role } from '@/lib/types';
import { KeyRound, UserX, UserCheck, Copy, RefreshCw } from 'lucide-react';
const gen = () => { const c = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'; let s = ''; for (let i = 0; i < 10; i++) s += c[Math.floor(Math.random() * c.length)]; return s + '!' + Math.floor(Math.random() * 10); };
export function Users({ users, equipiers, meId }: { users: any[]; equipiers: any[]; meId: string }) {
  const r = useRouter(); const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null); const [ok, setOk] = useState<{ email: string; password: string } | null>(null);
  const [f, setF] = useState({ prenom: '', nom: '', email: '', password: gen(), role: 'coordinateur' as Role, equipier_id: '' });
  const set = (k: string, v: any) => setF(p => ({ ...p, [k]: v }));
  async function create(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    const res = await fetch('/api/admin/utilisateurs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...f, equipier_id: f.equipier_id || null }) });
    setBusy(false); if (!res.ok) { setErr((await res.json()).error ?? 'Erreur'); return; }
    setOk({ email: f.email, password: f.password }); setF({ prenom: '', nom: '', email: '', password: gen(), role: 'coordinateur', equipier_id: '' }); r.refresh();
  }
  async function patch(id: string, body: any) { const res = await fetch('/api/admin/utilisateurs', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...body }) }); if (!res.ok) alert((await res.json()).error); else r.refresh(); }
  async function reset(u: any) { const p = gen(); if (!confirm(`Nouveau mot de passe pour ${u.prenom} ${u.nom} : ${p}\n\nNotez-le, il ne sera plus affiché.`)) return; await patch(u.id, { password: p }); }
  return (
    <div className="p-6 max-w-6xl mx-auto grid gap-4 lg:grid-cols-[1fr_360px]">
      <div className="rounded-lg border border-line bg-paper overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-mute"><tr><th className="text-left px-4 py-2 font-medium">Nom</th><th className="text-left px-4 py-2 font-medium">Email</th><th className="text-left px-4 py-2 font-medium">Rôle</th><th className="text-left px-4 py-2 font-medium">Actif</th><th /></tr></thead>
          <tbody className="divide-y divide-line">{users.map(u => (
            <tr key={u.id} className={u.actif ? '' : 'opacity-50'}>
              <td className="px-4 py-2 font-medium">{u.prenom} {u.nom}{u.id === meId && <span className="ml-1 text-xs text-mute">(vous)</span>}</td>
              <td className="px-4 py-2 text-mute">{u.email}</td>
              <td className="px-4 py-2"><Select className="h-8 w-40" value={u.role} onChange={e => patch(u.id, { role: e.target.value })} disabled={u.id === meId}>{(Object.keys(ROLE_LABEL) as Role[]).map(k => <option key={k} value={k}>{ROLE_LABEL[k]}</option>)}</Select></td>
              <td className="px-4 py-2">{u.actif ? 'Oui' : 'Non'}</td>
              <td className="px-4 py-2 text-right whitespace-nowrap"><button onClick={() => reset(u)} className="p-1 text-mute hover:text-ink" title="Nouveau mot de passe"><KeyRound className="h-4 w-4" /></button>{u.id !== meId && <button onClick={() => patch(u.id, { actif: !u.actif })} className="p-1 text-mute hover:text-ink" title={u.actif ? 'Désactiver' : 'Réactiver'}>{u.actif ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}</button>}</td>
            </tr>))}</tbody>
        </table>
      </div>
      <form onSubmit={create}>
        <Panel title="Créer un compte">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3"><Field label="Prénom"><Input value={f.prenom} onChange={e => set('prenom', e.target.value)} required /></Field><Field label="Nom"><Input value={f.nom} onChange={e => set('nom', e.target.value)} required /></Field></div>
            <Field label="Email"><Input type="email" value={f.email} onChange={e => set('email', e.target.value)} required /></Field>
            <Field label="Rôle"><Select value={f.role} onChange={e => set('role', e.target.value)}>{(Object.keys(ROLE_LABEL) as Role[]).map(k => <option key={k} value={k}>{ROLE_LABEL[k]}</option>)}</Select></Field>
            {f.role === 'chauffeur' && <Field label="Équipier correspondant" hint="Le chauffeur ne verra que ses ordres."><Select value={f.equipier_id} onChange={e => set('equipier_id', e.target.value)}><option value="">— choisir —</option>{equipiers.filter(e => !e.utilisateur_id).map(e => <option key={e.id} value={e.id}>{e.prenom} {e.nom ?? ''}</option>)}</Select></Field>}
            <Field label="Mot de passe"><div className="flex gap-2"><Input value={f.password} onChange={e => set('password', e.target.value)} className="font-mono" required minLength={8} /><Button type="button" variant="secondary" onClick={() => set('password', gen())}><RefreshCw className="h-4 w-4" /></Button></div></Field>
            {err && <p className="text-sm text-brick">{err}</p>}
            <Button type="submit" className="w-full" disabled={busy}>{busy ? 'Création…' : 'Créer le compte'}</Button>
            {ok && <div className="rounded-md bg-moss-soft p-3 text-sm"><div className="font-medium text-moss">Compte créé</div><div className="font-mono text-xs mt-1">{ok.email}<br />{ok.password}</div><button type="button" onClick={() => navigator.clipboard.writeText(`Email : ${ok.email}\nMot de passe : ${ok.password}\n${location.origin}/login`)} className="mt-2 inline-flex items-center gap-1 text-xs text-cobalt"><Copy className="h-3 w-3" />Copier les identifiants</button></div>}
          </div>
        </Panel>
      </form>
    </div>
  );
}
