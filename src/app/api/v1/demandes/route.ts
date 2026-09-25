import { NextRequest, NextResponse } from 'next/server';
import { apiContext } from '@/lib/api-auth';
import { listDemandes, querySchema } from '@/lib/demande-query';
import { demandesCsv } from '@/lib/csv';
export async function GET(req: NextRequest) {
  const ctx = await apiContext(req);
  const headers = { 'Cache-Control': 'private, no-store' };
  if (!ctx) return NextResponse.json({ error: 'Authentification ou rôle non autorisé.' }, { status: 401, headers });
  const parsed = querySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: 'Filtres invalides', details: parsed.error.flatten() }, { status: 400, headers });
  const { data, error, count } = await listDemandes(ctx.db, ctx.user.id, parsed.data);
  if (error) return NextResponse.json({ error: 'Lecture impossible. Réessayez.' }, { status: 500, headers });
  const p = parsed.data;
  if (p.format === 'csv') return new NextResponse(demandesCsv(data ?? []), { headers: {
    ...headers, 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="demandes-page-${p.page}.csv"`,
    'X-Total-Count': String(count ?? 0),
  } });
  return NextResponse.json({ data, pagination: { page: p.page, limit: p.limit, total: count ?? 0, has_more: p.page * p.limit < (count ?? 0) } }, { headers });
}
