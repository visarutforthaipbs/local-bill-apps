const {test}=require('node:test');
const assert=require('node:assert/strict');
const S=require('../lib/sync-v3.cjs');
const restart=s=>S.validate(JSON.parse(JSON.stringify(s)));
const row=(record,base=0,file='f',key='document:a')=>({key,base,revision:base+1,hash:S.digest(record),file});
const page=(c,sequence=1,operation='remote')=>({transactions:[{sequence,operation,changes:[c]}],cursor:sequence});
const seed=()=>S.ingest(S.initial('account1'),page(row({amount:100})),{f:{amount:100}});
const uploaded=s=>{let p=S.prepare(s);for(const c of p.pending.changes)p=S.attachFile(p,c.key,'uploaded');return p;};
test('offline edit conflict preserves both variants and remains after restart and quiet pull',()=>{
 let s=S.edit(seed(),'document:a',{amount:200});
 s=S.ingest(s,page(row({amount:300},1),2),{f:{amount:300}});
 s=restart(s);s=S.ingest(s,{transactions:[],cursor:2},{});
 assert.deepEqual(s.records['document:a'],{amount:200});assert.deepEqual(s.conflicts['document:a'].remote.record,{amount:300});
 assert.throws(()=>S.edit(s,'document:a',{amount:500}),/RECORD_NEEDS_REVIEW/);
 s=S.resolve(s,'document:a','remote');assert.deepEqual(s.records['document:a'],{amount:300});assert.equal(s.resolutions.length,1);
 assert.equal(S.prepare(s).pending,null);
});
test('unrelated documents continue while one record needs review',()=>{
 let s=S.edit(seed(),'document:a',{amount:200});s=S.ingest(s,page(row({amount:300},1),2),{f:{amount:300}});
 s=S.edit(s,'client:new',{name:'Synthetic client'});const p=S.prepare(s);
 assert.deepEqual(p.pending.changes.map(x=>x.key),['client:new']);
});
test('unknown outcome retains exactly the same operation, files and content across restarts',()=>{
 let s=uploaded(S.edit(seed(),'document:a',{amount:200}));const req=S.request(s);
 s=restart(s);s=S.edit(s,'document:a',{amount:250});assert.deepEqual(S.request(S.prepare(s)),req);
 const ack={ok:true,changes:req.changes.map(c=>({...c,revision:c.base+1}))};s=S.acknowledge(s,ack);
 assert.equal(s.cursor,1);assert.deepEqual(s.records['document:a'],{amount:250});
 assert.equal(S.prepare(s).pending.changes[0].base,2);
});
test('pull before ACK handles own operation without treating later local edits as conflicting',()=>{
 let s=uploaded(S.edit(seed(),'document:a',{amount:200}));const p=s.pending;
 s=S.edit(s,'document:a',{amount:250});
 s=S.ingest(s,page(row({amount:200},1,'uploaded'),2,p.operation),{uploaded:{amount:200}});
 assert.deepEqual(s.conflicts,{});assert.deepEqual(s.records['document:a'],{amount:250});
 s=S.acknowledge(s,{ok:true,changes:p.changes.map(({record,...c})=>({...c,revision:2}))});assert.equal(s.pending,null);
});
test('hash failure, schema failure and cursor gaps never mutate the replica',()=>{
 const s=seed(),before=JSON.stringify(s);
 assert.throws(()=>S.ingest(s,page(row({amount:300},1),2),{f:{amount:900}}),/PAYLOAD_HASH_MISMATCH/);
 assert.throws(()=>S.ingest(s,page(row({amount:300},1),2),{f:{amount:300}},()=>{throw Error('schema');}),/schema/);
 assert.throws(()=>S.ingest(s,page(row({amount:300},1),3),{f:{amount:300}}),/SYNC_LOG_GAP/);
 assert.equal(JSON.stringify(s),before);
});
test('reviews and deletions are records; replay cannot create a second event',()=>{
 const s=S.ingest(S.initial('account1'),page(row({id:'e1',type:'payment_match'},0,'f','reviewEvent:e1')),{f:{id:'e1',type:'payment_match'}});
 assert.equal(Object.keys(restart(s).records).length,1);
 assert.throws(()=>S.ingest(s,page(row({id:'e1',type:'payment_match'},0,'f','reviewEvent:e1')),{f:{id:'e1',type:'payment_match'}}),/SYNC_LOG_GAP/);
 assert.throws(()=>S.bound(s,'anotherAccount'),/SYNC_ACCOUNT_MISMATCH/);
});
test('rejection cannot discard an operation until conflicting remote data is durable',()=>{
 let s=uploaded(S.edit(seed(),'document:a',{amount:200}));const rejection={ok:false,conflicts:[{key:'document:a',revision:2}]};
 assert.throws(()=>S.rejected(s,rejection),/PULL_BEFORE_REJECT/);
 s=S.ingest(s,page(row({amount:300},1),2),{f:{amount:300}});s=S.rejected(restart(s),rejection);
 assert.equal(s.pending,null);s=S.resolve(s,'document:a','local');const p=S.prepare(s);
 assert.equal(p.pending.changes[0].base,2);assert.equal(p.pending.changes[0].record.amount,200);
});
test('bad ACK cannot clear the outbox',()=>{
 const s=uploaded(S.edit(seed(),'document:a',{amount:200}));
 assert.throws(()=>S.acknowledge(s,{ok:true,changes:[row({amount:999},1,'uploaded')]}),/INVALID_ACK/);assert.ok(s.pending);
});
test('dependent transaction is held together instead of partially changing payment facts',()=>{
 let s=S.edit(seed(),'document:a',{amount:200});
 const invoice=row({amount:300},1,'inv'),receipt=row({amount:300,type:'receipt'},0,'rc','document:receipt');
 const p={transactions:[{sequence:2,operation:'paymentAndReceipt',changes:[invoice,receipt]}],cursor:2};
 s=S.ingest(s,p,{inv:{amount:300},rc:{amount:300,type:'receipt'}});
 assert.equal(s.records['document:a'].amount,200);assert.equal(s.records['document:receipt'],undefined);
 assert.equal(Object.keys(s.conflicts).length,2);
 assert.throws(()=>S.resolve(s,'document:a','local'),/TRANSACTION_REVIEW_REQUIRED/);
 s=S.resolve(s,'document:a','remote');assert.equal(s.records['document:a'].amount,300);assert.equal(s.records['document:receipt'].amount,300);assert.equal(Object.keys(s.conflicts).length,0);
});
test('later dependent updates join an existing conflict group before resolution',()=>{
 let s=S.edit(seed(),'document:a',{amount:200});s=S.ingest(s,page(row({amount:300},1),2,'first'),{f:{amount:300}});
 const changes=[row({amount:400},2,'next'),row({type:'receipt',amount:400},0,'receipt','document:r')];
 s=S.ingest(s,{transactions:[{sequence:3,operation:'second',changes}],cursor:3},{next:{amount:400},receipt:{type:'receipt',amount:400}});
 assert.equal(s.conflicts['document:a'].operation,'second');assert.equal(s.conflicts['document:r'].operation,'second');
 s=S.resolve(s,'document:a','remote');assert.equal(s.records['document:r'].amount,400);assert.deepEqual(s.conflicts,{});
});
