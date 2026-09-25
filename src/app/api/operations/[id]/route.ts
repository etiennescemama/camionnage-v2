import { NextRequest, NextResponse } from 'next/server';
import {todayYmd} from '@/lib/utils';
import {z} from 'zod';
import { createClient } from '@/lib/supabase/server';
import { currentUser } from '@/lib/auth';
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const {id}=await ctx.params; const me=await currentUser();
  if(!me?.actif)return NextResponse.json({error:'Non connecté'},{status:401});
  if(!z.string().uuid().safeParse(id).success)return NextResponse.json({error:'Identifiant invalide'},{status:400});
  const body=await req.json().catch(()=>null);if(!body || typeof body!=='object')return NextResponse.json({error:'Données invalides'},{status:400});
  const db=await createClient();const {data:op,error:readError}=await db.from('operations').select('*,demande:demandes(etat),equipiers:operation_equipiers(equipier_id,equipier:equipiers(utilisateur_id))').eq('id',id).maybeSingle();
  if(readError || !op)return NextResponse.json({error:'Opération introuvable'},{status:404});
  if(['refusee','annulee','envoyee','brouillon'].includes(op.demande?.etat))return NextResponse.json({error:'Demande non disponible pour exécution'},{status:409});
  const dispatch=['admin','dispatcheur'].includes(me.role);
  if(dispatch && !['en_route','sur_site','terminee'].includes(body.etat)){
    const {error}=await db.rpc('planifier_operation',{p_id:id,p_date:body.date_prevue??op.date_prevue,p_heure:body.heure_debut??op.heure_debut,p_duree:body.duree_min??op.duree_min,p_camion:body.camion_id===undefined?op.camion_id:body.camion_id,p_equipiers:body.equipiers??op.equipiers.map((e:any)=>e.equipier_id),p_consignes:body.consignes===undefined?op.consignes:body.consignes,p_adresse:body.adresse??op.adresse,p_unassign:body.etat==='a_planifier'});
    if(error)return NextResponse.json({error:error.code==='PGRST202'?'Mise à jour SQL v2_02 à appliquer avant de planifier.':error.message},{status:409});
    return NextResponse.json({ok:true});
  }
  if(!dispatch && !op.equipiers.some((e:any)=>e.equipier?.utilisateur_id===me.id))return NextResponse.json({error:'Cette mission ne vous est pas affectée'},{status:403});
  if(!dispatch && (!op.date_prevue || op.date_prevue>todayYmd()))return NextResponse.json({error:'Cette mission est prévue à une date future.'},{status:409});
  const next:Record<string,string>={planifiee:'en_route',en_route:'sur_site',sur_site:'terminee'};
  if(body.etat!==next[op.etat])return NextResponse.json({error:'L’état de la mission a changé. Actualisez avant de continuer.'},{status:409});
  const allowed=['etat','heure_arrivee','heure_depart','compte_rendu','signature_nom'];
  if(Object.keys(body).some(k=>!allowed.includes(k)))return NextResponse.json({error:'Modification réservée au planning'},{status:403});
  const parsed=z.object({compte_rendu:z.string().max(5000).nullable().optional(),signature_nom:z.string().max(200).nullable().optional()}).safeParse(body);
  if(!parsed.success)return NextResponse.json({error:'Compte rendu ou signataire trop long'},{status:400});
  const upd:any={etat:body.etat};if(body.etat==='sur_site')upd.heure_arrivee=new Date().toISOString();
  if(body.etat==='terminee')Object.assign(upd,{heure_depart:new Date().toISOString(),compte_rendu:parsed.data.compte_rendu??null,signature_nom:parsed.data.signature_nom??null});
  const {data,error}=await db.from('operations').update(upd).eq('id',id).eq('etat',op.etat).select('id').maybeSingle();
  if(error || !data)return NextResponse.json({error:'Enregistrement impossible ou mission déjà modifiée. Actualisez.'},{status:409});
  return NextResponse.json({ok:true});
}
export async function DELETE(_:NextRequest,ctx:{params:Promise<{id:string}>}) {
  const me=await currentUser();if(!me?.actif || !['admin','dispatcheur'].includes(me.role))return NextResponse.json({error:'Accès refusé'},{status:403});
  const {id}=await ctx.params;const db=await createClient();const {error}=await db.from('operations').delete().eq('id',id);
  return error?NextResponse.json({error:error.message},{status:500}):NextResponse.json({ok:true});
}
