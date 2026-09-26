'use client';
import {useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import {Button} from './ui/button';
import {hhmm} from '@/lib/auto-planning';

// Suggestions pour glisser une mission dans les tournées du jour, en un clic.
export function InsertionRapide({operationId,onDone}:{operationId:string;onDone?:(message:string)=>void}){
  const router=useRouter();
  const [data,setData]=useState<any>(null),[erreur,setErreur]=useState(''),[enCours,setEnCours]=useState<number|null>(null);
  useEffect(()=>{let actif=true;setData(null);setErreur('');
    fetch(`/api/planning/insertion?operation=${operationId}`).then(r=>r.json().then(j=>({ok:r.ok,j}))).then(({ok,j})=>{if(!actif)return;if(!ok)setErreur(j.error);else setData(j);}).catch(()=>actif&&setErreur('Suggestions indisponibles'));
    return()=>{actif=false;};},[operationId]);
  async function affecter(i:number){
    const o=data.options[i];setEnCours(i);setErreur('');
    for(const l of o.lignes){
      const res=await fetch(`/api/operations/${l.operation_id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({date_prevue:data.date,heure_debut:l.heure_debut,duree_min:l.duree_min,camion_id:l.camion_id,equipiers:l.equipiers,adresse:l.adresse})});
      if(!res.ok){const j=await res.json().catch(()=>({}));setErreur(`${j.error??'Refusé'} — la suite n’a pas été enregistrée.`);setEnCours(null);router.refresh();return;}
    }
    setEnCours(null);router.refresh();
    onDone?.(`Mission ajoutée à la tournée ${data.camions[o.camion_id]??''}. ${data.journee_en_cours&&data.sms_actif?'L’équipe reçoit un SMS d’ici 2 minutes.':''}`.trim());
  }
  if(erreur&&!data)return <p className="text-sm text-brick mb-4">{erreur}</p>;
  if(!data)return <p className="text-sm text-mute mb-4" role="status">Recherche des meilleurs créneaux…</p>;
  if(!data.options.length)return <p className="text-sm bg-ochre-soft text-ochre rounded-lg p-3 mb-4">Pas de place automatique : {data.raison}. Affectez à la main ci-dessous.</p>;
  const noms=(ids:string[])=>ids.map((id,i)=>`${data.equipiers[id]??'?'}${i===0?' (chef)':''}`).join(', ');
  return <section className="mb-6 pb-5 border-b border-line">
    <h3 className="font-semibold">{data.journee_en_cours?'Glisser dans une tournée en cours':'Meilleurs créneaux ce jour-là'}</h3>
    <p className="text-sm text-mute mb-3">{Object.keys(data.ops).length>1?`Toute la rotation (${Object.values(data.ops).map((o:any)=>o.libelle).join(' → ')}) reste sur le même camion.`:'Calculé avec les missions déjà affectées et les trajets.'}</p>
    <ul className="space-y-2">{data.options.map((o:any,i:number)=><li key={i} className={`border rounded-lg p-3 flex flex-wrap items-center justify-between gap-3 ${i===0?'border-cobalt':'border-line'}`}>
      <div><p className="font-medium"><span className="font-mono">{hhmm(o.debut)}–{hhmm(o.fin)}</span> · {o.camion_id?data.camions[o.camion_id]:'Sans camion'}{i===0&&<span className="ml-2 text-xs bg-moss-soft text-moss rounded px-2 py-0.5">recommandé</span>}</p>
        <p className="text-sm text-mute">{noms(o.equipiers)} · {o.route_min} min de route{o.camion_deja_sorti?' · camion déjà en tournée':' · sortie d’un camion supplémentaire'}</p></div>
      <Button size="sm" variant={i===0?'primary':'secondary'} disabled={enCours!==null} onClick={()=>affecter(i)}>{enCours===i?'Enregistrement…':'Affecter'}</Button>
    </li>)}</ul>
    {erreur&&<p role="alert" className="text-sm text-brick mt-2">{erreur}</p>}
    <p className="text-xs text-mute mt-3">Ou affectez à la main ci-dessous.</p>
  </section>;
}
