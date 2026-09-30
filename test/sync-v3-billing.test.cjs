const {test}=require('node:test');const assert=require('node:assert/strict');const B=require('../lib/sync-v3-billing.cjs');
const db=()=>({business:{businessName:'Synthetic'},documents:[{id:'inv1',type:'invoice',number:'INV-69-001',status:'sent',items:[{description:'Work',qty:1,price:100}],issuedSnapshot:{document:{id:'inv1'},renderedHtml:'Synthetic paper'}}],clients:[],recurring:[],reviewEvents:[{id:'e1',type:'receipt_reissue',documentId:'old1',receipt:{number:'RC-69-001'}}],counters:{'invoice-2026':1},meta:{setupDone:true}});
const copy=v=>JSON.parse(JSON.stringify(v));
test('all reviews including corrected receipts round-trip without duplicate ledger documents',()=>{
 const d=db(),records=B.flatten(d);assert.ok(records['reviewEvent:e1']);assert.deepEqual(B.project(d,{records}),d);assert.equal(B.seal('reviewEvent:e1',d.reviewEvents[0]).number,'RC-69-001');
});
test('issued paper facts and existing payment identity cannot be silently edited',()=>{
 const d=db();for(const mutate of [n=>n.documents[0].items[0].price=200,n=>n.documents[0].number='INV-69-002',n=>n.documents[0].issuedSnapshot.renderedHtml='Edited',n=>n.documents[0].status='draft',n=>n.documents=[]]){
  const n=copy(d);mutate(n);assert.throws(()=>B.validateTransition(d,n),/SYNC_ISSUED_FACTS_IMMUTABLE/);
 }
 d.documents[0].paymentId='p1';d.documents[0].paidDate='2026-09-29';const n=copy(d);n.documents[0].paidDate='2026-09-28';assert.throws(()=>B.validateTransition(d,n),/SYNC_PAYMENT_FACTS_IMMUTABLE/);
});
test('explicit cancellation and WHT tracking preserve issued paper seal',()=>{
 const d=db(),n=copy(d);Object.assign(n.documents[0],{voidedAt:'2026-09-29',voidReason:'Duplicate',whtCertReceived:true});B.validateTransition(d,n);assert.equal(B.seal('document:inv1',d.documents[0]).sealedHash,B.seal('document:inv1',n.documents[0]).sealedHash);
});
test('review deletion or mutation cannot silently remove confirmed matches',()=>{
 const d=db(),n=copy(d);n.reviewEvents=[];assert.throws(()=>B.validateTransition(d,n),/SYNC_REVIEW_EVENT_IMMUTABLE/);
});
test('preserves number formats while separating atomic sequence token',()=>{
 assert.deepEqual(B.numberParts('RC-{YY}-{###}','69'),{prefix:'RC-69-',suffix:'',width:3});
 assert.deepEqual(B.numberParts('INV','69'),{prefix:'INV-',suffix:'',width:3});
 assert.deepEqual(B.numberParts('Q-##-END','26'),{prefix:'Q-',suffix:'-END',width:2});
 assert.throws(()=>B.numberParts('##-##','69'),/INVALID_NUMBER_FORMAT/);
});
test('counter floors retain consumed gaps and recover higher issued/corrected numbers',()=>{
 const d=db();d.business.numberFormats={invoice:'INV-{YY}-{###}',receipt:'RC-{YY}-{###}'};d.counters['receipt-2026']=14;d.documents[0].issueDate='2026-09-29';d.documents[0].number='INV-69-023';
 assert.equal(B.counterFloors(d)['receipt-2026'],14);assert.equal(B.counterFloors(d)['invoice-2026'],23);
});
