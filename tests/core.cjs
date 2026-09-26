const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
function load(relative) {
  const filename = path.resolve(relative);
  const compiled = ts.transpileModule(fs.readFileSync(filename,'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const m = new Module(filename, module); m.filename = filename; m.paths = Module._nodeModulePaths(path.dirname(filename)); m._compile(compiled, filename); return m.exports;
}
const {querySchema, listDemandes} = load('src/lib/demande-query.ts');
const {csvCell,demandesCsv} = load('src/lib/csv.ts');
test('Pagination bornée, dates et paramètres validés', () => {
  assert.equal(querySchema.parse({}).limit,50);
  for (const query of [{page:0},{page:1.5},{limit:101},{limit:-1},{from:'2026-02-30'},{from:'2026-10-01',to:'2026-09-01'},{f:'inconnu'},{format:'html'},{client:'bad'},{q:'x'.repeat(101)}]) assert.equal(querySchema.safeParse(query).success,false,JSON.stringify(query));
});
test('CSV : guillemets, retours ligne, formules et BOM', () => {
  assert.equal(csvCell('Jean "Paul"'),'"Jean ""Paul"""');
  assert.equal(csvCell('ligne 1\nligne 2'),'"ligne 1\nligne 2"');
  for (const input of ['=1+1',' +cmd','-2','@SUM(A1)','\ttext','\ntext']) assert.ok(csvCell(input).startsWith('"\''));
  assert.ok(demandesCsv([{numero:'C-1',client:{nom:'Musée'}}]).startsWith('\uFEFF'));
  assert.ok(demandesCsv([]).includes(';'));
});
test('Les filtres, le coordinateur et la pagination sont appliqués en base', async () => {
  const calls=[]; const chain = {};
  for (const method of ['select','in','eq','gte','lte','or','order','range']) chain[method]=(...args)=>{calls.push([method,...args]);return chain;};
  chain.then=resolve=>resolve({data:[],count:0,error:null});
  const db={from: table=>{assert.equal(table,'demandes');return chain;}};
  await listDemandes(db,'owner',querySchema.parse({f:'a_traiter',mine:'1',page:2,limit:25,q:'x),etat.eq.terminee',from:'2026-09-01',to:'2026-09-30'}));
  assert.ok(calls.some(c=>c[0]==='eq' && c[1]==='coordinateur_id' && c[2]==='owner'));
  assert.deepEqual(calls.find(c=>c[0]==='range'),['range',25,49]);
  assert.deepEqual(calls.find(c=>c[0]==='in'),['in','etat',['envoyee']]);
  const expression=calls.find(c=>c[0]==='or')[1];
  assert.equal(expression.split(',').length,3);
  assert.ok(!expression.includes(')'));
});
test('Le filtre Toutes ne restreint pas les états', async () => {
  const chain = {select(){return this;},order(){return this;},range(){return this;},in(){throw new Error('Unexpected state filter');},then(resolve){resolve({data:[],count:0});}};
  await listDemandes({from:()=>chain},'owner',querySchema.parse({f:'toutes'}));
});

const {watchNotifications} = load('src/lib/notifications.ts');
function notificationDb() {
  const channels = new Map(), pending = [], removed = [];
  const db = {
    channel(topic) {
      if (channels.has(topic)) return channels.get(topic);
      const ch = {
        joined:false,
        on(event, filter, callback) { if (this.joined) throw new Error('cannot add postgres_changes after subscribe()'); this.change=callback; return this; },
        subscribe(callback) { this.joined=true; this.status=callback; return this; },
      };
      channels.set(topic,ch);return ch;
    },
    removeChannel(ch) { removed.push(ch); return Promise.resolve('ok'); },
    from() {
      return {select(){return this;},eq(){return this;},order(){return this;},limit(){return new Promise(resolve=>pending.push(resolve));}};
    },
  };
  return {db,channels,pending,removed};
}
test('Notifications : remontage immédiat sans réutiliser un canal déjà abonné', async () => {
  const mock=notificationDb(), updates=[];
  const first=watchNotifications(mock.db,'same-user',x=>updates.push(x),()=>{});
  const firstChannel=[...mock.channels.values()][0];
  first.dispose();first.dispose();
  const second=watchNotifications(mock.db,'same-user',x=>updates.push(x),()=>{});
  assert.equal(mock.channels.size,2);
  assert.deepEqual(mock.removed,[firstChannel]);
  mock.pending[0]({data:[{id:'obsolete'}],error:null});
  mock.pending[1]({data:[{id:'current'}],error:null});
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(updates,[[{id:'current'}]]);
  firstChannel.change();
  second.dispose();assert.equal(mock.removed.length,2);
});
test('Notifications : le résultat le plus récent gagne et les erreurs sont visibles', async () => {
  const mock=notificationDb(), updates=[], errors=[];
  const stream=watchNotifications(mock.db,'user',x=>updates.push(x),e=>errors.push(e));
  const channel=[...mock.channels.values()][0];
  channel.status('SUBSCRIBED');
  mock.pending[1]({data:[{id:'new'}],error:null});
  mock.pending[0]({data:[{id:'old'}],error:null});
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(updates,[[{id:'new'}]]);
  channel.status('CHANNEL_ERROR');assert.match(errors.at(-1),/indisponibles/);
  const refresh=stream.refresh();mock.pending[2]({data:null,error:new Error('offline')});await refresh;
  assert.match(errors.at(-1),/Impossible de charger/);
  stream.dispose();
});

const {addressText,addressColumns,addressFrom}=load('src/lib/address.ts');
const {vehicleParameters,missingVehicleFields,summarizeRoute}=load('src/lib/routing.ts');
test('Adresses : champs séparés, codes postaux conservés et anciennes données préservées',()=>{
 const a={rue:'1 rue du Test',code_postal:'01230',ville:'Ville',pays:'France',lat:48,lng:2};
 const cols=addressColumns(a,'enlevement');assert.equal(cols.enlevement_code_postal,'01230');assert.equal(cols.adresse_enlevement,'1 rue du Test, 01230 Ville, France');assert.deepEqual(addressFrom(cols,'enlevement'),a);assert.equal(addressText({rue:'',ville:'',code_postal:'',pays:'France'}),'');assert.equal(addressFrom({adresse_enlevement:'Ancienne adresse complète'},'enlevement').rue,'Ancienne adresse complète');
});
test('Routage : profils PL/VL explicites, aucune dimension inventée',()=>{
 const c={hauteur_cm:350,largeur_cm:250,longueur_cm:900,ptac_kg:19000,essieux:2,poids_lourd:true};
 assert.deepEqual(missingVehicleFields(c),[]);assert.deepEqual(missingVehicleFields({...c,hauteur_cm:null,essieux:0}),['hauteur','essieux']);assert.equal(vehicleParameters(c).get('transportMode'),'truck');assert.equal(vehicleParameters(c).get('vehicle[currentWeight]'),'19000');assert.equal(vehicleParameters({...c,poids_lourd:false}).get('vehicle[commercial]'),'true');assert.equal(vehicleParameters({...c,hauteur_cm:null}).has('vehicle[height]'),false);assert.equal(vehicleParameters({poids_lourd:true}).get('transportMode'),'truck');assert.equal(vehicleParameters({ptac_kg:-1}).has('vehicle[grossWeight]'),false);
});
test('Routage : péage absent reste inconnu, zéros et restrictions conservés',()=>{
 const section={travelSummary:{length:120000,duration:7200,tolls:{total:{type:'value',currency:'EUR',value:0}}}};
 assert.equal(summarizeRoute({sections:[section]}).toll_eur,0);
 assert.equal(summarizeRoute({sections:[{travelSummary:{length:1,duration:1}}]}).toll_eur,null);
 assert.equal(summarizeRoute({sections:[section,{travelSummary:{}}]}).toll_eur,null);
 assert.equal(summarizeRoute({sections:[section],notices:[{severity:'critical',title:'restriction'}]}).restricted,true);
 assert.equal(summarizeRoute({sections:[section,section]}).distance_m,240000);
});

const {lifecycle}=load('src/lib/lifecycle.ts');
const {alertEmail,sendAlert}=load('src/lib/email.ts');
test('Suivi : affectation partielle, retour transport et comptes rendus distincts',()=>{
 const ops=[{etat:'terminee',compte_rendu:'RAS'},{etat:'a_planifier',periode:'retour'}];
 const s=lifecycle({etat:'en_cours'},ops);assert.equal(s.done,1);assert.equal(s.assigned,1);assert.equal(s.reports,1);assert.equal(s.returnsDone,0);assert.equal(s.stage,3);
 assert.match(lifecycle({etat:'terminee'},[{etat:'terminee'}]).action,/manquants/);
 assert.equal(lifecycle({etat:'annulee'},ops).stopped,true);
 assert.equal(lifecycle({etat:'envoyee'},[]).owner,'Responsable planning');
});
test('Emails : texte et URL internes, 202 accepté distinct de livraison, échec ambigu sans relance',async()=>{
 const payload=alertEmail({subject:'Test',message:'À vérifier',demande_id:'abc'},'dest@example.com','source@example.com','https://app.example.com');
 assert.match(payload.text,/https:\/\/app.example.com\/demandes\/abc/);assert.throws(()=>alertEmail({subject:'',message:'',demande_id:''},'','','http://example.com'));
 const fake=(status,headers={})=>async()=>new Response(null,{status,headers});
 assert.equal((await sendAlert(payload,'test',fake(202,{'x-message-id':'123'}))).status,'accepted');
 assert.equal((await sendAlert(payload,'test',fake(202,{'x-message-id':'123','x-send-paused':'true'}))).status,'paused');
 assert.equal((await sendAlert(payload,'test',fake(202))).status,'failed');
 assert.equal((await sendAlert(payload,'test',fake(429))).status,'pending');
 assert.equal((await sendAlert(payload,'test',async()=>{throw Error('timeout')})).status,'uncertain');
});

const {reusableDemande,reusableTeam}=load('src/lib/reuse-demande.ts');
test('Reprise : nouvelles dates, aucun identifiant ni exécution, opérations aller/retour conservées',()=>{
 const source={id:'old',numero:'OLD',client_id:'c',code_affaire:'old-code',date_souhaitee:'2020-01-01',date_retour:'2020-01-10',rdv_heure:'09:00',etat:'terminee',nb_camions:2,nb_jours:2,nb_hommes:3};
 const ops=[{type_operation:'enlevement',jour:1,rotation:1,periode:'aller',ordre:1},{type_operation:'livraison',jour:1,rotation:1,periode:'aller',ordre:2},{type_operation:'enlevement',jour:2,rotation:2,periode:'aller',ordre:3},{type_operation:'livraison',jour:2,rotation:2,periode:'aller',ordre:3.5},{type_operation:'livraison',periode:'retour',jour:1,rotation:1,ordre:4}];
 assert.throws(()=>reusableDemande(source,ops.filter(o=>o.ordre!==3.5),'2026-10-01'),/varient/);const c=reusableDemande(source,ops,'2026-10-01');assert.deepEqual(c.aller,['enlevement','livraison']);assert.deepEqual(c.retour,['livraison']);assert.equal(c.fields.date_souhaitee,'2026-10-01');for(const k of ['id','etat','numero','coordinateur_id'])assert.equal(c.fields[k],undefined);assert.equal(c.fields.code_affaire,'');assert.equal(c.fields.date_retour,'');assert.equal(c.fields.rdv_heure,'');assert.equal(c.fields.nb_camions,2);
});
test('Reprise équipe : chef conservé en premier, moyens absents des référentiels exclus',()=>{
 const p={camion_id:'old',equipiers:[{equipier_id:'a'},{equipier_id:'b',chef:true},{equipier_id:'inactive'}]};
 assert.deepEqual(reusableTeam(p,[],[{id:'a'},{id:'b'}]),{camion_id:'',equipiers:['b','a']});
});

test('Resend : clé d’idempotence, relance sans doublon, refus explicites', async () => {
  const {alertEmail,sendAlert,emailConfig}=load('src/lib/email.ts');
  const payload=alertEmail({subject:'Test',message:'Corps',demande_id:'abc'},'dest@example.com','ops@vfa.fr','https://app.example.com');
  let vu;const rep=(status,body)=>async(url,init)=>{vu={url,init};return new Response(JSON.stringify(body),{status});};
  const ok=await sendAlert(payload,'re_x',rep(200,{id:'em_1'}),'resend','alerte-1');
  assert.equal(ok.status,'accepted');assert.equal(ok.provider_id,'em_1');assert.equal(vu.url,'https://api.resend.com/emails');
  assert.equal(vu.init.headers['Idempotency-Key'],'alerte-alerte-1');const b=JSON.parse(vu.init.body);assert.equal(b.from,'VFA / ATI · Opérations <ops@vfa.fr>');assert.deepEqual(b.to,['dest@example.com']);
  assert.equal((await sendAlert(payload,'k',rep(429,{}),'resend','1')).status,'pending');
  assert.equal((await sendAlert(payload,'k',rep(503,{}),'resend','1')).status,'pending','Relance sûre grâce à la clé');
  assert.equal((await sendAlert(payload,'k',async()=>{throw Error('x')},'resend','1')).status,'pending');
  assert.equal((await sendAlert(payload,'k',async()=>{throw Error('x')},'resend')).status,'uncertain','Sans clé, prudence');
  const refus=await sendAlert(payload,'k',rep(403,{message:'domain not verified'}),'resend','1');assert.equal(refus.status,'failed');assert.match(refus.last_error,/domain not verified/);
  assert.equal(emailConfig({RESEND_API_KEY:'r'}).provider,'resend');assert.equal(emailConfig({MAILERSEND_API_KEY:'m'}).provider,'mailersend');
  assert.equal(emailConfig({RESEND_API_KEY:'r',MAILERSEND_API_KEY:'m',EMAIL_PROVIDER:'mailersend'}).provider,'mailersend');
});
