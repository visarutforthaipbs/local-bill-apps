const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname,'../billing.html'),'utf8');
const script = html.match(/<script>([\s\S]*)<\/script>\s*<\/body>/)[1].replace(/\bboot\(\);\s*$/, '');
function setup(){
  const elements=new Map();
  const element=()=>({innerHTML:'',textContent:'',value:'',checked:false,addEventListener(){},focus(){},
    querySelector(){return null;},classList:{add(){},remove(){},toggle(){}},style:{setProperty(){},removeProperty(){}}});
  const ctx=vm.createContext({
    window:{addEventListener(){},matchMedia(){return {matches:false};}},
    document:{getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);},
      querySelectorAll(){return [];},querySelector(){return null;},addEventListener(){},
      body:{classList:{add(){},remove(){},toggle(){}},setAttribute(){}},documentElement:element()},
    navigator:{platform:'SyntheticDocumentStabilization'},console,TextEncoder,TextDecoder,
    setTimeout(){return 0;},clearTimeout(){},setInterval(){return 0;},
    localStorage:{getItem(){return null;},setItem(){}},confirm(){return true;},
    prompt(){throw Error('prompt() is not supported.');}
  });
  vm.runInContext(script,ctx);
  vm.runInContext(`DB=blankDB();DEVICE_ID='synthetic-stabilization';
    Object.assign(DB.business,{businessName:'Synthetic issuer',address:'Synthetic address',taxId:'1234567890123',vatStatus:'non_registered'});
    DB.clients=[{id:'buyer',name:'Synthetic buyer'}];persist=async()=>true;render=()=>{};toast=()=>{};viewDoc=()=>{};setView=()=>{};
    function fixture(extra={}){return {id:'doc1',type:'invoice',number:'INV-1',clientId:'buyer',status:'sent',
      issueDate:'2026-01-10',dueDate:'2026-02-10',paidDate:null,currency:'THB',vatRate:0,whtRate:0,
      whtReviewed:true,fullPaymentConfirmed:false,deletedAt:null,items:[{description:'Synthetic service',qty:1,price:10000}],...extra};}
    function issued(extra={}){const d=fixture(extra);freezeIssuedDocument(d);DB.documents.push(d);return d;}
  `,ctx);
  return {run:s=>vm.runInContext(s,ctx),elements};
}

test('record-payment button opens a date modal without mutating an issued invoice',async()=>{
  const {run,elements}=setup();
  run(`issued();`);
  const before=run(`JSON.stringify(DB)`);
  await run(`setStatus('doc1','paid')`);
  assert.match(elements.get('modal').innerHTML,/type=["']date["']/);
  assert.match(elements.get('modal').innerHTML,/submitPaymentDialog/);
  assert.equal(run(`JSON.stringify(DB)`),before);
  run(`closeModal()`);
  assert.equal(run(`JSON.stringify(DB)`),before);
});

test('payment modal validates actual date and full-payment confirmation before persisting',async()=>{
  const {run,elements}=setup();
  run(`issued();openPaymentDialog('doc1');document.getElementById('paymentDate');document.getElementById('paymentFull');`);
  const before=run(`JSON.stringify(DB)`);
  const date=elements.get('paymentDate'),full=elements.get('paymentFull');
  for(const [paidDate,confirmed] of [['',true],['2026-02-30',true],['2999-01-01',true],['2026-01-20',false]]){
    date.value=paidDate;full.checked=confirmed;
    await run(`submitPaymentDialog('doc1')`);
    assert.equal(run(`JSON.stringify(DB)`),before);
  }
  date.value='2026-01-20';full.checked=true;
  const snapshot=run(`JSON.stringify(DB.documents[0].issuedSnapshot)`);
  await run(`submitPaymentDialog('doc1')`);
  assert.equal(run(`DB.documents[0].status`),'paid');
  assert.equal(run(`DB.documents[0].paidDate`),'2026-01-20');
  assert.equal(run(`DB.documents[0].fullPaymentConfirmed`),true);
  assert.ok(run(`DB.documents[0].paymentId`));
  assert.equal(run(`JSON.stringify(DB.documents[0].issuedSnapshot)`),snapshot);
});

test('payment save failure leaves invoice and counters unchanged and can retry with explicit facts',async()=>{
  const {run}=setup();
  run(`issued();`);
  const before=run(`JSON.stringify(DB)`);
  await run(`persist=async()=>false;setStatus('doc1','paid',{paidDate:'2026-01-20',fullPaymentConfirmed:true})`);
  assert.equal(run(`JSON.stringify(DB)`),before);
  await run(`persist=async()=>true;setStatus('doc1','paid',{paidDate:'2026-01-20',fullPaymentConfirmed:true})`);
  assert.equal(run(`DB.documents[0].status`),'paid');
  assert.equal(run(`DB.documents.length`),1);
});

test('voided invoice no longer appears collectible or exposes a payment quick action',async()=>{
  const {run}=setup();
  run(`issued();`);
  await run(`voidDocument('doc1','Duplicate document')`);
  assert.equal(run(`isOverdue(DB.documents[0])`),false);
  assert.equal(run(`docStatusMatch(DB.documents[0],'unpaid')`),false);
  assert.equal(run(`docStatusMatch(DB.documents[0],'overdue')`),false);
  assert.doesNotMatch(run(`docQuickAction(DB.documents[0],effectiveStatus(DB.documents[0]))`),/setStatus|createReceipt/);
});

test('legacy, deleted and voided invoices never offer impossible one-click payment actions',()=>{
  const {run}=setup();
  for(const extra of [{legacy_review_required:true},{deletedAt:'2026-03-01'},{voidedAt:'2026-03-01'}]){
    assert.doesNotMatch(run(`(()=>{const d=fixture(${JSON.stringify(extra)});DB.documents=[d];return docQuickAction(d,effectiveStatus(d));})()`),/setStatus|createReceipt/);
  }
});

test('declining an issued quotation preserves the frozen original and changes commercial status',async()=>{
  const {run}=setup();
  run(`issued({type:'quotation',number:'QT-1'});`);
  const snapshot=run(`JSON.stringify(DB.documents[0].issuedSnapshot)`);
  await run(`setStatus('doc1','declined')`);
  assert.equal(run(`DB.documents[0].status`),'declined');
  assert.equal(run(`JSON.stringify(DB.documents[0].issuedSnapshot)`),snapshot);
});

test('source no longer uses unsupported browser prompt for native document actions',()=>{
  assert.equal(/\bprompt\s*\(/.test(script),false,'Renderer document actions must use the application modal');
});

test('draft warning belongs to paper content and is not a print-hidden banner',()=>{
  const {run}=setup();
  for(const type of ['quotation','invoice','receipt']){
    const paper=run(`(()=>{const d=fixture({type:${JSON.stringify(type)},status:'draft'});return renderPaper(d,DB.clients[0],compute(d));})()`);
    const start=paper.indexOf('class="paper"');
    const marker=paper.indexOf('class="draft-print-marker"');
    assert.ok(start>=0&&marker>start,'Draft marker must be inside the printed paper');
    assert.match(paper.slice(marker),/ร่าง — ยังไม่ออกเอกสาร|DRAFT — not issued/);
  }
  const printCSS=html.slice(html.indexOf('@media print'),html.indexOf('</style>'));
  assert.equal(/\.draft-print-marker[^{}]*\{[^}]*display\s*:\s*none/.test(printCSS),false);
  // Structural regression only; native final-PDF text/visual verification is separate.
});

test('legacy tax-invoice drafts cannot print, share or reach tax-labelled paper',()=>{
  const {run}=setup();
  assert.equal(run(`(()=>{const d=fixture({type:'tax_invoice',status:'draft'});DB.documents=[d];
    return documentOutputBlocked(d)&&shareText(d)===''&&!renderPaper(d,DB.clients[0],compute(d)).includes('class="paper"');})()`),true);
});

test('malformed nested import is rejected before it can replace the active database',()=>{
  const {run}=setup();
  for(const payload of [
    `{...blankDB(),clients:[null]}`,
    `{...blankDB(),documents:[fixture({items:{}})]}`,
    `{...blankDB(),documents:[fixture(),fixture()]}`,
    `{...blankDB(),documents:[fixture({items:[null]})]}`
  ]){
    const before=run(`JSON.stringify(DB)`);
    assert.throws(()=>run(`migrate(${payload})`),/DATA_SCHEMA_INVALID/);
    assert.equal(run(`JSON.stringify(DB)`),before);
  }
});

test('imported IDs round-trip through inline-handler encoding as data, never executable code',()=>{
  const {run}=setup();
  for(const id of ["legacy');globalThis.idAttack=true;//",'legacy" onmouseover="globalThis.idAttack=true',"ไทย<&>\\\"'\u2028"]){
    const encoded=run(`jsArg(${JSON.stringify(id)})`);
    const decoded=encoded.replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
    assert.equal(vm.runInNewContext(decoded),id);
    const sandbox={idAttack:false,received:null,capture(value){this.received=value;}};
    vm.runInNewContext(`capture(${decoded});`,sandbox);
    assert.equal(sandbox.idAttack,false);
  }
});

test('actual imported document row handlers keep a crafted ID inert',()=>{
  const {run}=setup();
  const id="legacy');globalThis.idAttack=true;//";
  const table=run(`(()=>{const d=fixture({id:${JSON.stringify(id)}});DB.documents=[d];return docTable([d]);})()`);
  const match=table.match(/<tr\s+onclick="([^"]*)"/);
  assert.ok(match,'Synthetic document should have a navigable row');
  const handler=match[1].replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
  run(`globalThis.idAttack=false;globalThis.selectedId=null;viewDoc=id=>{globalThis.selectedId=id;};`);
  run(handler);
  assert.equal(run(`globalThis.idAttack`),false);
  assert.equal(run(`globalThis.selectedId`),id);
});
