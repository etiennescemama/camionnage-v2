const {test}=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
function load(rel){const f=path.resolve(rel);const out=ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const m=new Module(f,module);m.filename=f;m.paths=Module._nodeModulePaths(path.dirname(f));m._compile(out,f);return m.exports;}
const {proposerJournee,trajetMin}=load('src/lib/auto-planning.ts');
const DEPOT={lat:48.927,lng:2.296},LOUVRE={lat:48.861,lng:2.336},VERSAILLES={lat:48.805,lng:2.120},MARAIS={lat:48.859,lng:2.362},ORSAY={lat:48.860,lng:2.327};
let n=0;const op=(o)=>({id:`op${++n}`,demande_id:o.d??`d${n}`,numero:`C-${n}`,client:'Musée',libelle:o.type??'enlevement',type_operation:o.type??'enlevement',ordre:o.ordre??1,periode:'aller',jour:1,rotation:1,duree_min:o.duree??60,adresse:'adresse' in o?o.adresse:'12 rue X',lieu:o.lieu??LOUVRE,creneau:o.creneau??'journee',rdv_heure:o.rdv??null,nb_hommes:o.hommes??2,nb_camions:1,type_camion:o.camion??'20',besoin_hayon:o.hayon??true,besoin_clim:o.clim??false});
const camion=(id,v,o={})=>({id,numero:id,volume_m3:v,hayon:true,climatise:!!o.clim,poids_lourd:!!o.pl});
const eq=(id,permis)=>({id,nom:id,permis});
const ctx=(camions,equipiers,extra={})=>({camions,equipiers,occupationCamion:{},occupationEquipier:{},depot:DEPOT,...extra});
const min=t=>{const [h,m]=t.split(':').map(Number);return h*60+m;};

test('Une rotation enlèvement → livraison reste sur le même camion et la même équipe, trajet compris',()=>{
  const a=op({d:'D1',type:'enlevement',ordre:1,lieu:LOUVRE,duree:60}),b=op({d:'D1',type:'livraison',ordre:2,lieu:VERSAILLES,duree:45});
  const p=proposerJournee([b,a],ctx([camion('T20',20)],[eq('Ali','B'),eq('Bea',null)]));
  assert.equal(p.non_places.length,0);assert.equal(p.lignes.length,2);
  const [l1,l2]=[a,b].map(o=>p.lignes.find(l=>l.operation_id===o.id));
  assert.equal(l1.camion_id,l2.camion_id);assert.deepEqual(l1.equipiers,l2.equipiers);
  assert.equal(min(l2.heure_debut),min(l1.heure_debut)+60+trajetMin(LOUVRE,VERSAILLES),'La livraison démarre après la route');
  assert.equal(l1.equipiers[0],'Ali','Le conducteur est chef de mission');
});
test('Remplit le camion déjà sorti avant d’en sortir un second, et garde les permis C pour les poids lourds',()=>{
  const ops=[op({lieu:LOUVRE,creneau:'matin'}),op({lieu:ORSAY,creneau:'matin'}),op({lieu:MARAIS,creneau:'apres_midi'})];
  const p=proposerJournee(ops,ctx([camion('T20a',20),camion('T20b',20),camion('PL35',35,{pl:true,clim:true})],[eq('Cyril','C'),eq('Ali','B'),eq('Bea',null),eq('Dan',null)]));
  assert.equal(p.non_places.length,0);assert.equal(p.indicateurs.camions_sortis,1,'Un seul camion pour trois petites missions');
  assert.ok(!p.lignes[0].equipiers.includes('Cyril'),'Le permis C reste libre pour un poids lourd');
  assert.ok(p.lignes.every(l=>l.camion_id!=='PL35'),'Le 35 m³ n’est pas gaspillé');
});
test('Un 35 m³ poids lourd reçoit un conducteur permis C en tête',()=>{
  const p=proposerJournee([op({camion:'35',clim:true})],ctx([camion('PL35',35,{pl:true,clim:true})],[eq('Ali','B'),eq('Bea',null),eq('Cyril','C')]));
  assert.equal(p.lignes[0].camion_id,'PL35');assert.equal(p.lignes[0].equipiers[0],'Cyril');
});
test('Un rendez-vous est tenu à l’heure exacte, les autres missions se calent autour',()=>{
  const rdv=op({creneau:'rdv',rdv:'10:00',duree:90}),libre=op({creneau:'matin',duree:60,lieu:ORSAY});
  const p=proposerJournee([libre,rdv],ctx([camion('T20',20)],[eq('Ali','B'),eq('Bea',null)]));
  assert.equal(p.lignes.find(l=>l.operation_id===rdv.id).heure_debut,'10:00');
  const l=p.lignes.find(l=>l.operation_id===libre.id);assert.ok(l,'La mission libre est placée');
  assert.ok(min(l.heure_debut)+60<=min('10:00')-trajetMin(ORSAY,LOUVRE)||min(l.heure_debut)>=min('11:30'),'Pas de chevauchement avec le RDV');
});
test('Refus motivés : pas de camion climatisé, lieu manquant, équipe insuffisante',()=>{
  const p=proposerJournee([op({clim:true}),op({adresse:null}),op({hommes:5})],ctx([camion('T20',20)],[eq('Ali','B'),eq('Bea',null)]));
  const r=p.non_places.map(x=>x.raison).join(' | ');
  assert.match(r,/climatisé/);assert.match(r,/Lieu à préciser/);assert.equal(p.non_places.length,3);
});
test('Respecte les missions déjà affectées et l’amplitude des équipiers',()=>{
  const c=ctx([camion('T20a',20),camion('T20b',20)],[eq('Ali','B'),eq('Bea',null),eq('Eve','B'),eq('Fil',null)],{occupationCamion:{T20a:[{debut:min('07:30'),fin:min('12:30'),lieu:LOUVRE}]},occupationEquipier:{Ali:[{debut:min('07:30'),fin:min('12:30')}],Bea:[{debut:min('07:30'),fin:min('12:30')}]},equipeCamion:{T20a:['Ali','Bea']}});
  const p=proposerJournee([op({creneau:'matin'})],c);
  assert.equal(p.lignes[0].camion_id,'T20b');assert.deepEqual(p.lignes[0].equipiers.sort(),['Eve','Fil']);
  const tard=proposerJournee([op({creneau:'apres_midi'})],c);
  assert.equal(tard.lignes[0].camion_id,'T20a','L’après-midi prolonge le camion déjà sorti');assert.deepEqual(tard.lignes[0].equipiers.sort(),['Ali','Bea'],'avec son équipe');
});
test('Sans camion : l’atelier emballage reçoit une équipe libre',()=>{
  const o={...op({type:'emballage',lieu:DEPOT,hommes:2}),nb_camions:0};
  const p=proposerJournee([o],ctx([],[eq('Gus',null),eq('Hugo',null)]));
  assert.equal(p.lignes[0].camion_id,null);assert.equal(p.lignes[0].equipiers.length,2);
});
test('Charge : 40 missions sur 8 camions et 20 personnes en moins de 200 ms, sans double réservation',()=>{
  const lieux=[LOUVRE,ORSAY,MARAIS,VERSAILLES];const ops=[];
  for(let i=0;i<40;i++)ops.push(op({lieu:lieux[i%4],creneau:['matin','apres_midi','journee'][i%3],duree:45+(i%4)*15}));
  const t=Date.now();const p=proposerJournee(ops,ctx(Array.from({length:8},(_,i)=>camion('T'+i,20)),Array.from({length:20},(_,i)=>eq('E'+i,i<10?'B':null))));
  assert.ok(Date.now()-t<200);
  const parCamion={};for(const r of p.rotations){(parCamion[r.camion_id]??=[]).push(r);}
  for(const l of Object.values(parCamion)){l.sort((a,b)=>a.debut-b.debut);for(let i=1;i<l.length;i++)assert.ok(l[i].debut>=l[i-1].fin,'Pas de chevauchement camion');}
  const parPers={};for(const r of p.rotations)for(const e of r.equipiers)(parPers[e]??=[]).push(r);
  for(const l of Object.values(parPers)){l.sort((a,b)=>a.debut-b.debut);for(let i=1;i<l.length;i++)assert.ok(l[i].debut>=l[i-1].fin,'Pas de chevauchement équipier');}
  assert.equal(p.lignes.length+p.non_places.reduce((n,x)=>n+x.operation_ids.length,0),40);
});
const {optionsInsertion}=load('src/lib/auto-planning.ts');
test('Journée en cours : rien avant l’heure plancher, RDV passé refusé',()=>{
  const c=ctx([camion('T20',20)],[eq('Ali','B'),eq('Bea',null)],{pasAvant:min('14:00')});
  const p=proposerJournee([op({creneau:'journee'}),op({creneau:'rdv',rdv:'10:00'}),op({creneau:'matin'})],c);
  assert.ok(p.lignes.every(l=>min(l.heure_debut)>=min('14:00')));
  const r=p.non_places.map(x=>x.raison).join('|');assert.match(r,/déjà passé/);assert.equal(p.non_places.length,2);
});
test('Insertion : la mission urgente va dans la tournée déjà sortie, avec son équipe, plutôt que sortir un camion',()=>{
  const c=ctx([camion('T20a',20),camion('T20b',20)],[eq('Ali','B'),eq('Bea',null),eq('Eve','B'),eq('Fil',null)],
    {occupationCamion:{T20a:[{debut:min('08:00'),fin:min('12:00'),lieu:LOUVRE}]},occupationEquipier:{Ali:[{debut:min('08:00'),fin:min('12:00')}],Bea:[{debut:min('08:00'),fin:min('12:00')}]},equipeCamion:{T20a:['Ali','Bea']},pasAvant:min('13:00')});
  const d='URG';const rot=[op({d,type:'enlevement',ordre:1,lieu:ORSAY}),op({d,type:'livraison',ordre:2,lieu:MARAIS})];
  const {options}=optionsInsertion(rot,c);
  assert.equal(options[0].camion_id,'T20a');assert.deepEqual(options[0].equipiers,['Ali','Bea']);assert.equal(options[0].camion_deja_sorti,true);
  assert.equal(options[0].lignes.length,2,'Toute la rotation est proposée');assert.ok(options[0].debut>=min('13:00'));
  assert.equal(options[1].camion_id,'T20b');
});
