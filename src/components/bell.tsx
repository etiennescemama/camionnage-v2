'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell as BellIcon, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
type N = { id: string; titre: string; message: string | null; demande_id: string | null; lu_le: string | null; created_at: string };
export function Bell({ userId }: { userId: string }) {
  const r = useRouter(); const supabase = createClient();
  const [open, setOpen] = useState(false); const [items, setItems] = useState<N[]>([]);
  useEffect(() => {
    supabase.from('notifications').select('*').eq('destinataire_id', userId).order('created_at', { ascending: false }).limit(20).then(({ data }) => setItems((data ?? []) as N[]));
    const ch = supabase.channel('notif:' + userId + ':' + Math.random().toString(36).slice(2)).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `destinataire_id=eq.${userId}` }, p => setItems(prev => [p.new as N, ...prev].slice(0, 20))).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId]); // eslint-disable-line
  const unread = items.filter(i => !i.lu_le).length;
  async function markAll() { await supabase.from('notifications').update({ lu_le: new Date().toISOString() }).eq('destinataire_id', userId).is('lu_le', null); setItems(items.map(i => ({ ...i, lu_le: i.lu_le ?? new Date().toISOString() }))); }
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="relative h-8 w-8 grid place-items-center rounded-md hover:bg-fog" aria-label="Notifications">
        <BellIcon className="h-4 w-4" />{unread > 0 && <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-brick text-white text-[10px] grid place-items-center">{unread}</span>}
      </button>
      {open && <>
        <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
        <div className="absolute right-0 md:left-0 md:right-auto top-9 z-50 w-[min(20rem,calc(100vw-1.5rem))] rounded-lg border border-line bg-paper shadow-lg">
          <div className="flex items-center justify-between px-3 py-2 border-b border-line text-sm"><span className="font-medium">Notifications</span>{unread > 0 && <button onClick={markAll} className="text-xs text-cobalt">Tout marquer lu</button>}<button onClick={() => setOpen(false)}><X className="h-4 w-4" /></button></div>
          <div className="max-h-96 overflow-y-auto divide-y divide-line">
            {items.length === 0 && <p className="p-4 text-sm text-mute">Rien à signaler.</p>}
            {items.map(n => <button key={n.id} onClick={() => { setOpen(false); if (n.demande_id) r.push('/demandes/' + n.demande_id); }} className={`block w-full text-left p-3 hover:bg-fog ${!n.lu_le ? 'bg-cobalt-soft/40' : ''}`}><div className="text-sm font-medium">{n.titre}</div>{n.message && <div className="text-xs text-mute mt-0.5">{n.message}</div>}</button>)}
          </div>
        </div>
      </>}
    </div>
  );
}
