import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
export const cn = (...i: ClassValue[]) => twMerge(clsx(i));
export function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function addDays(s: string, n: number) { const d = new Date(s + 'T12:00:00'); if (Number.isNaN(d.getTime())) return ''; d.setDate(d.getDate() + n); return ymd(d); }
export function mondayOf(s: string) { const d = new Date(s + 'T12:00:00'); const dow = d.getDay(); return addDays(s, dow === 0 ? -6 : 1 - dow); }
export function fmtDate(s?: string | null, opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }) {
  if (!s) return '—'; return new Date(s + 'T12:00:00').toLocaleDateString('fr-FR', opts);
}
export function fmtHeure(t?: string | null) { return t ? t.slice(0, 5) : '—'; }
export function minToH(m: number) { const h = Math.floor(m / 60), r = m % 60; return r ? `${h}h${String(r).padStart(2, '0')}` : `${h}h`; }
export function todayYmd() { const parts = new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()); const p=(t:string)=>parts.find(x=>x.type===t)!.value;return `${p('year')}-${p('month')}-${p('day')}`; }
