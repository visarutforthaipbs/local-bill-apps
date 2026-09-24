const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const script = fs.readFileSync(path.join(__dirname, '../billing.html'), 'utf8')
  .match(/<script>([\s\S]*)<\/script>\s*<\/body>/)[1].replace(/\bboot\(\);\s*$/, '');

// Synthetic renderer only: never boot Electron or read an application profile.
function setup() {
  const elements = new Map();
  const element = () => ({innerHTML:'', textContent:'', value:'', checked:false,
    addEventListener(){}, focus(){}, querySelector(){return null;},
    classList:{add(){},remove(){},toggle(){}}, style:{setProperty(){},removeProperty(){}}});
  const ctx = vm.createContext({
    window:{addEventListener(){},matchMedia(){return {matches:false};},billingAPI:{isElectron:true,
      async evidenceInfo(sha256){return sha256==='a'.repeat(64)
        ?{sha256,size:100,mime:'application/pdf',available:true}:{sha256,available:false};}}},
    document:{getElementById(id){if(!elements.has(id)) elements.set(id,element());return elements.get(id);},
      querySelectorAll(){return [];},querySelector(){return null;},addEventListener(){},
      body:{classList:{add(){},remove(){},toggle(){}},setAttribute(){}},documentElement:element()},
    navigator:{platform:'SyntheticLegacyRecovery'}, console, TextEncoder, TextDecoder,
    setTimeout(){return 0;},clearTimeout(){},setInterval(){return 0;},
    localStorage:{getItem(){return null;},setItem(){}},confirm(){return true;},
    prompt(){throw Error('prompt() is not supported.');}
  });
  vm.runInContext(script,ctx);
  vm.runInContext(`DB=blankDB(); DEVICE_ID='synthetic-legacy-recovery';
    Object.assign(DB.business,{businessName:'TODAYS_ISSUER_NOT_ORIGINAL',address:'TODAYS_ADDRESS_NOT_ORIGINAL',
      taxId:'1234567890123',vatStatus:'non_registered',currency:'THB'});
    DB.clients=[{id:'buyer',name:'TODAYS_BUYER_NOT_ORIGINAL',address:'TODAYS_BUYER_ADDRESS'}];
    persist=async()=>true;render=()=>{};toast=()=>{};viewDoc=()=>{};setView=()=>{};
    function legacy(extra={}) {return {id:'legacy1',type:'invoice',number:'INV-OLD-1',status:'sent',
      clientId:'buyer',issueDate:'2025-01-10',dueDate:'2025-02-10',currency:'THB',vatRate:0,whtRate:0,
      items:[{description:'SAVED_SERVICE_LINE',qty:2,price:5000}],notes:'SAVED_DOCUMENT_NOTE',
      deletedAt:null,legacy_review_required:true,...extra};}
    function paymentFacts(extra={}) {return {paidDate:'2025-02-01',currency:'THB',gross:10000,wht:0,net:10000,
      fullPaymentConfirmed:true,vatStatus:'non_registered',historicalVatConfirmed:true,
      buyer:{name:'Reviewed historical buyer',address:'Reviewed buyer address',taxId:'1234567890123'},
      issuer:{name:'Reviewed historical issuer',address:'Reviewed issuer address',taxId:'1234567890123'},
      evidence:[{fileName:'synthetic-evidence.pdf',sha256:'a'.repeat(64),mime:'application/pdf',size:100,attachedAt:'2026-09-24T00:00:00.000Z'}],
      note:'Synthetic reviewer compared the retained invoice and payment evidence',...extra};}
  `,ctx);
  return {run:s=>vm.runInContext(s,ctx),elements};
}

test('every legacy document type exposes retained fields without inventing current issuer or buyer',()=>{
  const {run}=setup();
  for(const type of ['quotation','invoice','receipt','tax_invoice']) {
    const html=run(`renderHistoricalReview(legacy({type:${JSON.stringify(type)}}))`);
    assert.match(html,/INV-OLD-1/);
    assert.match(html,/SAVED_SERVICE_LINE/);
    assert.match(html,/SAVED_DOCUMENT_NOTE/);
    assert.doesNotMatch(html,/TODAYS_ISSUER_NOT_ORIGINAL|TODAYS_ADDRESS_NOT_ORIGINAL|TODAYS_BUYER_NOT_ORIGINAL/);
    assert.doesNotMatch(html,/class="paper(?:\s|")/);
    assert.match(html,/<dl\b/,'Historical details must be labelled, not only raw JSON');
    assert.match(html,/<table>/,'Line items must remain human-readable');
    assert.ok(html.indexOf('<table>')<html.indexOf('<pre'),'Raw JSON is secondary to readable details');
  }
});

test('historical review labels translate and later-reviewed parties stay separate from original unknowns',async()=>{
  const {run}=setup();
  run(`DB.documents=[legacy()];DB.business.uiLang='en';`);
  await run(`recordLegacyPayment('legacy1',paymentFacts())`);
  const html=run(`renderHistoricalReview(DB.documents[0])`);
  assert.match(html,/Retained document details/);
  assert.match(html,/Original information unknown/);
  assert.match(html,/Facts confirmed later — not original particulars/);
  assert.match(html,/Reviewed historical buyer/);
  assert.doesNotMatch(html,/TODAYS_BUYER_NOT_ORIGINAL|TODAYS_ISSUER_NOT_ORIGINAL/);
});

test('review is non-mutating and escapes imported historical text',()=>{
  const {run}=setup();
  assert.equal(run(`(()=>{const d=legacy({notes:'<script>legacyAttack()</script>',currency:undefined});
    DB.documents=[d];const before=JSON.stringify(DB);const html=renderHistoricalReview(d);
    return JSON.stringify(DB)===before && !d.issuedSnapshot && d.legacy_review_required &&
      !html.includes('<script>') && html.includes('&lt;script&gt;');})()`),true);
});

test('reviewing an unknown currency does not grant authoritative output',()=>{
  const {run}=setup();
  assert.equal(run(`(()=>{const d=legacy();delete d.currency;DB.documents=[d];
    renderHistoricalReview(d);return documentOutputBlocked(d)&&shareText(d)===''&&
      !d.issuedSnapshot&&!Object.prototype.hasOwnProperty.call(d,'currency');})()`),true);
});

test('tax invoices remain blocked even with a structurally valid frozen snapshot',()=>{
  const {run}=setup();
  assert.equal(run(`(()=>{const d=legacy({type:'tax_invoice',legacy_review_required:false});
    freezeIssuedDocument(d);DB.documents=[d];return hasIssuedSnapshot(d)&&documentOutputBlocked(d)&&shareText(d)==='';})()`),true);
});

test('migration keeps referenced customer tombstones and document evidence on repeat loads',()=>{
  const {run}=setup();
  assert.equal(run(`(()=>{const d=legacy({deletedAt:'2020-01-01T00:00:00Z'});
    const input={...blankDB(),documents:[d],clients:[{id:'buyer',name:'RETAINED_REFERENCE',deletedAt:'2020-01-01T00:00:00Z'}]};
    const a=migrate(input),b=migrate(a);return b.clients.length===1&&b.clients[0].name==='RETAINED_REFERENCE'&&
      b.documents.length===1&&!b.documents[0].issuedSnapshot&&JSON.stringify(a)===JSON.stringify(b);})()`),true);
});

test('archive visibility is separate from void, deletion and recorded payment',async()=>{
  const {run}=setup();
  run(`DB.documents=[legacy({type:'receipt',status:'issued',paidDate:'2025-01-10',paymentId:'old-payment'})];`);
  const before=run(`JSON.stringify(DB.documents[0])`);
  await run(`archiveDocument('legacy1',true)`);
  assert.ok(run(`DB.documents[0].archivedAt`));
  assert.equal(run(`DB.documents[0].voidedAt`),undefined);
  assert.equal(run(`DB.documents[0].deletedAt`),null);
  assert.equal(run(`DB.documents[0].paymentId`),'old-payment');
  assert.equal(run(`realizedDocs().length`),1);
  await run(`archiveDocument('legacy1',false)`);
  assert.equal(run(`!!DB.documents[0].archivedAt`),false);
  assert.equal(run(`DB.documents[0].paidDate`),'2025-01-10');
  assert.equal(run(`DB.documents[0].issuedSnapshot`),undefined);
  assert.match(before,/old-payment/);
});

test('failed archive persistence does not leave a successful archive in memory',async()=>{
  const {run}=setup();
  run(`DB.documents=[legacy()];persist=async()=>false;`);
  const before=run(`JSON.stringify(DB)`);
  await run(`archiveDocument('legacy1',true)`);
  assert.equal(run(`JSON.stringify(DB)`),before);
});

test('rejected archive and void saves also restore state rather than leaking staged changes',async()=>{
  const {run}=setup();
  run(`DB.documents=[legacy()];persist=async()=>{throw Error('Synthetic disk unavailable');};`);
  const before=run(`JSON.stringify(DB)`);
  await run(`archiveDocument('legacy1',true)`);
  assert.equal(run(`JSON.stringify(DB)`),before);
  await run(`voidDocument('legacy1','Wrong duplicate')`);
  assert.equal(run(`JSON.stringify(DB)`),before);
});

test('void button opens a real modal instead of invoking unsupported native prompt',async()=>{
  const {run,elements}=setup();
  run(`DB.documents=[legacy()];`);
  const before=run(`JSON.stringify(DB)`);
  await run(`voidDocument('legacy1')`);
  assert.match(elements.get('modal').innerHTML,/<(?:textarea|input)\b/);
  assert.match(elements.get('modal').innerHTML,/submitVoidDialog/);
  assert.equal(run(`JSON.stringify(DB)`),before);
  run(`closeModal()`);
  assert.equal(run(`JSON.stringify(DB)`),before);
});

test('void requires a reason and rolls back failed persistence without changing evidence',async()=>{
  const {run}=setup();
  run(`DB.documents=[legacy()];`);
  const before=run(`JSON.stringify(DB)`);
  await run(`voidDocument('legacy1','  ')`);
  assert.equal(run(`JSON.stringify(DB)`),before);
  await run(`persist=async()=>false;voidDocument('legacy1','Wrong duplicate')`);
  assert.equal(run(`JSON.stringify(DB)`),before);
  await run(`persist=async()=>true;voidDocument('legacy1','Wrong duplicate')`);
  assert.equal(run(`DB.documents[0].voidReason`),'Wrong duplicate');
  assert.equal(run(`DB.documents[0].items[0].description`),'SAVED_SERVICE_LINE');
  assert.equal(run(`DB.documents[0].legacy_review_required`),true);
  assert.equal(run(`DB.documents[0].issuedSnapshot`),undefined);
});

test('void modal submission requires entered reason, persists once and retains the source contents',async()=>{
  const {run,elements}=setup();
  run(`DB.documents=[legacy()];openVoidDialog('legacy1');document.getElementById('voidReason');`);
  const before=run(`JSON.stringify(DB)`);
  elements.get('voidReason').value=' ';
  await run(`submitVoidDialog('legacy1')`);
  assert.equal(run(`JSON.stringify(DB)`),before);
  elements.get('voidReason').value='Wrong duplicate';
  await run(`submitVoidDialog('legacy1')`);
  assert.equal(run(`DB.documents[0].voidReason`),'Wrong duplicate');
  const after=run(`JSON.stringify(DB)`);
  await run(`submitVoidDialog('legacy1')`);
  assert.equal(run(`JSON.stringify(DB)`),after);
});

test('reviewed legacy payment appends separate facts without rewriting the old invoice',async()=>{
  const {run}=setup();
  run(`DB.documents=[legacy()];`);
  const original=run(`JSON.stringify(DB.documents[0])`);
  await run(`recordLegacyPayment('legacy1',paymentFacts())`);
  assert.equal(run(`DB.reviewEvents.length`),1);
  assert.equal(run(`JSON.stringify(DB.documents[0])`),original);
  assert.equal(run(`DB.documents.length`),1,'Recording payment is not automatic receipt issuance');
  assert.equal(run(`DB.reviewEvents[0].type`),'legacy_payment');
  assert.equal(run(`DB.reviewEvents[0].documentId`),'legacy1');
  assert.equal(run(`DB.reviewEvents[0].paidDate`),'2025-02-01');
  assert.equal(run(`DB.reviewEvents[0].gross`),10000);
  assert.equal(run(`DB.reviewEvents[0].net`),10000);
  assert.ok(run(`DB.reviewEvents[0].id`));
  assert.ok(run(`DB.reviewEvents[0].paymentId`));
  assert.ok(run(`DB.reviewEvents[0].recordedAt`));
  assert.equal(run(`DB.reviewEvents[0].issuer.name`),'Reviewed historical issuer');
  assert.equal(run(`DB.reviewEvents[0].buyer.name`),'Reviewed historical buyer');
  const event=run(`JSON.stringify(DB.reviewEvents[0])`);
  await run(`recordLegacyPayment('legacy1',paymentFacts())`);
  assert.equal(run(`DB.reviewEvents.length`),1);
  assert.equal(run(`JSON.stringify(DB.reviewEvents[0])`),event);
  assert.equal(run(`JSON.stringify(DB.documents[0])`),original);
});

test('reviewed payment rejects incomplete, unsupported and contradictory submitted facts',async()=>{
  const {run}=setup();
  for(const extra of [
    {paidDate:''},{paidDate:'2025-02-30'},{paidDate:'2999-01-01'},
    {fullPaymentConfirmed:false},{vatStatus:'registered'},{historicalVatConfirmed:false},
    {currency:'USD'},{gross:9999},{wht:1},{net:9999},{gross:Infinity},
    {buyer:{name:''}},{issuer:{name:'Unverified issuer',address:'',taxId:''}},
    {note:' '},{evidence:[]},{evidence:[{fileName:'unhashed.pdf'}]}
  ]){
    run(`DB=blankDB();DB.business.vatStatus='non_registered';DB.documents=[legacy()];`);
    const before=run(`JSON.stringify(DB)`);
    // Infinity is exercised as an expression because JSON encoding maps it to null.
    const encoded=extra.gross===Infinity?'{gross:Infinity}':JSON.stringify(extra);
    await run(`recordLegacyPayment('legacy1',paymentFacts(${encoded}))`);
    assert.equal(run(`JSON.stringify(DB)`),before,encoded);
  }
});

test('legacy recovery refuses already paid, void, deleted, VAT, FX, partial and conflicting sources',async()=>{
  const {run}=setup();
  for(const extra of [
    {status:'paid'},{paidDate:'2025-01-20'},{paymentId:'existing-payment'},
    {voidedAt:'2025-01-20'},{deletedAt:'2025-01-20'},{vatRate:7},{currency:'USD'},
    {currency:null},{milestone:{seq:1,of:2}},{syncConflict:true},{type:'tax_invoice'},{status:'draft'}
  ]){
    run(`DB=blankDB();DB.business.vatStatus='non_registered';DB.documents=[legacy(${JSON.stringify(extra)})];`);
    const before=run(`JSON.stringify(DB)`);
    await run(`recordLegacyPayment('legacy1',paymentFacts())`);
    assert.equal(run(`JSON.stringify(DB)`),before,JSON.stringify(extra));
  }
});

test('retained receipt evidence blocks a second reviewed payment even if voided or deleted',async()=>{
  const {run}=setup();
  for(const extra of [{},{voidedAt:'2025-01-20'},{deletedAt:'2025-01-20'}]){
    run(`DB.documents=[legacy(),legacy({id:'old-receipt',type:'receipt',status:'issued',number:'RC-OLD',parentId:'legacy1',...${JSON.stringify(extra)}})];`);
    const before=run(`JSON.stringify(DB)`);
    await run(`recordLegacyPayment('legacy1',paymentFacts())`);
    assert.equal(run(`JSON.stringify(DB)`),before);
  }
});

test('false or rejected reviewed-payment saves roll back the entire sidecar and old source',async()=>{
  const {run}=setup();
  for(const failure of ['return false;',"throw Error('Synthetic disk unavailable');"]){
    run(`DB.documents=[legacy()];persist=async()=>{${failure}};`);
    const before=run(`JSON.stringify(DB)`);
    await run(`recordLegacyPayment('legacy1',paymentFacts())`);
    assert.equal(run(`JSON.stringify(DB)`),before);
  }
});

test('separate legacy receipt action issues today once and does not manufacture an old original',async()=>{
  const {run}=setup();
  run(`DB.documents=[legacy()];`);
  const original=run(`JSON.stringify(DB.documents[0])`);
  await run(`recordLegacyPayment('legacy1',paymentFacts())`);
  const event=run(`JSON.stringify(DB.reviewEvents[0])`);
  await run(`createLegacyReceipt('legacy1',DB.reviewEvents[0].id)`);
  assert.equal(run(`DB.documents.length`),2);
  assert.equal(run(`JSON.stringify(DB.documents[0])`),original);
  assert.equal(run(`JSON.stringify(DB.reviewEvents[0])`),event);
  assert.equal(run(`DB.documents[1].type`),'receipt');
  assert.equal(run(`DB.documents[1].issueDate===todayISO()`),true);
  assert.equal(run(`DB.documents[1].paidDate`),'2025-02-01');
  assert.equal(run(`DB.documents[1].paymentId===DB.reviewEvents[0].paymentId`),true);
  assert.equal(run(`hasIssuedSnapshot(DB.documents[1])`),true);
  await run(`createLegacyReceipt('legacy1',DB.reviewEvents[0].id)`);
  assert.equal(run(`DB.documents.length`),2);
});

test('legacy receipt failure leaves reviewed payment available without consuming a number',async()=>{
  const {run}=setup();
  run(`DB.documents=[legacy()];`);
  await run(`recordLegacyPayment('legacy1',paymentFacts())`);
  const before=run(`JSON.stringify(DB)`);
  await run(`persist=async()=>false;createLegacyReceipt('legacy1',DB.reviewEvents[0].id)`);
  assert.equal(run(`JSON.stringify(DB)`),before);
});

test('native evidence verification refuses missing files and mismatched metadata',async()=>{
  const {run}=setup();
  for(const response of [
    "{sha256:hash,available:false}",
    "{sha256:hash,available:true,size:999,mime:'application/pdf'}",
    "{sha256:hash,available:true,size:100,mime:'image/png'}"
  ]){
    run(`DB.documents=[legacy()];window.billingAPI.evidenceInfo=async hash=>(${response});`);
    const before=run(`JSON.stringify(DB)`);
    await run(`recordLegacyPayment('legacy1',paymentFacts())`);
    assert.equal(run(`JSON.stringify(DB)`),before,response);
  }
});

test('concurrent legacy receipt requests cannot issue two receipts for one reviewed payment',async()=>{
  const {run}=setup();
  run(`DB.documents=[legacy()];`);
  await run(`recordLegacyPayment('legacy1',paymentFacts())`);
  await run(`Promise.all([createLegacyReceipt('legacy1',DB.reviewEvents[0].id),createLegacyReceipt('legacy1',DB.reviewEvents[0].id)])`);
  assert.equal(run(`DB.documents.filter(d=>d.type==='receipt').length`),1);
  assert.equal(run(`new Set(DB.documents.filter(d=>d.type==='receipt').map(d=>d.paymentId)).size`),1);
});

test('receipt creation revalidates restored review facts and does not silently adopt changed source amounts',async()=>{
  for(const mutation of [
    `DB.reviewEvents[0].vatStatus='registered'`,
    `DB.reviewEvents[0].historicalVatConfirmed=false`,
    `DB.reviewEvents[0].fullPaymentConfirmed=false`,
    `DB.reviewEvents[0].gross=20000`,
    `DB.documents[0].items[0].price=7000`
  ]){
    const {run}=setup();
    run(`DB.documents=[legacy()];`);
    await run(`recordLegacyPayment('legacy1',paymentFacts())`);
    run(mutation);
    const before=run(`JSON.stringify(DB)`);
    await run(`createLegacyReceipt('legacy1',DB.reviewEvents[0].id)`);
    assert.equal(run(`JSON.stringify(DB)`),before,mutation);
  }
});

test('reviewed payment settles collection views and counts once before and after a new receipt',async()=>{
  const {run}=setup();
  run(`DB.documents=[legacy()];`);
  const original=run(`JSON.stringify(DB.documents[0])`);
  assert.equal(run(`docStatusMatch(DB.documents[0],'unpaid')`),true);
  await run(`recordLegacyPayment('legacy1',paymentFacts())`);
  assert.equal(run(`docStatusMatch(DB.documents[0],'unpaid')`),false);
  assert.equal(run(`effectiveStatus(DB.documents[0])`),'paid');
  assert.equal(run(`JSON.stringify(DB.documents[0])`),original);
  assert.equal(run(`taxYearAgg(2025).agg.net`),10000);
  assert.equal(run(`taxYearAgg(2025).agg.count`),1);
  await run(`createLegacyReceipt('legacy1',DB.reviewEvents[0].id)`);
  assert.equal(run(`taxYearAgg(2025).agg.net`),10000);
  assert.equal(run(`taxYearAgg(2025).agg.count`),1);
  await run(`archiveDocument('legacy1',true)`);
  assert.equal(run(`taxYearAgg(2025).agg.net`),10000);
  await run(`voidDocument('legacy1','Retain payment evidence after document void')`);
  assert.equal(run(`taxYearAgg(2025).agg.net`),10000);
});

test('archive export includes reference context and review events without pretending they are original parties',()=>{
  const {run}=setup();
  run(`DB.documents=[legacy()];DB.reviewEvents=[{id:'note1',documentId:'legacy1',type:'note',note:'Synthetic review',recordedAt:'2026-09-24T00:00:00.000Z',evidence:[]}];`);
  const exported=run(`(()=>{let content;downloadFile=text=>{content=text;};exportDocumentArchive();return content;})()`);
  assert.match(exported,/TODAYS_BUYER_NOT_ORIGINAL/);
  assert.match(exported,/Synthetic review/);
  assert.match(exported,/historical-review-not-tax-document/);
});
