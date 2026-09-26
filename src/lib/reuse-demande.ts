// Copy only the request's editable content. Never copy IDs, assignments or execution data.
export function reusableDemande(source:any,operations:any[],newDate:string){
 const text=['client_id','contact_nom','contact_email','contact_telephone','objets','nb_colis','volume_m3','type_camion','observations'];
 const fields:any={};for(const k of text)fields[k]=source[k]==null?'':String(source[k]);
 for(const k of ['besoin_hayon','besoin_clim'])fields[k]=!!source[k];
 for(const k of ['nb_hommes','nb_camions','nb_jours'])fields[k]=source[k]??(k==='nb_hommes'?2:1);
 fields.code_affaire='';fields.date_souhaitee=newDate;fields.creneau=source.creneau??'matin';fields.rdv_heure='';fields.date_retour='';fields.creneau_retour=source.creneau_retour??'matin';
 const active=operations.filter(o=>o.etat!=='annulee').sort((a,b)=>(a.ordre??0)-(b.ordre??0));
 for(const period of ['aller','retour']){
  const groups=new Map<string,string[]>();for(const o of active.filter(o=>(o.periode??'aller')===period)){const key=`${o.jour??1}:${o.rotation??1}`;groups.set(key,[...(groups.get(key)??[]),o.type_operation]);}
  const patterns=[...groups.values()].map(c=>JSON.stringify(c));if(new Set(patterns).size>1)throw new Error('Les opérations varient selon les jours ou les camions. Créez une nouvelle demande avec un scénario pour éviter une reprise inexacte.');
 }
 const codes=(period:string)=>active.filter(o=>(o.periode??'aller')===period&&(o.jour??1)===1&&(o.rotation??1)===1).map(o=>o.type_operation);
 return {fields,aller:codes('aller'),retour:codes('retour')};
}
export function reusableTeam(op:any,camions:any[],equipiers:any[]){
 return {camion_id:camions.some(c=>c.id===op.camion_id)?op.camion_id:'',equipiers:[...(op.equipiers??[])].sort((a,b)=>Number(!!b.chef)-Number(!!a.chef)).map(e=>e.equipier_id??e.equipier?.id).filter((id:string)=>equipiers.some(e=>e.id===id)) as string[]};
}
