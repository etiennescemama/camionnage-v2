import { cn } from '@/lib/utils';
import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
const base = 'w-full rounded-md border border-line bg-paper px-3 text-sm text-ink placeholder:text-mute focus:outline-none focus:border-cobalt focus:ring-2 focus:ring-cobalt-soft disabled:opacity-60';
export function Input({ className, ...p }: InputHTMLAttributes<HTMLInputElement>) { return <input className={cn(base, 'h-10', className)} {...p} />; }
export function Select({ className, ...p }: SelectHTMLAttributes<HTMLSelectElement>) { return <select className={cn(base, 'h-10', className)} {...p} />; }
export function Textarea({ className, ...p }: TextareaHTMLAttributes<HTMLTextAreaElement>) { return <textarea className={cn(base, 'py-2 min-h-[72px]', className)} {...p} />; }
export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return <label className="block space-y-1.5"><span className="text-sm text-ink">{label}</span>{children}{hint && <span className="block text-xs text-mute">{hint}</span>}</label>;
}
