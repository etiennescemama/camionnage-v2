'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {Button} from './ui/button';
import {fmtDate,minToH} from '@/lib/utils';
import {hhmm} from '@/lib/auto-planning';

type Etat = 'attente' | 'en_cours' | 'ok' | 'erreur';

// Propose en un clic l'affectation de toutes les missions à planifier d'un jour.
// Rien n'est réservé tant que l'utilisateur n'a pas validé ; chaque ligne passe ensuite
// par planifier_operation, qui refait tous les contrôles côté base.
export function ProposerJournee({date}:{date:string}){
  const router=useRouter();
  const [data,setData]=useState<any>(null),[chargement,setChargement]=useState(false),[erreur,setErreur]=useState('');
  const [etats,setEtats]=useState<Record<string,{etat:Etat;message?:string}>>({}),[application,setApplication]=useState(false);

  async function proposer(){
    setChargement(true);setErreur('');setEtats({});
    try{const res=await fetch(`/api/planning/proposition?date=${date}`);const j=await res.json();if(!res.ok)throw new Error(j.error);setData(j);}
    catch(e){setErreur(e instanceof Error?e.message:'Proposition impossible');}finally{setChargement(false);}
  }
  async function appliquer(rotations:any[]){
    if(application)return;setApplication(true);
    for(const rot of rotations){
      for(const op of rot.ops){
        const l=data.proposition.lignes.find((x:any)=>x.operation_id===op.id);
        setEtats(s=>({...s,[op.id]:{etat:'en_cours'}}));
        const res=await fetch(`/api/operations/${op.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({date_prevue:date,heure_debut:l.heure_debut,duree_min:l.duree_min,camion_id:l.camion_id,equipiers:l.equipiers,adresse:l.adresse})}).catch(()=>null);
        const j=res?await res.json().catch(()=>({})):{error:'Réseau indisponible'};
        if(!res?.ok){setEtats(s=>({...s,[op.id]:{etat:'erreur',message:j.error??'Refusé'}}));break;} // la suite de la rotation attend
        setEtats(s=>({...s,[op.id]:{etat:'ok'}}));
      }
    }
    setApplication(false);router.refresh();
  }

  if(!data)return <div className="rounded-xl border border-line bg-paper p-4 flex flex-wrap items-center justify-between gap-3">
    <div><p className="font-semibold">Proposer la journée du {fmtDate(date,{weekday:'long',day:'numeric',month:'long'})}</p><p className="text-sm text-mute">Camions, équipes et horaires calculés pour toutes les missions à affecter ce jour, trajets compris. Vous validez avant tout enregistrement.</p></div>
    <Button onClick={proposer} disabled={chargement}>{chargement?'Calcul…':'Proposer'}</Button>
    {erreur&&<p role="alert" className="w-full text-sm text-brick">{erreur}</p>}
  </div>;

  const {proposition:p,camions,equipiers,ops}=data;const k=p.indicateurs;
  const parCamion=new Map<string,any[]>();for(const r of p.rotations){const c=r.camion_id??'sans';parCamion.set(c,[...(parCamion.get(c)??[]),r]);}
  for(const l of parCamion.values())l.sort((a,b)=>a.debut-b.debut);
  const noms=(ids:string[])=>ids.map((id,i)=>`${equipiers[id]??'?'}${i===0?' (chef)':''}`).join(', ');
  const icone=(id:string)=>({en_cours:'…',ok:'✓',erreur:'✗',attente:''}[etats[id]?.etat??'attente']);
  const restant=p.rotations.filter((r:any)=>r.ops.some((o:any)=>etats[o.id]?.etat!=='ok'));

  return <section className="rounded-xl border border-line bg-paper p-4 md:p-5 space-y-4" aria-label="Proposition de planning">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="text-lg font-semibold">Proposition du {fmtDate(date,{weekday:'long',day:'numeric',month:'long'})}</h2>
        <p className="text-sm text-mute">{p.lignes.length} mission(s) placée(s){p.non_places.length?` · ${p.non_places.reduce((n:number,x:any)=>n+x.operation_ids.length,0)} à traiter à la main`:''}</p></div>
      <div className="flex gap-2"><Button variant="secondary" size="sm" onClick={()=>setData(null)} disabled={application}>Fermer</Button><Button variant="secondary" size="sm" onClick={proposer} disabled={application||chargement}>Recalculer</Button>
        {restant.length>0&&<Button size="sm" onClick={()=>appliquer(restant)} disabled={application}>{application?'Enregistrement…':`Tout valider (${restant.length} rotation${restant.length>1?'s':''})`}</Button>}</div>
    </div>
    <dl className="grid grid-cols-2 sm:grid-cols-5 border-y border-line text-sm">
      {[['Camions sortis',k.camions_sortis],['Personnes mobilisées',k.equipiers_mobilises],['Route',minToH(k.route_min)],['Travail chez client',minToH(k.travail_min)],['Occupation équipes',`${k.taux_occupation} %`]].map(([t,v])=><div key={t as string} className="px-3 py-3"><dt className="text-mute">{t}</dt><dd className="text-xl font-medium">{v}</dd></div>)}
    </dl>
    {data.sans_coordonnees>0&&<p className="text-sm bg-ochre-soft text-ochre p-3 rounded-lg">{data.sans_coordonnees} mission(s) sans adresse géolocalisée : trajet estimé à 30 min. Confirmez l’adresse dans le dossier pour un calcul exact.</p>}
    {[...parCamion.entries()].map(([camion,rots])=><div key={camion} className="border border-line rounded-lg">
      <div className="flex flex-wrap justify-between gap-2 px-4 py-3 bg-fog rounded-t-lg"><p className="font-semibold">{camion==='sans'?'Sans camion (atelier, visite)':camions[camion]}</p><p className="text-sm text-mute">{noms(rots[0].equipiers)}</p></div>
      <ol className="divide-y divide-line">{rots.map((r:any)=>r.ops.map((o:any,i:number)=>{const l=p.lignes.find((x:any)=>x.operation_id===o.id);const e=etats[o.id];
        return <li key={o.id} className="px-4 py-3 grid grid-cols-[3.5rem_1fr_auto] gap-3 items-start">
          <span className="font-mono text-sm pt-0.5">{l.heure_debut}</span>
          <div><p className="text-sm"><strong>{ops[o.id].client}</strong> · {ops[o.id].libelle} <span className="text-mute">· {ops[o.id].numero}</span></p>
            <p className="text-xs text-mute">{l.trajet_min?`${l.trajet_min} min de route avant · `:''}{minToH(l.duree_min)} sur place → {hhmm(Number(l.heure_debut.slice(0,2))*60+Number(l.heure_debut.slice(3))+l.duree_min)}{i===0&&r.equipiers.join()!==rots[0].equipiers.join()?` · équipe : ${noms(r.equipiers)}`:''}</p>
            {e?.etat==='erreur'&&<p role="alert" className="text-xs text-brick mt-1">{e.message} — rotation arrêtée, affectez la suite à la main.</p>}</div>
          <span aria-label={e?.etat??'en attente'} className={e?.etat==='erreur'?'text-brick':'text-moss'}>{icone(o.id)}</span>
        </li>;}))}</ol>
      {!application&&rots.some((r:any)=>r.ops.some((o:any)=>etats[o.id]?.etat!=='ok'))&&<div className="px-4 py-2 border-t border-line text-right"><Button variant="ghost" size="sm" onClick={()=>appliquer(rots)}>Valider ce camion</Button></div>}
    </div>)}
    {p.non_places.length>0&&<div className="border border-brick-soft rounded-lg p-4"><p className="font-semibold mb-2">À affecter à la main</p><ul className="space-y-2 text-sm">{p.non_places.map((n:any)=><li key={n.operation_ids[0]}><strong>{n.client}</strong> · {n.libelle} <span className="text-mute">· {n.numero}</span><br/><span className="text-brick">{n.raison}</span></li>)}</ul></div>}
  </section>;
}
