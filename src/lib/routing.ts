const profileFields: Record<string,string>={hauteur_cm:'height',largeur_cm:'width',longueur_cm:'length',ptac_kg:'grossWeight',essieux:'axleCount'};
export function missingVehicleFields(c:any) {
  const labels:Record<string,string>={hauteur_cm:'hauteur',largeur_cm:'largeur',longueur_cm:'longueur',ptac_kg:'PTAC',essieux:'essieux'};
  return Object.keys(profileFields).filter(k=>!Number.isFinite(Number(c[k])) || Number(c[k])<=0).map(k=>labels[k]);
}
export function vehicleParameters(c:any) {
  const q=new URLSearchParams({transportMode:c.poids_lourd?'truck':'car'});
  for(const [key,param] of Object.entries(profileFields))if(Number.isFinite(Number(c[key])) && Number(c[key])>0)q.set(`vehicle[${param}]`,String(c[key]));
  if(q.has('vehicle[grossWeight]'))q.set('vehicle[currentWeight]',q.get('vehicle[grossWeight]')!);
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
