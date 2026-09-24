import { cn } from '@/lib/utils';
import { ETAT_CLASS, ETAT_LABEL, OP_ETAT_LABEL, type DemandeEtat, type OpEtat } from '@/lib/types';
export function Pill({ className, children }: { className?: string; children: React.ReactNode }) {
  return <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', className)}>{children}</span>;
}
export function EtatDemande({ etat }: { etat: DemandeEtat }) { return <Pill className={ETAT_CLASS[etat]}>{ETAT_LABEL[etat]}</Pill>; }
export function EtatOp({ etat }: { etat: OpEtat }) {
  const c: Record<OpEtat, string> = { a_planifier: 'bg-ochre-soft text-ochre', planifiee: 'bg-moss-soft text-moss', en_route: 'bg-cobalt-soft text-cobalt-ink', sur_site: 'bg-cobalt text-white', terminee: 'bg-moss text-white', annulee: 'bg-fog text-mute' };
  return <Pill className={c[etat]}>{OP_ETAT_LABEL[etat]}</Pill>;
}
