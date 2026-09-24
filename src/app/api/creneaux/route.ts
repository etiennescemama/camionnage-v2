import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('creneaux_disponibles', {
    p_from: q.get('from'), p_to: q.get('to'),
    p_volume_min: Number(q.get('volume') ?? 0), p_hayon: q.get('hayon') === '1', p_clim: q.get('clim') === '1',
    p_duree_min: Number(q.get('duree') ?? 120),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ creneaux: data });
}
