const {test}=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
function load(rel){const f=path.resolve(rel);const out=ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const m=new Module(f,module);m.filename=f;m.paths=Module._nodeModulePaths(path.dirname(f));m._compile(out,f);return m.exports;}
const {numeroInternational,versGsm,segments,composerSms,envoyerSms,smsConfig}=load('src/lib/sms.ts');
test('Numéros : formats français et internationaux',()=>{
  assert.equal(numeroInternational('06 12 34 56 78'),'+33612345678');assert.equal(numeroInternational('06.12.34.56.78'),'+33612345678');
  assert.equal(numeroInternational('0033 6 12 34 56 78'),'+33612345678');assert.equal(numeroInternational('+44 7911 123456'),'+447911123456');
  for(const n of ['','612345678','06 12','abc',null])assert.equal(numeroInternational(n),null);
});
test('Texte GSM : pas de caractère qui double le coût',()=>{
  assert.equal(versGsm('Arrêt à l’hôtel « Crillon » – façade'),'Arret à l\'hotel "Crillon" - facade');
  assert.equal(versGsm('été, où, à, É'),'été, où, à, É');
});
const m=(h,client,o={})=>({heure:h+':00',client,type:o.type??'livraison',adresse:o.adresse??'12 rue de Rivoli\n75001 Paris',camion:o.camion??'12196',etat:o.etat??'planifiee',affecte_le:o.affecte??'2026-09-29T06:00:00Z',maj_le:o.maj??'2026-09-29T06:00:00Z'});
test('Feuille de la veille : horaires triés, camion, lien, 3 SMS maximum',()=>{
  const t=composerSms({nature:'veille',jour:'2026-09-30',aujourdhui:'2026-09-29',prenom:'Karim',missions:[m('13:30','Carnavalet',{type:'enlevement'}),m('08:07','Galerie Mitterrand',{type:'enlevement'})],dernierEnvoi:null,lien:'https://x.app/mobile?date=2026-09-30'});
  assert.match(t,/^VFA - Karim, demain mer 30\/09 : 08:07 Galerie Mitterrand \(enlèvement\), 12 rue de Rivoli ; 13:30 Carnavalet/);
  assert.match(t,/Camion 12196\. Détail : https:\/\/x\.app/);assert.ok(segments(t)<=3);
  const beaucoup=Array.from({length:15},(_,i)=>m(String(7+i%12).padStart(2,'0')+':'+String(i*3%60).padStart(2,'0'),'Client très long numéro '+i));
  const long=composerSms({nature:'veille',jour:'2026-09-30',aujourdhui:'2026-09-29',prenom:'Karim',missions:beaucoup,dernierEnvoi:null,lien:'https://x.app/mobile'});
  assert.ok(long.length<=459,String(long.length));assert.match(long,/\+\d+ autre\(s\)/);assert.match(long,/Détail/);
});
test('Changement du jour : NOUVEAU et MODIFIE depuis le dernier SMS, et plus aucune mission',()=>{
  const t=composerSms({nature:'changement',jour:'2026-09-29',aujourdhui:'2026-09-29',prenom:'Karim',dernierEnvoi:'2026-09-29T10:00:00Z',lien:'https://x.app/m',missions:[
    m('08:07','Mitterrand',{etat:'terminee'}),m('14:30','Fondation',{affecte:'2026-09-29T11:00:00Z'}),m('16:00','Orsay',{maj:'2026-09-29T11:00:00Z'})]});
  assert.match(t,/planning modifié aujourd'hui/);assert.match(t,/NOUVEAU 14:30 Fondation/);assert.match(t,/MODIFIE 16:00 Orsay/);assert.doesNotMatch(t,/MODIFIE 08:07|NOUVEAU 08:07/);
  assert.match(composerSms({nature:'changement',jour:'2026-09-29',aujourdhui:'2026-09-29',prenom:'Karim',dernierEnvoi:null,lien:'x',missions:[]}),/plus aucune mission aujourd'hui/);
});
test('Envoi Brevo et Twilio',async()=>{
  let vu;const rep=(status,body)=>async(url,init)=>{vu={url,init};return new Response(JSON.stringify(body),{status});};
  const env={BREVO_API_KEY:'k',SMS_SENDER:'VFA Art!'};
  const r=await envoyerSms('+33612345678','Test',env,rep(201,{messageId:42}));
  assert.equal(r.status,'sent');assert.equal(vu.url,'https://api.brevo.com/v3/transactionalSMS/sms');assert.equal(vu.init.headers['api-key'],'k');
  const b=JSON.parse(vu.init.body);assert.equal(b.recipient,'33612345678');assert.equal(b.sender,'VFAArt');assert.equal(b.type,'transactional');
  assert.equal((await envoyerSms('+33612345678','x',env,rep(402,{}))).last_error,'Crédits SMS Brevo épuisés.');
  assert.equal((await envoyerSms('+33612345678','x',env,rep(429,{}))).status,'pending');
  assert.equal((await envoyerSms('+33612345678','x',env,async()=>{throw Error()})).status,'uncertain');
  const tw={SMS_PROVIDER:'twilio',TWILIO_ACCOUNT_SID:'AC1',TWILIO_AUTH_TOKEN:'t',TWILIO_FROM:'+33700000000'};
  assert.equal(smsConfig(tw).pret,true);
  const r2=await envoyerSms('+33612345678','Hello',tw,rep(201,{sid:'SM1'}));assert.equal(r2.provider_id,'SM1');assert.match(vu.url,/Accounts\/AC1\/Messages\.json/);assert.equal(vu.init.body.get('To'),'+33612345678');
});
