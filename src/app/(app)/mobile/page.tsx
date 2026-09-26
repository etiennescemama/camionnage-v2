import { createClient } from '@/lib/supabase/server';
import { currentUser } from '@/lib/auth';
import { addDays, todayYmd } from '@/lib/utils';
import { MobileOps } from './ops';
export default async function Mobile({searchParams}:{searchParams:Promise<{date?:string;equipier?:string}>}){
 const sp=await searchParams, date=sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) && !Number.isNaN(Date.parse(sp.date))?sp.date:todayYmd();
 const me=await currentUser();if(!me?.actif || !['chauffeur','admin','dispatcheur'].includes(me.role))return <p className="p-8">Cette vue est réservée au terrain et au responsable planning.</p>;
 const db=await createClient(),preview=me.role!=='chauffeur';
 const {data:mine,error:mineError}=await db.from('equipiers').select('id,prenom,nom').eq('utilisateur_id',me.id).eq('actif',true).maybeSingle();
 const {data:options}=preview?await db.from('equipiers').select('id,prenom,nom').eq('actif',true).order('prenom'):{data:[]};
 const selected=preview?(options??[]).find(e=>e.id===sp.equipier):mine;
 let ops:any[]=[],error=mineError&&!preview?'Rattachement au compte à vérifier auprès du planning.':'';
 if(selected){const {data:links,error:e1}=await db.from('operation_equipiers').select('operation_id').eq('equipier_id',selected.id);
  if(e1)error='Impossible de charger les affectations. Actualisez.';
  else if(links?.length){const {data,error:e2}=await db.from('operations').select('*,camion:camions(numero,immatriculation,poids_lourd),demande:demandes!inner(*,client:clients(nom)),equipiers:operation_equipiers(chef,affecte_le,equipier:equipiers(id,prenom,nom,telephone)),photos:operation_photos(id,storage_path,categorie,legende,created_at,auteur_id)').in('id',links.map(x=>x.operation_id)).eq('date_prevue',date).in('etat',['planifiee','en_route','sur_site','terminee']).in('demande.etat',['acceptee','planifiee','en_cours','terminee']).order('heure_debut').order('ordre');ops=data??[];if(e2)error='Impossible de charger les missions. Actualisez.';}}
 return <MobileOps ops={ops} date={date} prev={addDays(date,-1)} next={addDays(date,1)} prenom={selected?.prenom??me.prenom} preview={preview} equipiers={options??[]} equipierId={selected?.id??''} linked={!!selected} error={error} meId={me.id}/>;
}
