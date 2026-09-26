'use client';
import {useEffect,useState} from 'react';
import dynamic from 'next/dynamic';
import {createClient} from '@/lib/supabase/client';
import type {Address} from '@/lib/address';
const Planner=dynamic(()=>import('./route-planner').then(m=>m.RoutePlanner),{loading:()=> <p className="text-sm text-mute">Chargement de la carte…</p>});
type Props={origin:Address;destination:Address;camions?:any[];initialIds?:string[]};
function Content(p:Props){
 const [fleet,setFleet]=useState<any[]|undefined>(p.camions),[error,setError]=useState('');
 useEffect(()=>{if(p.camions){setFleet(p.camions);return;}let alive=true;createClient().from('camions').select('*').eq('actif',true).order('numero').then(({data,error})=>{if(!alive)return;if(error)setError('Véhicules indisponibles. Fermez puis réouvrez cette section pour réessayer.');else setFleet(data??[]);});return()=>{alive=false;};},[p.camions]);
 if(error)return <p role="alert" className="text-sm text-brick">{error}</p>;
 if(!fleet)return <p className="text-sm text-mute">Chargement des véhicules…</p>;
 return <Planner {...p} camions={fleet}/>;
}
export function LazyRoutePlanner(p:Props){const [open,setOpen]=useState(false);return <details className="rounded-xl border border-line bg-paper p-4" onToggle={e=>setOpen(e.currentTarget.open)}><summary className="font-medium text-sm">Carte, distance et durée · facultatif</summary>{open&&<div className="mt-4"><Content {...p}/></div>}</details>;}
