import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {createClient} from '@/lib/supabase/server';
import {requireRole} from '@/lib/auth';
import {optionsInsertion} from '@/lib/auto-planning';
import {chargerJournee} from '@/lib/planning-data';

// Où glisser une mission à planifier (et le reste de sa rotation) dans les tournées du jour.
export async function GET(req:NextRequest){
  const me=await requireRole(['dispatcheur','admin']);
  if(!me?.actif)return NextResponse.json({error:'Réservé au planning'},{status:403});
  const id=req.nextUrl.searchParams.get('operation')??'';
  if(!z.string().uuid().safeParse(id).success)return NextResponse.json({error:'Mission invalide'},{status:400});
  const db=await createClient();
  const {data:op}=await db.from('operations').select('id,date_prevue,etat').eq('id',id).maybeSingle();
  if(!op)return NextResponse.json({error:'Mission introuvable'},{status:404});
  if(op.etat!=='a_planifier'||!op.date_prevue)return NextResponse.json({options:[],raison:'Mission déjà affectée ou sans date'});
  try{
    const {ops,ctx,libelles}=await chargerJournee(db,op.date_prevue);
    const cible=ops.find(o=>o.id===id);
    if(!cible)return NextResponse.json({options:[],raison:'Acceptez la demande avant de la planifier'});
    const rotation=ops.filter(o=>o.demande_id===cible.demande_id&&o.periode===cible.periode&&o.jour===cible.jour&&o.rotation===cible.rotation);
    const r=optionsInsertion(rotation,ctx);
    return NextResponse.json({...r,date:op.date_prevue,...libelles,ops:Object.fromEntries(rotation.map(o=>[o.id,{libelle:o.libelle,client:o.client}])),journee_en_cours:ctx.pasAvant!=null,sms_actif:process.env.SMS_ENABLED==='true'},{headers:{'Cache-Control':'no-store'}});
  }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Erreur'},{status:500});}
}
