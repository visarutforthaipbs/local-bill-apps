const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const script = fs.readFileSync(path.join(__dirname,'../billing.html'),'utf8').match(/<script>([\s\S]*)<\/script>\s*<\/body>/)[1].replace(/\bboot\(\);\s*$/, '');
function setup(){
  const classes=new Set(), events={}, elements=new Map();
  const element=()=>({innerHTML:'',textContent:'',value:'',addEventListener(){},classList:{add(){},remove(){},toggle(){}},style:{setProperty(){},removeProperty(){}}});
  const ctx=vm.createContext({
    window:{addEventListener(n,f){events[n]=f;},matchMedia(){return {matches:false};},print(){},billingAPI:{exportPDF(){throw new Error('Forbidden PDF call');}}},
    document:{getElementById(id){if(!elements.has(id)) elements.set(id,element());return elements.get(id);},querySelectorAll(){return [];},querySelector(){return null;},addEventListener(){},
      body:{classList:{add(n){classes.add(n);},remove(n){classes.delete(n);},toggle(n,v){v?classes.add(n):classes.delete(n);}},setAttribute(){}},documentElement:element()},
    navigator:{platform:'HistoryTest'},console,TextEncoder,TextDecoder,
    setTimeout(){return 0;},clearTimeout(){},setInterval(){return 0;},localStorage:{getItem(){return null;},setItem(){}},confirm(){return true;},prompt(){return 'Correction required';}
  });
  vm.runInContext(script,ctx);
  vm.runInContext(`DB=blankDB(); DEVICE_ID='synthetic-history';
    DB.business={...DB.business,businessName:'Original issuer',address:'Original issuer address',taxId:'1234567890123',yearMode:'be',lang:'th',brandColor:'#ff6b00'};
    DB.clients=[{id:'buyer',name:'Original buyer',address:'Original buyer address',docLang:'th'}];
    persist=async()=>true; render=()=>{}; toast=()=>{}; closeModal=()=>{}; setView=()=>{};
    function fixture(extra={}){return {id:'doc1',type:'receipt',number:'RC-69-001',status:'issued',clientId:'buyer',currency:'THB',issueDate:'2026-09-01',paidDate:'2026-09-01',paymentId:'payment1',vatRate:0,whtRate:3,items:[{description:'Original service',qty:1,price:10000}],deletedAt:null,...extra};}
    function frozen(extra={}){const d=fixture(extra);freezeIssuedDocument(d);DB.documents.push(d);return d;}
  `,ctx);
  return {run:s=>vm.runInContext(s,ctx),classes,events,elements};
}
test('issued snapshot freezes financial inputs, identity, language, dates and rendered color',()=>{
  const {run}=setup();
  assert.equal(run(`(()=>{const d=frozen();const paper=renderPaper(d,{},compute(d)),summary=shareText(d),amount=JSON.stringify(compute(d));
    DB.business.businessName='Changed'; DB.business.address='Changed';DB.business.taxId='9999999999999';DB.business.isVatRegistered=true;DB.business.lang='en';DB.business.yearMode='ce';DB.business.brandColor='#000000';DB.business.bankAccount='Changed';DB.business.logo='Changed';DB.business.signature='Changed';
    DB.clients[0].name='Changed';DB.clients[0].docLang='en';DB.clients[0].address='Changed';
    d.items[0].price=999999;d.notes='Changed';d.vatRate=7;d.docLang='en';
    return paper===renderPaper(d,{},compute(d)) && summary===shareText(d) && amount===JSON.stringify(compute(d)) && docLangOf(d)==='th' && paper.includes('Original issuer') && paper.includes('Original buyer') && paper.includes('2569') && paper.includes('--accent:#ff6b00');})()`),true);
});
test('snapshot computes exactly once and does not nest on repeated freezing',()=>{
  const {run}=setup();
  assert.equal(run(`(()=>{const d=frozen();const snapshot=d.issuedSnapshot;freezeIssuedDocument(d);return snapshot===d.issuedSnapshot && !snapshot.document.issuedSnapshot && snapshot.schemaVersion===1;})()`),true);
});
test('legacy issued migration retains original number, absent currency and old tombstones',()=>{
  const {run}=setup();
  assert.equal(run(`(()=>{const d=fixture({number:'RC-{001}',deletedAt:'2020-01-01T00:00:00Z'});delete d.currency;const a=migrate({...blankDB(),documents:[d]});const b=migrate(a);return b.documents.length===1 && b.documents[0].number==='RC-{001}' && !('currency' in b.documents[0]) && b.documents[0].legacy_review_required && !b.documents[0].issuedSnapshot && JSON.stringify(a.documents)===JSON.stringify(b.documents);})()`),true);
});
test('missing legacy status is conservatively treated as issued',()=>{
  const {run}=setup();assert.equal(run(`isIssuedDocument({type:'receipt'}) && !isIssuedDocument({type:'receipt',status:'draft'})`),true);
});
test('legacy output is quarantined while raw calculation does not follow current VAT profile',()=>{
  const {run}=setup();
  assert.equal(run(`(()=>{const d=fixture({vatRate:7});DB.documents=[d];const before=compute(d).grandTotal;DB.business.isVatRegistered=!DB.business.isVatRegistered;return before===compute(d).grandTotal && documentOutputBlocked(d) && !renderPaper(d,{},compute(d)).includes('class="paper"') && shareText(d)==='';})()`),true);
});
test('currency is not a withholding exemption',()=>{
  const {run}=setup();assert.equal(run(`compute(fixture({currency:'USD'})).whtAmount`),300);
});
test('English-only ordinary receipts fall back to bilingual product scope',()=>{
  const {run}=setup();assert.equal(run(`docLangOf(fixture({docLang:'en'}))`),'bilingual');
});
test('draft paper is clearly marked and is not issued',()=>{
  const {run}=setup();assert.equal(run(`(()=>{const d=fixture({status:'draft'});return !documentOutputBlocked(d) && renderPaper(d,{},compute(d)).includes('ร่าง — ยังไม่ออกเอกสาร') && shareText(d).startsWith('ร่าง');})()`),true);
});
test('duplicate issued numbers block both originals including retained tombstones',()=>{
  const {run}=setup();assert.equal(run(`(()=>{const a=frozen();const b=fixture({id:'doc2',deletedAt:'2020-01-01'});DB.documents.push(b);return documentOutputBlocked(a)&&documentOutputBlocked(b);})()`),true);
});
test('issued deletion is refused without changing the record',async()=>{
  const {run}=setup();assert.equal(await run(`(async()=>{const d=frozen(),before=JSON.stringify(d);return (await deleteDoc(d.id))===false && JSON.stringify(d)===before;})()`),true);
});
test('void requires reason and keeps amounts, original copy and payment identity',async()=>{
  const {run}=setup();assert.equal(await run(`(async()=>{const d=frozen(),snapshot=JSON.stringify(d.issuedSnapshot);if(await voidDocument(d.id,' '))return false;await voidDocument(d.id,'Wrong buyer');return !!d.voidedAt && d.voidReason==='Wrong buyer' && d.paidDate==='2026-09-01' && d.paymentId==='payment1' && d.status==='issued' && compute(d).subtotal===10000 && snapshot===JSON.stringify(d.issuedSnapshot) && documentOutputBlocked(d) && archivedDocuments().includes(d);})()`),true);
});
test('failed void persistence restores all fields',async()=>{
  const {run}=setup();assert.equal(await run(`(async()=>{const d=frozen(),before=JSON.stringify(d);persist=async()=>false;return !await voidDocument(d.id,'Wrong buyer') && JSON.stringify(d)===before;})()`),true);
});
test('PDF/direct print and beforeprint keyboard path cannot emit quarantined originals',async()=>{
  const {run,classes,events}=setup();
  run(`DB.documents=[fixture()];viewingId='doc1';currentView='docview';`);
  assert.equal(run(`printDocument()`),false);
  assert.equal(await run(`savePDF()`),false);
  events.beforeprint();assert.equal(classes.has('document-output-blocked'),true);
  events.afterprint();assert.equal(classes.has('document-output-blocked'),false);
});
test('archive exposes retained raw review data and JSON export without authoritative output',async()=>{
  const {run,elements}=setup();
  run(`DB.documents=migrate({...DB,documents:[fixture({deletedAt:'2020-01-01T00:00:00Z'})]}).documents;openDocumentArchive();`);
  assert.match(elements.get('modal').innerHTML,/RC-69-001/);
  assert.equal(run(`(()=>{let output;downloadFile=s=>output=JSON.parse(s);exportDocumentArchive();return output.documents.length===1 && output.purpose==='historical-review-not-tax-document';})()`),true);
});
test('malformed snapshot is quarantined and cannot crash computation or migration',()=>{
  const {run}=setup();assert.equal(run(`(()=>{const d=fixture({issuedSnapshot:{foo:'bar'}});DB.documents=[d];return compute(d).subtotal===10000 && docCurrency(d)==='THB' && documentOutputBlocked(d) && migrate(DB).documents[0].legacy_review_required;})()`),true);
});
test('persisted snapshot HTML is never injected and image/quantity/currency inputs are escaped',()=>{
  const {run}=setup();assert.equal(run(`(()=>{const d=frozen();d.issuedSnapshot.renderedHtml='<script>attack()</script>';d.issuedSnapshot.business.logo='x" onerror="attack()';d.issuedSnapshot.business.signature='javascript:attack()';d.issuedSnapshot.document.items[0].qty='<img src=x onerror=attack()>';d.issuedSnapshot.amounts.currency='<img src=x onerror=attack()>';const html=renderPaper(d,{},compute(d));return !html.includes('<script>') && !html.includes('<img src=x') && !html.includes('src="x" onerror=') && !html.includes('src="javascript:') && html.includes('&lt;img') && html.includes('ไม่ใช่ใบกำกับภาษี');})()`),true);
});
test('existing issued records cannot receive invented snapshots',()=>{
  const {run}=setup();run(`DB.documents=[fixture()];`);
  assert.throws(()=>run(`freezeIssuedDocument(DB.documents[0])`),/Cannot reconstruct/);
  assert.equal(run(`DB.documents[0].issuedSnapshot===undefined`),true);
});
test('receipt freeze may inherit original invoice identity without touching current profiles',()=>{
  const {run}=setup();assert.equal(run(`(()=>{const invoice=frozen({type:'invoice',status:'sent',docLang:'en'});DB.business.businessName='Changed issuer';DB.business.yearMode='ce';DB.clients[0].name='Changed buyer';const receipt=fixture({id:'receipt2',number:'RC-69-002'});freezeIssuedDocument(receipt,invoice.issuedSnapshot);const html=renderPaper(receipt,{},compute(receipt));return html.includes('Original issuer') && html.includes('Original buyer') && html.includes('2569') && html.includes('Not a tax invoice') && docLangOf(receipt)==='bilingual' && DB.business.businessName==='Changed issuer';})()`),true);
});
