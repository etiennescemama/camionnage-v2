import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { currentUser } from '@/lib/auth';
import { EtatDemande } from '@/components/ui/badge';
import { fmtDate } from '@/lib/utils';
import { FILTERS, listDemandes, querySchema } from '@/lib/demande-query';
import { Plus, Search, Download, ArrowRight } from 'lucide-react';
export default async function Demandes({ searchParams }: { searchParams: Promise<Record<string,string | undefined>> }) {
  const raw = await searchParams;
  const clean = Object.fromEntries(Object.entries(raw).filter(([,v]) => v !== '' && v !== undefined));
  const parsed = querySchema.safeParse(clean);
  const p = parsed.success ? parsed.data : querySchema.parse({});
  const me = await currentUser(); const db = await createClient();
  const [{ data, count, error }, { data: clients }] = await Promise.all([
    listDemandes(db, me!.id, p), db.from('clients').select('id,nom').order('nom'),
  ]);
  const rows = data ?? []; const total = count ?? 0;
  const params = new URLSearchParams(Object.entries(p).filter(([,v]) => v !== undefined).map(([k,v]) => [k,String(v)]));
  const href = (changes: Record<string,string>) => { const next = new URLSearchParams(params); Object.entries(changes).forEach(([k,v]) => next.set(k,v)); return '/demandes?' + next; };
  const exportUrl = (format: string) => { const next = new URLSearchParams(params); next.set('format',format); return '/api/v1/demandes?' + next; };
  return <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-5">
    <header className="flex flex-wrap justify-between gap-4 items-center"><div><p className="text-xs uppercase tracking-widest text-mute mb-1">Exploitation</p><h1 className="text-2xl font-semibold">Demandes de transport</h1><p className="text-sm text-mute mt-1">Retrouvez une affaire et passez à l’action.</p></div>{['coordinateur','dispatcheur','admin'].includes(me!.role) && <Link href="/demandes/nouvelle" className="inline-flex items-center gap-2 rounded-lg bg-cobalt text-white px-4 py-3 text-sm font-medium"><Plus size={18}/>Nouvelle demande</Link>}</header>
    {!parsed.success && <p role="alert" className="bg-brick-soft text-brick p-3 rounded-lg">Les filtres de l’adresse sont invalides. Affichage des demandes actives.</p>}
    <nav aria-label="État des demandes" className="flex flex-wrap gap-2">{FILTERS.map(f => <Link aria-current={p.f === f.key ? 'page' : undefined} key={f.key} href={href({ f:f.key, page:'1' })} className={`rounded-full px-3 py-2 text-sm ${p.f === f.key ? 'bg-ink text-white' : 'bg-paper border border-line hover:bg-fog'}`}>{f.label}</Link>)}</nav>
    <form className="bg-paper border border-line rounded-xl p-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <input type="hidden" name="f" value={p.f}/>
      <label className="text-xs text-mute lg:col-span-2">Rechercher un numéro, une affaire ou un objet<div className="flex items-center border border-line rounded-lg mt-1 px-2"><Search size={16}/><input name="q" defaultValue={p.q} maxLength={100} placeholder="Ex. 26-00091, sculpture…" className="p-2 bg-transparent w-full text-sm text-ink"/></div></label>
      <label className="text-xs text-mute">Client<select name="client" defaultValue={p.client ?? ''} className="w-full mt-1 border border-line rounded-lg p-2 text-sm text-ink"><option value="">Tous les clients</option>{clients?.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}</select></label>
      <label className="text-xs text-mute">Du<input type="date" name="from" defaultValue={p.from} className="w-full mt-1 border border-line rounded-lg p-2 text-sm text-ink"/></label>
      <label className="text-xs text-mute">Au<input type="date" name="to" defaultValue={p.to} className="w-full mt-1 border border-line rounded-lg p-2 text-sm text-ink"/></label>
      <div className="sm:col-span-2 lg:col-span-5 flex gap-4 flex-wrap items-center"><label className="text-sm flex gap-2 items-center"><input type="checkbox" name="mine" value="1" defaultChecked={p.mine === '1'}/>Mes demandes</label><button className="bg-ink text-white px-4 py-2 rounded-lg text-sm">Rechercher</button><Link href="/demandes" className="text-sm underline text-mute">Réinitialiser</Link></div>
    </form>
    <div className="flex flex-wrap justify-between gap-3 text-sm"><p aria-live="polite"><strong>{total}</strong> résultat{total > 1 ? 's' : ''} · {p.limit} maximum par page</p><div className="flex gap-4"><a href={exportUrl('csv')} className="inline-flex items-center gap-1 text-cobalt-ink"><Download size={15}/>CSV · cette page</a><a href={exportUrl('json')} className="text-cobalt-ink">JSON · cette page</a></div></div>
    {error ? <p role="alert" className="bg-brick-soft text-brick p-5 rounded-lg">Impossible de charger les demandes. Réessayez en actualisant la page.</p> : rows.length === 0 ? <div className="p-12 text-center rounded-xl bg-paper border border-line"><h2 className="font-semibold">Aucune demande pour ces critères</h2><p className="text-sm text-mute mt-2">Élargissez les dates ou choisissez « Toutes ».</p></div> : <div className="bg-paper border border-line rounded-xl overflow-hidden"><div className="hidden md:grid grid-cols-[1.5fr_1fr_1fr_1fr_24px] gap-4 px-5 py-3 bg-fog text-xs text-mute"><span>Client / affaire</span><span>Date souhaitée</span><span>Moyens</span><span>Avancement</span><span/></div>{rows.map((d:any) => <Link key={d.id} href={`/demandes/${d.id}`} className="grid md:grid-cols-[1.5fr_1fr_1fr_1fr_24px] gap-3 md:gap-4 px-5 py-4 border-t border-line hover:bg-cobalt-soft/30 focus-visible:bg-cobalt-soft items-center"><div><div className="font-medium">{d.client?.nom ?? 'Client à préciser'}</div><div className="text-xs text-mute mt-1">{d.numero}{d.code_affaire && ` · ${d.code_affaire}`}</div></div><div className="text-sm">{fmtDate(d.date_souhaitee)}<p className="text-xs text-mute mt-1">{d.rdv_heure?.slice(0,5) ?? ({matin:'Matin',apres_midi:'Après-midi',journee:'Journée',rdv:'RDV'} as Record<string,string>)[d.creneau]}</p></div><div className="text-sm">{d.nb_camions ? `${d.nb_camions} × ${d.type_camion ?? '?'} m³` : 'Sans camion'}<p className="text-xs text-mute mt-1">{d.nb_hommes} équipiers{d.nb_camions > 1 ? ' / camion' : ''} · {d.nb_jours} j</p></div><div><EtatDemande etat={d.etat}/><p className="text-xs text-mute mt-1">{d.operations.filter((o:any) => ['planifiee','en_route','sur_site','terminee'].includes(o.etat)).length}/{d.operations.filter((o:any) => o.etat !== 'annulee').length} opérations prises en charge</p></div><ArrowRight size={16} className="hidden md:block text-mute"/></Link>)}</div>}
    <nav aria-label="Pagination" className="flex justify-between items-center text-sm">{p.page > 1 ? <Link className="border border-line rounded-lg p-2" href={href({page:String(p.page-1)})}>← Précédent</Link> : <span/>}<span>Page {p.page} / {Math.max(1,Math.ceil(total/p.limit))}</span>{p.page*p.limit < total ? <Link className="border border-line rounded-lg p-2" href={href({page:String(p.page+1)})}>Suivant →</Link> : <span/>}</nav>
  </div>;
}
