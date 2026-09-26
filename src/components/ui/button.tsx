import { cn } from '@/lib/utils';
import type { ButtonHTMLAttributes } from 'react';
type V = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
const V_CLASS: Record<V, string> = {
  primary: 'bg-cobalt text-white hover:bg-cobalt-ink',
  secondary: 'bg-paper text-ink border border-line hover:bg-fog',
  ghost: 'text-ink hover:bg-fog',
  danger: 'bg-brick text-white hover:opacity-90',
  success: 'bg-moss text-white hover:opacity-90',
};
export function Button({ className, variant = 'primary', size = 'md', ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: V; size?: 'sm' | 'md' }) {
  return <button className={cn('inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-cobalt', size === 'sm' ? 'h-8 px-3 text-sm' : 'h-11 px-5 text-sm', V_CLASS[variant], className)} {...p} />;
}
