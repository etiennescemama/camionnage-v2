export type Fournisseur = 'resend' | 'mailersend';
// Resend par défaut dès que sa clé est présente ; MailerSend conservé pour les installations existantes.
export function emailConfig(env: Record<string, string | undefined> = process.env) {
  const provider: Fournisseur = env.EMAIL_PROVIDER === 'mailersend' || (!env.RESEND_API_KEY && env.MAILERSEND_API_KEY) ? 'mailersend' : 'resend';
  const key = provider === 'resend' ? env.RESEND_API_KEY : env.MAILERSEND_API_KEY;
  return { provider, key, label: provider === 'resend' ? 'Resend' : 'MailerSend' };
}
export function alertEmail(alert:{subject:string;message:string;demande_id:string},to:string,from:string,site:string){
 const base=new URL(site);if(base.protocol!=='https:')throw new Error('Le site doit utiliser HTTPS.');
 const link=new URL('/demandes/'+encodeURIComponent(alert.demande_id),base.origin).toString();
 return {from:{email:from,name:'VFA / ATI · Opérations'},to:[{email:to}],subject:alert.subject,text:alert.message+'\n\nOuvrir le dossier (connexion requise) :\n'+link+'\n\nNotification automatique VFA / ATI.'};
}
type Payload = ReturnType<typeof alertEmail>;
type Resultat = {status:string;provider_id:string|null;last_error:string|null};

// idempotencyKey : identifiant de l'alerte. Resend ignore un second envoi portant la même clé
// pendant 24 h, ce qui rend les nouvelles tentatives sans risque de doublon.
export async function sendAlert(payload:Payload,key:string,request:typeof fetch=fetch,provider:Fournisseur='mailersend',idempotencyKey?:string):Promise<Resultat>{
 if(provider==='resend')return sendResend(payload,key,request,idempotencyKey);
 try{
  const r=await request('https://api.mailersend.com/v1/email',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(8000)});
  const provider_id=r.headers.get('x-message-id');
  if(r.status===202&&provider_id)return {status:r.headers.get('x-send-paused')==='true'?'paused':'accepted',provider_id,last_error:null};
  if(r.status===429)return {status:'pending',provider_id:null,last_error:'Limite MailerSend : nouvelle tentative différée.'};
  return {status:r.status>=500?'uncertain':'failed',provider_id,last_error:`Réponse MailerSend ${r.status}. Vérifiez le compte fournisseur avant de relancer.`};
 }catch{return {status:'uncertain',provider_id:null,last_error:'Réponse réseau inconnue. Vérifier MailerSend avant une relance pour éviter un doublon.'};}
}
async function sendResend(p:Payload,key:string,request:typeof fetch,idem?:string):Promise<Resultat>{
 const headers:Record<string,string>={Authorization:'Bearer '+key,'Content-Type':'application/json'};
 if(idem)headers['Idempotency-Key']='alerte-'+idem;
 const body={from:`${p.from.name} <${p.from.email}>`,to:p.to.map(t=>t.email),subject:p.subject,text:p.text};
 try{
  const r=await request('https://api.resend.com/emails',{method:'POST',headers,body:JSON.stringify(body),signal:AbortSignal.timeout(8000)});
  const j:any=await r.json().catch(()=>({}));
  if(r.ok&&j?.id)return {status:'accepted',provider_id:j.id,last_error:null};
  if(r.status===429)return {status:'pending',provider_id:null,last_error:'Limite Resend : nouvelle tentative différée.'};
  if(r.status===409)return {status:'uncertain',provider_id:null,last_error:'Resend signale un envoi déjà en cours avec cette clé : vérifier le journal Resend.'};
  if(r.status>=500)return idem?{status:'pending',provider_id:null,last_error:`Resend ${r.status} : nouvelle tentative sans risque de doublon.`}:{status:'uncertain',provider_id:null,last_error:`Resend ${r.status} : vérifier avant relance.`};
  return {status:'failed',provider_id:null,last_error:`Resend ${r.status} : ${j?.message??'refus'}. Vérifiez le domaine d'expédition et la clé.`};
 }catch{
  return idem?{status:'pending',provider_id:null,last_error:'Réseau indisponible : nouvelle tentative sans risque de doublon.'}:{status:'uncertain',provider_id:null,last_error:'Réponse réseau inconnue : vérifier Resend avant relance.'};
 }
}
