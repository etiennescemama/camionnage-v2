import {NextRequest,NextResponse} from 'next/server';
import {timingSafeEqual} from 'node:crypto';
import {createAdminClient} from '@/lib/supabase/admin';
import {alertEmail,sendAlert,emailConfig} from '@/lib/email';
import {traiterFileSms} from '@/lib/sms-file';
export const maxDuration=60;
export async function POST(req:NextRequest){
 const secret=process.env.ALERTS_CRON_SECRET;const supplied=req.headers.get('authorization')??'';
 if(!secret||Buffer.byteLength(supplied)!==Buffer.byteLength('Bearer '+secret)||!timingSafeEqual(Buffer.from(supplied),Buffer.from('Bearer '+secret)))return NextResponse.json({error:'Accès refusé'},{status:401});
 // SMS terrain d'abord : indépendants de la configuration mail
 let sms:any={actif:false};try{sms=await traiterFileSms(createAdminClient());}catch(e){sms={erreur:e instanceof Error?e.message:'SMS indisponibles'};}
 const {provider,key}=emailConfig(),from=process.env.ALERTS_FROM_EMAIL,site=process.env.NEXT_PUBLIC_SITE_URL;
 if(process.env.EMAIL_ALERTS_ENABLED!=='true'||!key||!from||!site)return NextResponse.json({error:'Alertes mail désactivées ou configuration incomplète.',sms},{status:sms.actif?200:503});
 try{alertEmail({subject:'',message:'',demande_id:''},from,from,site);}catch{return NextResponse.json({error:'URL du site invalide.'},{status:503});}
 const db=createAdminClient();const {data,error}=await db.rpc('claim_email_alerts');
 if(error)return NextResponse.json({error:'File de mails indisponible. Vérifiez la migration v2_03.'},{status:503});
 let processed=0;
 for(const a of data??[]){
  const {data:user,error:userError}=await db.from('utilisateurs').select('email,actif').eq('id',a.recipient_id).single();
  const result=userError?{status:'failed',last_error:'Destinataire inaccessible.'}:!user?.actif||!user.email?{status:'skipped',last_error:'Compte inactif ou sans adresse email.'}:await sendAlert(alertEmail(a,user.email,from,site),key,fetch,provider,a.id);
  const {error:saveError}=await db.from('email_alerts').update({...result,...(result.status==='pending'?{status:a.attempts>=5?'failed':'pending',available_at:new Date(Date.now()+15*60000).toISOString()}:{}),processed_at:new Date().toISOString()}).eq('id',a.id).eq('status','sending');
  if(saveError)return NextResponse.json({error:'État d’envoi non enregistré : vérifier MailerSend et la file avant toute relance.'},{status:500});
  processed++;
 }
 return NextResponse.json({processed,sms},{headers:{'Cache-Control':'no-store'}});
}
