// Installment payments (PRD-INSTALLMENTS): one quotation, several invoices, one receipt per paid installment.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../billing.html'),'utf8');
const script=html.match(/<script>([\s\S]*)<\/script>\s*<\/body>/)[1].replace(/\bboot\(\);\s*$/,'');
function context(){
  const elements=new Map();
  const element=()=>({innerHTML:'',textContent:'',value:'',checked:false,style:{},addEventListener(){},setAttribute(){},classList:{add(){},remove(){},toggle(){}}});
  const ctx=vm.createContext({BillingData:require('../lib/billing-data.cjs'),window:{addEventListener(){},matchMedia(){return {matches:false};}},
    document:{getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);},querySelectorAll(){return [];},addEventListener(){},body:{classList:{add(){},remove(){},toggle(){}}}},
    navigator:{platform:'Test'},console,TextEncoder,TextDecoder,setTimeout(){return 0;},clearTimeout(){},setInterval(){return 0;},
    localStorage:{getItem(){return null;},setItem(){}},confirm(){return true;}});
  vm.runInContext(script,ctx);
  vm.runInContext(`DB=blankDB(); DEVICE_ID='test';
    Object.assign(DB.business,{businessName:'Test issuer',address:'Bangkok',taxId:'1234567890123',isVatRegistered:false,vatStatus:'non_registered'});
    DB.clients=[{id:'client',name:'Test buyer',address:'Bangkok'}];
    persist=async()=>true;render=()=>{};viewDoc=()=>{};toasts=[];toast=m=>toasts.push(m);closeModal=()=>{};openModal=()=>{};
    // A 50,000 quotation with 3% withholding, split 25,000 / 15,000 / 10,000 through the app's own split flow.
    const quotation={id:'q',type:'quotation',number:'QT-69-015',clientId:'client',issueDate:'2026-01-05',status:'accepted',currency:'THB',vatRate:0,whtRate:3,whtReviewed:true,items:[{description:'Website',qty:1,price:50000}]};
    freezeIssuedDocument(quotation);DB.documents=[quotation];
    const invoices=()=>DB.documents.filter(d=>d.type==='invoice').sort((a,b)=>a.milestone.seq-b.milestone.seq);
    const receipts=()=>DB.documents.filter(d=>d.type==='receipt');
    async function issueAll(){for(const inv of invoices()){editDoc={...inv,whtReviewed:true,issueConfirmed:true};await saveDoc();}}
    async function pay(i,date){return setStatus(invoices()[i].id,'paid',{paidDate:date,fullPaymentConfirmed:true});}
  `,ctx);
  // Plain values cross the vm boundary as JSON so deepEqual compares structure, not realm prototypes.
  const run=code=>{const v=vm.runInContext(code,ctx);if(v&&typeof v.then==='function')return v;const s=JSON.stringify(v);return s===undefined?undefined:JSON.parse(s);};
  return {ctx,run,elements};
}
const rows="[{label:'มัดจำ',amount:25000,due:'2026-02-10'},{label:'',amount:15000,due:'2026-03-10'},{label:'ส่งมอบงาน',amount:10000,due:'2026-04-10'}]";
async function split(run){ assert.equal(await run(`splitQuotation(DB.documents[0],${rows})`),true); await run('issueAll()'); }

test('a paid installment invoice gets its own receipt for exactly the installment amount',async()=>{
  const {run}=context();await split(run);
  assert.deepEqual(run("invoices().map(d=>d.status)"),['sent','sent','sent']);
  for(const [i,date] of [[0,'2026-02-09'],[1,'2026-03-09'],[2,'2026-04-09']]){
    assert.equal(await run(`pay(${i},'${date}')`),true,'payment recorded for installment '+(i+1));
    assert.ok(await run(`createReceipt(invoices()[${i}].id)`),'receipt issued for installment '+(i+1));
  }
  assert.equal(run('receipts().length'),3);
  assert.deepEqual(run('receipts().map(r=>compute(r).netPayable)'),[24250,14550,9700]);
  assert.deepEqual(run('receipts().map(r=>compute(r).netPayable)'),run('invoices().map(d=>compute(d).netPayable)'));
  assert.deepEqual(run('receipts().map(r=>r.paymentId)'),run('invoices().map(d=>d.paymentId)'));
  assert.equal(run('paymentReview().docs.length'),3);
  assert.equal(run('whtTrackedDocs().length'),3);
  assert.equal(run('taxYearAgg(2026).agg.net'),48500);
  assert.deepEqual(run('receipts().map(r=>r.settles)'),[1,2,3].map(seq=>({invoiceNumber:run(`invoices()[${seq-1}].number`),installment:{seq,of:3},quotationNumber:'QT-69-015'})));
  assert.doesNotMatch(run('toasts.join("|")'),/มัดจำหรือแบ่งจ่าย/);
});

test('the payment dialog names the installment and asks for full payment of this invoice',async()=>{
  const {run,elements}=context();await split(run);
  run('openPaymentDialog(invoices()[1].id)');
  const modal=elements.get('modal').innerHTML;
  assert.match(modal,/งวดที่ 2\/3/);assert.match(modal,/14,550\.00/);
  assert.match(modal,/ยืนยันรับชำระงวดนี้เต็มจำนวนแล้ว/);assert.doesNotMatch(modal,/ไม่ใช่มัดจำหรือแบ่งจ่าย/);
  run("DB.documents.push({id:'plain',type:'invoice',number:'INV-PLAIN',clientId:'client',issueDate:'2026-01-10',status:'sent',currency:'THB',vatRate:0,whtRate:0,items:[{description:'Plain',qty:1,price:100}]});openPaymentDialog('plain')");
  assert.match(elements.get('modal').innerHTML,/ไม่ใช่มัดจำหรือแบ่งจ่าย/);
});

test('the receipt prints which invoice it settles, frozen into the issued snapshot; earlier receipts are untouched',async()=>{
  const {run}=context();await split(run);
  await run("pay(2,'2026-04-09')");await run('createReceipt(invoices()[2].id)');
  const paper=run('receipts()[0].issuedSnapshot.renderedHtml');
  const inv=run('invoices()[2].number');
  assert.match(paper,new RegExp('<div class="settled-reference">ชำระตามใบแจ้งหนี้ '+inv+' · งวดที่ 3/3 ของ QT-69-015</div>'));
  assert.equal(run('renderPaper(receipts()[0],null,null)'),run('(()=>{const s=receipts()[0].issuedSnapshot;return renderPaper(s.document,s.buyer,s.amounts,{business:s.business,buyer:s.buyer,docLang:s.docLang,yearMode:s.yearMode,amounts:s.amounts});})()'));
  // Bilingual and English-only requests both print the English wording (receipts never render English-only).
  const bi=run("(()=>{const r={...receipts()[0].issuedSnapshot.document};delete r.issuedSnapshot;r.docLang='bilingual';return renderPaper(r,DB.clients[0],compute(r),{business:DB.business,buyer:DB.clients[0],docLang:'bilingual',yearMode:'be',amounts:compute(r)});})()");
  assert.match(bi,/ชำระตามใบแจ้งหนี้ .* · งวดที่ 3\/3 ของ QT-69-015 <span[^>]*>\/ Payment for invoice .* · installment 3\/3 of QT-69-015<\/span>/);
  // Parts that do not exist are left out: no quotation, no installment.
  const plain=run("(()=>{const r={...receipts()[0].issuedSnapshot.document};delete r.issuedSnapshot;r.settles={invoiceNumber:'INV-X',installment:null,quotationNumber:null};return settledReferenceHtml(r.settles,(a)=>a);})()");
  assert.equal(plain,'<div class="settled-reference">ชำระตามใบแจ้งหนี้ INV-X</div>');
  assert.equal(run("settledReferenceHtml({invoiceNumber:'INV-X',installment:null,quotationNumber:'QT-1'},(a)=>a)"),'<div class="settled-reference">ชำระตามใบแจ้งหนี้ INV-X · ตามใบเสนอราคา QT-1</div>');
  assert.equal(run("settledReferenceHtml({invoiceNumber:'<b>',installment:{seq:'<i>',of:3},quotationNumber:null},(a)=>a)"),'<div class="settled-reference">ชำระตามใบแจ้งหนี้ &lt;b&gt; · งวดที่ &lt;i&gt;/3</div>');
  assert.equal(run("settledReferenceHtml(undefined,(a)=>a)"),'');
  // A receipt issued before this change has no reference field: its paper gains no line.
  run("const old={id:'old',type:'receipt',number:'RC-OLD',clientId:'client',parentId:invoices()[0].id,paymentId:'legacy',issueDate:'2026-01-10',paidDate:'2026-01-10',status:'issued',currency:'THB',vatRate:0,whtRate:0,whtReviewed:true,fullPaymentConfirmed:true,items:[{description:'Old',qty:1,price:100}]};freezeIssuedDocument(old);DB.documents.push(old)");
  assert.doesNotMatch(run("DB.documents.at(-1).issuedSnapshot.renderedHtml"),/settled-reference|ชำระตามใบแจ้งหนี้/);
  // Corrected receipts keep their own reference block only.
  assert.doesNotMatch(run("(()=>{const r={...receipts()[0].issuedSnapshot.document,reissueOf:'tax',reissueOfNumber:'TX-1',reissueOfDate:'2026-01-10'};delete r.issuedSnapshot;return renderPaper(r,DB.clients[0],compute(r),{business:DB.business,buyer:DB.clients[0],docLang:'th',yearMode:'be',amounts:compute(r)});})()"),/settled-reference/);
  // Historical milestone invoices without a quotation still name the invoice.
  assert.deepEqual(run("settledReference({id:'x',type:'invoice',number:'INV-H',milestone:{seq:2,of:2}})"),{invoiceNumber:'INV-H',installment:{seq:2,of:2},quotationNumber:null});
  assert.deepEqual(run("settledReference({id:'x',type:'invoice',number:'INV-H',milestone:{seq:'<img>',of:2}})"),{invoiceNumber:'INV-H',installment:null,quotationNumber:null});
});

test('a blocked payment or receipt attempt leaves DB.counters and the ledger unchanged',async()=>{
  const {run}=context();await split(run);
  const counters=run('JSON.stringify(DB.counters)');assert.equal(counters,'{"invoice-2026":3}');
  // Unpaid invoice: refused before any number is reserved.
  assert.equal(await run('createReceipt(invoices()[0].id)'),undefined);
  assert.equal(run('JSON.stringify(DB.counters)'),counters);assert.equal(run('receipts().length'),0);
  // Payment facts rejected (no full-payment confirmation): nothing changes.
  assert.equal(await run("setStatus(invoices()[0].id,'paid',{paidDate:'2026-02-09',fullPaymentConfirmed:false})"),false);
  assert.equal(run('invoices()[0].status'),'sent');assert.equal(run('JSON.stringify(DB.counters)'),counters);
  // Storage refuses the payment: status and counters roll back.
  run('persist=async()=>false');
  assert.equal(await run("pay(0,'2026-02-09')"),false);
  assert.equal(run('invoices()[0].status'),'sent');assert.equal(run('JSON.stringify(DB.counters)'),counters);
  run('persist=async()=>true');assert.equal(await run("pay(0,'2026-02-09')"),true);
  // Storage refuses the receipt: the reserved receipt number is rolled back and no receipt exists.
  run('persist=async()=>false');
  assert.equal(await run('createReceipt(invoices()[0].id)'),undefined);
  assert.equal(run('receipts().length'),0);assert.equal(run('JSON.stringify(DB.counters)'),counters);
  // Validation fails after the pre-checks (payment dated in the future): still no reservation.
  run("persist=async()=>true;savedPaid=invoices()[0].paidDate;invoices()[0].paidDate='2999-01-01'");
  assert.equal(await run('createReceipt(invoices()[0].id)'),undefined);
  assert.match(run('toasts.at(-1)'),/กรอกวันรับเงินจริง/);
  assert.equal(run('receipts().length'),0);assert.equal(run('JSON.stringify(DB.counters)'),counters);
  run('invoices()[0].paidDate=savedPaid');
  assert.ok(await run('createReceipt(invoices()[0].id)'));
  assert.equal(run('JSON.stringify(DB.counters)'),'{"invoice-2026":3,"receipt-2026":1}');
  assert.equal(run('receipts()[0].number'),run("nextNumber('receipt','2026-01-01').replace(/\\d+$/,m=>String(Number(m)-1).padStart(m.length,'0'))"));
});

test('unpaid installment invoices count toward the dashboard receivable and the overdue count',async()=>{
  const {run}=context();await split(run);
  run("DB.documents.forEach(d=>{if(d.type==='invoice')d.dueDate='2000-01-01';})");   // all three overdue today
  await run("pay(0,'2026-02-09')");await run('createReceipt(invoices()[0].id)');
  const dashboard=run('(()=>{const c={},ta={};renderDashboard(c,ta);return c.innerHTML;})()');
  const owed=dashboard.match(/ยอดค้างรับ[\s\S]*?data-cu="([^"]+)"/)[1];
  assert.equal(Number(owed),24250,'installments 2 and 3 (15,000 + 10,000 less 3% withholding) are receivable');
  assert.match(dashboard,/<b>2<\/b> ใบเกินกำหนด/);
  assert.match(dashboard,/data-cu="24250"/);
  assert.match(dashboard.match(/รับแล้ว[\s\S]*?data-cu="([^"]+)"/)[1],/^24250$/);
  assert.equal(run("activeDocs().filter(d=>docStatusMatch(d,'unpaid')).length"),2);
});

test('the quotation shows agreed, received and outstanding from receipts linked to its installments',async()=>{
  const {run}=context();await split(run);
  assert.deepEqual(run('quotationProgress(DB.documents[0])'),{agreed:48500,received:0,outstanding:48500,receipts:0,installments:3});
  for(const [i,date] of [[0,'2026-02-09'],[1,'2026-03-09']]){await run(`pay(${i},'${date}')`);await run(`createReceipt(invoices()[${i}].id)`);}
  assert.deepEqual(run('quotationProgress(DB.documents[0])'),{agreed:48500,received:38800,outstanding:9700,receipts:2,installments:3});
  assert.equal(run('renderQuotationProgress(DB.documents[0])'),'<div class="quotation-progress"><span>ตกลง <b>฿48,500.00</b> · รับแล้ว <b>฿38,800.00</b> (2/3) · ค้าง <b>฿9,700.00</b></span></div>');
  run("DB.business.uiLang='en'");
  assert.equal(run('renderQuotationProgress(DB.documents[0])'),'<div class="quotation-progress"><span>Agreed <b>฿48,500.00</b> · Received <b>฿38,800.00</b> (2/3) · Outstanding <b>฿9,700.00</b></span></div>');
  // A voided receipt no longer counts; a draft receipt never did.
  assert.equal(await run("voidDocument(receipts()[1].id,'Synthetic void')"),true);
  run("DB.documents.push({...receipts()[0],id:'draft-r',number:null,status:'draft',issuedSnapshot:undefined})");
  assert.deepEqual(run('quotationProgress(DB.documents[0])'),{agreed:48500,received:24250,outstanding:24250,receipts:1,installments:3});
  // The line appears only on a quotation with installment invoices, inside the screen-only lineage area.
  assert.equal(run("renderQuotationProgress({...DB.documents[0],id:'none'})"),'');
  const view=run("viewingId='q';(()=>{const c={},ta={};renderDocView(c,ta);return c.innerHTML;})()");
  assert.match(view,/class="doc-trail">[\s\S]*class="quotation-progress"/);
  assert.match(html,/\.doc-trail,\.quotation-progress,\.split-progress\{display:none!important\}/);
  assert.match(html,/\.doc-trail,\.quotation-progress\{display:flex/);
});

test('new installment copy has English entries and the retired refusal is gone',()=>{
  const {run}=context();
  for(const key of ['ยืนยันรับชำระงวดนี้เต็มจำนวนแล้ว','ตกลง {agreed} · รับแล้ว {received} ({count}) · ค้าง {outstanding}'])
    assert.ok(run(`Object.hasOwn(I18N_EN,${JSON.stringify(key)})`),key);
  assert.doesNotMatch(script,/ออกใบเสร็จได้เฉพาะยอดที่รับชำระเต็มจำนวน/);
});
