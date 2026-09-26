// Photos : droits de dépôt et de lecture (table et stockage), alerte sur réserve.
const {PGlite}=require('@electric-sql/pglite');const fs=require('node:fs'),assert=require('node:assert/strict');
const U={dispatch:'11111111-1111-4111-8111-111111111111',coordA:'a1111111-1111-4111-8111-111111111111',coordB:'b1111111-1111-4111-8111-111111111111',ch1:'c1111111-1111-4111-8111-111111111111',ch2:'c2222222-1111-4111-8111-111111111111'};
const DA='55555555-5555-4555-8555-555555555555',DB='56666666-5555-4555-8555-555555555555',OPA='66666666-6666-4666-8666-666666666666',OPB='77777777-7777-4777-8777-777777777777';
(async()=>{const db=new PGlite();
await db.exec(`create role authenticated;create role anon;create role service_role;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;create table utilisateurs(id uuid primary key,prenom text,nom text,email text,role text,actif boolean default true);create table clients(id uuid primary key default gen_random_uuid(),nom text);create table camions(id uuid primary key default gen_random_uuid(),numero text,immatriculation text);create table equipiers(id uuid primary key default gen_random_uuid(),prenom text);
create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner uuid default auth.uid());alter table storage.objects enable row level security;`);
for(const f of ['v2_01_schema','v2_02_adresses_planification','v2_03_suivi_alertes','v2_04_securite','v2_05_photos'])await db.exec(fs.readFileSync(`supabase/${f}.sql`,'utf8'));
await db.exec(`insert into utilisateurs(id,prenom,role,email) values('${U.dispatch}','Dispatch','dispatcheur','d@x'),('${U.coordA}','CoordA','coordinateur','a@x'),('${U.coordB}','CoordB','coordinateur','b@x'),('${U.ch1}','Ch1','chauffeur','c1@x'),('${U.ch2}','Ch2','chauffeur','c2@x');
insert into equipiers(id,prenom,utilisateur_id) values('33333333-3333-4333-8333-333333333333','Ch1','${U.ch1}'),('44444444-4444-4444-8444-444444444444','Ch2','${U.ch2}');
insert into demandes(id,etat,coordinateur_id,dispatcheur_id) values('${DA}','acceptee','${U.coordA}','${U.dispatch}'),('${DB}','acceptee','${U.coordB}',null);
insert into operations(id,demande_id,type_operation,etat) values('${OPA}','${DA}','livraison','planifiee'),('${OPB}','${DB}','livraison','planifiee');
insert into operation_equipiers(operation_id,equipier_id) values('${OPA}','33333333-3333-4333-8333-333333333333'),('${OPB}','44444444-4444-4444-8444-444444444444');
grant usage on schema public,auth,storage to authenticated;grant select,insert,update,delete on all tables in schema public,storage to authenticated;`);
const as=async(u,sql,p=[])=>{await db.exec(`reset role;select set_config('request.jwt.claim.sub','${u}',false);set role authenticated;`);try{return (await db.query(sql,p)).rows;}finally{await db.exec(`reset role;select set_config('request.jwt.claim.sub','',false);`);}};
const depot=(u,op,cat='constat',leg=null,chemin=null)=>as(u,`with o as (insert into storage.objects(bucket_id,name) values('operations-photos',$2) returning 1) insert into operation_photos(operation_id,storage_path,categorie,legende) select $1,$2,$3,$4 from o`,[op,chemin??`${op}/${Math.random().toString(36).slice(2)}.jpg`,cat,leg]);
await depot(U.ch1,OPA,'livraison');
await assert.rejects(()=>depot(U.ch1,OPB),/row-level security/,'Pas de photo sur la mission d’un autre');
await depot(U.coordA,OPA);await assert.rejects(()=>depot(U.coordB,OPA),/row-level security/);
await depot(U.dispatch,OPB);
await assert.rejects(()=>as(U.ch1,`insert into operation_photos(operation_id,storage_path) values($1,$2)`,[OPA,`${OPB}/x.jpg`]),/row-level security/,'Chemin rangé sous une autre mission');
assert.equal((await as(U.ch1,'select * from operation_photos')).length,2,'Le terrain voit les photos de ses missions seulement');
assert.equal((await as(U.ch1,'select * from storage.objects')).length,2);
assert.equal((await as(U.coordB,'select * from operation_photos')).length,3,'Le bureau voit tout');
// réserve : mail et notification au coordinateur et au dispatcheur, pas à l'auteur
await depot(U.ch1,OPA,'reserve','Angle du cadre enfoncé');
const alertes=(await db.query(`select recipient_id,subject from email_alerts where event_key like 'photo:%'`)).rows;
assert.deepEqual(alertes.map(a=>a.recipient_id).sort(),[U.coordA,U.dispatch].sort());assert.match(alertes[0].subject,/Réserve/);
assert.equal((await db.query(`select count(*)::int n from notifications where type='reserve'`)).rows[0].n,2);
// suppression : l'auteur tant que la mission n'est pas close
const mine=(await as(U.ch1,`select id from operation_photos where auteur_id=$1`,[U.ch1]))[0].id;
await db.query(`update operations set etat='terminee' where id=$1`,[OPA]);
await as(U.ch1,'delete from operation_photos where id=$1',[mine]);assert.equal((await db.query('select 1 from operation_photos where id=$1',[mine])).rows.length,1,'Photo conservée une fois la mission close');
assert.equal((await db.query(`select public from storage.buckets where id='operations-photos'`)).rows[0].public,false);
await db.exec(fs.readFileSync('supabase/v2_05_photos.sql','utf8'));
console.log('Photos OK : dépôt par l’équipe, le coordinateur ou le planning uniquement, lecture cloisonnée pour le terrain, chemin vérifié, alerte réserve, conservation après clôture, bucket privé, migration réexécutable.');
await db.close();})().catch(e=>{console.error(e);process.exit(1)});
