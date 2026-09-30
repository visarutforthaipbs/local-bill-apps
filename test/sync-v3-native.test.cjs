const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs/promises');const os=require('node:os');const path=require('node:path');const vm=require('node:vm');
const {mainHarness}=require('./helpers/main-harness.cjs');const S=require('../lib/sync-v3.cjs');const B=require('../lib/sync-v3-billing.cjs');
async function fixture(t){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'billngai-sync-main-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const db={version:2,business:{businessName:'Synthetic'},clients:[],documents:[],recurring:[],reviewEvents:[],meta:{},counters:{}};
 const state=S.initial('synthetic');state.root='driveRoot';state.mode='active';state.records=B.flatten(db);state.heads={'business:main':{revision:1,hash:S.digest(db.business)}};state.cursor=1;db.syncV3=state;
 const file=path.join(root,'billing.json');await fs.writeFile(file,JSON.stringify(db));const h=mainHarness(root);await h.call('data:load');
 const files={business:db.business};const log=[{sequence:1,operation:'init',changes:[{key:'business:main',base:0,revision:1,hash:S.digest(db.business),file:'business'}]}];let fail=false;
 const operations={};h.context.testTransport={reserve:async r=>({number:'INV-69-001',reservation:r.operation}),upload:async record=>{const id='file'+Object.keys(files).length;files[id]=record;return id;},download:async id=>files[id],pull:async cursor=>({transactions:log.slice(cursor),cursor:log.length}),commit:async r=>{
  if(!operations[r.operation]){const changes=r.changes.map(c=>({...c,revision:c.base+1}));log.push({sequence:log.length+1,operation:r.operation,changes});operations[r.operation]={ok:true,changes};}
  if(fail){fail=false;throw Error('NETWORK');}return operations[r.operation];
 }};
 vm.runInContext('nativeSyncTransport = async () => testTransport',h.context);
 return {h,read:async()=>JSON.parse(await fs.readFile(file,'utf8')),lose:()=>{fail=true;},log};
}
test('actual native save persists draft and sync state together, ignores renderer metadata tampering',async t=>{
 const f=await fixture(t),next=await f.read();next.documents.push({id:'d1',type:'invoice',status:'draft'});next.syncV3.account='attacker';
 const result=await f.h.call('data:save',JSON.stringify(next));assert.equal(JSON.parse(result.text).documents.length,1);assert.equal((await f.read()).syncV3.account,'synthetic');
 assert.equal((await f.read()).syncV3.records['document:d1'].id,'d1');
});
test('actual native save rejects stale renderer revision instead of overwriting a pull',async t=>{
 const f=await fixture(t),next=await f.read();next.syncV3.cursor=0;await assert.rejects(f.h.call('data:save',JSON.stringify(next)),/SYNC_REFRESH_REQUIRED/);assert.equal((await f.read()).syncV3.cursor,1);
});
test('native IPC finalization survives lost response and retry without duplicate issued records',async t=>{
 const f=await fixture(t);await f.h.call('syncV3:reserve','document:inv',{prefix:'INV-69-',suffix:'',width:3});const next=await f.read();next.documents.push({id:'inv',type:'invoice',status:'sent',number:'INV-69-001',currency:'THB',issueDate:'2026-09-29',items:[{description:'Synthetic service',qty:1,price:100}],vatRate:0,whtRate:0});
 f.lose();await assert.rejects(f.h.call('data:save',JSON.stringify(next)),/SYNC_FINALIZATION_PENDING/);assert.equal((await f.read()).documents.length,0);
 const result=await f.h.call('syncV3:run');assert.equal(JSON.parse(result.text).documents.length,1);assert.equal(f.log.length,2);assert.equal(result.status.pending,0);
});
test('unconfigured app cannot connect pilot even via direct IPC',async t=>{
 const f=await fixture(t);await assert.rejects(f.h.call('syncV3:connect'),/SYNC_V3_NOT_CONFIGURED/);
});
test('native sync refuses local records changed outside the v3 replica',async t=>{
 const f=await fixture(t);vm.runInContext('dataSession.text = dataSession.text.replace("Synthetic", "Changed")',f.h.context);
 // Invalidate both stored bytes and the session snapshot as an older app would at next launch.
 const text=vm.runInContext('dataSession.text',f.h.context);const file=vm.runInContext('dataSession.file',f.h.context);await fs.writeFile(file,text);
 await assert.rejects(f.h.call('syncV3:run'),/SYNC_LOCAL_STATE_MISMATCH/);
});
