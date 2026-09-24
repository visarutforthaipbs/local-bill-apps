const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const test=require('node:test'),assert=require('node:assert/strict');
const script=fs.readFileSync(path.join(__dirname,'../billing.html'),'utf8').match(/<script>([\s\S]*)<\/script>\s*<\/body>/)[1].replace(/\bboot\(\);\s*$/,'');
function setup(){
  const ctx=vm.createContext({window:{addEventListener(){},matchMedia(){return {matches:false}}},document:{getElementById(){return {addEventListener(){},classList:{add(){},remove(){}}}},querySelectorAll(){return []},addEventListener(){}},navigator:{platform:'Test'},console,TextEncoder,TextDecoder,setTimeout(){},clearTimeout(){},setInterval(){},localStorage:{getItem(){return null},setItem(){}},confirm(){return true}});
  vm.runInContext(script,ctx);
  vm.runInContext(`DB=blankDB();DB.clients=[{id:'buyer',name:'Original buyer',taxId:'1234567890123'}];DB.business.uiLang='en';
    function fixture(extra={}){return {id:'r',type:'receipt',number:'RC1',clientId:'buyer',status:'issued',paidDate:'2026-01-10',issueDate:'2026-01-10',currency:'THB',vatRate:0,whtRate:0,incomeCategory:'40(8)',items:[{description:'Service',qty:1,price:1000}],...extra};}`,ctx);
  return code=>vm.runInContext(code,ctx);
}
test('frozen buyer, category and FX remain authoritative for reports after profile edits',()=>{
  const run=setup();
  run(`const d=fixture({currency:'USD',fxRate:35});freezeIssuedDocument(d);DB.documents=[d];DB.clients[0].name='Replacement';DB.clients[0].taxId='999';d.fxRate=1;d.incomeCategory='40(2)';`);
  assert.equal(run(`taxYearAgg(2026).byClient['Original buyer']`),35000);
  assert.equal(run(`taxYearAgg(2026).byCategory['40(8)'].subtotal`),35000);
  assert.match(run('buildReportCSV(2026)'),/Original buyer,1234567890123,40\(8\)/);
  assert.doesNotMatch(run('buildReportCSV(2026)'),/Replacement/);
});
test('missing and invalid payment dates remain unallocated, never fall back to issue date',()=>{
  const run=setup();run(`DB.documents=[fixture({paidDate:null}),fixture({id:'bad',paidDate:'2026-02-31'})]`);
  assert.equal(run('taxYearAgg(2026).agg.subtotal'),0);
  assert.equal(run('taxYearAgg(2026).missingDate'),2);
  assert.equal(run('taxYearAgg(2026).unallocatedDocs.length'),2);
  assert.equal(run('filingIncome(2026,0,11).grossThb'),0);
  assert.match(run('buildSummaryCSV(2026)'),/Records not allocated to a year,2/);
});
test('distinct positive payment IDs on the same invoice remain distinct payments',()=>{
  const run=setup();run(`const payments=[fixture({id:'one',parentId:'invoice',paymentId:'p1'}),fixture({id:'two',parentId:'invoice',paymentId:'p2'})];payments.forEach(d=>freezeIssuedDocument(d));DB.documents=payments;`);
  assert.equal(run('taxYearAgg(2026).agg.subtotal'),2000);
  assert.equal(run('paymentReview().docs.length'),2);
});
test('historical children with distinct IDs remain ambiguous without authoritative payment snapshots',()=>{
  const run=setup();run(`DB.documents=[fixture({id:'one',parentId:'invoice',paymentId:'p1'}),fixture({id:'two',parentId:'invoice',paymentId:'p2'})]`);
  assert.equal(run('taxYearAgg(2026).agg.subtotal'),0);
  assert.equal(run('paymentReview().docs.length'),0);
  assert.equal(run('paymentReview().unallocatedDocs.length'),2);
  assert.equal(run('taxYearAgg(2026).incomplete'),true);
});
test('explicit identity deduplicates equivalent invoice and receipt evidence',()=>{
  const run=setup();run(`DB.documents=[fixture({id:'invoice',type:'invoice',status:'paid',paymentId:'p'}),fixture({parentId:'invoice',paymentId:'p'})]`);
  assert.equal(run('taxYearAgg(2026).agg.subtotal'),1000);
  assert.equal(run('paymentReview().docs.length'),1);
});
test('ambiguous parent-only and conflicting explicit payment records never choose arbitrary totals',()=>{
  const run=setup();
  for(const paymentId of ['', 'same']){
    run(`DB.documents=[fixture({id:'a',parentId:'invoice',paymentId:${JSON.stringify(paymentId)}}),fixture({id:'b',parentId:'invoice',paymentId:${JSON.stringify(paymentId)},items:[{description:'Other',qty:1,price:2000}]})]`);
    assert.equal(run('taxYearAgg(2026).agg.subtotal'),0);
    assert.equal(run('paymentReview().ambiguousCount'),1);
    assert.equal(run('paymentReview().unallocatedDocs.length'),2);
    assert.match(run('buildSummaryCSV(2026)'),/Payments with unresolved identity,1/);
  }
});
test('unknown issued currency does not produce a THB or FX total',()=>{
  const run=setup();run(`DB.documents=[fixture({currency:'',fxRate:35})];docCurrency=()=>'';`);
  assert.equal(run('taxYearAgg(2026).agg.subtotal'),0);
  assert.equal(run('taxYearAgg(2026).foreignThb'),0);
  assert.equal(run('taxYearAgg(2026).unknownCurrency'),1);
  assert.equal(run('filingIncome(2026,0,11).incomplete'),true);
});
test('split progress separates drafts, excludes voided children and ignores draft receipts',()=>{
  const run=setup();run(`const q=fixture({id:'q',type:'quotation'});DB.documents=[q,fixture({id:'i1',type:'invoice',parentId:'q',status:'draft'}),fixture({id:'i2',type:'invoice',parentId:'q',status:'sent'}),fixture({id:'i3',type:'invoice',parentId:'q',status:'paid',voidedAt:'2026-01-10'}),fixture({id:'r2',parentId:'i2',status:'draft'})]`);
  assert.equal(run('splitProgress(q).planned'),1000);
  assert.equal(run('splitProgress(q).billed'),1000);
  assert.equal(run('splitProgress(q).paid'),0);
  assert.equal(run('splitProgress(q).kids.length'),2);
});
test('document-row inline handlers treat imported IDs as literal strings, never code',()=>{
  const run=setup();
  const id=`x');attack();//" autofocus onfocus="attack()`;
  run(`DB.documents=[fixture({id:${JSON.stringify(id)}})];`);
  const html=run('docTable(DB.documents)');
  const encoded=html.match(/<tr onclick="([^"]*)"/)[1];
  const handler=encoded.replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
  let seen,attacked=false;
  vm.runInNewContext(handler,{viewDoc(value){seen=value},attack(){attacked=true}});
  assert.equal(seen,id);assert.equal(attacked,false);
});
function reviewedFixture(run){
  run(`DB.business.vatStatus='non_registered';DEVICE_ID='review-test';
    DB.documents=[fixture({id:'legacy-invoice',number:'INV-OLD',type:'invoice',status:'sent',paidDate:null,issueDate:'2025-10-01',whtRate:3,legacy_review_required:true})];
    DB.reviewEvents=[{id:'review-event',type:'legacy_payment',documentId:'legacy-invoice',paymentId:'review-payment',paidDate:'2026-08-20',currency:'THB',gross:1000,wht:30,net:970,fullPaymentConfirmed:true,historicalVatConfirmed:true,vatStatus:'non_registered',recordedAt:'2026-09-24T00:00:00Z',
      issuer:{name:'Reviewed issuer',address:'Reviewed address',taxId:'1234567890123'},buyer:{name:'Reviewed buyer',address:'Reviewed buyer address',taxId:'1111111111111'},note:'Verified original evidence',evidence:[{sha256:'a'.repeat(64),fileName:'proof.pdf',size:100,mime:'application/pdf'}],sourceRecordAtReview:JSON.parse(JSON.stringify(DB.documents[0]))}];
    window.billingAPI={evidenceInfo:async sha256=>({sha256,available:true,size:100,mime:'application/pdf'})};persist=async()=>true;render=()=>{};viewDoc=()=>{};toast=()=>{};closeModal=()=>{};`);
}
test('reviewed legacy payment projects immutable facts without changing original invoice or inventing snapshot',()=>{
  const run=setup();reviewedFixture(run);
  const before=run('JSON.stringify(DB.documents[0])');
  assert.equal(run('taxYearAgg(2025).agg.subtotal'),0);
  assert.equal(run('taxYearAgg(2026).agg.subtotal'),1000);
  assert.equal(run('taxYearAgg(2026).agg.wht'),30);
  assert.equal(run('taxYearAgg(2026).agg.net'),970);
  assert.equal(run('taxYearAgg(2026).byMonth[7]'),1000);
  assert.equal(run('realizedDocs()[0].id'),'review:review-event');
  assert.equal(run('hasIssuedSnapshot(realizedDocs()[0])'),false);
  assert.equal(run('JSON.stringify(DB.documents[0])'),before);
  assert.equal(run('DB.documents.length'),1);
  run(`DB.clients[0].name='Current buyer';DB.clients[0].taxId='999';DB.business.businessName='Current seller';DB.documents[0].items[0].price=9000;DB.documents[0].incomeCategory='40(2)';`);
  assert.equal(run('taxYearAgg(2026).agg.subtotal'),1000);
  assert.equal(run(`taxYearAgg(2026).byCategory['40(8)'].subtotal`),1000);
  assert.match(run('buildReportCSV(2026)'),/2026-08-20,Reviewed buyer,1111111111111/);
  assert.doesNotMatch(run('buildReportCSV(2026)'),/Current buyer/);
});
test('physical receipt replaces projection exactly once, including retained void or deletion evidence',async()=>{
  const run=setup();reviewedFixture(run);
  const before=run('JSON.stringify(DB.documents[0])');
  assert.equal(run('realizedDocs().length'),1);
  await run(`createLegacyReceipt('legacy-invoice','review-event')`);
  assert.equal(run('DB.documents.length'),2);
  assert.equal(run('reviewedPaymentDocuments().length'),0);
  assert.equal(run('realizedDocs().length'),1);
  assert.equal(run('taxYearAgg(2026).agg.subtotal'),1000);
  assert.equal(run('taxYearAgg(2026).agg.wht'),30);
  assert.equal(run(`DB.documents[1].issuedSnapshot.buyer.name`),'Reviewed buyer');
  assert.equal(run('JSON.stringify(DB.documents[0])'),before);
  run(`DB.documents[1].voidedAt='2026-09-24';DB.documents[1].deletedAt='2026-09-24';`);
  assert.equal(run('reviewedPaymentDocuments().length'),0);
  assert.equal(run('realizedDocs().length'),1);
  assert.equal(run('taxYearAgg(2026).agg.subtotal'),1000);
});
test('receipt drafts do not erase reviewed payment projections and imported fields cannot forge them',()=>{
  const run=setup();reviewedFixture(run);
  run(`DB.documents.push(fixture({id:'draft',parentId:'legacy-invoice',paymentId:'review-payment',status:'draft'}));`);
  assert.equal(run('reviewedPaymentDocuments().length'),1);
  assert.equal(run('realizedDocs().length'),1);
  assert.equal(run(`isReviewedPaymentDocument({id:'review:review-event',reviewEventId:'review-event'})`),false);
  assert.equal(run(`reviewedPaymentAmounts({id:'review:review-event',reviewEventId:'review-event',gross:100000})`),null);
});
test('virtual payment WHT and document-row actions navigate retained source, not missing virtual IDs',()=>{
  const run=setup();reviewedFixture(run);
  const markup=run(`const content={},actions={};renderWht(content,actions);content.innerHTML`);
  assert.match(markup,/Reviewed buyer/);
  assert.match(markup,/viewDoc\(&quot;legacy-invoice&quot;\)/);
  assert.match(markup,/openReviewDialog\(&quot;legacy-invoice&quot;\)/);
  assert.doesNotMatch(markup,/openWhtCert\(/);
  assert.doesNotMatch(markup,/viewDoc\(&quot;review:/);
  assert.match(run('docTable(realizedDocs())'),/viewDoc\(&quot;legacy-invoice&quot;\)/);
  assert.match(run('buildWhtCSV(2026)'),/Reviewed buyer,1111111111111,2026-08-20/);
  assert.match(run('chartsBlock()'),/Reviewed buyer/);
});
test('malformed imported review amounts are flagged and never crash CSV or contaminate totals',()=>{
  const run=setup();reviewedFixture(run);
  run(`delete DB.reviewEvents[0].gross;DB.reviewEvents[0].sourceRecordAtReview='not a record';`);
  assert.equal(run('taxYearAgg(2026).agg.subtotal'),0);
  assert.equal(run('taxYearAgg(2026).invalidAmounts'),1);
  assert.equal(run('taxYearAgg(2026).incomplete'),true);
  assert.match(run('buildReportCSV(2026)'),/Incomplete totals/);
});
test('unconfirmed or unsupported imported payment events neither settle invoices nor create report income',()=>{
  for(const change of [
    `DB.reviewEvents[0].fullPaymentConfirmed=false`,
    `DB.reviewEvents[0].historicalVatConfirmed=false`,
    `DB.reviewEvents[0].evidence=[]`,
    `DB.reviewEvents[0].evidence[0].sha256='not a digest'`,
    `DB.reviewEvents[0].vatStatus='registered'`,
    `DB.reviewEvents[0].buyer.address=''`,
    `delete DB.reviewEvents[0].sourceRecordAtReview`
  ]){
    const run=setup();reviewedFixture(run);
    run(`DB.documents[0].dueDate='2026-01-01';${change};`);
    assert.equal(run('hasReviewedPayment(DB.documents[0])'),false,change);
    assert.equal(run('effectiveStatus(DB.documents[0])'),'overdue',change);
    assert.equal(run(`docStatusMatch(DB.documents[0],'unpaid')`),true,change);
    assert.equal(run('taxYearAgg(2026).agg.subtotal'),0,change);
    assert.equal(run('taxYearAgg(2026).invalidAmounts'),1,change);
    assert.equal(run('taxYearAgg(2026).incomplete'),true,change);
  }
});
test('valid reviewed payment remains settled despite later current business and client changes',()=>{
  const run=setup();reviewedFixture(run);
  run(`DB.documents[0].dueDate='2026-01-01';DB.business.vatStatus='registered';DB.business.businessName='New business';DB.clients[0].name='Different buyer';`);
  assert.equal(run('hasReviewedPayment(DB.documents[0])'),true);
  assert.equal(run('effectiveStatus(DB.documents[0])'),'paid');
  assert.equal(run(`docStatusMatch(DB.documents[0],'unpaid')`),false);
  assert.equal(run('taxYearAgg(2026).agg.subtotal'),1000);
  assert.match(run('buildReportCSV(2026)'),/Reviewed buyer/);
});
