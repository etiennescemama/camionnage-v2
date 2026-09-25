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
const {vehicleParameters,summarizeRoute}=load('src/lib/routing.ts');
test('Adresses : champs séparés, codes postaux conservés et anciennes données préservées',()=>{
 const a={rue:'1 rue du Test',code_postal:'01230',ville:'Ville',pays:'France',lat:48,lng:2};
 const cols=addressColumns(a,'enlevement');assert.equal(cols.enlevement_code_postal,'01230');assert.equal(cols.adresse_enlevement,'1 rue du Test, 01230 Ville, France');assert.deepEqual(addressFrom(cols,'enlevement'),a);assert.equal(addressText({rue:'',ville:'',code_postal:'',pays:'France'}),'');assert.equal(addressFrom({adresse_enlevement:'Ancienne adresse complète'},'enlevement').rue,'Ancienne adresse complète');
});
test('Routage : profils PL/VL explicites, aucune dimension inventée',()=>{
 const c={hauteur_cm:350,largeur_cm:250,longueur_cm:900,ptac_kg:19000,essieux:2,poids_lourd:true};
 assert.equal(vehicleParameters(c).get('transportMode'),'truck');assert.equal(vehicleParameters(c).get('vehicle[currentWeight]'),'19000');assert.equal(vehicleParameters({...c,poids_lourd:false}).get('vehicle[commercial]'),'true');assert.throws(()=>vehicleParameters({...c,hauteur_cm:null}),/incomplet/);
});
test('Routage : péage absent reste inconnu, zéros et restrictions conservés',()=>{
 const section={travelSummary:{length:120000,duration:7200,tolls:{total:{type:'value',currency:'EUR',value:0}}}};
 assert.equal(summarizeRoute({sections:[section]}).toll_eur,0);
 assert.equal(summarizeRoute({sections:[{travelSummary:{length:1,duration:1}}]}).toll_eur,null);
 assert.equal(summarizeRoute({sections:[section,{travelSummary:{}}]}).toll_eur,null);
 assert.equal(summarizeRoute({sections:[section],notices:[{severity:'critical',title:'restriction'}]}).restricted,true);
 assert.equal(summarizeRoute({sections:[section,section]}).distance_m,240000);
});
