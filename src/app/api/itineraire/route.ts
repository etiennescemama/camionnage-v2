import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {decode} from '@here/flexpolyline';
import {apiContext} from '@/lib/api-auth';
import {vehicleParameters,summarizeRoute} from '@/lib/routing';
const point=z.object({lat:z.number().min(-90).max(90),lng:z.number().min(-180).max(180)});
export async function POST(req:NextRequest) {
  const ctx=await apiContext(req);if(!ctx)return NextResponse.json({error:'Accès non autorisé.'},{status:401});
  const p=z.object({origin:point,destination:point,camions:z.array(z.string().uuid()).min(1).max(8),departure:z.string().datetime().optional()}).safeParse(await req.json().catch(()=>null));
  if(!p.success)return NextResponse.json({error:'Confirmez les deux adresses et choisissez de 1 à 8 véhicules.'},{status:400});
  const key=process.env.HERE_API_KEY;if(!key)return NextResponse.json({error:'Le calcul routier nécessite HERE_API_KEY sur le serveur. Aucun kilométrage ni péage ne sera inventé.'},{status:503});
  const {data:camions,error}=await ctx.db.from('camions').select('*').in('id',[...new Set(p.data.camions)]).eq('actif',true);
  if(error || camions?.length!==new Set(p.data.camions).size)return NextResponse.json({error:'Véhicule introuvable ou inactif.'},{status:400});
  const results=await Promise.all(camions!.map(async(c:any)=>{
    try {
      const q=vehicleParameters(c);q.set('origin',`${p.data.origin.lat},${p.data.origin.lng}`);q.set('destination',`${p.data.destination.lat},${p.data.destination.lng}`);q.set('return','polyline,travelSummary,tolls');q.set('tolls[summaries]','total');q.set('currency','EUR');q.set('departureTime',p.data.departure??'any');q.set('apiKey',key);
      const r=await fetch('https://router.hereapi.com/v8/routes?'+q,{cache:'no-store',signal:AbortSignal.timeout(20000)});
      if(!r.ok)throw new Error('Calcul indisponible pour ce véhicule. Vérifiez le profil et les droits HERE.');
      const j=await r.json();if(!j.routes?.[0])throw new Error('Aucun itinéraire trouvé.');
      const route=j.routes[0];return {id:c.id,numero:c.numero,...summarizeRoute(route),lines:route.sections.map((s:any)=>decode(s.polyline).polyline.map((p:number[])=>[p[0],p[1]]))};
    } catch(e) {return {id:c.id,numero:c.numero,error:e instanceof Error?e.message:'Calcul indisponible'};}
  }));
  return NextResponse.json({results,calculated_at:new Date().toISOString()},{headers:{'Cache-Control':'private, no-store'}});
}
