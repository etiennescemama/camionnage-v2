'use client';
import {useEffect,useRef,useState} from 'react';
import type {Address} from '@/lib/address';
export function RouteMap({origin,destination,routes}:{origin:Address;destination:Address;routes:any[]}) {
  const div=useRef<HTMLDivElement>(null);const [error,setError]=useState('');
  useEffect(()=>{
    setError('');
    let alive=true;let map:import('leaflet').Map|undefined;
    import('leaflet').then(L=>{
      if(!alive || !div.current)return;
      map=L.map(div.current,{scrollWheelZoom:false});
      L.tileLayer(process.env.NEXT_PUBLIC_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:process.env.NEXT_PUBLIC_MAP_ATTRIBUTION || '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · Itinéraire HERE'}).on('tileerror',()=>{if(alive)setError('Fond de carte indisponible. Le tracé et les résultats restent consultables.');}).addTo(map);
      const points:import('leaflet').LatLngTuple[]=[];
      for(const [a,label] of [[origin,'A · Enlèvement'],[destination,'B · Livraison']] as const)if(a.lat!==undefined && a.lng!==undefined){const p:[number,number]=[a.lat,a.lng];points.push(p);const el=document.createElement('span');el.textContent=label;L.circleMarker(p,{radius:8,color:label.startsWith('A')?'#2743c6':'#246344'}).addTo(map).bindTooltip(el,{permanent:true});}
      routes.forEach((r,i)=>r.lines?.forEach((line:[number,number][])=>{const el=document.createElement('span');el.textContent=`Camion ${r.numero}`;L.polyline(line,{color:['#2743c6','#b06514','#39754a','#ab3579'][i%4],weight:4}).addTo(map!).bindTooltip(el);points.push(...line);}));
      if(points.length)map.fitBounds(L.latLngBounds(points),{padding:[35,35],maxZoom:15});else map.setView([48.85,2.35],6);
    }).catch(()=>setError('Carte indisponible. Les résultats chiffrés restent affichés.'));
    return ()=>{alive=false;map?.remove();};
  },[origin,destination,routes]);
  return <div>{error && <p role="alert">{error}</p>}<div ref={div} role="img" aria-label="Carte des points de départ, d’arrivée et des itinéraires calculés" className="h-80 rounded-xl relative z-0"/></div>;
}
