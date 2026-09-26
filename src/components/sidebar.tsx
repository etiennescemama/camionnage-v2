'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { CalendarRange, Inbox, ListTodo, Settings2, Users, LogOut, Smartphone, FileOutput } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { Utilisateur } from '@/lib/types';
import { ROLE_LABEL } from '@/lib/types';
import { Bell } from './bell';
const NAV = [
  { href: '/programme', label: 'Mon programme', icon: ListTodo, roles: ['coordinateur','dispatcheur','gm','emballage','direction','admin'] },
  { href: '/demandes', label: 'Demandes', icon: Inbox, roles: ['coordinateur','dispatcheur','gm','emballage','direction','admin'] },
  { href: '/planning', label: 'Planning', icon: CalendarRange, roles: ['coordinateur','dispatcheur','gm','emballage','direction','admin'] },
  { href: '/integrations', label: 'Exports & API', icon: FileOutput, roles: ['coordinateur','dispatcheur','gm','emballage','direction','admin'] },
  { href: '/mobile', label: 'Vue chauffeur', icon: Smartphone, roles: ['dispatcheur','admin'] },
  { href: '/admin/referentiels', label: 'Référentiels', icon: Settings2, roles: ['dispatcheur','admin'] },
  { href: '/admin/utilisateurs', label: 'Utilisateurs', icon: Users, roles: ['admin'] },
];
export function MobileBars({ user }: { user: Utilisateur }) {
  const path = usePathname(); const r = useRouter();
  const items = NAV.filter(n => n.roles.includes(user.role) && !n.href.startsWith('/admin/utilisateurs')).slice(0, 5);
  return (<>
    <header className="no-print md:hidden fixed top-0 inset-x-0 z-30 h-12 bg-paper border-b border-line flex items-center justify-between px-3" style={{ paddingTop: 'env(safe-area-inset-top)', height: 'calc(48px + env(safe-area-inset-top))' }}>
      <span className="font-semibold tracking-tight">VFA / ATI <span className="font-normal text-xs ml-2 opacity-60">Opérations</span></span>
      <div className="flex items-center gap-1"><Bell /><button onClick={async () => { await createClient().auth.signOut(); r.push('/login'); r.refresh(); }} className="h-8 w-8 grid place-items-center text-mute" aria-label="Se déconnecter"><LogOut className="h-4 w-4" /></button></div>
    </header>
    <nav className="no-print md:hidden fixed bottom-0 inset-x-0 z-30 bg-paper border-t border-line grid" style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)`, paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {items.map(n => { const active = path === n.href || path.startsWith(n.href + '/'); return (
        <Link key={n.href} href={n.href} aria-current={active?'page':undefined} className={cn('flex flex-col items-center gap-0.5 py-2 text-[10px]', active ? 'text-cobalt-ink' : 'text-mute')}><n.icon className="h-5 w-5" />{n.label.replace('Mon programme', 'Programme').replace('Vue chauffeur', 'Chauffeur').replace('Référentiels', 'Réf.')}</Link>); })}
    </nav>
  </>);
}

export function Sidebar({ user }: { user: Utilisateur }) {
  const path = usePathname(); const r = useRouter();
  return (
    <aside className="app-sidebar hidden md:flex w-60 shrink-0 flex-col sticky top-0 h-screen">
      <div className="px-6 pt-8 pb-7">
        <Link href="/programme" className="block text-white"><span className="block text-2xl font-semibold tracking-tight">VFA / ATI</span><span className="block text-[10px] tracking-[.18em] uppercase mt-2 text-white/60">Fine art logistics</span></Link>
      </div>
      <div className="px-6 pb-4 text-[10px] uppercase tracking-[.16em] text-white/40">Espace opérations</div>
      <nav className="px-3 flex-1 space-y-1">
        {NAV.filter(n => n.roles.includes(user.role)).map(n => {
          const active = path === n.href || path.startsWith(n.href + '/');
          return <Link key={n.href} href={n.href} aria-current={active?'page':undefined} className={cn('flex items-center gap-3 rounded-md px-3 py-3 text-sm transition-colors', active ? 'bg-white/10 text-white font-medium' : 'text-white/60 hover:bg-white/5 hover:text-white')}><n.icon className="h-4 w-4" />{n.label}</Link>;
        })}
      </nav>
      <div className="mx-5 py-5 border-t border-white/10 text-sm text-white">
        <div className="font-medium truncate">{user.prenom} {user.nom}</div>
        <div className="text-xs text-white/50 mt-1">{ROLE_LABEL[user.role]}</div>
        <button onClick={async () => { await createClient().auth.signOut(); r.push('/login'); r.refresh(); }} className="mt-4 inline-flex items-center gap-1.5 text-xs text-white/50 hover:text-white"><LogOut className="h-3.5 w-3.5" />Se déconnecter</button>
      </div>
    </aside>
  );
}

export function WorkspaceBar(){
 const path=usePathname();const section=NAV.find(n=>path===n.href||path.startsWith(n.href+'/'));
 return <div className="workspace-bar hidden md:flex items-center justify-between border-b border-line bg-paper px-8 h-16"><div className="text-xs text-mute">Opérations <span className="mx-3 text-line">/</span><span className="text-ink font-medium">{section?.label??'Dossier'}</span></div><div className="flex items-center gap-5"><span className="text-[10px] uppercase tracking-[.12em] text-mute">Vulcan Fine Art · Art Transit International</span><Bell/></div></div>;
}
