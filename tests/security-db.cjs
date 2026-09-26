// Audit de sécurité : chaque attaque est jouée avec un vrai jeton utilisateur (RLS active),
// exactement comme depuis la console du navigateur avec la clé publique Supabase.
// MODE=avant  → rejoue les attaques sur v2.7 et montre qu'elles passent.
// (défaut)    → applique v2_04 et exige qu'elles échouent, sans casser les parcours normaux.
const {PGlite}=require('@electric-sql/pglite');const fs=require('node:fs'),assert=require('node:assert/strict');
const AVANT=process.env.MODE==='avant';
const U={dispatch:'11111111-1111-4111-8111-111111111111',coordA:'a1111111-1111-4111-8111-111111111111',coordB:'b1111111-1111-4111-8111-111111111111',chauffeur:'c1111111-1111-4111-8111-111111111111'};
const TRUCK='22222222-2222-4222-8222-222222222222',TRUCK2='23333333-2222-4222-8222-222222222222';
const EQ_CH='33333333-3333-4333-8333-333333333333',EQ_TECH='44444444-4444-4444-8444-444444444444';
const DEM='55555555-5555-4555-8555-555555555555',OP1='66666666-6666-4666-8666-666666666666',OP2='77777777-7777-4777-8777-777777777777';
(async()=>{const db=new PGlite();
await db.exec(`create role authenticated;create role anon;create role service_role;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;create table utilisateurs(id uuid primary key,prenom text,nom text,email text,role text,actif boolean default true);create table clients(id uuid primary key default gen_random_uuid(),nom text);create table camions(id uuid primary key default gen_random_uuid(),numero text,immatriculation text);create table equipiers(id uuid primary key default gen_random_uuid(),prenom text);`);
for(const f of ['v2_01_schema','v2_02_adresses_planification','v2_03_suivi_alertes'])await db.exec(fs.readFileSync(`supabase/${f}.sql`,'utf8'));
if(!AVANT)await db.exec(fs.readFileSync('supabase/v2_04_securite.sql','utf8'));
await db.exec(`insert into utilisateurs(id,prenom,role) values('${U.dispatch}','Dispatch','dispatcheur'),('${U.coordA}','Coord A','coordinateur'),('${U.coordB}','Coord B','coordinateur'),('${U.chauffeur}','Chauffeur','chauffeur');
insert into camions(id,numero,volume_m3,hayon,climatise,poids_lourd)values('${TRUCK}','PL',35,true,true,true),('${TRUCK2}','PL2',35,true,true,true);
insert into equipiers(id,prenom,permis,utilisateur_id) values('${EQ_CH}','Conducteur','C','${U.chauffeur}'),('${EQ_TECH}','Technicien','B',null);
insert into demandes(id,nb_hommes,nb_camions,type_camion,etat,adresse_enlevement,adresse_livraison,coordinateur_id,date_souhaitee)values('${DEM}',2,1,'35','acceptee','Paris','Persan','${U.coordA}','2026-01-15');
insert into operations(id,demande_id,type_operation,adresse,date_prevue)values('${OP1}','${DEM}','enlevement','Paris','2026-01-15'),('${OP2}','${DEM}','livraison','Persan','2026-01-15');
grant usage on schema public,auth to authenticated;grant select,insert,update,delete on all tables in schema public to authenticated;grant usage,select on all sequences in schema public to authenticated;`);
const as=async(u,sql,p=[])=>{await db.exec(`reset role;select set_config('request.jwt.claim.sub','${u}',false);set role authenticated;`);try{return await db.query(sql,p);}finally{await db.exec('reset role');}};
const q=async(sql,p=[])=>{await db.exec(`reset role;select set_config('request.jwt.claim.sub','',false);`);return (await db.query(sql,p)).rows;};
const plan=(id,h,camion=TRUCK)=>as(U.dispatch,'select planifier_operation($1,$2,$3,$4,$5,$6,$7,$8,false)',[id,'2026-01-15',h,120,camion,[EQ_CH,EQ_TECH],'Consignes','Paris']);
await plan(OP1,'08:00');
// Chaque attaque renvoie true si elle a produit son effet.
const attaques={
 'Un chauffeur se nomme administrateur':async()=>{await as(U.chauffeur,`update utilisateurs set role='admin' where id=$1`,[U.chauffeur]).catch(()=>{});const r=(await q('select role from utilisateurs where id=$1',[U.chauffeur]))[0].role==='admin';await q(`update utilisateurs set role='chauffeur' where id=$1`,[U.chauffeur]);return r;},
 'Un compte désactivé se réactive seul':async()=>{await q('update utilisateurs set actif=false where id=$1',[U.coordB]);await as(U.coordB,'update utilisateurs set actif=true where id=$1',[U.coordB]).catch(()=>{});const r=(await q('select actif from utilisateurs where id=$1',[U.coordB]))[0].actif;await q('update utilisateurs set actif=true where id=$1',[U.coordB]);return r;},
 'Un coordinateur accepte lui-même sa demande':async()=>{await q(`update demandes set etat='envoyee' where id=$1`,[DEM]);await as(U.coordA,`update demandes set etat='acceptee',dispatcheur_id=$2 where id=$1`,[DEM,U.coordA]).catch(()=>{});const r=(await q('select etat,dispatcheur_id from demandes where id=$1',[DEM]))[0];const ok=r.dispatcheur_id===U.coordA;await q(`update demandes set etat='acceptee',dispatcheur_id=null where id=$1`,[DEM]);return ok;},
 'Un coordinateur crée une demande déjà acceptée':async()=>{const r=await as(U.coordA,`insert into demandes(etat,coordinateur_id) values('acceptee',$1) returning id`,[U.coordA]).catch(()=>null);if(!r)return false;await q('delete from demandes where id=$1',[r.rows[0].id]);return true;},
 'Un coordinateur crée une demande au nom d’un collègue':async()=>{const r=await as(U.coordA,`insert into demandes(etat,coordinateur_id) values('envoyee',$1) returning id`,[U.coordB]).catch(()=>null);if(!r)return false;await q('delete from demandes where id=$1',[r.rows[0].id]);return true;},
 'Un coordinateur affecte un camion sans contrôle de conflit':async()=>{await as(U.coordA,`update operations set camion_id=$2,heure_debut='08:30',etat='planifiee' where id=$1`,[OP2,TRUCK]).catch(()=>{});const r=(await q('select camion_id from operations where id=$1',[OP2]))[0].camion_id===TRUCK;await q(`update operations set camion_id=null,heure_debut=null,etat='a_planifier' where id=$1`,[OP2]);return r;},
 'Un chauffeur déplace sa mission et change de camion':async()=>{await as(U.chauffeur,`update operations set date_prevue='2026-10-15',camion_id=$2 where id=$1`,[OP1,TRUCK2]).catch(()=>{});const r=(await q('select camion_id from operations where id=$1',[OP1]))[0].camion_id===TRUCK2;await q(`update operations set date_prevue='2026-01-15',camion_id=$2 where id=$1`,[OP1,TRUCK]);return r;},
 'Un chauffeur déclare terminée une mission jamais démarrée':async()=>{await as(U.chauffeur,`update operations set etat='terminee',heure_arrivee='2026-01-15 07:00',heure_depart='2026-01-15 19:00' where id=$1`,[OP1]).catch(()=>{});const r=(await q('select etat from operations where id=$1',[OP1]))[0].etat==='terminee';await q(`update operations set etat='planifiee',heure_arrivee=null,heure_depart=null where id=$1`,[OP1]);return r;},
 'N’importe qui envoie une fausse notification à n’importe qui':async()=>{await as(U.chauffeur,`insert into notifications(destinataire_id,type,titre,message) values($1,'info','Urgent','Rappelez ce numéro')`,[U.dispatch]).catch(()=>{});const n=(await q(`select count(*)::int n from notifications where titre='Urgent'`))[0].n;await q(`delete from notifications where titre='Urgent'`);return n>0;},
 'Un chauffeur ajoute des photos sur la mission d’un autre':async()=>{await q(`update operation_equipiers set equipier_id=$2 where operation_id=$1 and equipier_id=$3`,[OP1,EQ_TECH,EQ_CH]).catch(()=>{});await q('delete from operation_equipiers where operation_id=$1 and equipier_id=$2',[OP1,EQ_CH]);await as(U.chauffeur,`insert into operation_photos(operation_id,storage_path) values($1,'x.jpg')`,[OP1]).catch(()=>{});await q('insert into operation_equipiers(operation_id,equipier_id,chef) values($1,$2,true) on conflict do nothing',[OP1,EQ_CH]);const n=(await q(`select count(*)::int n from operation_photos where storage_path='x.jpg'`))[0].n;await q(`delete from operation_photos where storage_path='x.jpg'`);return n>0;},
 'Un coordinateur efface une demande dont les missions sont réalisées':async()=>{await q(`update operations set etat='terminee' where id=$1`,[OP1]);const r=await as(U.coordA,'delete from demandes where id=$1 returning id',[DEM]).catch(()=>null);const gone=(await q('select 1 from demandes where id=$1',[DEM])).length===0;if(!gone)await q(`update operations set etat='planifiee' where id=$1`,[OP1]);return gone;},
};
let passees=0;const lignes=[];
for(const [nom,f] of Object.entries(attaques)){const ok=await f();if(ok)passees++;lignes.push(`${ok?'✗ PASSE ':'✓ bloquée'}  ${nom}`);if(!AVANT)assert.equal(ok,false,nom);if(nom.startsWith('Un coordinateur efface')&&ok)break;}
console.log(lignes.join('\n'));
if(AVANT){console.log(`\n${passees}/${Object.keys(attaques).length} attaques réussies sur v2.7`);await db.close();return;}
// Parcours légitimes qui doivent continuer à fonctionner après durcissement
await plan(OP2,'11:00');
await as(U.chauffeur,`update operations set etat='en_route' where id=$1`,[OP1]);
await as(U.chauffeur,`update operations set etat='sur_site',heure_arrivee=now() where id=$1`,[OP1]);
await as(U.chauffeur,`update operations set etat='terminee',heure_depart=now(),compte_rendu='RAS',signature_nom='M. Client' where id=$1`,[OP1]);
assert.equal((await q('select etat from operations where id=$1',[OP1]))[0].etat,'terminee');
await as(U.chauffeur,`insert into operation_photos(operation_id,storage_path) values($1::uuid,$1::text||'/ok.jpg')`,[OP1]);
await as(U.coordA,`update demandes set observations='Accès par la cour' where id=$1`,[DEM]);
await as(U.coordA,`update utilisateurs set prenom='Anne' where id=$1`,[U.coordA]);
const nd=(await as(U.coordA,`insert into demandes(etat,coordinateur_id,date_souhaitee) values('envoyee',$1,'2026-10-01') returning id`,[U.coordA])).rows[0].id;
await as(U.coordA,`insert into operations(demande_id,type_operation,date_prevue,etat) values($1,'enlevement','2026-10-01','a_planifier')`,[nd]);
await as(U.dispatch,`update demandes set etat='refusee',motif_refus='Pas de camion',dispatcheur_id=$2 where id=$1`,[nd,U.dispatch]);
await as(U.coordA,`update demandes set etat='envoyee',motif_refus=null where id=$1`,[nd]);
await as(U.dispatch,`update demandes set etat='acceptee',dispatcheur_id=$2 where id=$1`,[nd,U.dispatch]);
// Report de date par le coordinateur : les opérations non démarrées suivent, les affectées reviennent au planning
const op3=(await q('select id from operations where demande_id=$1',[nd]))[0].id;
await as(U.dispatch,'select planifier_operation($1,$2,$3,$4,$5,$6,$7,$8,false)',[op3,'2026-10-01','08:00',120,TRUCK2,[EQ_CH,EQ_TECH],'','Paris']).catch(e=>{throw new Error('plan op3: '+e.message)});
await as(U.coordA,`update demandes set date_souhaitee='2026-10-05' where id=$1`,[nd]);
const r3=(await q('select date_prevue::text d,etat,camion_id from operations where id=$1',[op3]))[0];
assert.equal(r3.d,'2026-10-05','La mission suit la nouvelle date');assert.equal(r3.etat,'a_planifier','La mission revient au planning');assert.equal(r3.camion_id,null);
assert.equal((await q(`select count(*)::int n from notifications where destinataire_id=$1 and type='modifiee'`,[U.dispatch]))[0].n>=1,true,'Le planning est prévenu');
await as(U.coordA,`update demandes set etat='annulee' where id=$1`,[nd]);
await as(U.coordA,`update operations set etat='annulee' where demande_id=$1`,[nd]);
const brouillon=(await as(U.coordA,`insert into demandes(etat,coordinateur_id) values('brouillon',$1) returning id`,[U.coordA])).rows[0].id;
await as(U.coordA,'delete from demandes where id=$1',[brouillon]);
await db.exec(fs.readFileSync('supabase/v2_04_securite.sql','utf8'));
console.log('\nParcours légitimes (chauffeur, coordinateur, planning, report de date, annulation) : OK · migration réexécutable : OK');
await db.close();
})().catch(e=>{console.error(e);process.exit(1)});
