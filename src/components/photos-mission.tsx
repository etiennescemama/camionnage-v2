'use client';
import {useEffect,useRef,useState} from 'react';
import {createClient} from '@/lib/supabase/client';

const BUCKET='operations-photos';
const CATEGORIES=[{code:'enlevement',label:'Enlèvement'},{code:'livraison',label:'Livraison'},{code:'reserve',label:'Réserve / dommage'},{code:'constat',label:'Autre constat'}] as const;
type Photo={id:string;storage_path:string;categorie:string;legende:string|null;created_at:string;auteur_id:string|null};
type Envoi={cle:string;nom:string;etat:'compression'|'envoi'|'ok'|'erreur';message?:string;fichier:File;apercu:string};

// Réduit la photo à 2048 px et la recompresse en JPEG : 4 à 12 Mo deviennent 300 à 700 Ko,
// ce qui passe en 4G depuis un quai de chargement. L'orientation du téléphone est respectée.
export async function compresser(f:File,max=2048,qualite=0.82):Promise<Blob>{
  if(!/^image\/(jpeg|png|webp|heic|heif)$/i.test(f.type)&&!/\.(heic|heif)$/i.test(f.name))throw new Error('Format non reconnu : choisissez une photo.');
  try{
    const img=await createImageBitmap(f,{imageOrientation:'from-image'} as any);
    const k=Math.min(1,max/Math.max(img.width,img.height));
    const c=document.createElement('canvas');c.width=Math.round(img.width*k);c.height=Math.round(img.height*k);
    c.getContext('2d')!.drawImage(img,0,0,c.width,c.height);img.close?.();
    const b=await new Promise<Blob|null>(res=>c.toBlob(res,'image/jpeg',qualite));
    if(b)return b;
  }catch{/* HEIC hors Safari : envoi du fichier d'origine */}
  if(f.size>15*1024*1024)throw new Error('Photo trop lourde (15 Mo max) et impossible à réduire sur cet appareil.');
  return f;
}

export function PhotosMission({operationId,photos:initiales=[],peutAjouter,typeOperation,utilisateurId,close=false,titre='Photos'}:{operationId:string;photos?:Photo[];peutAjouter:boolean;typeOperation?:string;utilisateurId?:string;close?:boolean;titre?:string}){
  const db=useRef(createClient()).current;
  const [photos,setPhotos]=useState<Photo[]>(initiales),[urls,setUrls]=useState<Record<string,string>>({});
  const [envois,setEnvois]=useState<Envoi[]>([]),[categorie,setCategorie]=useState(typeOperation==='enlevement'?'enlevement':['livraison','installation'].includes(typeOperation??'')?'livraison':'constat'),[legende,setLegende]=useState('');
  const [erreur,setErreur]=useState('');const camera=useRef<HTMLInputElement>(null),galerie=useRef<HTMLInputElement>(null);

  // Liens temporaires (1 h) : le bucket est privé
  useEffect(()=>{const manquants=photos.map(p=>p.storage_path).filter(p=>!urls[p]);if(!manquants.length)return;let actif=true;
    db.storage.from(BUCKET).createSignedUrls(manquants,3600).then(({data})=>{if(actif&&data)setUrls(u=>({...u,...Object.fromEntries(data.filter(d=>d.signedUrl).map(d=>[d.path!,d.signedUrl as string]))}));});
    return()=>{actif=false;};},[photos]); // eslint-disable-line react-hooks/exhaustive-deps

  async function envoyer(e:Envoi){
    const maj=(x:Partial<Envoi>)=>setEnvois(l=>l.map(y=>y.cle===e.cle?{...y,...x}:y));
    if(categorie==='reserve'&&!legende.trim()){maj({etat:'erreur',message:'Décrivez la réserve avant l’envoi.'});return;}
    try{
      maj({etat:'compression',message:undefined});const blob=await compresser(e.fichier);
      maj({etat:'envoi'});
      const chemin=`${operationId}/${crypto.randomUUID()}.jpg`;
      const up=await db.storage.from(BUCKET).upload(chemin,blob,{contentType:blob.type||'image/jpeg',upsert:false});
      if(up.error)throw new Error(up.error.message);
      const {data,error}=await db.from('operation_photos').insert({operation_id:operationId,storage_path:chemin,categorie,legende:legende.trim()||null,taille_octets:blob.size}).select('id,storage_path,categorie,legende,created_at,auteur_id').single();
      if(error){await db.storage.from(BUCKET).remove([chemin]);throw new Error(error.message);}
      setPhotos(p=>[...p,data as Photo]);maj({etat:'ok'});
    }catch(x){maj({etat:'erreur',message:x instanceof Error?x.message:'Envoi impossible'});}
  }
  async function ajouter(fichiers:FileList|null){
    setErreur('');if(!fichiers?.length)return;
    if(categorie==='reserve'&&!legende.trim()){setErreur('Décrivez la réserve (ex. « angle du cadre enfoncé ») avant d’ajouter la photo.');return;}
    const nouveaux=[...fichiers].map(f=>({cle:crypto.randomUUID(),nom:f.name,etat:'compression' as const,fichier:f,apercu:URL.createObjectURL(f)}));
    setEnvois(l=>[...l.filter(x=>x.etat!=='ok'),...nouveaux]);
    for(const e of nouveaux)await envoyer(e); // une à une : plus fiable en réseau faible
    if(categorie==='reserve')setLegende('');
  }
  async function supprimer(p:Photo){
    if(!confirm('Supprimer cette photo ?'))return;
    const {error}=await db.from('operation_photos').delete().eq('id',p.id);
    if(error){setErreur(error.message);return;}
    await db.storage.from(BUCKET).remove([p.storage_path]);setPhotos(l=>l.filter(x=>x.id!==p.id));
  }
  const libelle=(c:string)=>CATEGORIES.find(x=>x.code===c)?.label??c;
  const enCours=envois.some(e=>e.etat==='compression'||e.etat==='envoi');

  return <section className="space-y-3" aria-label={titre}>
    <div className="flex justify-between items-baseline"><h3 className="text-xs uppercase text-mute">{titre}</h3><span className="text-xs text-mute">{photos.length} photo{photos.length>1?'s':''}</span></div>
    {photos.length>0&&<ul className="grid grid-cols-3 sm:grid-cols-4 gap-2">{photos.map(p=><li key={p.id} className="relative">
      <a href={urls[p.storage_path]} target="_blank" rel="noreferrer" className="block aspect-square rounded-lg overflow-hidden bg-fog border border-line">{urls[p.storage_path]&&<img src={urls[p.storage_path]} alt={p.legende??libelle(p.categorie)} loading="lazy" className="w-full h-full object-cover"/>}</a>
      <span className={`absolute left-1 top-1 text-[10px] px-1.5 py-0.5 rounded ${p.categorie==='reserve'?'bg-brick text-white':'bg-paper/90'}`}>{libelle(p.categorie)}</span>
      {p.legende&&<p className="text-[11px] leading-tight mt-1 line-clamp-2">{p.legende}</p>}
      {peutAjouter&&!close&&p.auteur_id===utilisateurId&&<button onClick={()=>supprimer(p)} aria-label="Supprimer la photo" className="absolute right-1 top-1 w-6 h-6 rounded-full bg-paper/90 text-sm">×</button>}
    </li>)}</ul>}
    {envois.filter(e=>e.etat!=='ok').map(e=><div key={e.cle} className="flex items-center gap-3 text-sm border border-line rounded-lg p-2">
      <img src={e.apercu} alt="" className="w-10 h-10 object-cover rounded"/><span className="flex-1">{e.etat==='compression'?'Préparation…':e.etat==='envoi'?'Envoi…':<span className="text-brick">{e.message}</span>}</span>
      {e.etat==='erreur'&&<button onClick={()=>envoyer(e)} className="text-cobalt-ink px-2 py-1">Réessayer</button>}
    </div>)}
    {peutAjouter&&<div className="space-y-2">
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Type de photo">{CATEGORIES.map(c=><button key={c.code} type="button" role="radio" aria-checked={categorie===c.code} onClick={()=>setCategorie(c.code)} className={`text-xs rounded-full px-3 py-1.5 border ${categorie===c.code?(c.code==='reserve'?'bg-brick text-white border-brick':'bg-ink text-white border-ink'):'border-line bg-paper'}`}>{c.label}</button>)}</div>
      {categorie==='reserve'&&<input value={legende} onChange={e=>setLegende(e.target.value)} placeholder="Décrivez la réserve (obligatoire)" className="w-full border border-brick rounded-lg p-3 text-sm" maxLength={300}/>}
      {categorie!=='reserve'&&<input value={legende} onChange={e=>setLegende(e.target.value)} placeholder="Légende (facultatif)" className="w-full border border-line rounded-lg p-3 text-sm" maxLength={300}/>}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" disabled={enCours} onClick={()=>camera.current?.click()} className="rounded-xl bg-ink text-white py-3 font-medium disabled:opacity-50">📷 Prendre une photo</button>
        <button type="button" disabled={enCours} onClick={()=>galerie.current?.click()} className="rounded-xl border border-line bg-paper py-3 font-medium disabled:opacity-50">Importer</button>
      </div>
      <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={e=>{void ajouter(e.target.files);e.target.value='';}}/>
      <input ref={galerie} type="file" accept="image/*" multiple hidden onChange={e=>{void ajouter(e.target.files);e.target.value='';}}/>
      {categorie==='reserve'&&<p className="text-xs text-brick">Le coordinateur et le planning sont prévenus immédiatement.</p>}
    </div>}
    {erreur&&<p role="alert" className="text-sm text-brick">{erreur}</p>}
  </section>;
}
