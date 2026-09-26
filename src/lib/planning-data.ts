import {lieuOperation,type OpAPlacer,type Occupation,type Lieu,type Contexte} from './auto-planning';
import {todayYmd} from './utils';

export const DEPOT:Lieu={lat:Number(process.env.DEPOT_LAT??48.9268),lng:Number(process.env.DEPOT_LNG??2.2958)};
const minutes=(t:string|null)=>{if(!t)return null;const [h,m]=t.split(':').map(Number);return h*60+(m||0);};
const maintenantParis=()=>{const [h,m]=new Intl.DateTimeFormat('fr-FR',{timeZone:'Europe/Paris',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date()).split(':').map(Number);return h*60+m;};

// Charge une journée : missions à placer, occupations existantes, moyens disponibles.
// Pour aujourd'hui, rien n'est proposé avant maintenant + 30 min (temps de prévenir l'équipe).
export async function chargerJournee(db:any,date:string){
  const [aPlacer,deja,camions,equipiers,indispos]=await Promise.all([
    db.from('operations').select('*,demande:demandes!inner(*,client:clients(nom))').eq('etat','a_planifier').eq('date_prevue',date).in('demande.etat',['acceptee','planifiee','en_cours']),
    db.from('operations').select('id,type_operation,periode,heure_debut,duree_min,camion_id,etat,demande:demandes!inner(enlevement_lat,enlevement_lng,livraison_lat,livraison_lng),equipiers:operation_equipiers(equipier_id,chef)').eq('date_prevue',date).in('etat',['planifiee','en_route','sur_site','terminee']),
    db.from('camions').select('id,numero,immatriculation,volume_m3,hayon,climatise,poids_lourd').eq('actif',true).order('numero'),
    db.from('equipiers').select('id,prenom,nom,permis').eq('actif',true),
    db.from('indisponibilites').select('camion_id,equipier_id').lte('date_debut',date).gte('date_fin',date),
  ]);
  const erreur=[aPlacer,deja,camions,equipiers,indispos].find((r:any)=>r.error)?.error;
  if(erreur)throw new Error(erreur.message);
  const occupationCamion:Record<string,Occupation[]>={},occupationEquipier:Record<string,Occupation[]>={},equipeCamion:Record<string,string[]>={};
  for(const o of (deja.data??[]) as any[]){
    const debut=minutes(o.heure_debut);if(debut==null)continue;
    const occ={debut,fin:debut+(o.duree_min??120),lieu:lieuOperation(o,o.demande,DEPOT)};
    if(o.camion_id){(occupationCamion[o.camion_id]??=[]).push(occ);const eq=[...(o.equipiers??[])].sort((a:any,b:any)=>Number(b.chef)-Number(a.chef)).map((e:any)=>e.equipier_id);equipeCamion[o.camion_id]=[...new Set([...(equipeCamion[o.camion_id]??[]),...eq])];}
    for(const e of o.equipiers??[])(occupationEquipier[e.equipier_id]??=[]).push({debut:occ.debut,fin:occ.fin});
  }
  const camionsIndispo=new Set((indispos.data??[]).map((i:any)=>i.camion_id).filter(Boolean));
  for(const i of (indispos.data??[]) as any[])if(i.equipier_id)(occupationEquipier[i.equipier_id]??=[]).push({debut:0,fin:24*60});
  const ops:OpAPlacer[]=((aPlacer.data??[]) as any[]).map(o=>({
    id:o.id,demande_id:o.demande_id,numero:o.demande.numero,client:o.demande.client?.nom??'Client à préciser',libelle:o.libelle??o.type_operation,
    type_operation:o.type_operation,ordre:o.ordre??1,periode:o.periode??'aller',jour:o.jour??1,rotation:o.rotation??1,
    duree_min:o.duree_min??120,adresse:o.adresse,lieu:lieuOperation(o,o.demande,DEPOT),
    creneau:o.periode==='retour'?(o.demande.creneau_retour??'journee'):o.demande.creneau,rdv_heure:o.periode==='retour'?null:o.demande.rdv_heure,
    nb_hommes:o.demande.nb_hommes??1,nb_camions:o.demande.nb_camions??1,type_camion:o.demande.type_camion,besoin_hayon:!!o.demande.besoin_hayon,besoin_clim:!!o.demande.besoin_clim,
  }));
  const ctx:Contexte={
    camions:((camions.data??[]) as any[]).filter(c=>!camionsIndispo.has(c.id)),
    equipiers:((equipiers.data??[]) as any[]).map(e=>({id:e.id,nom:[e.prenom,e.nom].filter(Boolean).join(' '),permis:e.permis})),
    occupationCamion,occupationEquipier,equipeCamion,depot:DEPOT,
    pasAvant:date===todayYmd()?maintenantParis()+30:undefined,
  };
  const libelles={
    camions:Object.fromEntries(((camions.data??[]) as any[]).map(c=>[c.id,`${c.numero}${c.volume_m3?` · ${c.volume_m3} m³`:''}${c.poids_lourd?' PL':''}`])),
    equipiers:Object.fromEntries(((equipiers.data??[]) as any[]).map(e=>[e.id,[e.prenom,e.nom].filter(Boolean).join(' ')])),
  };
  return {ops,ctx,libelles};
}
