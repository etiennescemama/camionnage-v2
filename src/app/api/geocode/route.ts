import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {apiContext} from '@/lib/api-auth';
export async function POST(req:NextRequest) {
  if(!await apiContext(req))return NextResponse.json({error:'Accès non autorisé.'},{status:401});
  const key=process.env.HERE_API_KEY;
  if(!key)return NextResponse.json({error:'La localisation nécessite la configuration HERE_API_KEY sur le serveur. Vous pouvez enregistrer l’adresse sans localisation.'},{status:503});
  const p=z.object({q:z.string().trim().min(5).max(500)}).safeParse(await req.json().catch(()=>null));
  if(!p.success)return NextResponse.json({error:'Précisez une adresse complète.'},{status:400});
  try {
    const q=new URLSearchParams({q:p.data.q,apiKey:key,limit:'5',lang:'fr-FR'});
    const r=await fetch('https://geocode.search.hereapi.com/v1/geocode?'+q,{cache:'no-store',signal:AbortSignal.timeout(12000)});
    if(!r.ok)throw new Error();const j=await r.json();
    const items=(j.items??[]).filter((a:any)=>['houseNumber','place','street'].includes(a.resultType) && a.position).map((a:any)=>({rue:[a.address?.houseNumber,a.address?.street].filter(Boolean).join(' ') || a.title,code_postal:a.address?.postalCode??'',ville:a.address?.city??'',pays:a.address?.countryName??'',lat:a.access?.[0]?.lat ?? a.position.lat,lng:a.access?.[0]?.lng ?? a.position.lng,label:a.address?.label??a.title}));
    return NextResponse.json({items},{headers:{'Cache-Control':'private, no-store'}});
  } catch {return NextResponse.json({error:'Le service de localisation ne répond pas. Réessayez ou vérifiez la clé HERE.'},{status:502});}
}
