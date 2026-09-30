// Pre-publish audit fixes (2026-09-29): receipt VAT prompt, full issue checklist,
// two-decimal prices, tax-ID feedback and the dashboard withholding card. Synthetic data only.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../billing.html'),'utf8');
const script=html.match(/<script>([\s\S]*)<\/script>\s*<\/body>/)[1].replace(/\bboot\(\);\s*$/,'');
function context(){
  const elements={};
  const element=id=>elements[id]||(elements[id]={id,value:'',innerHTML:'',textContent:'',className:'',attrs:{},
    addEventListener(){},classList:{add(){},remove(){},contains(){return false;}},
    setAttribute(k,v){this.attrs[k]=v;},removeAttribute(k){delete this.attrs[k];},scrollIntoView(){},focus(){},closest(){return null;},querySelector(){return null;}});
  const ctx=vm.createContext({window:{addEventListener(){},matchMedia(){return {matches:false};}},
    document:{getElementById:element,querySelector(){return null;},querySelectorAll(){return [];},addEventListener(){}},
    navigator:{platform:'Test'},console,TextEncoder,TextDecoder,setTimeout(){return 0;},clearTimeout(){},setInterval(){return 0;},
    localStorage:{getItem(){return null;},setItem(){}},confirm(){return true;},prompt(){return '2026-01-10';}});
  ctx.elements=elements;
  vm.runInContext(script,ctx);
  vm.runInContext(`DB=blankDB(); DEVICE_ID='test';
    Object.assign(DB.business,{businessName:'Synthetic seller',address:'Bangkok',taxId:'1234567890121',vatStatus:'non_registered'});
    DB.clients=[{id:'client',name:'Synthetic buyer',address:'Bangkok'}];
    persistCalls=0; persistResult=true; confirmAnswer=true; toasts=[]; drawn=0;
    persist=async()=>{persistCalls++;return persistResult;}; render=()=>{}; viewDoc=()=>{}; closeModal=()=>{}; openModal=()=>{};
    toast=(m,k,a)=>toasts.push({m,k,a}); askConfirm=async()=>confirmAnswer; drawDocEditor=()=>{drawn++;};
    function fixture(overrides={}) { return {id:null,type:'quotation',number:null,clientId:'client',issueDate:'2026-01-10',status:'draft',currency:'THB',vatRate:0,whtRate:3,whtReviewed:true,items:[{description:'Service',qty:1,price:10000}],...overrides}; }
  `,ctx);
  return ctx;
}
const run=(ctx,code)=>vm.runInContext(code,ctx);

test('issue checklist lists every blocker at once, each fix routed to its place',()=>{
  const ctx=context();
  run(ctx,"DB.business.taxId='12345'; DB.business.vatStatus='unknown'");
  const list=run(ctx,"issueBlockers(fixture({type:'receipt',whtReviewed:false,paidDate:null,fullPaymentConfirmed:false,items:[{description:'',qty:1,price:10}]}))");
  const messages=list.map(i=>i.msg).join('\n');
  for(const expected of ['ใส่รายละเอียดให้ทุกรายการ','เลขประจำตัวผู้เสียภาษี 13 หลัก','ตรวจอัตราหัก ณ ที่จ่าย','ไม่ได้จด VAT','วันรับเงินจริง'])
    assert.match(messages,new RegExp(expected),expected);
  assert.equal(list.find(i=>/ตั้งค่า/.test(i.msg)&&/13 หลัก/.test(i.msg)).run,'openBusinessSettings()');
  assert.equal(list.find(i=>/VAT/.test(i.msg)).run,'confirmReceiptPrerequisite()');
  run(ctx,"DB.business.vatStatus='registered'");
  assert.equal(run(ctx,"issueBlockers(fixture({type:'receipt',paidDate:'2026-01-10',fullPaymentConfirmed:true}))").find(i=>/VAT/.test(i.msg)).run,'openReceiptSettings()');
});

test('checklist is never empty when the authoritative gate rejects an ordinary document',()=>{
  const ctx=context();
  for(const change of ["{issueDate:'2026-02-30'}","{dueDate:'bad'}","{whtReviewed:false}","{whtRate:-1}","{whtRate:101}",
    "{items:[]}","{items:[{description:'X',qty:0,price:1}]}","{items:[{description:'X',qty:1,price:-1}]}",
    "{items:[{description:'',qty:1,price:1}]}","{items:[{description:'X',qty:1,price:0}]}","{clientId:'missing'}"]){
    assert.ok(run(ctx,`issuanceError(fixture(${change}),true)`),change);
    assert.ok(run(ctx,`issueBlockers(fixture(${change})).length`),change);
  }
  run(ctx,"DB.business.address=''");
  assert.ok(run(ctx,'issuanceError(fixture(),true)'));
  assert.ok(run(ctx,'issueBlockers(fixture()).length'));
  run(ctx,"DB.business.address='Bangkok'");
  assert.equal(run(ctx,'issuanceError(fixture(),true)'),'');
  assert.equal(run(ctx,'issueBlockers(fixture()).length'),0);
});

test('issuing from the editor shows the checklist instead of a single toast',async()=>{
  const ctx=context();
  run(ctx,"DB.business.taxId=''; editDoc=fixture({whtReviewed:false})");
  assert.equal(await run(ctx,'issueDoc()'),false);
  assert.equal(run(ctx,'editorIssues.length'),2);
  assert.equal(run(ctx,'drawn'),1);
  assert.equal(run(ctx,'toasts.length'),0);
  assert.match(run(ctx,'issueChecklistHtml()'),/openBusinessSettings\(\)/);
  run(ctx,"openDocEditor('quotation')");
  assert.equal(run(ctx,'editorIssues.length'),0,'a new editor starts without stale blockers');
});

test('unit prices are kept to two decimals so printed lines add up',async()=>{
  const ctx=context();
  const price=run(ctx,"priceInput('3333.335')");
  assert.match(price,/^\d+(\.\d{1,2})?$/);
  assert.equal(run(ctx,`lineTotal({qty:3,price:'${price}'})`),run(ctx,`round2(3*${Number(price)})`));
  assert.equal(run(ctx,"priceInput('')"),'');
  assert.equal(run(ctx,"priceInput('abc')"),'abc');
  assert.equal(run(ctx,"hasUnroundedPrice({items:[{price:'10.50'},{price:3}]})"),false);
  assert.equal(run(ctx,"hasUnroundedPrice({items:[{price:3333.335}]})"),true);
  // An old draft with a three-decimal price cannot be issued until it is rounded explicitly.
  run(ctx,"editDoc=fixture({items:[{description:'Design',qty:3,price:3333.335}]})");
  assert.equal(await run(ctx,'issueDoc()'),false);
  assert.ok(run(ctx,"editorIssues.some(i=>i.run==='roundEditorPrices()')"));
  run(ctx,'markDirty=()=>{}; roundEditorPrices()');
  assert.equal(run(ctx,'hasUnroundedPrice(editDoc)'),false);
  assert.equal(run(ctx,'editorIssues.length'),0);
  // Receipts created from existing invoices keep the frozen invoice items and are not blocked here.
  assert.equal(run(ctx,"issuanceError(fixture({type:'receipt',paidDate:'2026-01-10',fullPaymentConfirmed:true,items:[{description:'Old',qty:1,price:10.005}]}),true)"),'');
});

test('receipt VAT prompt records only an explicit non-VAT answer and rolls back on failed save',async()=>{
  const ctx=context();
  run(ctx,"DB.business.vatStatus='unknown'; DB.business.vatStatusConfirmedAt=null; confirmAnswer=false");
  assert.equal(await run(ctx,'confirmNonVatInline()'),false);
  assert.equal(run(ctx,'DB.business.vatStatus'),'unknown');
  assert.equal(run(ctx,'persistCalls'),0);
  run(ctx,'confirmAnswer=true; persistResult=false');
  assert.equal(await run(ctx,'confirmNonVatInline()'),false);
  assert.equal(run(ctx,'DB.business.vatStatus'),'unknown','failed save restores the previous answer');
  run(ctx,'persistResult=true');
  assert.equal(await run(ctx,'confirmNonVatInline()'),true);
  assert.equal(run(ctx,'DB.business.vatStatus'),'non_registered');
  assert.equal(run(ctx,'DB.business.isVatRegistered'),false);
  assert.ok(run(ctx,'DB.business.vatStatusConfirmedAt'));
  run(ctx,"DB.business.vatStatus='registered'; persistCalls=0");
  assert.equal(await run(ctx,'confirmNonVatInline()'),false);
  assert.equal(run(ctx,'DB.business.vatStatus'),'registered','a registered business is sent to Settings, never flipped');
  assert.equal(run(ctx,'persistCalls'),0);
  assert.equal(run(ctx,'toasts.at(-1).a.run'),run(ctx,'openReceiptSettings'));
});

test('first-run setup records a VAT answer only when the owner chooses one',()=>{
  const ctx=context();
  run(ctx,"DB.business.vatStatus='unknown'; DB.business.vatStatusConfirmedAt=null");
  ctx.elements.w_vat={value:'unknown'};
  run(ctx,'wizCollect()');
  assert.equal(run(ctx,'DB.business.vatStatusConfirmedAt'),null);
  ctx.elements.w_vat.value='non_registered';
  run(ctx,'wizCollect()');
  assert.equal(run(ctx,'DB.business.vatStatus'),'non_registered');
  const stamp=run(ctx,'DB.business.vatStatusConfirmedAt');
  assert.ok(stamp);
  run(ctx,'wizCollect()');
  assert.equal(run(ctx,'DB.business.vatStatusConfirmedAt'),stamp,'an unchanged answer keeps its confirmation time');
  assert.match(html,/id="w_vat"/);
});

test('tax-ID feedback flags letters and short numbers once the field is left',()=>{
  const ctx=context();
  const feedback=(value,finished)=>{run(ctx,`taxIdFeedback(${JSON.stringify(value)},${finished})`);return ctx.elements.taxIdFeedback.className;};
  assert.equal(feedback('abc',false),'taxid-invalid');
  assert.equal(feedback('12345',false),'','typing digits stays quiet');
  assert.equal(feedback('12345',true),'taxid-invalid');
  assert.equal(feedback('1234567890121',false),'taxid-valid');
  assert.equal(feedback('1234567890123',false),'taxid-invalid','check digit');
  assert.equal(feedback('',true),'');
});

test('dashboard withholding card counts certificates still pending after payment',()=>{
  const ctx=context();
  run(ctx,`const inv={id:'inv',type:'invoice',number:'INV-1',clientId:'client',issueDate:'2026-01-10',status:'paid',paidDate:'2026-01-10',
      paymentId:'pay',fullPaymentConfirmed:true,whtReviewed:true,currency:'THB',vatRate:0,whtRate:3,items:[{description:'Service',qty:1,price:10000}]};
    freezeIssuedDocument(inv); DB.documents.push(inv);
    const rc={id:'rc',type:'receipt',number:'RC-1',parentId:'inv',clientId:'client',issueDate:'2026-01-10',status:'issued',paidDate:'2026-01-10',
      paymentId:'pay',fullPaymentConfirmed:true,whtReviewed:true,currency:'THB',vatRate:0,whtRate:3,items:[{description:'Service',qty:1,price:10000}]};
    freezeIssuedDocument(rc); DB.documents.push(rc);`);
  assert.equal(run(ctx,'whtPendingList().length'),1);
  const c={innerHTML:''},ta={innerHTML:''};
  ctx.c=c;ctx.ta=ta;run(ctx,'renderDashboard(c,ta)');
  const card=c.innerHTML.slice(c.innerHTML.indexOf('pillar wht'));
  assert.match(card,/data-cu="300"/);
  assert.match(card,/รอใบ 50 ทวิ 1 ใบ/);
  run(ctx,"DB.documents.forEach(d=>{d.whtCertReceived=true;})");
  run(ctx,'renderDashboard(c,ta)');
  const cleared=c.innerHTML.slice(c.innerHTML.indexOf('pillar wht'));
  assert.match(cleared,/data-cu="0"/);
  assert.match(cleared,/ไม่มีใบ 50 ทวิค้างรับ/);
});
