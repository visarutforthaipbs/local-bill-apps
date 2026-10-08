const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const S=require('../lib/sync-v3.cjs'),B=require('../lib/sync-v3-billing.cjs'),D=require('../lib/billing-data.cjs'),{SQLiteStore}=require('../lib/sqlite-store.cjs'),{BillingSyncController}=require('../lib/sync-v3-controller.cjs'),{rendererHarness}=require('./helpers/renderer-harness.cjs');
test('three durable devices preserve conflicting decisions until an explicit reviewed successor; replay cannot count twice',async t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'billngai-three-device-')),stores=[];t.after(()=>{for(const store of stores)store.close();fs.rmSync(root,{recursive:true,force:true});});
 const seed=rendererHarness().run('JSON.parse(JSON.stringify(DB))');seed.meta.reviewSemanticsVersion=3;
 const records=B.flatten(seed),hashes={};for(const [key,value] of Object.entries(records))hashes[key]={revision:1,hash:S.digest(value)};
 const files={},logs=[{sequence:1,operation:'bootstrap',changes:Object.entries(records).map(([key,record],i)=>{files['seed'+i]=record;return {key,base:0,revision:1,hash:S.digest(record),file:'seed'+i};})}],operations=new Map();
 let upgraded=0;const transport={upgradeProtocol:async()=>{upgraded++;},upload:async record=>{const file='file'+Object.keys(files).length;files[file]=record;return file;},download:async file=>files[file],pull:async cursor=>({transactions:logs.slice(cursor),cursor:logs.length}),commit:async request=>{
  if(operations.has(request.operation))return operations.get(request.operation);
  const changes=request.changes.map(c=>{assert.equal(c.base,hashes[c.key]?.revision||0);const revision=c.base+1;hashes[c.key]={revision,hash:c.hash};return {...c,revision};});
  const ack={ok:true,changes};logs.push({sequence:logs.length+1,operation:request.operation,changes});operations.set(request.operation,ack);return ack;
 }};
 function device(name){
  const dir=path.join(root,name);fs.mkdirSync(dir);const store=new SQLiteStore(path.join(dir,'billing.sqlite'),{validate:text=>D.validate(JSON.parse(text))});stores.push(store);
  const db=JSON.parse(JSON.stringify(seed)),state=S.initial('synthetic');Object.assign(state,{mode:'active',root:'root',records:B.flatten(db),heads:JSON.parse(JSON.stringify(hashes)),cursor:1});db.syncV3=state;let revision=store.write(JSON.stringify(db),'empty');
  const read=async()=>JSON.parse(store.read().text),write=async next=>{revision=store.write(JSON.stringify(next),revision);};
  return {read,controller:new BillingSyncController({account:'synthetic',read,write,transport,validateDatabase:D.validate})};
 }
 const a=device('mac-control'),b=device('pc'),c=device('iphone');
 const answer=(id,decision,supersedes=[])=>({id,type:'legacy_group_review',documentId:'i',groupKey:'legacy-parent:i',sourceRecords:seed.documents,decision,...(decision==='same_payment'?{representativeId:'r'}:{}),ownerConfirmed:true,note:'Synthetic reviewed answer',recordedAt:'2026-10-04T00:00:00.000Z',supersedes});
 const nextA=await a.read();nextA.reviewEvents.push(answer('a','same_payment'));await a.controller.save(nextA);
 const nextB=await b.read();nextB.reviewEvents.push(answer('b','not_income'));await b.controller.save(nextB);
 await Promise.all([a.controller.sync(),b.controller.sync(),c.controller.sync()]);
 for(const host of [a,b,c]){const db=await host.read(),r=D.resolveReviews(db.reviewEvents,'legacy-parent:i',db.documents,['r']);assert.equal(r.status,'conflict');assert.deepEqual(r.heads,['a','b']);}
 const resolved=await c.read();resolved.reviewEvents.push(answer('c','same_payment',['a','b']));await c.controller.save(resolved);
 await Promise.all([a.controller.sync(),b.controller.sync(),c.controller.sync()]);
 for(const host of [a,b,c]){
  await host.controller.sync();const db=await host.read();assert.equal(D.resolveReviews(db.reviewEvents,'legacy-parent:i',db.documents,['r']).answer.id,'c');
  const {ctx,run}=rendererHarness();ctx.incoming=db;run('DB=incoming');assert.equal(run('taxYearAgg(2026).agg.net'),1000);assert.equal(db.reviewEvents.length,3);
 }
 assert.ok(upgraded>=3);assert.equal(logs.length,4);
});
