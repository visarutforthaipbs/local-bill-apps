const {test}=require('node:test'),assert=require('node:assert/strict'),D=require('../lib/billing-data.cjs');
const doc=extra=>({id:'d',type:'invoice',status:'draft',items:[{description:'Synthetic',qty:1,price:1000}],...extra});
const db=document=>({version:3,business:{},documents:[document],clients:[],recurring:[],reviewEvents:[],counters:{},meta:{}});
test('unsupported statuses and negative/nonfinite/null amounts fail with absent or null deletion',()=>{
 for(const deletedAt of [undefined,null])for(const changed of [{status:'not-a-status'},{items:[{description:'Synthetic',qty:1,price:-1}]},{items:[{description:'Synthetic',qty:NaN,price:1}]},{items:[{description:'Synthetic',qty:null,price:1}]},{deletedAt:'invalid'}]){
  assert.throws(()=>D.validate(db(doc({deletedAt,...changed}))),/DATA_INVALID_SCHEMA/);
  assert.throws(()=>D.validate(db(doc({deletedAt,...changed})),{strictLiveDocuments:true}),/DATA_INVALID_SCHEMA/);
 }
});
test('mobile retains its strict live-document boundary; incomplete desktop history remains evidence',()=>{
 for(const deletedAt of [undefined,null])for(const changed of [{items:undefined},{status:undefined},{items:[{description:'Synthetic',price:1}]}]){
  const history=db(doc({deletedAt,...changed}));assert.equal(D.validate(history),history);
  assert.throws(()=>D.validate(history,{strictLiveDocuments:true}),/DATA_INVALID_SCHEMA/);
 }
 const marker={id:'deleted',deletedAt:'2020-01-01T00:00:00.000Z',updatedAt:'2020-01-01T00:00:00.000Z'};D.validate(db(marker),{strictLiveDocuments:true});
 for(const extra of [{deletedAt:null},{type:'unknown'},{items:[]},{status:'paid'}])assert.throws(()=>D.validate(db({...marker,...extra}),{strictLiveDocuments:true}),/DATA_INVALID_SCHEMA/);
});
test('causal review resolution is order independent and rejects dangling/cyclic ancestry without stack recursion',()=>{
 const source=[doc({status:'paid'}),doc({id:'r',type:'receipt',status:'issued',parentId:'d'})];
 const answer=(id,decision='same_payment',supersedes=[])=>({id,type:'legacy_group_review',documentId:'d',groupKey:'legacy-parent:d',sourceRecords:source,decision,...(decision==='same_payment'?{representativeId:'r'}:{}),ownerConfirmed:true,note:'Synthetic review',recordedAt:'2026-10-04T00:00:00.000Z',supersedes});
 for(const events of [[answer('a'),answer('b','not_income')],[answer('b','not_income'),answer('a')]])assert.equal(D.resolveReviews(events,'legacy-parent:d',source,['r']).status,'conflict');
 assert.equal(D.resolveReviews([answer('a'),answer('b','not_income'),answer('c','same_payment',['b','a'])],'legacy-parent:d',source,['r']).answer.id,'c');
 assert.equal(D.resolveReviews([answer('a','same_payment',['missing'])],'legacy-parent:d',source,['r']).status,'invalid');
 assert.equal(D.resolveReviews([answer('a','same_payment',['b']),answer('b','same_payment',['a'])],'legacy-parent:d',source,['r']).status,'invalid');
 const chain=Array.from({length:10000},(_,i)=>answer('e'+i,'same_payment',i?['e'+(i-1)]:[]));assert.equal(D.resolveReviews(chain,'legacy-parent:d',source,['r']).answer.id,'e9999');
});

// Stored business images: verified by content hash at every trust boundary.
{
 const crypto=require('node:crypto'),B=require('../lib/billing-data.cjs');
 const image='data:image/png;base64,'+crypto.randomBytes(3000).toString('base64'),hash=crypto.createHash('sha256').update(image).digest('hex');
 const base=()=>({version:3,business:{businessName:'Synthetic'},clients:[],documents:[],recurring:[],reviewEvents:[],counters:{},meta:{}});
 const issued=ref=>({id:'d1',type:'invoice',number:'INV-1',status:'sent',items:[{description:'Synthetic',qty:1,price:100}],issuedSnapshot:{schemaVersion:1,business:{businessName:'Synthetic',logo:ref},buyer:{name:'Buyer'},renderedHtml:'<img src="'+ref+'">',shareText:''}});
 test('the built-in SHA-256 agrees with the platform implementation',()=>{
  for(const text of ['','abc','a'.repeat(55),'a'.repeat(56),'a'.repeat(64),'a'.repeat(119),'a'.repeat(120),image])assert.equal(B.sha256(text),crypto.createHash('sha256').update(text).digest('hex'));
 });
 test('a stored image must be a bounded embedded image whose name is its content hash',()=>{
  const ok=base();ok.assets={[hash]:image};ok.documents=[issued('asset:'+hash)];assert.equal(B.validate(ok),ok);
  const bad=[['wrong content',{[hash]:image.slice(0,-1)+(image.endsWith('A')?'B':'A')}],['not an image',{[B.sha256('data:text/html;base64,AAAA')]:'data:text/html;base64,AAAA'}],
   ['remote URL',{[B.sha256('https://example.invalid/a.png')]:'https://example.invalid/a.png'}],['bad name',{short:image}],['too large',(()=>{const big='data:image/png;base64,'+'A'.repeat(B.ASSET_MAX);return {[B.sha256(big)]:big};})()]];
  for(const [name,assets] of bad){const db=base();db.assets=assets;assert.throws(()=>B.validate(db),/DATA_INVALID_SCHEMA/,name);}
  const list=base();list.assets=[image];assert.throws(()=>B.validate(list),/DATA_INVALID_SCHEMA/);
 });
 test('an issued original cannot refer to an image the workspace does not hold',()=>{
  const missing=base();missing.documents=[issued('asset:'+hash)];assert.throws(()=>B.validate(missing),/DATA_INVALID_SCHEMA/);
  const embedded=base();embedded.documents=[issued(image)];assert.equal(B.validate(embedded),embedded); // older originals keep their own copy
 });
}
