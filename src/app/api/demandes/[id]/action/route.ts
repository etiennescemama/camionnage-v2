import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { action, motif } = await req.json();
  const supabase = await createClient();
  const me = await requireRole(['dispatcheur', 'admin', 'coordinateur']);
  if (!me) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  const { data: d } = await supabase.from('demandes').select('*').eq('id', id).single();
  if (!d) return NextResponse.json({ error: 'Demande introuvable' }, { status: 404 });
  const isDispatch = me.role === 'dispatcheur' || me.role === 'admin';
  let upd: any = {}; let notif: { to: string | null; type: string; titre: string; message: string } | null = null;
  if (action === 'accepter' && isDispatch) {
    upd = { etat: 'acceptee', dispatcheur_id: me.id, motif_refus: null };
    notif = { to: d.coordinateur_id, type: 'acceptee', titre: `Demande ${d.numero} acceptée`, message: 'Le dispatch prend la demande en charge, planification en cours.' };
  } else if (action === 'refuser' && isDispatch) {
    if (!motif?.trim()) return NextResponse.json({ error: 'Le motif est obligatoire' }, { status: 400 });
    upd = { etat: 'refusee', dispatcheur_id: me.id, motif_refus: motif.trim() };
    notif = { to: d.coordinateur_id, type: 'refusee', titre: `Demande ${d.numero} refusée`, message: motif.trim() };
  } else if (action === 'terminer' && isDispatch) {
    await supabase.from('operations').update({ etat: 'terminee' }).eq('demande_id', id).neq('etat', 'annulee');
    upd = { etat: 'terminee' };
    notif = { to: d.coordinateur_id, type: 'terminee', titre: `Demande ${d.numero} terminée`, message: 'Toutes les opérations sont réalisées.' };
  } else if (action === 'annuler' && (isDispatch || d.coordinateur_id === me.id)) {
    await supabase.from('operations').update({ etat: 'annulee' }).eq('demande_id', id);
    upd = { etat: 'annulee' };
    notif = d.dispatcheur_id ? { to: d.dispatcheur_id, type: 'annulee', titre: `Demande ${d.numero} annulée`, message: 'Le coordinateur a annulé la demande.' } : null;
  } else if (action === 'renvoyer' && d.coordinateur_id === me.id) {
    upd = { etat: 'envoyee', motif_refus: null };
  } else return NextResponse.json({ error: 'Action non autorisée' }, { status: 403 });
  const { error } = await supabase.from('demandes').update(upd).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (notif?.to) await supabase.from('notifications').insert({ destinataire_id: notif.to, type: notif.type, demande_id: id, titre: notif.titre, message: notif.message });
  return NextResponse.json({ ok: true });
}
