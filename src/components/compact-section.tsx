'use client';
import {useEffect,useId,useState} from 'react';
export function CompactSection({title,summary,defaultOpen=false,children}:{title:string;summary:string;defaultOpen?:boolean;children:React.ReactNode}){
 const [open,setOpen]=useState(defaultOpen),[wide,setWide]=useState(false);const id=useId();
 useEffect(()=>{const query=window.matchMedia('(min-width: 1024px)');const update=()=>setWide(query.matches);update();query.addEventListener('change',update);return()=>query.removeEventListener('change',update);},[]);
 const expanded=wide||open;
 return <section className="rounded-lg border border-line bg-paper" onInvalidCapture={e=>{setOpen(true);const target=e.target as HTMLElement;requestAnimationFrame(()=>target.focus());}}><header className="px-4 py-3"><button type="button" aria-expanded={expanded} aria-controls={id} onClick={()=>setOpen(!open)} className="w-full flex justify-between items-start gap-3 text-left lg:pointer-events-none"><span><span className="font-semibold block">{title}</span><span className="text-sm text-mute block mt-1 whitespace-pre-line lg:hidden">{summary}</span></span><span className="text-xs underline shrink-0 mt-1 lg:hidden">{open?'Réduire':'Modifier'}</span></button></header><div id={id} hidden={!expanded} className="p-4 border-t border-line">{children}</div></section>;
}
