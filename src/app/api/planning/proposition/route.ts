import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@/lib/supabase/server';
import {requireRole} from '@/lib/auth';
import {proposerJournee} from '@/lib/auto-planning';
import {chargerJournee} from '@/lib/planning-data';

export async function GET(req:NextRequest){
  const me=await requireRole(['dispatcheur','admin']);
  if(!me?.actif)return NextResponse.json({error:'Réservé au planning'},{status:403});
  const date=req.nextUrl.searchParams.get('date')??'';
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(date)))return NextResponse.json({error:'Date invalide'},{status:400});
  try{
    const {ops,ctx,libelles}=await chargerJournee(await createClient(),date);
    return NextResponse.json({date,proposition:proposerJournee(ops,ctx),...libelles,
      ops:Object.fromEntries(ops.map(o=>[o.id,{numero:o.numero,client:o.client,libelle:o.libelle,demande_id:o.demande_id}])),
      sans_coordonnees:ops.filter(o=>o.lieu.lat==null).length,journee_en_cours:ctx.pasAvant!=null},{headers:{'Cache-Control':'no-store'}});
  }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Erreur'},{status:500});}
}
