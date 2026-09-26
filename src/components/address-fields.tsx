'use client';
import {useEffect,useRef,useState} from 'react';
import {Field,Input} from './ui/input';
import {addressText,type Address} from '@/lib/address';
type Candidate=Address & {id?:string};
export function AddressFields({title,value,onChange}:{title:string;value:Address;onChange:(a:Address)=>void}) {
  const [candidates,setCandidates]=useState<Candidate[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false),[search,setSearch]=useState('');
  const generation=useRef(0),controller=useRef<AbortController>();
  function cancel(){generation.current++;controller.current?.abort();setBusy(false);setCandidates([]);setError('');}
  async function request(body:object,select=false){
    controller.current?.abort();const abort=new AbortController();controller.current=abort;const current=++generation.current;
    setBusy(true);setError('');setCandidates([]);
    try {const r=await fetch('/api/geocode',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:abort.signal});const j=await r.json();if(current!==generation.current)return;if(!r.ok)throw new Error(j.error);if(select && j.items?.[0]){onChange(j.items[0]);setSearch('');}else setCandidates(j.items??[]);if(!j.items?.length)setError('Aucune adresse trouvée. Ajoutez une ville ou un code postal.');}
    catch(e){if(current===generation.current && !abort.signal.aborted)setError(e instanceof Error?e.message:'Recherche indisponible');}finally{if(current===generation.current)setBusy(false);}
  }
  useEffect(()=>{if(search.trim().length<3)return;const timer=setTimeout(()=>{void request({q:search,suggest:true});},400);return ()=>clearTimeout(timer);},[search]);
  useEffect(()=>()=>{generation.current++;controller.current?.abort();},[]);
  function change(key:string,text:string){cancel();setSearch('');onChange({...value,[key]:text,lat:undefined,lng:undefined,label:undefined});}
  return <fieldset className="space-y-3 min-w-0"><legend className="font-semibold mb-2">{title}</legend>
    <Field label="Rechercher une adresse"><Input value={search} onChange={e=>{cancel();setSearch(e.target.value);}} onKeyDown={e=>{if(e.key==='Escape'){cancel();setSearch('');}}} autoComplete="off" placeholder="Commencez à taper : 12 rue des Archives Paris…"/></Field>
    <p className="text-xs text-mute">Dès 3 caractères, choisissez une proposition pour remplir la rue, le code postal et la ville.</p>
    {busy && <p role="status" className="text-sm text-mute">Recherche…</p>}
    {candidates.length>0 && <div aria-label="Propositions d’adresses" className="border border-line rounded-lg p-2 space-y-1">{candidates.map((a,i)=><button key={a.id??i} type="button" className="text-left text-sm block w-full p-2 hover:bg-fog focus:bg-fog" onClick={()=>{cancel();setSearch('');if(a.lat!==undefined){onChange(a);}else if(a.id){void request({id:a.id},true);}else{void request({q:a.label??addressText(a)},true);}}}>{a.label??addressText(a)}</button>)}</div>}
    {error && <p role="alert" className="text-sm text-brick">{error}</p>}
    <details open={value.lat===undefined}><summary className="text-sm font-medium mb-3">{value.lat!==undefined?addressText(value):'Saisie manuelle / détails de l’adresse'}</summary><div className="space-y-3"><Field label="N° et rue"><Input value={value.rue} onChange={e=>change('rue',e.target.value)} autoComplete="street-address" placeholder="12 rue des Archives"/></Field>
    <div className="grid grid-cols-[110px_1fr] gap-2"><Field label="Code postal"><Input value={value.code_postal} onChange={e=>change('code_postal',e.target.value)} autoComplete="postal-code"/></Field><Field label="Ville"><Input value={value.ville} onChange={e=>change('ville',e.target.value)} autoComplete="address-level2"/></Field></div>
    <Field label="Pays"><Input value={value.pays} onChange={e=>change('pays',e.target.value)} autoComplete="country-name"/></Field>
    </div></details><button type="button" onClick={()=>{cancel();setSearch('');void request({q:addressText(value)});}} disabled={busy || !value.rue || !value.ville} className="text-sm text-cobalt-ink underline disabled:opacity-50">{value.lat!==undefined?'Vérifier à nouveau sur la carte':'Localiser cette adresse'}</button>
    {value.lat!==undefined && <p className="text-xs text-moss">Point confirmé : {value.label??addressText(value)}</p>}
  </fieldset>;
}
