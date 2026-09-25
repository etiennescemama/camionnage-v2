export function vehicleParameters(c:any) {
  for(const key of ['hauteur_cm','largeur_cm','longueur_cm','ptac_kg','essieux']) if(!Number.isFinite(Number(c[key])) || Number(c[key])<=0) throw new Error('Profil routier incomplet : renseignez dimensions, PTAC et essieux dans Référentiels → Camions.');
  const q=new URLSearchParams({transportMode:c.poids_lourd?'truck':'car','vehicle[height]':String(c.hauteur_cm),'vehicle[width]':String(c.largeur_cm),'vehicle[length]':String(c.longueur_cm),'vehicle[grossWeight]':String(c.ptac_kg),'vehicle[currentWeight]':String(c.ptac_kg),'vehicle[axleCount]':String(c.essieux)});
  if(!c.poids_lourd)q.set('vehicle[commercial]','true');
  return q;
}
export function summarizeRoute(route:any) {
  const sections=route.sections??[];
  if(!sections.length)throw new Error('Aucun itinéraire trouvé.');
  const notices=[...(route.notices??[]),...sections.flatMap((s:any)=>s.notices??[])];
  const totals=sections.map((s:any)=>(s.travelSummary??s.summary)?.tolls?.total);
  const complete=totals.every((t:any)=>t?.currency==='EUR' && t.type==='value' && typeof t.value==='number') && !notices.some((n:any)=>/toll|currency/i.test(n.code??''));
  return {distance_m:sections.reduce((n:number,s:any)=>n+Number((s.travelSummary??s.summary)?.length??0),0),duration_s:sections.reduce((n:number,s:any)=>n+Number((s.travelSummary??s.summary)?.duration??0),0),toll_eur:complete?totals.reduce((n:number,t:any)=>n+t.value,0):null,notices:notices.map((n:any)=>({title:n.title??n.code,severity:n.severity})),restricted:notices.some((n:any)=>n.severity==='critical')};
}
