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
    <main className="min-h-screen grid place-items-center p-6">
      <form onSubmit={go} className="w-full max-w-sm rounded-lg border border-line bg-paper p-8 space-y-5">
        <div><div className="text-2xl font-semibold">Camionnage</div><div className="text-sm text-mute">Planning et ordres de transport</div></div>
        <Field label="Email"><Input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus /></Field>
        <Field label="Mot de passe"><Input type="password" value={pwd} onChange={e => setPwd(e.target.value)} required /></Field>
        {err && <p className="text-sm text-brick">{err}</p>}
        <Button type="submit" className="w-full" disabled={busy}>{busy ? 'Connexion…' : 'Se connecter'}</Button>
      </form>
    </main>
  );
}
