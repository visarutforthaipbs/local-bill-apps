const {test}=require('node:test');const assert=require('node:assert/strict');const S=require('../lib/sync-v3.cjs');const B=require('../lib/sync-v3-billing.cjs');const {BillingSyncController}=require('../lib/sync-v3-controller.cjs');
const copy=v=>JSON.parse(JSON.stringify(v));
function fixture(){
 let db={business:{businessName:'Synthetic'},documents:[],clients:[],reviewEvents:[],recurring:[],meta:{},counters:{},syncV3:S.initial('test')};db.syncV3.records=B.flatten(db);
 const files={},operations={},log=[];let fail=false;
 const transport={reserve:async r=>({number:'RC-69-001',reservation:r.operation}),upload:async r=>{const file='f'+Object.keys(files).length;files[file]=r;return file;},download:async f=>files[f],pull:async n=>({transactions:log.slice(n),cursor:log.length}),commit:async r=>{
  if(!operations[r.operation]){const changes=r.changes.map(c=>({...c,revision:c.base+1}));operations[r.operation]={ok:true,changes};log.push({sequence:log.length+1,operation:r.operation,changes});}
  if(fail){fail=false;throw Error('NETWORK_LOST');}return operations[r.operation];
 }};
 const options={account:'test',read:async()=>copy(db),write:async next=>{db=copy(next);},transport,validateDatabase:next=>{assert.ok(Array.isArray(next.documents));}};
 return {controller:()=>new BillingSyncController(options),read:()=>copy(db),lose:()=>{fail=true;},log};
}
const receipt=()=>({id:'r1',number:'RC-69-001',type:'receipt',status:'issued',items:[{price:100}],paidDate:'2026-09-29',paymentId:'p1',issuedSnapshot:{renderedHtml:'Synthetic paper'}});
test('receipt remains invisible after lost commit response; restart completes same issuance',async()=>{
 const f=fixture();let c=f.controller();await c.reserve('document:r1',{prefix:'RC-69-',suffix:'',width:3});const next=f.read();next.documents.push(receipt());f.lose();
 await assert.rejects(c.save(next),/SYNC_FINALIZATION_PENDING/);assert.equal(f.read().documents.length,0);assert.ok(f.read().syncV3.intents['document:r1']);
 c=f.controller();await c.sync();assert.equal(f.read().documents.length,1);assert.equal(f.read().documents[0].number,'RC-69-001');assert.equal(f.log.length,1);assert.deepEqual(f.read().syncV3.intents,{});
});
test('offline draft on another record remains editable while finalization result is unknown',async()=>{
 const f=fixture(),c=f.controller();await c.reserve('document:r1',{prefix:'RC-69-',suffix:'',width:3});let next=f.read();next.documents.push(receipt());f.lose();await assert.rejects(c.save(next),/SYNC_FINALIZATION_PENDING/);
 next=f.read();next.documents.push({id:'draft2',type:'invoice',status:'draft',items:[]});await c.save(next);
 assert.deepEqual(f.read().documents.map(d=>d.id),['draft2']);await c.sync();assert.equal(f.read().documents.length,2);
});
test('native save rejects issuance without a reservation and immutable paper edits',async()=>{
 const f=fixture(),c=f.controller();let next=f.read();next.documents.push(receipt());await assert.rejects(c.save(next),/SYNC_NUMBER_RESERVATION_REQUIRED/);assert.equal(f.read().documents.length,0);
 await c.reserve('document:r1',{prefix:'RC-69-',suffix:'',width:3});await c.save(next);next=f.read();next.documents[0].items[0].price=200;await assert.rejects(c.save(next),/SYNC_ISSUED_FACTS_IMMUTABLE/);
});
