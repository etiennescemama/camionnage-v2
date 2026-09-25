import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { NotificationsProvider } from '@/components/notifications-provider';
import { Sidebar, MobileBars } from '@/components/sidebar';
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await currentUser();
  if (!me) redirect('/login');
  if (me.role === 'chauffeur') {
    return <div className="min-h-screen bg-fog">{children}</div>;
  }
  return (
    <NotificationsProvider key={me.id} userId={me.id}><div className="min-h-screen flex">
      <Sidebar user={me} />
      <MobileBars user={me} />
      <main className="app-main flex-1 min-w-0">{children}</main>
    </div></NotificationsProvider>
  );
}
