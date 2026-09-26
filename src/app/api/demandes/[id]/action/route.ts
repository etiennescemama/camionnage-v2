import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Données invalides' }, { status: 400 });
  const { action, motif } = body as { action?: string; motif?: string };
  const supabase = await createClient();
  const me = await requireRole(['dispatcheur', 'admin', 'coordinateur']);
  if (!me) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  const { data: d } = await supabase.from('demandes').select('*').eq('id', id).single();
  if (!d) return NextResponse.json({ error: 'Demande introuvable' }, { status: 404 });
  const isDispatch = me.role === 'dispatcheur' || me.role === 'admin';
  let upd: any = {}; let notif: { to: string | null; type: string; titre: string; message: string } | null = null;
  if (action === 'accepter' && isDispatch && d.etat === 'envoyee') {
    upd = { etat: 'acceptee', dispatcheur_id: me.id, motif_refus: null };
    notif = { to: d.coordinateur_id, type: 'acceptee', titre: `Demande ${d.numero} acceptée`, message: 'Le dispatch prend la demande en charge, planification en cours.' };
  } else if (action === 'refuser' && isDispatch && d.etat === 'envoyee') {
    if (!motif?.trim()) return NextResponse.json({ error: 'Le motif est obligatoire' }, { status: 400 });
    upd = { etat: 'refusee', dispatcheur_id: me.id, motif_refus: motif.trim() };
    notif = { to: d.coordinateur_id, type: 'refusee', titre: `Demande ${d.numero} refusée`, message: motif.trim() };
  } else if (action === 'terminer' && isDispatch) {
    return NextResponse.json({ error: 'Clôturez chaque mission depuis la vue terrain. La demande sera terminée automatiquement après toutes les opérations, retour compris.' }, { status: 409 });
  } else if (action === 'annuler' && (isDispatch || d.coordinateur_id === me.id)) {
    if (['terminee', 'annulee', 'refusee'].includes(d.etat)) return NextResponse.json({ error: 'Cette demande est déjà close.' }, { status: 409 });
    // Seules les missions non démarrées sont annulées : l'historique d'exécution reste intact pour la facturation.
    const { error: opsError } = await supabase.from('operations').update({ etat: 'annulee' }).eq('demande_id', id).in('etat', ['a_planifier', 'planifiee']);
    if (opsError) return NextResponse.json({ error: opsError.message }, { status: 409 });
    upd = { etat: 'annulee' };
    notif = d.dispatcheur_id ? { to: d.dispatcheur_id, type: 'annulee', titre: `Demande ${d.numero} annulée`, message: 'Le coordinateur a annulé la demande.' } : null;
  } else if (action === 'renvoyer' && d.coordinateur_id === me.id && d.etat === 'refusee') {
    upd = { etat: 'envoyee', motif_refus: null };
  } else return NextResponse.json({ error: 'Action non autorisée' }, { status: 403 });
  const { error } = await supabase.from('demandes').update(upd).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: error.code === '42501' ? 403 : 500 });
  if (notif?.to) await supabase.from('notifications').insert({ destinataire_id: notif.to, type: notif.type, demande_id: id, titre: notif.titre, message: notif.message });
  return NextResponse.json({ ok: true });
}
