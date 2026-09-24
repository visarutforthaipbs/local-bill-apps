const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../billing.html'),'utf8');
const script=html.match(/<script>([\s\S]*)<\/script>\s*<\/body>/)[1].replace(/\bboot\(\);\s*$/,'');
function setup(){
  const elements=new Map(),element=()=>({innerHTML:'',textContent:'',value:'',checked:false,style:{},addEventListener(){},classList:{add(){},remove(){},toggle(){}}});
  const ctx=vm.createContext({window:{addEventListener(){},matchMedia(){return {matches:false};},billingAPI:{async snapshotBackup(){return 'synthetic-backup.json';}}},document:{getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);},querySelectorAll(){return [];},addEventListener(){},body:{classList:{add(){},remove(){}}}},navigator:{platform:'Synthetic'},console,TextEncoder,TextDecoder,setTimeout(){},clearTimeout(){},setInterval(){},localStorage:{getItem(){return null;},setItem(){}},confirm(){return true;}});
  vm.runInContext(script,ctx);
  vm.runInContext(`DB=blankDB();DB.business.uiLang='en';DEVICE_ID='synthetic';
    DB.clients=[{id:'buyer',name:'Current buyer reference'}];
    function fixture(extra={}){return {id:'tx',type:'tax_invoice',number:'TX-OLD',status:'issued',currency:'THB',vatRate:0,whtRate:0,clientId:'buyer',parentId:'inv',paidDate:'2026-01-10',issueDate:'2026-01-10',items:[{description:'Historical service',qty:1,price:1000}],legacy_review_required:true,...extra};}
    DB.documents=[fixture(),fixture({id:'tx2',number:'TX-OLD-2',parentId:'inv2'})];
    const facts={deliveryStatus:'unknown',historicalVatConfirmed:true,note:'Owner states non-VAT; delivery unknown'};
    persist=async()=>true;render=()=>{};toast=()=>{};
  `,ctx);
  return {run:s=>vm.runInContext(s,ctx),elements};
}
test('bulk proposals preserve all originals, counters and payment totals',async()=>{
  const h=setup();h.run(`const original=JSON.stringify(DB.documents),counters=JSON.stringify(DB.counters),payments=JSON.stringify(paymentReview());`);
  assert.equal(await h.run(`applyCorrectionBatch(buildCorrectionBatch(['tx','tx2'],facts,'prepare_proposal'))`),true);
  assert.equal(h.run(`JSON.stringify(DB.documents)===original&&JSON.stringify(DB.counters)===counters&&JSON.stringify(paymentReview())===payments`),true);
  assert.equal(h.run('DB.reviewEvents.length'),2);
  assert.equal(h.run(`DB.reviewEvents.every(e=>e.deliveryStatus==='unknown'&&e.proposal.status==='review_only'&&!e.proposal.number&&!e.proposal.issueDate&&validCorrectionReviewEvent(e))`),true);
  assert.equal(h.run(`validateRendererData(JSON.parse(JSON.stringify(DB)))===undefined`),true);
});
test('eligibility rejects deleted, VAT, unknown currency, split and malformed records without selecting them',()=>{
  const h=setup();
  for(const extra of [{deletedAt:'2026-01-01'},{voidedAt:'2026-01-01'},{vatRate:7},{vatRate:null},{vatRate:''},{currency:''},{currency:'USD'},{milestone:{seq:1,of:2}},{items:[]},{items:[{description:'bad',qty:0,price:100}]},{whtRate:''}]){
    h.run(`DB.documents=[fixture(${JSON.stringify(extra)})]`);
    assert.throws(()=>h.run(`buildCorrectionBatch(['tx'],facts,'prepare_proposal')`));
    assert.doesNotThrow(()=>h.run(`buildCorrectionBatch(['tx'],facts,'review')`));
  }
});
test('delivery and VAT require explicit valid facts, not prefilled assumptions',()=>{
  const h=setup();
  for(const f of [{...{deliveryStatus:'unknown',note:'n'},historicalVatConfirmed:false},{deliveryStatus:'guessed',historicalVatConfirmed:true,note:'n'},{deliveryStatus:'sent',historicalVatConfirmed:true,note:''}])assert.throws(()=>h.run(`buildCorrectionBatch(['tx'],${JSON.stringify(f)},'review')`));
  assert.throws(()=>h.run(`buildCorrectionBatch(['tx','tx'],facts,'review')`));
  assert.throws(()=>h.run(`buildCorrectionBatch([],facts,'review')`));
});
test('stale preview and stale source during backup never save',async()=>{
  const h=setup();h.run(`const batch=buildCorrectionBatch(['tx'],facts,'prepare_proposal');DB.documents[0].notes='changed';`);
  assert.equal(await h.run('applyCorrectionBatch(batch)'),false);assert.equal(h.run('DB.reviewEvents.length'),0);
  h.run(`const batch2=buildCorrectionBatch(['tx'],facts,'prepare_proposal');window.billingAPI.snapshotBackup=async()=>{DB.documents[0].vatRate=7;return 'snapshot';};`);
  assert.equal(await h.run('applyCorrectionBatch(batch2)'),false);assert.equal(h.run('DB.reviewEvents.length'),0);
});
test('backup failure and false/rejected save roll back the whole batch',async()=>{
  for(const failure of [`window.billingAPI.snapshotBackup=async()=>{throw Error('backup');}`,`window.billingAPI.snapshotBackup=async()=>false`, `persist=async()=>false`,`persist=async()=>{throw Error('save');}`]){
    const h=setup();h.run(`const original=JSON.stringify(DB.documents);${failure}`);
    assert.equal(await h.run(`applyCorrectionBatch(buildCorrectionBatch(['tx','tx2'],facts,'prepare_proposal'))`),false);
    assert.equal(h.run(`DB.reviewEvents.length===0&&JSON.stringify(DB.documents)===original&&!issuanceBusy`),true);
  }
});
test('repeated preparation and concurrent submission cannot create duplicates',async()=>{
  const h=setup();h.run(`const batch=buildCorrectionBatch(['tx'],facts,'prepare_proposal');`);
  const first=h.run('applyCorrectionBatch(batch)');assert.equal(await h.run('applyCorrectionBatch(batch)'),false);assert.equal(await first,true);
  assert.equal(await h.run('applyCorrectionBatch(batch)'),false);assert.equal(h.run('DB.reviewEvents.length'),1);
  assert.equal(await h.run(`applyCorrectionBatch(buildCorrectionBatch(['tx'],{...facts,deliveryStatus:'sent'},'review'))`),true);
  assert.equal(h.run('DB.reviewEvents.length'),2);assert.equal(h.run(`correctionEvents('tx').at(-1).deliveryStatus`),'sent');
});
test('render failure after successful save does not roll memory back',async()=>{
  const h=setup();h.run(`render=()=>{throw Error('render');}`);
  assert.equal(await h.run(`applyCorrectionBatch(buildCorrectionBatch(['tx'],facts,'review'))`),true);
  assert.equal(h.run('DB.reviewEvents.length'),1);
});
test('review screen escapes untrusted values and exports review-only packet',async()=>{
  const h=setup();h.run(`DB.documents[0].number='<img src=x onerror=alert(1)>';`);
  await h.run(`applyCorrectionBatch(buildCorrectionBatch(['tx'],{...facts,note:'<script>unsafe</script>'},'prepare_proposal'))`);
  const rendered=h.run(`const c={},ta={};renderCorrections(c,ta);c.innerHTML`);
  assert.ok(rendered.includes('&lt;img'));assert.ok(rendered.includes('&lt;script&gt;'));assert.ok(!rendered.includes('<script>unsafe'));
  assert.ok(rendered.includes('value="unknown"'));assert.ok(!rendered.includes('id="correctionVat" type="checkbox" checked'));
  const packet=h.run('correctionReviewPacket()');assert.equal(packet.purpose,'correction-review-only-not-issued-receipts');assert.equal(packet.events.length,1);
  h.run(`showCorrectionProposal('tx')`);assert.ok(h.elements.get('modal').innerHTML.includes('not an issued receipt'));
});
test('correction event validators match and reject fake issued proposals',async t=>{
  const h=setup();await h.run(`applyCorrectionBatch(buildCorrectionBatch(['tx'],facts,'prepare_proposal'))`);
  const event=JSON.parse(h.run('JSON.stringify(DB.reviewEvents[0])'));
  const main=fs.readFileSync(path.join(__dirname,'../main.js'),'utf8');
  const helper=s=>s.slice(s.indexOf('function validCorrectionReviewEvent(event) {'),s.indexOf('\nfunction isLegacyDeletionMarker',s.indexOf('function validCorrectionReviewEvent(event) {')));
  assert.equal(helper(main),helper(html));
  const {mainHarness}=require('./helpers/main-harness.cjs'),fsp=require('node:fs/promises'),os=require('node:os');
  const root=await fsp.mkdtemp(path.join(os.tmpdir(),'billngai-correction-test-'));t.after(()=>fsp.rm(root,{recursive:true,force:true}));
  const native=mainHarness(root),data=JSON.parse(h.run('JSON.stringify(DB)'));
  await native.call('data:recover',JSON.stringify(data));
  assert.equal(JSON.parse(await mainHarness(root).call('data:load')).reviewEvents.length,1);
  for(const change of [{proposal:{type:'receipt',status:'issued',sourceDocumentId:'tx'}},{deliveryStatus:'guess'},{historicalVatConfirmed:false},{recordedAt:'2026-02-31'},{sourceRecordAtReview:{...event.sourceRecordAtReview,vatRate:7}}]){
    const bad={...data,reviewEvents:[{...event,...change}]};
    await assert.rejects(native.call('data:recover',JSON.stringify(bad)),/DATA_INVALID_SCHEMA/);
    assert.throws(()=>h.run(`validateRendererData(${JSON.stringify(bad)})`),/DATA_SCHEMA_INVALID/);
  }
});
