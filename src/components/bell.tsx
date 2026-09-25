'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell as BellIcon, X } from 'lucide-react';
import { useNotifications } from './notifications-provider';
export function Bell() {
  const r = useRouter();
  const [open, setOpen] = useState(false);
  const { items, error, marking, markAll, refresh } = useNotifications();
  const unread = items.filter(i => !i.lu_le).length;
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="relative h-8 w-8 grid place-items-center rounded-md hover:bg-fog" aria-label="Notifications" aria-expanded={open}>
        <BellIcon className="h-4 w-4" />{unread > 0 && <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-brick text-white text-[10px] grid place-items-center">{unread}</span>}
      </button>
      {open && <>
        <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
        <div className="absolute right-0 md:left-0 md:right-auto top-9 z-50 w-[min(20rem,calc(100vw-1.5rem))] rounded-lg border border-line bg-paper shadow-lg">
          <div className="flex items-center justify-between px-3 py-2 border-b border-line text-sm"><span className="font-medium">Notifications</span>{unread > 0 && <button disabled={marking} onClick={markAll} className="text-xs text-cobalt">{marking ? 'Enregistrement…' : 'Tout marquer lu'}</button>}<button aria-label="Fermer les notifications" onClick={() => setOpen(false)}><X className="h-4 w-4" /></button></div>
          {error && <p role="status" className="p-3 text-xs text-brick">{error}</p>}
          <button onClick={refresh} className="px-3 py-2 text-xs text-cobalt-ink">Actualiser</button>
          <div className="max-h-96 overflow-y-auto divide-y divide-line">
            {items.length === 0 && <p className="p-4 text-sm text-mute">Rien à signaler.</p>}
            {items.map(n => <button key={n.id} onClick={() => { setOpen(false); if (n.demande_id) r.push('/demandes/' + n.demande_id); }} className={`block w-full text-left p-3 hover:bg-fog ${!n.lu_le ? 'bg-cobalt-soft/40' : ''}`}><div className="text-sm font-medium">{n.titre}</div>{n.message && <div className="text-xs text-mute mt-0.5">{n.message}</div>}</button>)}
          </div>
        </div>
      </>}
    </div>
  );
}
