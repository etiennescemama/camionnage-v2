// SMS terrain : quand une personne est prévenue, regroupement, veille, heures calmes.
const {PGlite}=require('@electric-sql/pglite');const fs=require('node:fs'),assert=require('node:assert/strict');
const paris=(d=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris'}).format(d);
const plus=(ymd,n)=>{const d=new Date(ymd+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
const AUJ=paris(),DEMAIN=plus(AUJ,1),LOIN=plus(AUJ,7);
const DIS='11111111-1111-4111-8111-111111111111',T='22222222-2222-4222-8222-222222222222';
const KARIM='33333333-3333-4333-8333-333333333333',LOIC='44444444-4444-4444-8444-444444444444',EVE='45555555-4444-4444-8444-444444444444',SANSTEL='46666666-4444-4444-8444-444444444444';
(async()=>{const db=new PGlite();
await db.exec(`create role authenticated;create role anon;create role service_role;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;create table utilisateurs(id uuid primary key,prenom text,nom text,email text,role text,actif boolean default true);create table clients(id uuid primary key default gen_random_uuid(),nom text);create table camions(id uuid primary key default gen_random_uuid(),numero text,immatriculation text);create table equipiers(id uuid primary key default gen_random_uuid(),prenom text);
create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner uuid);`);
for(const f of ['v2_01_schema','v2_02_adresses_planification','v2_03_suivi_alertes','v2_04_securite','v2_05_photos','v2_06_sms'])await db.exec(fs.readFileSync(`supabase/${f}.sql`,'utf8'));
await db.exec(`insert into utilisateurs(id,prenom,role) values('${DIS}','Dispatch','dispatcheur');
insert into camions(id,numero,volume_m3,hayon) values('${T}','12196',20,true);
insert into equipiers(id,prenom,permis,telephone) values('${KARIM}','Karim','B','06 12 34 56 78'),('${LOIC}','Loïc',null,'0611223344'),('${EVE}','Eve','B','0600000001'),('${SANSTEL}','Sam',null,null);
grant usage on schema public,auth to authenticated;grant select,insert,update,delete on all tables in schema public to authenticated;grant usage,select on all sequences in schema public to authenticated;`);
const q=async(s,p=[])=>(await db.query(s,p)).rows;
const asDis=async(s,p=[])=>{await db.exec(`select set_config('request.jwt.claim.sub','${DIS}',false);set role authenticated;`);try{return (await db.query(s,p)).rows;}finally{await db.exec(`reset role;select set_config('request.jwt.claim.sub','',false);`);}};
let n=0;const mission=async(jour,equipe,h='08:00')=>{++n;const did=`aaaaaaaa-${String(n).padStart(4,'0')}-4aaa-8aaa-aaaaaaaaaaaa`,oid=`bbbbbbbb-${String(n).padStart(4,'0')}-4bbb-8bbb-bbbbbbbbbbbb`;
  await q(`insert into demandes(id,etat,nb_hommes,nb_camions,type_camion,besoin_hayon) values($1,'acceptee',1,1,'20',true)`,[did]);
  await q(`insert into operations(id,demande_id,type_operation,adresse,date_prevue) values($1,$2,'livraison','Paris',$3)`,[oid,did,jour]);
  await asDis('select planifier_operation($1,$2,$3,$4,$5,$6,$7,$8,false)',[oid,jour,h,60,T,equipe,'','Paris']);return oid;};
const file=async()=>q(`select e.prenom,s.jour::text,s.nature,s.status,s.available_at from sms_alertes s join equipiers e on e.id=s.equipier_id order by e.prenom,s.jour,s.nature`);
const pending=async(prenom,jour,nature='changement')=>(await file()).filter(x=>x.prenom===prenom&&x.jour===jour&&x.nature===nature&&x.status==='pending');

// 1. Mission ajoutée aujourd'hui → SMS ; dans une semaine → rien (la feuille de la veille suffira)
const op1=await mission(AUJ,[KARIM,LOIC],'09:00');
assert.equal((await pending('Karim',AUJ)).length,1);assert.equal((await pending('Loïc',AUJ)).length,1);
await mission(LOIN,[EVE]);assert.equal((await file()).filter(x=>x.jour===LOIN).length,0,'Pas de SMS pour une mission lointaine');
// 2. Plusieurs changements rapprochés → un seul SMS en attente
await mission(AUJ,[KARIM,LOIC],'14:00');await asDis('select planifier_operation($1,$2,$3,$4,$5,$6,$7,$8,false)',[op1,AUJ,'10:00',60,T,[KARIM,LOIC],'','Paris']);
assert.equal((await pending('Karim',AUJ)).length,1,'Regroupés');
// 3. Réenregistrer sans changement : l'heure d'affectation ne bouge pas
const avant=(await q('select affecte_le from operation_equipiers where operation_id=$1 and equipier_id=$2',[op1,KARIM]))[0].affecte_le;
await asDis('select planifier_operation($1,$2,$3,$4,$5,$6,$7,$8,false)',[op1,AUJ,'10:00',60,T,[KARIM,LOIC],'','Paris']);
assert.equal((await q('select affecte_le from operation_equipiers where operation_id=$1 and equipier_id=$2',[op1,KARIM]))[0].affecte_le.getTime(),avant.getTime());
// 4. Retirer Loïc de la mission → Loïc prévenu ; Eve ajoutée → prévenue
await q(`update sms_alertes set status='sent'`);
await asDis('select planifier_operation($1,$2,$3,$4,$5,$6,$7,$8,false)',[op1,AUJ,'10:00',60,T,[KARIM,EVE],'','Paris']);
assert.equal((await pending('Loïc',AUJ)).length,1,'Loïc retiré');assert.equal((await pending('Eve',AUJ)).length,1,'Eve ajoutée');
// 5. Pas de numéro → rien
await q(`update sms_alertes set status='sent'`);await mission(AUJ,[KARIM,SANSTEL],'16:00');assert.equal((await file()).filter(x=>x.prenom==='Sam').length,0);
// 6. Veille : feuilles de demain une seule fois ; ensuite un changement pour demain part aussitôt
const opD=await mission(DEMAIN,[KARIM,LOIC]);assert.equal((await pending('Karim',DEMAIN)).length,0,'Avant la veille : rien');
await db.exec('set role service_role');const nb=(await q('select file_sms_veille($1) n',[DEMAIN]))[0].n;await db.exec('reset role');
assert.equal(nb,2);assert.equal((await q('select file_sms_veille($1) n',[DEMAIN]))[0].n,0,'Pas de doublon');
await q(`update sms_alertes set status='sent' where nature='veille'`);
await asDis('select planifier_operation($1,$2,$3,$4,$5,$6,$7,$8,false)',[opD,DEMAIN,'11:00',60,T,[KARIM,LOIC],'','Paris']);
assert.equal((await pending('Karim',DEMAIN)).length,1,'Changement après la feuille de la veille');
// 7. Heures calmes
const h=async ts=>(await q(`select to_char(heure_sms($1::timestamptz) at time zone 'Europe/Paris','HH24:MI') h`,[ts]))[0].h;
assert.equal(await h('2026-09-29 23:30:00+02'),'06:30');assert.equal(await h('2026-09-29 05:00:00+02'),'06:30');assert.equal(await h('2026-09-29 14:12:00+02'),'14:12');
// 8. File : droits
await db.exec('set role authenticated');await assert.rejects(()=>db.query('select * from claim_sms()'),/permission denied/);await db.exec('reset role;set role service_role');
const lot=(await q('select * from claim_sms()'));assert.ok(lot.every(x=>x.status==='sending'));await db.exec('reset role');
await db.exec(fs.readFileSync('supabase/v2_06_sms.sql','utf8'));
console.log('SMS OK : mission du jour ajoutée, retirée ou modifiée → personne prévenue ; missions lointaines attendues à la veille ; changements regroupés ; réenregistrement sans faux « nouveau » ; sans numéro ignoré ; feuille de veille unique ; heures calmes 21h-6h30 ; file réservée au serveur ; migration réexécutable.');
await db.close();})().catch(e=>{console.error(e);process.exit(1)});
