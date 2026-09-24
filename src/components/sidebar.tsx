'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { CalendarRange, Inbox, ListTodo, Settings2, Users, LogOut, Smartphone } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { Utilisateur } from '@/lib/types';
import { ROLE_LABEL } from '@/lib/types';
import { Bell } from './bell';
const NAV = [
  { href: '/programme', label: 'Mon programme', icon: ListTodo, roles: ['coordinateur','dispatcheur','gm','emballage','direction','admin'] },
  { href: '/demandes', label: 'Demandes', icon: Inbox, roles: ['coordinateur','dispatcheur','gm','emballage','direction','admin'] },
  { href: '/planning', label: 'Planning', icon: CalendarRange, roles: ['coordinateur','dispatcheur','gm','emballage','direction','admin'] },
  { href: '/mobile', label: 'Vue chauffeur', icon: Smartphone, roles: ['dispatcheur','admin'] },
  { href: '/admin/referentiels', label: 'Référentiels', icon: Settings2, roles: ['dispatcheur','admin'] },
  { href: '/admin/utilisateurs', label: 'Utilisateurs', icon: Users, roles: ['admin'] },
];
export function Sidebar({ user }: { user: Utilisateur }) {
  const path = usePathname(); const r = useRouter();
  return (
    <aside className="w-56 shrink-0 border-r border-line bg-paper flex flex-col">
      <div className="h-14 px-4 flex items-center justify-between border-b border-line">
        <span className="font-semibold">Camionnage</span>
        <Bell userId={user.id} />
      </div>
      <nav className="p-2 flex-1 space-y-0.5">
        {NAV.filter(n => n.roles.includes(user.role)).map(n => {
          const active = path === n.href || path.startsWith(n.href + '/');
          return <Link key={n.href} href={n.href} className={cn('flex items-center gap-2.5 rounded-md px-3 py-2 text-sm', active ? 'bg-cobalt-soft text-cobalt-ink font-medium' : 'text-ink hover:bg-fog')}><n.icon className="h-4 w-4" />{n.label}</Link>;
        })}
      </nav>
      <div className="p-3 border-t border-line text-sm">
        <div className="font-medium truncate">{user.prenom} {user.nom}</div>
        <div className="text-xs text-mute">{ROLE_LABEL[user.role]}</div>
        <button onClick={async () => { await createClient().auth.signOut(); r.push('/login'); r.refresh(); }} className="mt-2 inline-flex items-center gap-1.5 text-xs text-mute hover:text-ink"><LogOut className="h-3.5 w-3.5" />Se déconnecter</button>
      </div>
    </aside>
  );
}
