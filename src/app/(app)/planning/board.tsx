'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { cn, addDays, fmtDate, fmtHeure, minToH, todayYmd } from '@/lib/utils';
import type { Camion } from '@/lib/types';
import { ChevronLeft, ChevronRight, Truck, Users, GripVertical } from 'lucide-react';

const H0 = 7, H1 = 19, HOURS = H1 - H0; // 7h → 19h
type Op = any; type Cap = { jour: string; demi: string; camions_libres: number; hommes_libres: number };

function tMin(t?: string | null) { if (!t) return 8 * 60; const [h, m] = t.split(':').map(Number); return h * 60 + m; }
function pct(min: number) { return ((min - H0 * 60) / (HOURS * 60)) * 100; }
function snap(min: number) { return Math.round(min / 15) * 15; }
function hhmm(min: number) { return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}:00`; }

export function Board({ date, vue, from, to, camions, ops, aPlanifier, indispos, capacite, nbEquipiers, canEdit }: {
  date: string; vue: 'jour' | 'semaine' | 'mois'; from: string; to: string; camions: Camion[]; ops: Op[]; aPlanifier: Op[]; indispos: any[]; capacite: Cap[]; nbEquipiers: number; canEdit: boolean;
}) {
  const r = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const go = (d: string, v = vue) => r.push(`/planning?vue=${v}&date=${d}`);
  const step = vue === 'jour' ? 1 : vue === 'semaine' ? 7 : 30;

  async function place(opId: string, camion_id: string | null, date_prevue: string, heureMin?: number) {
    if (!canEdit) return; setBusy(opId); setErr(null);
    const body: any = { camion_id, date_prevue };
    if (heureMin !== undefined) body.heure_debut = hhmm(snap(heureMin));
    else { const op = [...ops, ...aPlanifier].find(o => o.id === opId); if (!op?.heure_debut) body.heure_debut = '08:00:00'; }
    const res = await fetch(`/api/operations/${opId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    setBusy(null); if (!res.ok) { setErr((await res.json()).error ?? 'Erreur'); return; }
    r.refresh();
  }

  const days = useMemo(() => { const a: string[] = []; for (let d = from; d <= to; d = addDays(d, 1)) a.push(d); return a; }, [from, to]);
  const isIndispo = (camionId: string, d: string) => indispos.some(i => i.camion_id === camionId && d >= i.date_debut && d <= i.date_fin);
  const capOf = (d: string, demi: string) => capacite.find(c => c.jour === d && c.demi === demi);

  // hommes affectés le jour sélectionné
  const hommesJour = useMemo(() => new Set(ops.filter(o => o.date_prevue === date).flatMap(o => (o.equipiers ?? []).map((e: any) => e.equipier_id))).size, [ops, date]);
  const hommesDemandes = useMemo(() => ops.filter(o => o.date_prevue === date).reduce((s, o) => s + (o.demande?.nb_hommes ?? 0), 0), [ops, date]);

  const titre = vue === 'jour' ? fmtDate(date, { weekday: 'long', day: 'numeric', month: 'long' })
    : vue === 'semaine' ? `Semaine du ${fmtDate(from, { day: 'numeric', month: 'long' })}`
    : new Date(date + 'T12:00:00').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  return (
    <div className="p-6 max-w-[1700px] mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => go(addDays(date, -step))} aria-label="Précédent"><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="secondary" size="sm" onClick={() => go(todayYmd())}>Aujourd'hui</Button>
          <Button variant="secondary" size="sm" onClick={() => go(addDays(date, step))} aria-label="Suivant"><ChevronRight className="h-4 w-4" /></Button>
          <input type="date" value={date} onChange={e => go(e.target.value)} className="h-8 rounded-md border border-line bg-paper px-2 text-sm" />
          <h1 className="ml-2 text-xl font-semibold capitalize">{titre}</h1>
        </div>
        <div className="inline-flex rounded-md border border-line bg-paper p-0.5 text-sm">
          {(['jour', 'semaine', 'mois'] as const).map(v => <button key={v} onClick={() => go(date, v)} className={cn('rounded px-3 py-1 capitalize', vue === v ? 'bg-ink text-white' : 'hover:bg-fog')}>{v}</button>)}
        </div>
      </div>

      {vue === 'jour' && (
        <div className="mb-3 flex flex-wrap gap-4 text-sm">
          <Gauge icon={<Truck className="h-4 w-4" />} label="Camions occupés" val={new Set(ops.filter(o => o.date_prevue === date && o.camion_id).map(o => o.camion_id)).size} max={camions.length} />
          <Gauge icon={<Users className="h-4 w-4" />} label="Équipiers affectés" val={hommesJour} max={nbEquipiers} hint={hommesDemandes ? `${hommesDemandes} demandés` : undefined} />
          {(['matin', 'apres_midi'] as const).map(demi => { const c = capOf(date, demi); return c ? <span key={demi} className="inline-flex items-center gap-2 rounded-md border border-line bg-paper px-3 py-1.5"><span className="text-mute">{demi === 'matin' ? 'Matin' : 'Après-midi'}</span><strong>{c.camions_libres}</strong> camions libres · <strong>{c.hommes_libres}</strong> h.</span> : null; })}
        </div>
      )}
      {err && <p className="mb-3 rounded-md bg-brick-soft text-brick text-sm p-2">{err}</p>}

      <div className={cn('grid gap-4', canEdit && vue !== 'mois' && 'lg:grid-cols-[1fr_300px]')}>
        <div className="min-w-0">
          {vue === 'jour' && <DayGrid date={date} camions={camions} ops={ops.filter(o => o.date_prevue === date)} isIndispo={isIndispo} canEdit={canEdit} busy={busy} dragId={dragId} setDragId={setDragId} place={place} />}
          {vue === 'semaine' && <WeekGrid days={days} camions={camions} ops={ops} isIndispo={isIndispo} capOf={capOf} canEdit={canEdit} busy={busy} dragId={dragId} setDragId={setDragId} place={place} go={go} />}
          {vue === 'mois' && <MonthGrid date={date} days={days} ops={ops} capOf={capOf} nbCamions={camions.length} go={go} />}
        </div>
        {canEdit && vue !== 'mois' && (
          <aside className="rounded-lg border border-line bg-paper self-start lg:sticky lg:top-6">
            <div className="px-4 py-3 border-b border-line"><h2 className="font-semibold">À planifier <span className="text-mute font-normal">({aPlanifier.length})</span></h2><p className="text-xs text-mute">Glissez une opération sur un camion.</p></div>
            <div className="max-h-[70vh] overflow-y-auto divide-y divide-line">
              {aPlanifier.length === 0 && <p className="p-4 text-sm text-mute">Rien en attente. Les demandes acceptées apparaissent ici.</p>}
              {aPlanifier.map(o => (
                <div key={o.id} draggable onDragStart={e => { setDragId(o.id); e.dataTransfer.effectAllowed = 'move'; }} onDragEnd={() => setDragId(null)}
                  className={cn('flex gap-2 p-3 text-sm cursor-grab active:cursor-grabbing hover:bg-fog', busy === o.id && 'opacity-50')}>
                  <GripVertical className="h-4 w-4 text-mute shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <div className="font-medium truncate">{o.demande?.client?.nom ?? 'Sans client'}</div>
                    <div className="text-xs text-mute">{o.libelle} · {minToH(o.duree_min ?? 120)}</div>
                    <div className="text-xs text-mute">{fmtDate(o.date_prevue)} · {o.demande?.type_camion ? o.demande.type_camion + ' m³' : '—'}{o.demande?.besoin_hayon ? ', hayon' : ''} · {o.demande?.nb_hommes} h.</div>
                    <Link href={`/demandes/${o.demande?.id}`} className="text-xs text-cobalt hover:underline">{o.demande?.numero}</Link>
                  </div>
                </div>
              ))}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}

function Gauge({ icon, label, val, max, hint }: { icon: React.ReactNode; label: string; val: number; max: number; hint?: string }) {
  const p = max ? Math.min(100, (val / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3 rounded-md border border-line bg-paper px-3 py-1.5">
      <span className="text-mute">{icon}</span><span className="text-mute">{label}</span>
      <div className="w-28 h-2 rounded-full bg-fog overflow-hidden"><div className={cn('h-full', p >= 100 ? 'bg-brick' : p >= 75 ? 'bg-ochre' : 'bg-moss')} style={{ width: `${p}%` }} /></div>
      <strong>{val}/{max}</strong>{hint && <span className="text-xs text-mute">{hint}</span>}
    </div>
  );
}

function OpBlock({ op, dragging, onDragStart, onDragEnd, compact }: { op: Op; dragging: boolean; onDragStart?: (e: React.DragEvent) => void; onDragEnd?: () => void; compact?: boolean }) {
  const eq = (op.equipiers ?? []).length, need = op.demande?.nb_hommes ?? 0;
  const done = op.etat === 'terminee', live = op.etat === 'en_route' || op.etat === 'sur_site';
  return (
    <div draggable={!!onDragStart} onDragStart={onDragStart} onDragEnd={onDragEnd}
      className={cn('rounded-md border-l-4 px-2 py-1 text-xs leading-tight overflow-hidden', done ? 'bg-fog border-l-mute text-mute' : live ? 'bg-cobalt-soft border-l-cobalt' : eq >= need && need > 0 ? 'bg-moss-soft border-l-moss' : 'bg-ochre-soft border-l-ochre', dragging && 'opacity-40', onDragStart && 'cursor-grab')}>
      <Link href={`/demandes/${op.demande?.id}`} className="font-medium truncate block hover:underline">{fmtHeure(op.heure_debut)} {op.demande?.client?.nom ?? '—'}</Link>
      {!compact && <div className="truncate text-mute">{op.libelle} · {eq}/{need} h.{(op.equipiers ?? []).length ? ' · ' + op.equipiers.map((e: any) => e.equipier?.prenom).join(', ') : ''}</div>}
    </div>
  );
}

function DayGrid({ date, camions, ops, isIndispo, canEdit, busy, dragId, setDragId, place }: any) {
  const hours = Array.from({ length: HOURS }, (_, i) => H0 + i);
  function onDrop(e: React.DragEvent<HTMLDivElement>, camionId: string) {
    e.preventDefault(); if (!dragId) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const min = H0 * 60 + ((e.clientX - rect.left) / rect.width) * HOURS * 60;
    place(dragId, camionId, date, Math.max(H0 * 60, Math.min(H1 * 60 - 30, min)));
    setDragId(null);
  }
  return (
    <div className="rounded-lg border border-line bg-paper overflow-x-auto">
      <div className="min-w-[900px]">
        <div className="grid border-b border-line text-xs text-mute" style={{ gridTemplateColumns: `160px repeat(${HOURS}, 1fr)` }}>
          <div className="px-3 py-2">Camion</div>{hours.map(h => <div key={h} className="px-1 py-2 border-l border-line">{h}h</div>)}
        </div>
        {camions.map((c: Camion) => {
          const mine = ops.filter((o: Op) => o.camion_id === c.id);
          const load = mine.reduce((s: number, o: Op) => s + (o.duree_min ?? 120), 0);
          const off = isIndispo(c.id, date);
          return (
            <div key={c.id} className="grid border-b border-line last:border-0" style={{ gridTemplateColumns: `160px 1fr` }}>
              <div className="px-3 py-2 border-r border-line">
                <div className="font-medium text-sm">{c.numero}</div>
                <div className="text-xs text-mute">{c.volume_m3 ?? '?'} m³{c.hayon ? ' · hayon' : ''}{c.climatise ? ' · clim' : ''}</div>
                <div className="mt-1 h-1.5 w-full rounded-full bg-fog overflow-hidden"><div className={cn('h-full', load > 9 * 60 ? 'bg-brick' : load > 7 * 60 ? 'bg-ochre' : 'bg-moss')} style={{ width: `${Math.min(100, (load / (9 * 60)) * 100)}%` }} /></div>
                <div className="text-[11px] text-mute">{minToH(load)} / 9h{off ? ' · indisponible' : ''}</div>
              </div>
              <div className={cn('relative min-h-[64px]', off && 'bg-fog/70 bg-[repeating-linear-gradient(45deg,transparent,transparent_6px,rgba(0,0,0,.04)_6px,rgba(0,0,0,.04)_12px)]')}
                onDragOver={e => { if (canEdit && !off) e.preventDefault(); }} onDrop={e => !off && onDrop(e, c.id)}>
                <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${HOURS}, 1fr)` }}>{hours.map(h => <div key={h} className="border-l border-line/60 slot" />)}</div>
                {mine.map((o: Op) => { const s = tMin(o.heure_debut), d = o.duree_min ?? 120; return (
                  <div key={o.id} className="op-block" style={{ left: `${pct(s)}%`, width: `${Math.max(4, (d / (HOURS * 60)) * 100)}%` }}>
                    <OpBlock op={o} dragging={dragId === o.id || busy === o.id} onDragStart={canEdit ? (e: React.DragEvent) => { setDragId(o.id); e.dataTransfer.effectAllowed = 'move'; } : undefined} onDragEnd={() => setDragId(null)} />
                  </div>); })}
              </div>
            </div>
          );
        })}
        {camions.length === 0 && <p className="p-6 text-sm text-mute">Aucun camion actif. Ajoutez votre flotte dans Référentiels.</p>}
      </div>
    </div>
  );
}

function WeekGrid({ days, camions, ops, isIndispo, capOf, canEdit, busy, dragId, setDragId, place, go }: any) {
  return (
    <div className="rounded-lg border border-line bg-paper overflow-x-auto">
      <div className="min-w-[1000px]">
        <div className="grid border-b border-line" style={{ gridTemplateColumns: `160px repeat(${days.length}, 1fr)` }}>
          <div className="px-3 py-2 text-xs text-mute">Camion</div>
          {days.map((d: string) => { const m = capOf(d, 'matin'), a = capOf(d, 'apres_midi'); const we = new Date(d + 'T12:00:00').getDay() % 6 === 0; return (
            <button key={d} onClick={() => go(d, 'jour')} className={cn('px-2 py-2 text-left border-l border-line hover:bg-fog', d === todayYmd() && 'bg-cobalt-soft/40', we && 'text-mute')}>
              <div className="text-sm font-medium capitalize">{fmtDate(d)}</div>
              {m && a && <div className="text-[11px] text-mute">libres : {m.camions_libres} / {a.camions_libres} camions · {m.hommes_libres} / {a.hommes_libres} h.</div>}
            </button>); })}
        </div>
        {camions.map((c: Camion) => (
          <div key={c.id} className="grid border-b border-line last:border-0" style={{ gridTemplateColumns: `160px repeat(${days.length}, 1fr)` }}>
            <div className="px-3 py-2 border-r border-line"><div className="font-medium text-sm">{c.numero}</div><div className="text-xs text-mute">{c.volume_m3 ?? '?'} m³{c.hayon ? ' · hayon' : ''}</div></div>
            {days.map((d: string) => { const off = isIndispo(c.id, d); const mine = ops.filter((o: Op) => o.camion_id === c.id && o.date_prevue === d).sort((x: Op, y: Op) => (x.heure_debut ?? '').localeCompare(y.heure_debut ?? '')); return (
              <div key={d} className={cn('min-h-[72px] border-l border-line p-1 space-y-1 slot', off && 'bg-fog/70')}
                onDragOver={e => { if (canEdit && !off) e.preventDefault(); }} onDrop={e => { e.preventDefault(); if (dragId && !off) { place(dragId, c.id, d); setDragId(null); } }}>
                {mine.map((o: Op) => <OpBlock key={o.id} op={o} compact dragging={dragId === o.id || busy === o.id} onDragStart={canEdit ? (e: React.DragEvent) => { setDragId(o.id); e.dataTransfer.effectAllowed = 'move'; } : undefined} onDragEnd={() => setDragId(null)} />)}
              </div>); })}
          </div>
        ))}
      </div>
    </div>
  );
}

function MonthGrid({ date, days, ops, capOf, nbCamions, go }: any) {
  const first = new Date(days[0] + 'T12:00:00'); const lead = (first.getDay() + 6) % 7;
  const cells = [...Array(lead).fill(null), ...days];
  return (
    <div className="rounded-lg border border-line bg-paper p-3">
      <div className="grid grid-cols-7 gap-1 text-xs text-mute mb-1">{['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(d => <div key={d} className="px-1">{d}</div>)}</div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((d: string | null, i: number) => {
          if (!d) return <div key={i} />;
          const n = ops.filter((o: Op) => o.date_prevue === d).length; const m = capOf(d, 'matin'), a = capOf(d, 'apres_midi');
          const libres = m && a ? Math.min(m.camions_libres, a.camions_libres) : null;
          const tone = libres === null ? 'bg-fog' : libres === 0 ? 'bg-brick-soft' : libres <= Math.ceil(nbCamions * 0.25) ? 'bg-ochre-soft' : 'bg-moss-soft';
          return (
            <button key={d} onClick={() => go(d, 'jour')} className={cn('h-20 rounded-md border border-line p-1.5 text-left hover:ring-2 hover:ring-cobalt', tone, d === todayYmd() && 'ring-2 ring-ink')}>
              <div className="text-sm font-medium">{Number(d.slice(8))}</div>
              {n > 0 && <div className="text-xs">{n} opération{n > 1 ? 's' : ''}</div>}
              {libres !== null && <div className="text-[11px] text-mute">{libres} camion{libres > 1 ? 's' : ''} libre{libres > 1 ? 's' : ''}</div>}
            </button>);
        })}
      </div>
    </div>
  );
}
