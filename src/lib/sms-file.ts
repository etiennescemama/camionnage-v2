import {composerSms,envoyerSms,numeroInternational,smsConfig,type MissionSms} from './sms';
import {addDays,todayYmd} from './utils';

const heureParis=()=>new Intl.DateTimeFormat('fr-FR',{timeZone:'Europe/Paris',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date());

// Traite la file des SMS terrain. Appelée chaque minute par le job d'alertes existant.
export async function traiterFileSms(db:any,env:Record<string,string|undefined>=process.env){
  const cfg=smsConfig(env),site=env.NEXT_PUBLIC_SITE_URL;
  if(env.SMS_ENABLED!=='true'||!cfg.pret||!site)return {actif:false,envoyes:0,veille:0};
  const aujourdhui=todayYmd();let veille=0;
  if(heureParis()>=(env.SMS_VEILLE_HEURE||'18:00')){
    const {data}=await db.rpc('file_sms_veille',{p_jour:addDays(aujourdhui,1)});veille=Number(data??0);
  }
  const {data:file,error}=await db.rpc('claim_sms');
  if(error)throw new Error('File SMS indisponible : appliquez v2_06_sms.sql.');
  let envoyes=0;
  for(const a of file??[]){
    const fin=async(r:{status:string;provider_id?:string|null;last_error?:string|null;contenu?:string})=>{
      const relance=r.status==='pending'?{status:a.attempts>=5?'failed':'pending',available_at:new Date(Date.now()+5*60000).toISOString()}:{};
      await db.from('sms_alertes').update({...r,...relance,processed_at:new Date().toISOString()}).eq('id',a.id).eq('status','sending');
    };
    if(a.jour<aujourdhui){await fin({status:'skipped',last_error:'Journée passée.'});continue;}
    const {data:e}=await db.from('equipiers').select('prenom,telephone,actif').eq('id',a.equipier_id).single();
    const numero=numeroInternational(e?.telephone);
    if(!e?.actif||!numero){await fin({status:'skipped',last_error:'Équipier inactif ou numéro invalide sur sa fiche.'});continue;}
    const etats=a.nature==='veille'?['planifiee']:['planifiee','en_route','sur_site'];
    const {data:lignes}=await db.from('operation_equipiers').select('affecte_le,operation:operations!inner(heure_debut,type_operation,adresse,etat,updated_at,date_prevue,camion:camions(numero),demande:demandes!inner(etat,client:clients(nom)))').eq('equipier_id',a.equipier_id).eq('operation.date_prevue',a.jour).in('operation.etat',etats);
    const missions:MissionSms[]=(lignes??[]).filter((l:any)=>!['annulee','refusee'].includes(l.operation.demande?.etat)).map((l:any)=>({heure:l.operation.heure_debut,client:l.operation.demande?.client?.nom??'Client',type:l.operation.type_operation,adresse:l.operation.adresse,camion:l.operation.camion?.numero??null,etat:l.operation.etat,affecte_le:l.affecte_le,maj_le:l.operation.updated_at}));
    if(a.nature==='veille'&&!missions.length){await fin({status:'skipped',last_error:'Plus de mission ce jour-là.'});continue;}
    const {data:precedent}=await db.from('sms_alertes').select('processed_at').eq('equipier_id',a.equipier_id).eq('jour',a.jour).eq('status','sent').order('processed_at',{ascending:false}).limit(1).maybeSingle();
    const contenu=composerSms({nature:a.nature,jour:a.jour,aujourdhui,prenom:e.prenom??'',missions,dernierEnvoi:precedent?.processed_at??null,lien:new URL(`/mobile?date=${a.jour}`,site).toString()});
    const r=await envoyerSms(numero,contenu,env);
    await fin({...r,contenu});if(r.status==='sent')envoyes++;
  }
  return {actif:true,envoyes,veille};
}
