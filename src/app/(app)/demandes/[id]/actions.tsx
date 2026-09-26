'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { Check, ThumbsDown, CheckCheck, XCircle, Send } from 'lucide-react';
import type { DemandeEtat } from '@/lib/types';
export function DemandeActions({ id, numero, etat, isDispatch, isOwner }: { id: string; numero: string; etat: DemandeEtat; isDispatch: boolean; isOwner: boolean }) {
  const r = useRouter(); const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  const [refus, setRefus] = useState(false); const [motif, setMotif] = useState('');
  async function act(action: string, m?: string) {
    setBusy(true); setErr(null);
    const res = await fetch(`/api/demandes/${id}/action`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, motif: m }) });
    setBusy(false); if (!res.ok) { setErr((await res.json()).error ?? 'Erreur'); return; }
    setRefus(false); r.refresh();
  }
  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap gap-2 justify-end">
        {isDispatch && etat === 'envoyee' && <><Button onClick={() => act('accepter')} disabled={busy}><Check className="h-4 w-4" />Accepter</Button><Button variant="secondary" onClick={() => setRefus(true)} disabled={busy}><ThumbsDown className="h-4 w-4" />Refuser</Button></>}
        {isOwner && etat === 'refusee' && <Button onClick={() => act('renvoyer')} disabled={busy}><Send className="h-4 w-4" />Renvoyer au dispatch</Button>}
        {(isOwner || isDispatch) && !['terminee', 'annulee'].includes(etat) && <Button variant="ghost" onClick={() => confirm(`Annuler la demande ${numero} ?`) && act('annuler')} disabled={busy} className="text-brick"><XCircle className="h-4 w-4" />Annuler</Button>}
      </div>
      {err && <p className="text-sm text-brick">{err}</p>}
      {refus && <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={() => !busy && setRefus(false)}>
        <div className="w-full max-w-md rounded-lg bg-paper p-5 space-y-3" onClick={e => e.stopPropagation()}>
          <h2 className="font-semibold">Refuser {numero}</h2><p className="text-sm text-mute">Le coordinateur reçoit le motif et peut modifier puis renvoyer sa demande.</p>
          <Textarea value={motif} onChange={e => setMotif(e.target.value)} placeholder="Motif (obligatoire)" autoFocus />
          <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setRefus(false)}>Annuler</Button><Button variant="danger" onClick={() => act('refuser', motif)} disabled={busy || !motif.trim()}>Confirmer le refus</Button></div>
        </div></div>}
    </div>
  );
}
