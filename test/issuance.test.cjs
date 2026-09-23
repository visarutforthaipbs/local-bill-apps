const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../billing.html'),'utf8');
const script=html.match(/<script>([\s\S]*)<\/script>\s*<\/body>/)[1].replace(/\bboot\(\);\s*$/,'');
function context(){
  const ctx=vm.createContext({window:{addEventListener(){},matchMedia(){return {matches:false};}},
    document:{getElementById(){return {addEventListener(){},classList:{add(){},remove(){}}};},querySelectorAll(){return [];},addEventListener(){}},
    navigator:{platform:'Test'},console,TextEncoder,TextDecoder,setTimeout(){return 0;},clearTimeout(){},setInterval(){return 0;},
    localStorage:{getItem(){return null;},setItem(){}},confirm(){return true;},prompt(){return '2026-01-10';}});
  vm.runInContext(script,ctx);
  vm.runInContext(`DB=blankDB(); DEVICE_ID='test';
    Object.assign(DB.business,{businessName:'Test issuer',address:'Bangkok',taxId:'1234567890123',isVatRegistered:false,vatStatus:'non_registered'});
    DB.clients=[{id:'client',name:'Test buyer',address:'Bangkok'}];
    persist=async()=>true;render=()=>{};viewDoc=()=>{};toast=()=>{};closeModal=()=>{};openModal=()=>{};
    function fixture(overrides={}) { return {id:null,type:'receipt',number:null,clientId:'client',issueDate:'2026-01-10',paidDate:'2026-01-10',status:'draft',currency:'THB',vatRate:0,whtRate:3,whtReviewed:true,fullPaymentConfirmed:true,issueConfirmed:true,items:[{description:'Service',qty:1,price:10000}],...overrides}; }
  `,ctx);
  return ctx;
}
const run=(ctx,code)=>vm.runInContext(code,ctx);
test('issuance requires explicit non-VAT status; tax invoices always rejected',()=>{
  const ctx=context();
  assert.equal(run(ctx,'issuanceError(fixture(),true)'), '');
  for(const status of ['unknown','registered',undefined]){
    ctx.status=status;
    assert.ok(run(ctx,'DB.business.vatStatus=status; issuanceError(fixture(),true)'));
  }
  assert.ok(run(ctx,"DB.business.vatStatus='non_registered'; issuanceError(fixture({type:'tax_invoice'}),true)"));
});
test('rejects invalid dates, payment acknowledgement, numeric inputs and issuer fields',()=>{
  const ctx=context();
  for(const change of ["{paidDate:null}","{paidDate:'2999-01-01'}","{paidDate:'2026-02-30'}","{issueDate:'2026-02-30'}",
    "{fullPaymentConfirmed:false}","{whtReviewed:false}","{currency:'USD'}","{vatRate:7}","{whtRate:Infinity}","{whtRate:-1}",
    "{items:[null]}","{items:[{description:'X',qty:NaN,price:1}]}","{items:[{description:'',qty:1,price:1}]}",
    "{items:[{description:'X',qty:0,price:1}]}","{items:[{description:'X',qty:1,price:-1}]}",
    "{items:[{description:'X',qty:1e200,price:1e200}]}"]){
    assert.ok(run(ctx,`issuanceError(fixture(${change}),true)`),change);
  }
  assert.ok(run(ctx,"DB.business.taxId='123';issuanceError(fixture(),true)"));
});
test('issuance freezes output and does not consume records or numbers after failed storage',async()=>{
  const ctx=context();
  await run(ctx,'editDoc=fixture();persist=async()=>false;saveDoc()');
  assert.equal(run(ctx,'DB.documents.length'),0);
  assert.equal(run(ctx,'Object.keys(DB.counters).length'),0);
  assert.equal(run(ctx,'editDoc.id'),null);
  await run(ctx,'persist=async()=>true;saveDoc()');
  assert.equal(run(ctx,'DB.documents.length'),1);
  assert.ok(run(ctx,'DB.documents[0].issuedSnapshot.renderedHtml'));
  assert.ok(run(ctx,'DB.documents[0].paymentId'));
});
test('new numbers never reuse retained deleted or void numbers',async()=>{
  const ctx=context();
  await run(ctx,`const retained=fixture({id:'old',number:nextNumber('receipt','2026-01-10'),deletedAt:'2026-01-11',voidedAt:'2026-01-11'});DB.documents=[retained];editDoc=fixture();saveDoc()`);
  assert.equal(run(ctx,'DB.documents.length'),2);
  assert.notEqual(run(ctx,'DB.documents[0].number'),run(ctx,'DB.documents[1].number'));
});
test('receipt shortcut rejects draft payment and returns a single receipt for repeated clicks',async()=>{
  const ctx=context();
  await run(ctx,"DB.documents=[fixture({id:'inv',type:'invoice',status:'draft'})];createReceipt('inv')");
  assert.equal(run(ctx,'DB.documents.length'),1);
  await run(ctx,"const paidInvoice=fixture({id:'inv',number:'INV-001',type:'invoice',status:'paid',paymentId:'pay-1'});freezeIssuedDocument(paidInvoice);DB.documents[0]=paidInvoice;createReceipt('inv')");
  await run(ctx,"createReceipt('inv')");
  assert.equal(run(ctx,'DB.documents.length'),2);
  assert.equal(run(ctx,'DB.documents[1].paymentId'),'pay-1');
  assert.equal(run(ctx,'DB.documents[1].parentId'),'inv');
});
test('derived receipt preserves the payment withholding certificate and pending count',async()=>{
  const ctx=context();
  await run(ctx,`const inv=fixture({id:'cert-invoice',number:'INV-CERT',type:'invoice',status:'paid',paymentId:'cert-payment',
    whtCertReceived:true,whtCertNo:'CERT-9',whtCertDate:'2026-01-10'});
    freezeIssuedDocument(inv);DB.documents=[inv];`);
  assert.equal(run(ctx,'whtPendingList().length'),0);
  assert.match(run(ctx,'buildWhtCSV(2026)'),/CERT-9/);
  await run(ctx,"createReceipt('cert-invoice')");
  assert.equal(run(ctx,'DB.documents.length'),2);
  assert.equal(run(ctx,'whtTrackedDocs().length'),1);
  assert.equal(run(ctx,'whtPendingList().length'),0);
  assert.equal(run(ctx,'realizedDocs()[0].whtCertReceived'),true);
  assert.equal(run(ctx,'realizedDocs()[0].whtCertNo'),'CERT-9');
  assert.equal(run(ctx,'realizedDocs()[0].whtCertDate'),'2026-01-10');
  assert.match(run(ctx,'buildWhtCSV(2026)'),/CERT-9/);
});
test('duplicate is unsaved draft without payment, snapshot or certificate identity',()=>{
  const ctx=context();
  run(ctx,"drawDocEditor=()=>{};DB.documents=[fixture({id:'old',status:'issued',paymentId:'old-payment',whtCertReceived:true,voidedAt:'2026-01-11',issuedSnapshot:{foo:'bar'}})];duplicateDoc('old')");
  assert.equal(run(ctx,'DB.documents.length'),1);
  for(const field of ['paymentId','issuedSnapshot','whtCertReceived','voidedAt']) assert.equal(run(ctx,`editDoc.${field}`),undefined);
  assert.equal(run(ctx,'editDoc.status'),'draft');
  assert.equal(run(ctx,'editDoc.paidDate'),null);
  assert.equal(run(ctx,'editDoc.whtReviewed'),false);
});
test('income category and currency never infer withholding rate',()=>{
  const ctx=context();
  run(ctx,"editDoc=fixture({whtRate:2});setIncomeCategory('40(2)');drawDocEditor=()=>{};setDocCurrency('USD')");
  assert.equal(run(ctx,'editDoc.whtRate'),2);
  assert.equal(run(ctx,'editDoc.whtReviewed'),false);
});
test('cannot edit issued records or use preset metadata to forge history',()=>{
  const ctx=context();
  run(ctx,"drawDocEditor=()=>{};DB.documents=[fixture({id:'old',status:'issued'})];editDoc=null;openDocEditor('receipt','old')");
  assert.equal(run(ctx,'editDoc'),null);
  run(ctx,"openDocEditor('receipt',null,null,null,{id:'forged',status:'issued',paymentId:'forged',issuedSnapshot:{},whtReviewed:true})");
  assert.equal(run(ctx,'editDoc.id'),null);
  assert.equal(run(ctx,'editDoc.status'),'draft');
  assert.equal(run(ctx,'editDoc.paymentId'),undefined);
  assert.equal(run(ctx,'editDoc.whtReviewed'),false);
});
test('payment records date explicitly and preserves issued financial snapshot',async()=>{
  const ctx=context();
  run(ctx,"const inv=fixture({id:'inv',number:'INV-001',type:'invoice',status:'issued',paidDate:null,fullPaymentConfirmed:false});freezeIssuedDocument(inv);DB.documents=[inv];originalPaper=DB.documents[0].issuedSnapshot.renderedHtml");
  await run(ctx,"DB.business.taxId='';DB.business.businessName='';DB.clients[0].name='';setStatus('inv','paid')");
  assert.equal(run(ctx,'DB.documents[0].status'),'paid');
  assert.equal(run(ctx,'DB.documents[0].paidDate'),'2026-01-10');
  assert.ok(run(ctx,'DB.documents[0].paymentId'));
  assert.equal(run(ctx,'DB.documents[0].issuedSnapshot.renderedHtml'),run(ctx,'originalPaper'));
});
test('receipt derives source financial contents and parties from immutable invoice',async()=>{
  const ctx=context();
  run(ctx,"const inv=fixture({id:'inv',number:'INV-001',type:'invoice',status:'paid',paymentId:'payment'});freezeIssuedDocument(inv);DB.documents=[inv];DB.documents[0].items[0].price=20000;DB.documents[0].whtRate=10;DB.clients[0].name='New buyer';DB.business.businessName='New seller'");
  await run(ctx,"createReceipt('inv')");
  assert.equal(run(ctx,'DB.documents.length'),2);
  assert.equal(run(ctx,'compute(DB.documents[1]).subtotal'),10000);
  assert.equal(run(ctx,'compute(DB.documents[1]).whtAmount'),300);
  assert.equal(run(ctx,'DB.documents[1].issuedSnapshot.buyer.name'),'Test buyer');
  assert.equal(run(ctx,'DB.documents[1].issuedSnapshot.business.businessName'),'Test issuer');
});
test('finalized commercial documents enter the usable sent lifecycle',async()=>{
  const ctx=context();
  await run(ctx,"editDoc=fixture({type:'invoice',paidDate:null});saveDoc()");
  assert.equal(run(ctx,'DB.documents[0].status'),'sent');
  assert.ok(run(ctx,'DB.documents[0].issuedSnapshot'));
});
test('parallel saves are serialized and retry after rejected storage is safe',async()=>{
  const ctx=context();
  await run(ctx,"editDoc=fixture();persist=async()=>{throw Error('disk full');};saveDoc()");
  assert.equal(run(ctx,'DB.documents.length'),0);
  const first=run(ctx,'persist=()=>new Promise(resolve=>{resolveStorage=resolve;});saveDoc()');
  await run(ctx,'saveDoc()');
  assert.equal(run(ctx,'DB.documents.length'),1);
  run(ctx,'resolveStorage(true)');
  await first;
  assert.equal(run(ctx,'DB.documents.length'),1);
});
test('quotation conversion opens draft, splitting saves drafts without rewriting source',async()=>{
  const ctx=context();
  run(ctx,"drawDocEditor=()=>{};const q=fixture({id:'quote',type:'quotation',number:'QT-1',status:'issued'});freezeIssuedDocument(q);DB.documents=[q];originalSource=JSON.stringify(DB.documents[0]);convertToInvoice('quote')");
  assert.equal(run(ctx,'DB.documents.length'),1);
  assert.equal(run(ctx,'editDoc.type'),'invoice');
  assert.equal(run(ctx,'editDoc.status'),'draft');
  assert.equal(run(ctx,'editDoc.parentId'),'quote');
  const rows="[{label:'First',amount:5000,due:'2026-02-10'},{label:'Second',amount:5000,due:'2026-03-10'}]";
  await run(ctx,`persist=async()=>false;splitQuotation(DB.documents[0],${rows})`);
  assert.equal(run(ctx,'DB.documents.length'),1);
  await run(ctx,`persist=async()=>true;splitQuotation(DB.documents[0],${rows})`);
  assert.equal(run(ctx,'DB.documents.length'),3);
  assert.equal(run(ctx,'JSON.stringify(DB.documents[0])'),run(ctx,'originalSource'));
  assert.equal(run(ctx,"DB.documents.slice(1).every(d=>d.status==='draft'&&!d.paymentId&&!d.issuedSnapshot)"),true);
});
test('receipt-to-invoice changes cannot manufacture payment metadata or income',async()=>{
  const ctx=context();
  run(ctx,"drawDocEditor=()=>{};editDoc=fixture({paymentId:'oldpay',whtCertReceived:true});editField('type','invoice')");
  assert.equal(run(ctx,'editDoc.paidDate'),null);
  assert.equal(run(ctx,'editDoc.fullPaymentConfirmed'),false);
  assert.equal(run(ctx,'editDoc.paymentId'),undefined);
  await run(ctx,"editDoc.issueConfirmed=true;editDoc.paidDate='2026-01-10';editDoc.fullPaymentConfirmed=true;saveDoc()");
  assert.equal(run(ctx,'DB.documents[0].paidDate'),null);
  assert.equal(run(ctx,'DB.documents[0].fullPaymentConfirmed'),false);
  assert.equal(run(ctx,'DB.documents[0].paymentId'),undefined);
  assert.equal(run(ctx,'editDoc'),null);
  await run(ctx,'saveDoc()');
  assert.equal(run(ctx,'DB.documents.length'),1);
});
