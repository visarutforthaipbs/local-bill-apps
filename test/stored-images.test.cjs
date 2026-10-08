const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const S=require('../lib/sync-v3.cjs'),B=require('../lib/sync-v3-billing.cjs'),BillingData=require('../lib/billing-data.cjs');
const script=fs.readFileSync(path.join(__dirname,'../billing.html'),'utf8').match(/<script>([\s\S]*)<\/script>\s*<\/body>/)[1].replace(/\bboot\(\);\s*$/,'');
const image=(type,bytes)=>'data:image/'+type+';base64,'+crypto.randomBytes(bytes).toString('base64');
const sha=text=>crypto.createHash('sha256').update(text).digest('hex');
function context(){
  const ctx=vm.createContext({BillingData,window:{addEventListener(){},matchMedia(){return {matches:false};}},
    document:{getElementById(){return {addEventListener(){},classList:{add(){},remove(){}}};},querySelectorAll(){return [];},addEventListener(){}},
    navigator:{platform:'Test'},console,TextEncoder,TextDecoder,setTimeout(){return 0;},clearTimeout(){},setInterval(){return 0;},
    localStorage:{getItem(){return null;},setItem(){}},confirm(){return true;},prompt(){return '2026-01-10';}});
  vm.runInContext(script,ctx);
  ctx.logo=image('png',60000);ctx.signature=image('jpeg',20000);
  vm.runInContext(`DB=blankDB(); DEVICE_ID='test';
    Object.assign(DB.business,{businessName:'Test issuer',address:'Bangkok',taxId:'1234567890123',isVatRegistered:false,vatStatus:'non_registered',logo,signature});
    DB.clients=[{id:'client',name:'Test buyer',address:'Bangkok'}];
    persist=async()=>true;render=()=>{};viewDoc=()=>{};toast=()=>{};closeModal=()=>{};openModal=()=>{};
    function fixture(overrides={}) { return {id:null,type:'receipt',number:null,clientId:'client',issueDate:'2026-01-10',paidDate:'2026-01-10',status:'issued',currency:'THB',vatRate:0,whtRate:3,whtReviewed:true,fullPaymentConfirmed:true,issueConfirmed:true,items:[{description:'Service',qty:1,price:10000}],...overrides}; }
    async function issue(id){const d=fixture({id});await persistDocumentMutation(d,null);return DB.documents.find(x=>x.id===id);}
  `,ctx);
  return ctx;
}
const run=(ctx,code)=>vm.runInContext(code,ctx);
test('a newly issued original stores each business image once and refers to it by content hash',async()=>{
  const ctx=context(),logoRef='asset:'+sha(ctx.logo),signatureRef='asset:'+sha(ctx.signature);
  const doc=JSON.parse(JSON.stringify(await run(ctx,"issue('r1')")));
  assert.equal(doc.status,'issued');assert.ok(doc.number);
  assert.equal(doc.issuedSnapshot.business.logo,logoRef);assert.equal(doc.issuedSnapshot.business.signature,signatureRef);
  assert.deepEqual(JSON.parse(JSON.stringify(run(ctx,'DB.assets'))),{[sha(ctx.logo)]:ctx.logo,[sha(ctx.signature)]:ctx.signature});
  assert.ok(doc.issuedSnapshot.renderedHtml.includes(logoRef));assert.ok(doc.issuedSnapshot.renderedHtml.includes(signatureRef));
  assert.ok(!JSON.stringify(doc).includes(ctx.logo.slice(0,200)));assert.ok(!JSON.stringify(doc).includes(ctx.signature.slice(0,200)));
  assert.ok(JSON.stringify(doc).length<20000,'issued document bytes: '+JSON.stringify(doc).length);
  // What is shown and printed is exactly the archived HTML with the stored images put back.
  const shown=run(ctx,"renderPaper(DB.documents.find(d=>d.id==='r1'))");
  assert.ok(shown.includes(ctx.logo));assert.ok(shown.includes(ctx.signature));
  assert.equal(doc.issuedSnapshot.renderedHtml.split(logoRef).join(ctx.logo).split(signatureRef).join(ctx.signature),shown);
  assert.equal(run(ctx,'JSON.stringify(DB.business.logo===logo&&DB.business.signature===signature)'),'true','settings keep their own images');
  // A second document reuses the stored images instead of adding copies.
  await run(ctx,"issue('r2')");assert.equal(run(ctx,'Object.keys(DB.assets).length'),2);
  assert.ok(run(ctx,'JSON.stringify(DB)').length<ctx.logo.length*2+ctx.signature.length*2+40000);
  BillingData.validate(JSON.parse(run(ctx,'JSON.stringify(DB)')));
});
test('changing the logo later never changes an issued original',async()=>{
  const ctx=context();await run(ctx,"issue('r1')");const before=run(ctx,"renderPaper(DB.documents[0])");
  ctx.newLogo=image('png',5000);run(ctx,'DB.business={...DB.business,logo:newLogo}');
  assert.equal(run(ctx,"renderPaper(DB.documents[0])"),before);
  const next=JSON.parse(JSON.stringify(await run(ctx,"issue('r2')")));
  assert.equal(next.issuedSnapshot.business.logo,'asset:'+sha(ctx.newLogo));assert.equal(run(ctx,'Object.keys(DB.assets).length'),3);
  assert.ok(run(ctx,"renderPaper(DB.documents[1])").includes(ctx.newLogo));assert.equal(run(ctx,"renderPaper(DB.documents[0])"),before);
});
test('an older original with embedded images is left exactly as issued and still displays',()=>{
  const ctx=context();run(ctx,"const old=fixture({id:'old',number:'RC-OLD'});freezeIssuedDocument(old);DB.documents.push(old);");
  const doc=JSON.parse(run(ctx,'JSON.stringify(DB.documents[0])'));
  assert.equal(doc.issuedSnapshot.business.logo,ctx.logo);assert.ok(doc.issuedSnapshot.renderedHtml.includes(ctx.logo));
  assert.equal(run(ctx,'Object.keys(DB.assets).length'),0);
  assert.equal(run(ctx,'renderPaper(DB.documents[0])'),doc.issuedSnapshot.renderedHtml);
  BillingData.validate(JSON.parse(run(ctx,'JSON.stringify(DB)')));
});
test('an image outside the stored form stays embedded, and a missing or altered stored image is refused',async()=>{
  const ctx=context();ctx.odd=ctx.logo.replace('base64,','base64, ');run(ctx,'DB.business={...DB.business,logo:odd}');
  const doc=JSON.parse(JSON.stringify(await run(ctx,"issue('r1')")));
  assert.equal(doc.issuedSnapshot.business.logo,ctx.odd);assert.equal(doc.issuedSnapshot.business.signature,'asset:'+sha(ctx.signature));
  const db=JSON.parse(run(ctx,'JSON.stringify(DB)'));BillingData.validate(db);
  const missing=JSON.parse(JSON.stringify(db));missing.assets={};assert.throws(()=>BillingData.validate(missing),/DATA_INVALID_SCHEMA/);
  const altered=JSON.parse(JSON.stringify(db));altered.assets[sha(ctx.signature)]=image('jpeg',20000);assert.throws(()=>BillingData.validate(altered),/DATA_INVALID_SCHEMA/);
});
test('stored images sync as their own records, first in an operation, and survive a round trip',async()=>{
  const ctx=context();await run(ctx,"issue('r1')");const db=JSON.parse(run(ctx,'JSON.stringify(DB)'));delete db.syncV3;
  const records=B.flatten(db),keys=Object.keys(records).filter(k=>k.startsWith('asset:'));
  assert.deepEqual(keys.sort(),['asset:'+sha(ctx.logo),'asset:'+sha(ctx.signature)].sort());
  const state=S.initial('acct');state.records=records;
  assert.deepEqual(B.project(db,state),db);
  const pending=S.prepare(state,B.seal).pending.changes.map(c=>c.key);
  assert.ok(pending.slice(0,2).every(k=>k.startsWith('asset:')),pending.join(','));
  assert.ok(Buffer.byteLength(S.canonical(records['document:r1']))<20000);
  // Removing a stored image is not a valid change to a connected workspace.
  const without=JSON.parse(JSON.stringify(db));without.assets={};
  assert.throws(()=>B.validateTransition(db,without),/SYNC_USE_TOMBSTONE/);
});
