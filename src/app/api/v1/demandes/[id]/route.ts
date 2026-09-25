import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { apiContext } from '@/lib/api-auth';
export async function GET(req:NextRequest, {params}:{params:Promise<{id:string}>}) {
  const ctx = await apiContext(req); const headers = { 'Cache-Control':'private, no-store' };
  if (!ctx) return NextResponse.json({error:'Authentification ou rôle non autorisé.'},{status:401,headers});
  const {id} = await params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({error:'Identifiant invalide.'},{status:400,headers});
  const {data,error} = await ctx.db.from('demandes').select('*,client:clients(nom,code_akanea),operations(id,type_operation,ordre,libelle,adresse,date_prevue,heure_debut,duree_min,etat,consignes,periode,jour,rotation,camion:camions(numero,immatriculation),equipiers:operation_equipiers(chef,equipier:equipiers(prenom,nom)))').eq('id',id).maybeSingle();
  if (error) return NextResponse.json({error:'Lecture impossible.'},{status:500,headers});
  if (!data) return NextResponse.json({error:'Demande introuvable.'},{status:404,headers});
  data.operations.sort((a:any,b:any) => (a.date_prevue ?? '').localeCompare(b.date_prevue ?? '') || a.ordre-b.ordre);
  return NextResponse.json({data},{headers});
}
