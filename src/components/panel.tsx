import { cn } from '@/lib/utils';
export function Panel({ className, children, title, aside }: { className?: string; children: React.ReactNode; title?: string; aside?: React.ReactNode }) {
  return (
    <section className={cn('rounded-lg border border-line bg-paper', className)}>
      {(title || aside) && <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3"><h2 className="text-base font-semibold">{title}</h2>{aside}</header>}
      <div className="p-4">{children}</div>
    </section>
  );
}
