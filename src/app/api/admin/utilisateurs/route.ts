import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireRole } from '@/lib/auth';
const S = z.object({ prenom: z.string().min(1), nom: z.string().min(1), email: z.string().email(), password: z.string().min(8), role: z.enum(['coordinateur','dispatcheur','chauffeur','gm','emballage','direction','admin']), equipier_id: z.string().uuid().nullable().optional() });
export async function POST(req: NextRequest) {
  const me = await requireRole(['admin']); if (!me) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  let p; try { p = S.parse(await req.json()); } catch (e: any) { return NextResponse.json({ error: e?.errors?.[0]?.message ?? 'Données invalides' }, { status: 400 }); }
  let admin; try { admin = createAdminClient(); } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
  const { data: c, error: e1 } = await admin.auth.admin.createUser({ email: p.email, password: p.password, email_confirm: true, user_metadata: { prenom: p.prenom, nom: p.nom } });
  if (e1) return NextResponse.json({ error: e1.message }, { status: 400 });
  const uid = c.user!.id;
  const { error: e2 } = await admin.from('utilisateurs').insert({ id: uid, prenom: p.prenom, nom: p.nom, email: p.email, role: p.role, actif: true });
  if (e2) { await admin.auth.admin.deleteUser(uid); return NextResponse.json({ error: e2.message }, { status: 500 }); }
  if (p.equipier_id) await admin.from('equipiers').update({ utilisateur_id: uid }).eq('id', p.equipier_id);
  return NextResponse.json({ ok: true });
}
export async function PATCH(req: NextRequest) {
  const me = await requireRole(['admin']); if (!me) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  const { id, password, actif, role } = await req.json();
  let admin; try { admin = createAdminClient(); } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }); }
  if (password) { const { error } = await admin.auth.admin.updateUserById(id, { password }); if (error) return NextResponse.json({ error: error.message }, { status: 500 }); }
  const upd: any = {}; if (actif !== undefined) upd.actif = actif; if (role) upd.role = role;
  if (Object.keys(upd).length) { const { error } = await admin.from('utilisateurs').update(upd).eq('id', id); if (error) return NextResponse.json({ error: error.message }, { status: 500 }); }
  return NextResponse.json({ ok: true });
}
