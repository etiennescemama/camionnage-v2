'use client';
import { useEffect, useState } from 'react';
import { cn, fmtDate } from '@/lib/utils';

export type Creneau = { jour: string; demi: 'matin' | 'apres_midi'; camions_libres: number; hommes_libres: number; camions_ids: string[] };

export function useCreneaux(from: string, to: string, volume: number, hayon: boolean, clim: boolean, duree: number, enabled=true) {
  const [data, setData] = useState<Creneau[]>([]); const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setData([]); setError(null);
    if (!enabled || !from || !to || from.includes('NaN') || to.includes('NaN')) { setLoading(false); return; }
    let alive = true; const controller = new AbortController(); setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/creneaux?from=${from}&to=${to}&volume=${volume}&hayon=${hayon ? 1 : 0}&clim=${clim ? 1 : 0}&duree=${duree}`, { signal: controller.signal });
        if (!response.ok) throw new Error('Disponibilités indisponibles. Réessayez en changeant la date.');
        const result = await response.json();
        if (alive) setData(result.creneaux ?? []);
      } catch (e) { if (alive && !controller.signal.aborted) setError(e instanceof Error ? e.message : 'Disponibilités indisponibles.'); }
      finally { if (alive) setLoading(false); }
    }, 300);
    return () => { alive = false; clearTimeout(timer); controller.abort(); };
  }, [from, to, volume, hayon, clim, duree, enabled]);
  return { data, loading, error };
}

function tone(c: number, need: number) {
  if (c <= 0) return 'bg-brick-soft text-brick border-brick/30';
  if (c < need) return 'bg-ochre-soft text-ochre border-ochre/30';
  return 'bg-moss-soft text-moss border-moss/30';
}

export function CreneauxGrid({ data, loading, selected, onSelect, hommes = 2, camions = 1 }: {
  data: Creneau[]; loading: boolean; selected?: { jour: string; demi: string } | null; onSelect?: (c: Creneau) => void; hommes?: number; camions?: number;
}) {
  const jours = Array.from(new Set(data.map(d => d.jour)));
  if (loading && data.length === 0) return <p className="text-sm text-mute">Calcul des disponibilités…</p>;
  if (jours.length === 0) return <p className="text-sm text-mute">Choisissez une date pour voir les créneaux libres.</p>;
  return (
    <div className="overflow-x-auto">
      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${jours.length}, minmax(96px, 1fr))` }}>
        {jours.map(j => <div key={j} className="text-xs text-mute text-center pb-1">{fmtDate(j, { weekday: 'short', day: 'numeric' })}</div>)}
        {(['matin', 'apres_midi'] as const).map(demi => jours.map(j => {
          const c = data.find(d => d.jour === j && d.demi === demi);
          if (!c) return <div key={j + demi} />;
          const isSel = selected?.jour === j && selected?.demi === demi;
          return (
            <button type="button" key={j + demi} onClick={() => onSelect?.(c)} disabled={!onSelect}
              className={cn('rounded-md border px-2 py-1.5 text-left text-xs leading-tight transition-colors', tone(camions === 0 ? (c.hommes_libres >= hommes ? 1 : 0) : Math.min(Math.floor(c.camions_libres / camions), Math.floor(c.hommes_libres / Math.max(1, hommes))), 1), isSel && 'ring-2 ring-cobalt', onSelect && 'hover:brightness-95')}>
              <div className="font-medium">{demi === 'matin' ? 'Matin' : 'Après-midi'}</div>
              <div>{c.camions_libres} camion{c.camions_libres > 1 ? 's' : ''} · {c.hommes_libres} h.</div>
            </button>
          );
        }))}
      </div>
      <p className="mt-2 text-xs text-mute">Vert : {camions > 1 ? `${camions} camions` : 'camion'} et {hommes} équipiers disponibles · Orange ou rouge : moyens insuffisants sur ce créneau.</p>
    </div>
  );
}
