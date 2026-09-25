'use client';
import {useState} from 'react';
import {Field,Input} from './ui/input';
import {addressText,type Address} from '@/lib/address';
export function AddressFields({title,value,onChange}:{title:string;value:Address;onChange:(a:Address)=>void}) {
  const [candidates,setCandidates]=useState<Address[]>([]), [error,setError]=useState(''),[busy,setBusy]=useState(false);
  function change(key:string,text:string) {setCandidates([]);setError('');onChange({...value,[key]:text,lat:undefined,lng:undefined,label:undefined});}
  async function locate() {
    setBusy(true);setError('');setCandidates([]);
    try {const r=await fetch('/api/geocode',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({q:addressText(value)})});const j=await r.json();if(!r.ok)throw new Error(j.error);setCandidates(j.items);if(!j.items.length)setError('Adresse introuvable. Précisez le numéro, la rue et la ville.');}
    catch(e){setError(e instanceof Error?e.message:'Recherche indisponible');}finally{setBusy(false);}
  }
  return <fieldset className="space-y-3 min-w-0"><legend className="font-semibold mb-2">{title}</legend><Field label="N° et rue"><Input value={value.rue} onChange={e=>change('rue',e.target.value)} autoComplete="street-address" placeholder="12 rue des Archives"/></Field><div className="grid grid-cols-[110px_1fr] gap-2"><Field label="Code postal"><Input value={value.code_postal} onChange={e=>change('code_postal',e.target.value)} autoComplete="postal-code"/></Field><Field label="Ville"><Input value={value.ville} onChange={e=>change('ville',e.target.value)} autoComplete="address-level2"/></Field></div><Field label="Pays"><Input value={value.pays} onChange={e=>change('pays',e.target.value)} autoComplete="country-name"/></Field><button type="button" onClick={locate} disabled={busy || !value.rue || !value.ville} className="text-sm text-cobalt-ink underline disabled:opacity-50">{busy?'Recherche…':value.lat !== undefined?'Vérifier à nouveau sur la carte':'Localiser cette adresse'}</button>{value.lat !== undefined && <p className="text-xs text-moss">Point confirmé : {value.label ?? addressText(value)}</p>}{error && <p role="alert" className="text-sm text-brick">{error}</p>}{candidates.length>0 && <div className="border border-line rounded-lg p-2 space-y-1"><p className="text-xs text-mute">Confirmez l’adresse exacte :</p>{candidates.map((a,i)=><button key={i} type="button" className="text-left text-sm block w-full p-2 hover:bg-fog" onClick={()=>{onChange(a);setCandidates([]);}}>{a.label ?? addressText(a)}</button>)}</div>}</fieldset>;
}
