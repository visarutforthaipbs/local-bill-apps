// Regressions for the 2026-09-30 live two-Mac test findings (synthetic data only):
// false conflicts, half-applied payments, and backups that re-bind or lock sync.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),vm=require('node:vm');
const S=require('../lib/sync-v3.cjs'),B=require('../lib/sync-v3-billing.cjs');
const {mainHarness}=require('./helpers/main-harness.cjs');
const row=(key,record,base,file)=>({key,base,revision:base+1,hash:S.digest(record),file});
const tx=(sequence,operation,changes)=>({transactions:[{sequence,operation,changes}],cursor:sequence});
function seeded(){
 let s=S.initial('account1');
 const inv={id:'inv',type:'invoice',status:'sent',number:'INV-1'},other={id:'other',type:'invoice',status:'sent',number:'INV-2'};
 s=S.ingest(s,tx(1,'boot',[row('document:inv',inv,0,'f1'),row('document:other',other,0,'f2')]),{f1:inv,f2:other});
 return {s,inv,other};
}

test('a remote batch with one real clash does not flag its members that are already identical',()=>{
 let {s,inv,other}=seeded();
 const mine={...inv,status:'paid',paymentId:'mine'},theirs={...inv,status:'paid',paymentId:'theirs'};
 const normalized={...other,docLang:'th'};          // both Macs made the same automatic change
 s=S.edit(s,'document:inv',mine);s=S.edit(s,'document:other',normalized);
 s=S.ingest(s,tx(2,'remote',[row('document:inv',theirs,1,'f3'),row('document:other',normalized,1,'f4')]),{f3:theirs,f4:normalized});
 assert.deepEqual(Object.keys(s.conflicts),['document:inv']);
 assert.deepEqual(s.records['document:other'],normalized);assert.equal(s.heads['document:other'].revision,2);
 assert.equal(S.prepare(s).pending,null,'nothing identical is re-sent');
});

test('an existing conflict clears itself once the other Mac publishes the same content',()=>{
 let {s,other}=seeded();
 const a={...other,notes:'A'},b={...other,notes:'B'};
 s=S.edit(s,'document:other',a);
 s=S.ingest(s,tx(2,'r1',[row('document:other',b,1,'f3')]),{f3:b});
 assert.ok(s.conflicts['document:other']);
 s=S.ingest(s,tx(3,'r2',[row('document:other',a,2,'f4')]),{f4:a});
 assert.deepEqual(s.conflicts,{});assert.deepEqual(s.records['document:other'],a);
 assert.equal(s.resolutions.at(-1).choice,'identical','the automatic resolution stays in the audit trail');
});

test('a receipt for an invoice under review waits with it instead of arriving alone',()=>{
 let {s,inv}=seeded();
 const mine={...inv,status:'paid',paymentId:'mine'},theirs={...inv,status:'paid',paymentId:'theirs'};
 const receipt={id:'rc',type:'receipt',status:'issued',number:'RC-1',parentId:'inv',paymentId:'theirs'};
 s=S.edit(s,'document:inv',mine);
 s=S.ingest(s,tx(2,'pay',[row('document:inv',theirs,1,'f3')]),{f3:theirs},()=>{},B.related);
 s=S.ingest(s,tx(3,'receipt',[row('document:rc',receipt,0,'f4')]),{f4:receipt},()=>{},B.related);
 assert.ok(s.conflicts['document:rc'],'receipt held for review with its invoice');
 assert.equal(s.conflicts['document:rc'].operation,s.conflicts['document:inv'].operation,'one group');
 assert.equal(Object.hasOwn(s.records,'document:rc'),false,'no receipt shown before the invoice is settled');
 s=S.resolve(s,'document:inv','remote');
 assert.deepEqual(s.conflicts,{});assert.deepEqual(s.records['document:rc'],receipt);assert.deepEqual(s.records['document:inv'],theirs);
 assert.deepEqual(B.related('document:rc',receipt),['document:inv']);
});

async function profile(t,withBinding){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'billngai-live-findings-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const db={business:{businessName:'Synthetic'},clients:[],documents:[],recurring:[],reviewEvents:[]};
 if(withBinding){const st=S.initial('synthetic-subject');st.root='r';st.mode='active';st.records=B.flatten(db);db.syncV3=st;}
 await fs.writeFile(path.join(root,'billing.json'),JSON.stringify(db));
 const h=mainHarness(root);await h.call('data:load');
 return {root,h,read:async()=>JSON.parse(await fs.readFile(path.join(root,'billing.json'),'utf8')),bound:()=>{const st=S.initial('synthetic-subject');st.root='r';st.mode='active';st.cursor=1;st.heads={};st.records={};return st;}};
}

test('importing a backup that carries a sync binding cannot re-bind or lock saving',async t=>{
 const p=await profile(t,false);
 const imported={business:{businessName:'Synthetic'},clients:[],documents:[],recurring:[],reviewEvents:[],syncV3:p.bound()};
 await p.h.call('data:recover',JSON.stringify(imported));
 assert.equal(Object.hasOwn(await p.read(),'syncV3'),false,'recover strips the binding');
 const next={...imported,clients:[{id:'c1',name:'New client'}]};    // renderer copy may still carry it
 await p.h.call('data:save',JSON.stringify(next));
 const saved=await p.read();assert.equal(saved.clients.length,1);assert.equal(Object.hasOwn(saved,'syncV3'),false);
});

test('restore and import are refused while this Mac is connected',async t=>{
 const p=await profile(t,true);
 const other={business:{businessName:'Other'},clients:[],documents:[],recurring:[],reviewEvents:[]};
 await assert.rejects(p.h.call('data:recover',JSON.stringify(other)),/SYNC_DISCONNECT_REQUIRED/);
 assert.equal((await p.read()).business.businessName,'Synthetic','current data untouched');
});

test('exported backups never include the sync binding',async t=>{
 const p=await profile(t,false);const out=path.join(p.root,'export.json');
 p.h.dialogs.save={canceled:false,filePath:out};
 await p.h.call('data:export',JSON.stringify({business:{businessName:'Synthetic'},clients:[],documents:[],syncV3:p.bound()}));
 assert.equal(Object.hasOwn(JSON.parse(await fs.readFile(out,'utf8')),'syncV3'),false);
});

test('leaving Settings without changes does not create a new business version',async()=>{
 const html=await fs.readFile(path.join(__dirname,'../billing.html'),'utf8');
 const script=html.match(/<script>([\s\S]*)<\/script>\s*<\/body>/)[1].replace(/\bboot\(\);\s*$/,'');
 const values={s_name:'Synthetic',s_vatStatus:'non_registered',s_year:'be'};
 const ctx=vm.createContext({window:{addEventListener(){},matchMedia(){return {matches:false};}},
  document:{getElementById:id=>id in values?{value:values[id],setAttribute(){},removeAttribute(){},focus(){}}:id.startsWith('s_')?null:{addEventListener(){},classList:{add(){},remove(){}}},querySelectorAll(){return [];},addEventListener(){}},
  navigator:{platform:'Test'},console,TextEncoder,TextDecoder,setTimeout(){return 0;},clearTimeout(){},setInterval(){return 0;},localStorage:{getItem(){return null;},setItem(){}}});
 vm.runInContext(script,ctx);
 vm.runInContext(`DB=blankDB();Object.assign(DB.business,{businessName:'Synthetic',vatStatus:'non_registered',vatStatusConfirmedAt:'2026-09-01T00:00:00.000Z',yearMode:'be',updatedAt:'2026-09-01T00:00:00.000Z'});
  saves=0;persist=async()=>{saves++;return true;};applyTheme=()=>{};render=()=>{};toast=()=>{};`,ctx);
 assert.equal(await vm.runInContext('saveSettings(true)',ctx),true);
 assert.equal(vm.runInContext('saves',ctx),0);
 assert.equal(vm.runInContext('DB.business.vatStatusConfirmedAt',ctx),'2026-09-01T00:00:00.000Z');
 values.s_name='Renamed';
 assert.equal(await vm.runInContext('saveSettings(true)',ctx),true);
 assert.equal(vm.runInContext('saves',ctx),1);
 assert.equal(vm.runInContext('DB.business.vatStatusConfirmedAt',ctx),'2026-09-01T00:00:00.000Z','unchanged VAT answer keeps its time');
});
