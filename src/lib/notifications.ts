import type { SupabaseClient } from '@supabase/supabase-js';
export type Notification = { id: string; titre: string; message: string | null; demande_id: string | null; lu_le: string | null; created_at: string };

// One owner per provider; each effect gets a fresh topic, including StrictMode remounts.
export function watchNotifications(db: SupabaseClient, userId: string, onItems: (items: Notification[]) => void, onError: (message: string | null) => void) {
  let alive = true, request = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  async function refresh() {
    const version = ++request;
    try {
      const { data, error } = await db.from('notifications').select('*').eq('destinataire_id', userId).order('created_at', { ascending: false }).limit(20);
      if (!alive || version !== request) return;
      if (error) throw error;
      onItems((data ?? []) as Notification[]);
      onError(null);
    } catch {
      if (alive && version === request) onError('Impossible de charger les notifications. Réessayez.');
    }
  }
  const channel = db.channel(`notif:${userId}:${crypto.randomUUID()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `destinataire_id=eq.${userId}` }, () => {
      if (!alive) return;
      ++request; // Invalidate a snapshot that started before this database change.
      clearTimeout(timer);
      timer = setTimeout(() => { void refresh(); }, 100);
    });
  channel.subscribe(status => {
    if (!alive) return;
    if (status === 'SUBSCRIBED') void refresh(); // Catch changes between initial fetch and subscription.
    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') onError('Notifications en direct indisponibles. Vous pouvez actualiser la liste.');
  });
  void refresh();
  return {
    refresh,
    dispose() {
      if (!alive) return;
      alive = false;
      ++request;
      clearTimeout(timer);
      void db.removeChannel(channel).catch(() => {});
    },
  };
}
