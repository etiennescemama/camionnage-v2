'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/input';
export default function Login() {
  const r = useRouter(); const [email, setEmail] = useState(''); const [pwd, setPwd] = useState(''); const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false);
  async function go(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    const { error } = await createClient().auth.signInWithPassword({ email, password: pwd });
    setBusy(false);
    if (error) { setErr('Email ou mot de passe incorrect.'); return; }
    r.push('/programme'); r.refresh();
  }
  return (
    <main className="login-shell">
      <section className="login-editorial"><div><p className="text-2xl font-semibold tracking-tight">VFA / ATI</p><p className="text-[10px] tracking-[.18em] uppercase text-white/60 mt-2">Fine art logistics</p></div><div><p className="text-xs uppercase tracking-[.18em] text-white/50 mb-6">L’exigence, à chaque étape.</p><h1>Chaque œuvre.<br/>Chaque mouvement.</h1><p className="text-white/60 text-sm mt-8 max-w-xs leading-relaxed">Un espace commun pour préparer, coordonner et suivre vos opérations.</p></div><footer className="text-xs text-white/40">Vulcan Fine Art · Art Transit International</footer></section>
      <section className="login-form-area"><form onSubmit={go} className="w-full max-w-sm mx-auto space-y-6">
        <div className="pb-4"><p className="text-xs uppercase tracking-[.15em] text-mute mb-4">Espace opérations</p><h2 className="text-3xl font-semibold">Connexion</h2><p className="text-sm text-mute mt-3">Retrouvez vos demandes, votre planning et vos missions.</p></div>
        <Field label="Email"><Input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus /></Field>
        <Field label="Mot de passe"><Input type="password" value={pwd} onChange={e => setPwd(e.target.value)} required /></Field>
        {err && <p className="text-sm text-brick">{err}</p>}
        <Button type="submit" className="w-full" disabled={busy}>{busy ? 'Connexion…' : 'Se connecter'}</Button>
      </form></section>
    </main>
  );
}
