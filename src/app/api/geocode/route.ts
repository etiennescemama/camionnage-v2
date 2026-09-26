import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {apiContext} from '@/lib/api-auth';
export async function POST(req:NextRequest) {
  if(!await apiContext(req))return NextResponse.json({error:'Accès non autorisé.'},{status:401});
  const key=process.env.HERE_API_KEY;
  if(!key)return NextResponse.json({error:'Configurez HERE_API_KEY sur le serveur pour activer les suggestions. La saisie manuelle reste disponible.'},{status:503});
  const p=z.union([z.object({id:z.string().min(1).max(1000)}),z.object({q:z.string().trim().min(3).max(500),suggest:z.boolean().optional()})]).safeParse(await req.json().catch(()=>null));
  if(!p.success)return NextResponse.json({error:'Saisissez au moins trois caractères.'},{status:400});
  try {
    const lookup='id' in p.data;
    const suggest=!lookup && 'suggest' in p.data && p.data.suggest;
    const endpoint=lookup?'lookup':suggest?'autocomplete':'geocode';
    const q=new URLSearchParams({apiKey:key,lang:'fr-FR'});
    if('id' in p.data)q.set('id',p.data.id);else {q.set('q',p.data.q);q.set('limit','5');}
    const r=await fetch(`https://${endpoint}.search.hereapi.com/v1/${endpoint}?`+q,{cache:'no-store',signal:AbortSignal.timeout(12000)});
    if(!r.ok)throw new Error();const j=await r.json();
    const items=(lookup?[j]:j.items??[]).filter((a:any)=>a.address && (suggest || a.position)).map((a:any)=>({id:a.id,rue:[a.address?.houseNumber,a.address?.street].filter(Boolean).join(' '),code_postal:a.address?.postalCode??'',ville:a.address?.city??'',pays:a.address?.countryName??'',lat:a.access?.[0]?.lat ?? a.position?.lat,lng:a.access?.[0]?.lng ?? a.position?.lng,label:a.address?.label??a.title}));
    return NextResponse.json({items},{headers:{'Cache-Control':'private, no-store'}});
  } catch {return NextResponse.json({error:'Recherche HERE indisponible. Réessayez ; la saisie manuelle reste possible.'},{status:502});}
}
