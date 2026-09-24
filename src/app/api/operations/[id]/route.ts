import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { currentUser } from '@/lib/auth';
const SCHED = ['date_prevue', 'heure_debut', 'duree_min', 'camion_id', 'etat', 'consignes', 'adresse', 'libelle', 'heure_arrivee', 'heure_depart', 'compte_rendu', 'signature_nom', 'signature_data'];
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params; const body = await req.json();
  const me = await currentUser(); if (!me) return NextResponse.json({ error: 'Non connecté' }, { status: 401 });
  const supabase = await createClient();
  const upd: any = {}; for (const k of SCHED) if (body[k] !== undefined) upd[k] = body[k];
  if (upd.camion_id && upd.date_prevue && upd.heure_debut && !upd.etat) upd.etat = 'planifiee';
  if (upd.camion_id === null && !upd.etat) upd.etat = 'a_planifier';
  const { error } = await supabase.from('operations').update(upd).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (Array.isArray(body.equipiers) && (me.role === 'dispatcheur' || me.role === 'admin')) {
    await supabase.from('operation_equipiers').delete().eq('operation_id', id);
    if (body.equipiers.length) await supabase.from('operation_equipiers').insert(body.equipiers.map((e: string, i: number) => ({ operation_id: id, equipier_id: e, chef: i === 0 })));
  }
  return NextResponse.json({ ok: true });
}
export async function DELETE(_: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params; const supabase = await createClient();
  const { error } = await supabase.from('operations').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
