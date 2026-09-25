'use client';
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { watchNotifications, type Notification } from '@/lib/notifications';
type State = { items: Notification[]; error: string | null; marking: boolean; refresh: () => void; markAll: () => Promise<void> };
const Context = createContext<State | null>(null);
export function NotificationsProvider({ userId, children }: { userId: string; children: React.ReactNode }) {
  const db = useMemo(() => createClient(), []);
  const [items, setItems] = useState<Notification[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [marking, setMarking] = useState(false);
  const watcher = useRef<ReturnType<typeof watchNotifications> | null>(null);
  useEffect(() => {
    setItems([]); setError(null);
    const subscription = watchNotifications(db, userId, setItems, setError);
    watcher.current = subscription;
    return () => { watcher.current = null; subscription.dispose(); };
  }, [db, userId]);
  async function markAll() {
    if (marking) return;
    setMarking(true);
    try {
      const { error: failure } = await db.from('notifications').update({ lu_le: new Date().toISOString() }).eq('destinataire_id', userId).is('lu_le', null);
      if (failure) throw failure;
      await watcher.current?.refresh();
    } catch { setError('Les notifications n’ont pas été marquées comme lues. Réessayez.'); }
    finally { setMarking(false); }
  }
  return <Context.Provider value={{ items, error, marking, markAll, refresh: () => { void watcher.current?.refresh(); } }}>{children}</Context.Provider>;
}
export function useNotifications() {
  const value = useContext(Context);
  if (!value) throw new Error('NotificationsProvider manquant');
  return value;
}
