const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const test=require('node:test');
const assert=require('node:assert/strict');
const html=fs.readFileSync(path.join(__dirname,'..','billing.html'),'utf8');
const script=html.match(/<script>([\s\S]*)<\/script>\s*<\/body>/)[1].replace(/\bboot\(\);\s*$/,'');
function run(code){
  const ctx=vm.createContext({window:{addEventListener(){},matchMedia(){return {matches:false};}},
    document:{getElementById(){return {addEventListener(){},classList:{add(){},remove(){}}};},querySelectorAll(){return [];},addEventListener(){}},
    navigator:{platform:'Synthetic'},console,TextEncoder,TextDecoder,setTimeout(){return 0;},clearTimeout(){},setInterval(){return 0;},
    localStorage:{getItem(){return null;},setItem(){}},confirm(){return false;}});
  vm.runInContext(script,ctx);
  vm.runInContext(`DB=blankDB();DB.business.isVatRegistered=false;DB.business.uiLang='en';
    DB.clients=[{id:'c',name:'Synthetic buyer'}];
    function fixture(overrides={}){return {id:'i',type:'invoice',number:'INV-1',clientId:'c',
      status:'paid',paidDate:'2026-01-10',issueDate:'2026-01-10',currency:'THB',
      vatRate:0,whtRate:3,incomeCategory:'40(8)',items:[{description:'Service',qty:1,price:10000}],...overrides};}`,ctx);
  const result=vm.runInContext(code,ctx);
  return result&&typeof result.then==='function'?result.then(value=>JSON.parse(JSON.stringify(value))):JSON.parse(JSON.stringify(result));
}
test('paid invoice counts once without a receipt',()=>{
  const r=run(`DB.documents=[fixture()];({a:taxYearAgg(2026).agg.subtotal,f:filingIncome(2026,0,11),w:whtTrackedDocs().length})`);
  assert.equal(r.a,10000);assert.equal(r.f.grossThb,10000);assert.equal(r.w,1);
});
test('historical dashboard shows a separate non-double-counted provisional sum, excluding conflicts and deletion',()=>{
  const r=run(`DB.documents=[fixture(),fixture({id:'r',type:'receipt',status:'issued',parentId:'i'}),fixture({id:'i2'}),fixture({id:'r2',type:'receipt',status:'issued',parentId:'i2',items:[{qty:1,price:20000}]}),fixture({id:'i3',deletedAt:'2026-01-11'}),fixture({id:'r3',type:'receipt',status:'issued',parentId:'i3'})];
    DB.documents.forEach(d=>d.number=d.id);const summary=pendingPaymentSummary();({included:paymentReview().docs.length,net:summary.net,eligible:summary.eligible.length,excluded:summary.excluded,html:renderPendingPayments(summary)})`);
  assert.equal(r.included,0);assert.equal(r.net,9700);assert.equal(r.eligible,1);assert.equal(r.excluded,2);
  assert.match(r.html,/Historical income awaiting confirmation/);assert.match(r.html,/not yet included as received/);
});
test('explicit matching counts one payment, preserves originals and invalidates when source changes',async()=>{
  const r=await run(`(async()=>{DB.documents=[fixture(),fixture({id:'r',type:'receipt',status:'issued',parentId:'i'})];
    DB.documents.forEach(d=>d.number=d.id);const original=JSON.stringify(DB.documents),groups=paymentReview().unallocatedGroups;
    window.billingAPI={snapshotBackup:async()=> 'snapshot'};persist=async()=>true;render=()=>{};toast=()=>{};closeModal=()=>{};
    const saved=await savePaymentMatches(groups,true,'Confirmed against records');const summary=paymentReview(),total=taxYearAgg(2026).agg.net;
    const repeated=await savePaymentMatches(groups,true,'Repeated');const unchanged=JSON.stringify(DB.documents)===original;
    DB.documents[0].items[0].price=20000;return {saved,repeated,unchanged,total,included:summary.docs.length,afterChange:paymentReview().docs.length};})()`);
  assert.equal(r.saved,true);assert.equal(r.repeated,false);assert.equal(r.unchanged,true);assert.equal(r.total,9700);assert.equal(r.included,1);assert.equal(r.afterChange,0);
});
test('payment match requires confirmation, backup and durable save',async()=>{
  const r=await run(`(async()=>{DB.documents=[fixture(),fixture({id:'r',type:'receipt',status:'issued',parentId:'i'})];
    DB.documents.forEach(d=>d.number=d.id);const groups=paymentReview().unallocatedGroups;toast=()=>{};render=()=>{};closeModal=()=>{};
    window.billingAPI={snapshotBackup:async()=>false};persist=async()=>true;
    const noConfirmation=await savePaymentMatches(groups,false,'Note'),failedBackup=await savePaymentMatches(groups,true,'Note');
    window.billingAPI.snapshotBackup=async()=> 'snapshot';persist=async()=>false;const failedSave=await savePaymentMatches(groups,true,'Note');
    return {noConfirmation,failedBackup,failedSave,events:DB.reviewEvents.length,included:paymentReview().docs.length};})()`);
  assert.deepEqual(r,{noConfirmation:false,failedBackup:false,failedSave:false,events:0,included:0});
});
test('forged, duplicate, changed or conflicting matching snapshots cannot affect reports',()=>{
  const r=run(`DB.documents=[fixture(),fixture({id:'r',type:'receipt',status:'issued',parentId:'i'})];
    DB.documents.forEach(d=>d.number=d.id);const group=paymentReview().unallocatedGroups[0],base={id:'event',type:'payment_match',documentId:'i',representativeId:'r',samePaymentConfirmed:true,note:'Review',recordedAt:'2026-09-24T00:00:00.000Z',sourceRecords:JSON.parse(JSON.stringify(group))};
    const cases=[{...base,samePaymentConfirmed:false},{...base,representativeId:'missing'},{...base,sourceRecords:[group[0],group[0]]},{...base,sourceRecords:[]},{...base,sourceRecords:[{...group[0],paidDate:'2026-02-10'},group[1]]}];
    cases.map(e=>{DB.reviewEvents=[e];return paymentReview().docs.length;})`);
  assert.deepEqual(r,[0,0,0,0,0]);
});
test('explicit receipt/source identity deduplicates but unidentified extra receipt remains ambiguous',()=>{
  const r=run(`DB.documents=[fixture({paymentId:'p'}),fixture({id:'r',type:'receipt',status:'issued',parentId:'i',paymentId:'p'}),fixture({id:'r2',type:'receipt',status:'issued',parentId:'i'})];taxYearAgg(2026)`);
  assert.equal(r.agg.subtotal,10000);assert.equal(r.docs.length,1);assert.equal(r.duplicateCount,0);
  assert.equal(r.ambiguousCount,1);assert.equal(r.unallocatedDocs.length,1);assert.equal(r.incomplete,true);
});
test('matching payment IDs deduplicate receipts without parent IDs',()=>{
  const r=run(`DB.documents=[fixture({paymentId:'p'}),fixture({id:'r',type:'receipt',status:'issued',paymentId:'p'})];taxYearAgg(2026)`);
  assert.equal(r.agg.subtotal,10000);assert.equal(r.docs.length,1);
});
test('duplicate invoices sharing payment identity are counted once and flagged',()=>{
  const r=run(`DB.documents=[fixture({paymentId:'p'}),fixture({id:'i2',paymentId:'p'})];taxYearAgg(2026)`);
  assert.equal(r.agg.subtotal,10000);assert.equal(r.docs.length,1);assert.equal(r.duplicateCount,1);
});
test('draft receipts excluded; void and tombstones do not erase payments',()=>{
  const r=run(`DB.documents=[fixture({id:'draft',type:'receipt',status:'draft'}),fixture({id:'v',type:'receipt',status:'issued',voidedAt:'2026-02-01',deletedAt:'2026-02-02'})];taxYearAgg(2026)`);
  assert.equal(r.docs.length,1);assert.equal(r.agg.subtotal,10000);assert.equal(r.incomplete,true);
});
test('only explicit 40(5)–40(8) enter half-year summary',()=>{
  const r=run(`DB.documents=['','40(2)','40(5)','40(6)','40(7)','40(8)'].map((cat,i)=>fixture({id:String(i),incomeCategory:cat}));filingIncome(2026,0,5,true)`);
  assert.equal(r.grossThb,40000);assert.equal(r.unknownCategory,1);assert.equal(r.excluded,2);assert.equal(r.incomplete,true);
});
test('legacy FX pre-VAT income agrees in reports, categories, filing and CSV',()=>{
  const r=run(`DB.documents=[fixture({id:'fx',currency:'USD',fxRate:35,vatRate:7})];({a:taxYearAgg(2026),f:filingIncome(2026,0,11),csv:buildReportCSV(2026)})`);
  assert.equal(r.a.foreignThb,350000);assert.equal(r.f.foreignThb,350000);
  assert.equal(r.a.byCategory['40(8)'].subtotal,350000);assert.equal(r.a.byMonth[0],350000);
  assert.match(r.csv,/350000\.00/);
});
test('missing or non-finite FX is incomplete, not certified zero income',()=>{
  const r=run(`DB.documents=[fixture({currency:'USD',fxRate:Infinity})];({a:taxYearAgg(2026),f:filingIncome(2026,0,11),summary:buildSummaryCSV(2026)})`);
  assert.equal(r.a.foreignMissing,1);assert.equal(r.a.incomplete,true);assert.equal(r.f.incomplete,true);
  assert.match(r.summary,/Incomplete totals/);
});
test('unknown and invalid payment dates retain uncertainty',()=>{
  const r=run(`DB.documents=[fixture({paidDate:null}),fixture({id:'bad-date',paidDate:'2026-02-31'})];taxYearAgg(2026)`);
  assert.equal(r.missingDate,2);assert.equal(r.incomplete,true);
});
test('non-finite amounts do not contaminate totals',()=>{
  const r=run(`DB.documents=[fixture({items:[{qty:1,price:Infinity}]})];taxYearAgg(2026)`);
  assert.equal(r.agg.subtotal,0);assert.equal(r.invalidAmounts,1);assert.equal(r.incomplete,true);
});
test('tax estimate, deadline and reminder entry points are disabled',()=>{
  const r=run(`({estimate:pitEstimate(600000,false),deadlines:filingDeadlines(2026),reminder:filingReminder()})`);
  assert.equal(r.estimate.supported,false);assert.equal('tax' in r.estimate,false);assert.deepEqual(r.deadlines,[]);assert.equal(r.reminder,'');
});
test('filing UI has no payable/refund figures, credits or universal expense formula',()=>{
  const r=run(`DB.documents=[fixture()];reportYear=2026;const c={},ta={};renderFiling(c,ta);c.innerHTML`);
  assert.match(r,/Tax payable or refund calculation is unavailable/);
  assert.doesNotMatch(r,/50%|100,000|Amount payable|Tax credit|8 days|2026-09-30/);
  assert.match(r,/PND94 instructions for tax year 2569/);
});
test('WHT UI tracks expected deductions and receipt counts, not certified credits',()=>{
  const r=run(`DB.documents=[fixture({whtCertReceived:true})];const c={},ta={};renderWht(c,ta);c.innerHTML`);
  assert.match(r,/expected, not a verified tax credit/);
  assert.match(r,/Certificates marked received \(count\)/);
});
test('certificate receipt save failure rolls back metadata and never changes frozen withholding',async()=>{
  const r=await run(`(async()=>{
    const d=fixture({type:'receipt',status:'issued'});freezeIssuedDocument(d);DB.documents=[d];
    const original=JSON.stringify(DB.documents[0]),before=compute(DB.documents[0]).whtAmount;
    document.getElementById=id=>({checked:true,value:id==='w_no'?'CERT-1':'2026-01-10'});
    persist=async()=>false;toast=()=>{};closeModal=()=>{};render=()=>{};
    const failed=await saveWhtCert('i'),unchanged=JSON.stringify(DB.documents[0])===original;
    persist=async()=>true;const saved=await saveWhtCert('i');
    return {failed,unchanged,saved,received:DB.documents[0].whtCertReceived,before,after:compute(DB.documents[0]).whtAmount};
  })()`);
  assert.equal(r.failed,false);assert.equal(r.unchanged,true);assert.equal(r.saved,true);assert.equal(r.received,true);assert.equal(r.after,r.before);
});
