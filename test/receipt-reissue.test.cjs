const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),os=require('node:os');
const {mainHarness}=require('./helpers/main-harness.cjs');
const html=fs.readFileSync(path.join(__dirname,'../billing.html'),'utf8'),script=html.match(/<script>([\s\S]*)<\/script>\s*<\/body>/)[1].replace(/\bboot\(\);\s*$/,'');
function setup(){
 const context=vm.createContext({window:{addEventListener(){},matchMedia(){return {matches:false};}},document:{getElementById(){return {innerHTML:'',addEventListener(){},classList:{add(){},remove(){}}};},querySelectorAll(){return [];},addEventListener(){}},navigator:{platform:'Synthetic'},console,TextEncoder,TextDecoder,setTimeout(){},clearTimeout(){},setInterval(){},localStorage:{getItem(){return null;},setItem(){}}});
 vm.runInContext(script,context);
 const run=code=>vm.runInContext(code,context);
 run(`DB=blankDB();DB.business={...DB.business,businessName:'Synthetic seller',address:'Synthetic address',taxId:'1234567890123',vatStatus:'non_registered'};DB.clients=[{id:'buyer',name:'Synthetic buyer',address:'Synthetic address',taxId:'1234567890123'}];
 function fixture(extra={}){return {id:'tax',type:'tax_invoice',number:'TX-26-001',clientId:'buyer',status:'issued',issueDate:'2026-01-10',paidDate:'2026-01-10',currency:'THB',vatRate:0,whtRate:3,items:[{description:'Installment 1 / <img src=x onerror=alert(1)>',qty:1,unit:'payment',price:10000}],legacy_review_required:true,...extra};}
 DB.documents=[fixture()];messages=[];backups=0;saves=0;toast=s=>messages.push(s);closeModal=()=>{};viewDoc=id=>{viewingId=id;};persist=async()=>{saves++;return true;};window.billingAPI={snapshotBackup:async()=>{backups++;return true;}};
 facts={historicalVatConfirmed:true,partyDetailsConfirmed:true,paymentFactsConfirmed:true,note:'Correct document title'};`);
 return {run,context};
}
test('corrected receipt preserves originals and income, supports retained archived installments, and freezes reviewed parties',async()=>{
 const {run}=setup();run("DB.documents[0].archivedAt='2026-02-01T00:00:00.000Z';DB.documents[0].milestone={seq:1,of:3};original=JSON.stringify(DB.documents);income=JSON.stringify(paymentReview());");
 assert.equal(run("receiptReissueError(DB.documents[0])"),'');
 assert.ok(await run("applyReceiptReissues(buildReceiptReissueBatch(['tax']),facts)"));
 assert.equal(run('JSON.stringify(DB.documents)===original'),true);assert.equal(run('JSON.stringify(paymentReview())===income'),true);
 assert.equal(run('backups'),1);assert.equal(run('saves'),1);assert.equal(run('receiptReissues().length'),1);
 assert.equal(run('validReceiptReissueEvent(DB.reviewEvents[0])'),true);
 assert.equal(run('DB.reviewEvents[0].receipt.fullPaymentConfirmed'),undefined);
 run("issued=JSON.stringify(DB.reviewEvents[0]);DB.business.businessName='Changed';DB.clients[0].name='Changed';viewDoc(DB.reviewEvents[0].receipt.id)");
 assert.equal(run('JSON.stringify(DB.reviewEvents[0])===issued'),true);
 const paper=run('renderPaper(getViewingDocument())');assert.match(paper,/ใบเสร็จรับเงิน/);assert.doesNotMatch(paper,/class="tax-stamp"/);assert.match(paper,/TX-26-001/);assert.match(paper,/Synthetic buyer/);assert.doesNotMatch(paper,/<img src=x onerror/);assert.match(paper,/not an additional payment|ไม่ใช่การรับเงินใหม่/);
});
test('eligibility rejects deleted, voided, VAT, foreign, invalid dates, amount and missing party facts',()=>{
 const {run}=setup();
 for(const extra of [{deletedAt:'2026-01-11'},{voidedAt:'2026-01-11'},{status:'draft'},{vatRate:7},{vatRate:null},{currency:'USD'},{paidDate:''},{paidDate:'2026-02-30'},{whtRate:null},{items:[{description:'x',qty:0,price:100}]}]){run(`DB.documents=[fixture(${JSON.stringify(extra)})]`);assert.ok(run('receiptReissueError(DB.documents[0])'));}
 run("DB.documents=[fixture()];DB.clients[0].address=''");assert.ok(run('receiptReissueError(DB.documents[0])'));
});
test('missing confirmations and duplicate IDs never allocate numbers or save',async()=>{
 const {run}=setup();run("batch=buildReceiptReissueBatch(['tax']);before=JSON.stringify(DB)");
 for(const key of ['historicalVatConfirmed','partyDetailsConfirmed','paymentFactsConfirmed']){assert.equal(await run(`applyReceiptReissues(batch,{...facts,${key}:false})`),false);assert.equal(run('JSON.stringify(DB)===before'),true);}
 assert.throws(()=>run("buildReceiptReissueBatch(['tax','tax'])"));assert.equal(run('backups'),0);assert.equal(run('saves'),0);
});
test('backup failure and persist failure roll back numbers and events; retry issues exactly once',async()=>{
 const {run}=setup();run("batch=buildReceiptReissueBatch(['tax']);before=JSON.stringify(DB);window.billingAPI.snapshotBackup=async()=>false");
 assert.equal(await run('applyReceiptReissues(batch,facts)'),false);assert.equal(run('JSON.stringify(DB)===before'),true);
 run('window.billingAPI.snapshotBackup=async()=>true;persist=async()=>false');assert.equal(await run('applyReceiptReissues(batch,facts)'),false);assert.equal(run('JSON.stringify(DB)===before'),true);
 run('persist=async()=>true');assert.ok(await run('applyReceiptReissues(batch,facts)'));const number=run('DB.reviewEvents[0].receipt.number');
 assert.equal(await run('applyReceiptReissues(batch,facts)'),false);assert.equal(run('receiptReissues().length'),1);assert.equal(run('DB.reviewEvents[0].receipt.number'),number);
});
test('recheck after backup rejects changed source or parties without issuance',async()=>{
 for(const mutation of ["DB.documents[0].items[0].price=20000","DB.clients[0].name='Different buyer'"]){
 const {run}=setup();run(`batch=buildReceiptReissueBatch(['tax']);window.billingAPI.snapshotBackup=async()=>{${mutation};return true;}`);
 assert.equal(await run('applyReceiptReissues(batch,facts)'),false);assert.equal(run('receiptReissues().length'),0);assert.equal(run('saves'),0);
 }
});
test('reissued receipt numbers share collision checks with ordinary documents',async()=>{
 const {run}=setup();run("DB.business.numberFormats.receipt='RC-{YY}-{###}';DB.documents.push(fixture({id:'second',number:'TX-26-002'}));");
 assert.ok(await run("applyReceiptReissues(buildReceiptReissueBatch(['tax','second']),facts)"));
 assert.equal(run('new Set(receiptReissues().map(e=>e.receipt.number)).size'),2);
 run("DB.counters={};next={id:'new',type:'receipt',issueDate:todayISO()};uniqueDocumentNumber(next)");
 assert.equal(run('receiptReissues().some(e=>e.receipt.number===next.number)'),false);
 assert.equal(run('uniqueDocumentNumber({...next,number:receiptReissues()[0].receipt.number})'),false);
});
test('renderer and main schemas reject forged amounts, references, duplicate corrections and numbers',async()=>{
 const {run}=setup();await run("applyReceiptReissues(buildReceiptReissueBatch(['tax']),facts)");const good=run('JSON.stringify(DB)');
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'billngai-reissue-schema-')),main=mainHarness(root);
 try{
  assert.doesNotThrow(()=>vm.runInContext(`validateData(${JSON.stringify(good)})`,main.context));assert.doesNotThrow(()=>run(`migrate(JSON.parse(${JSON.stringify(good)}))`));
  const mutations=[d=>d.reviewEvents[0].receipt.issuedSnapshot.amounts.netPayable++,d=>d.reviewEvents[0].receipt.reissueOf='other',d=>d.reviewEvents[0].receipt.reissueOfDate='2026-01-11',d=>d.reviewEvents.push({...d.reviewEvents[0],id:'duplicate'}),d=>d.documents.push({...d.documents[0],id:'collide',number:d.reviewEvents[0].receipt.number})];
  for(const mutate of mutations){const d=JSON.parse(good);mutate(d);const bad=JSON.stringify(d);assert.throws(()=>run(`migrate(JSON.parse(${JSON.stringify(bad)}))`),/DATA_SCHEMA_INVALID/);assert.throws(()=>vm.runInContext(`validateData(${JSON.stringify(bad)})`,main.context),/DATA_INVALID_SCHEMA/);}
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});

test('main storage refuses to rewrite or remove an issued correction during an ordinary save',async()=>{
 const {run}=setup();await run("applyReceiptReissues(buildReceiptReissueBatch(['tax']),facts)");const good=run('JSON.stringify(DB)');
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'billngai-reissue-immutable-'));fs.writeFileSync(path.join(root,'config.json'),'{"externalPath":null}');fs.writeFileSync(path.join(root,'billing.json'),good);const h=mainHarness(root);
 try{
  await h.call('data:load');
  const removed=JSON.parse(good);removed.reviewEvents=[];await assert.rejects(h.call('data:save',JSON.stringify(removed)),/RECEIPT_REISSUE_IMMUTABLE/);
  const changed=JSON.parse(good);changed.reviewEvents[0].note='rewritten';await assert.rejects(h.call('data:save',JSON.stringify(changed)),/RECEIPT_REISSUE_IMMUTABLE/);
  assert.equal(fs.readFileSync(path.join(root,'billing.json'),'utf8'),good);await h.call('data:save',good);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
