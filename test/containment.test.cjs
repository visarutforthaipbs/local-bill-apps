const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { mainHarness } = require('./helpers/main-harness.cjs');
const source = fs.readFileSync(path.resolve(__dirname, '../billing.html'), 'utf8');
const script = source.match(/<script>([\s\S]*)<\/script>\s*<\/body>/)[1].replace(/\bboot\(\);\s*$/, '');

test('inline renderer syntax remains valid', () => { new vm.Script(script); });
test('all cloud mutation/read/ack IPC entries fail before touching data', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'billngai-containment-'));
  const harness = mainHarness(root);
  for(const channel of ['sync:connect','sync:push','sync:pull','sync:commitPull','sync:snapshot','sync:restore']) {
    await assert.rejects(harness.call(channel, '{}'), /CLOUD_SYNC_PAUSED_2_0_3/);
  }
  assert.deepEqual(fs.readdirSync(root), []);
});
test('renderer sync/connect/restore and e-Tax entry points are contained', async () => {
  const messages=[];
  const ctx = vm.createContext({ CLOUD_SYNC_PAUSED:true, tr:s=>s, toast:s=>messages.push(s) });
  for(const [start,end] of [
    ['async function syncNow(', 'async function connectDrive('],
    ['async function connectDrive(', 'async function disconnectDrive('],
    ['async function restoreFromCloudFlow(', '/* ---------- conflict UI'],
    ['function exportETaxXML(', 'function importJSON(']
  ]) {
    vm.runInContext(source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start))),ctx);
  }
  await ctx.syncNow(false); await ctx.connectDrive(); await ctx.restoreFromCloudFlow(); ctx.exportETaxXML();
  assert.equal(messages.length,4);
});
test('fresh profile never assumes VAT registration or a 3 percent withholding rule', () => {
  const ctx=vm.createContext({});
  vm.runInContext(source.slice(source.indexOf('function blankDB('),source.indexOf('/* ---------- persistence')),ctx);
  const b=ctx.blankDB().business;
  assert.equal(b.isVatRegistered,false); assert.equal(b.vatStatus,'unknown'); assert.equal(b.defaultWhtRate,0);
});

function renderer(){
  const elements=new Map();
  const context=vm.createContext({window:{addEventListener(){},matchMedia(){return {matches:false};}},
    document:{getElementById(id){if(!elements.has(id))elements.set(id,{innerHTML:'',addEventListener(){},classList:{add(){},remove(){}}});return elements.get(id);},querySelectorAll(){return [];},addEventListener(){}},
    navigator:{platform:'Synthetic'},console,TextEncoder,TextDecoder,setTimeout(){},clearTimeout(){},setInterval(){},
    localStorage:{getItem(){return null;},setItem(){}},confirm(){return true;}});
  vm.runInContext(script,context);
  vm.runInContext(`DB=blankDB();DB.clients=[{id:'buyer',name:'Buyer'}];
    function fixture(extra={}){return {id:'invoice',type:'invoice',number:'INV-1',status:'paid',clientId:'buyer',issueDate:'2026-01-10',paidDate:'2026-01-10',currency:'THB',items:[{description:'Service',qty:1,price:10000}],vatRate:0,whtRate:0,...extra};}`,context);
  return {run:code=>vm.runInContext(code,context),elements};
}
test('dashboard charts use the same unique payment set and never count draft receipts',()=>{
  const {run}=renderer();
  run("DB.documents=[fixture(),fixture({id:'draft',type:'receipt',status:'draft',items:[{description:'Draft',qty:1,price:90000}]})]");
  assert.equal(run('receivedDocs().length'),1);
  assert.match(run('chartsBlock()'),/10,000\.00/);
  assert.doesNotMatch(run('chartsBlock()'),/90,000\.00/);
  run("DB.documents.push(fixture({id:'receipt1',type:'receipt',parentId:'invoice'}),fixture({id:'receipt2',type:'receipt',parentId:'invoice'}))");
  assert.equal(run('receivedDocs().length'),0);
  assert.equal(run('paymentReview().ambiguousCount'),1);
  assert.equal(run('paymentReview().unallocatedDocs.length'),3);
  assert.doesNotMatch(run('chartsBlock()'),/20,000\.00/);
});
test('CSV treats formulas as text, quotes carriage returns and does not invent payment dates',()=>{
  const {run}=renderer();
  assert.equal(run('csvCell("=1+2")'),"'=1+2");
  assert.equal(run('csvCell("@SUM(A1)")'),"'@SUM(A1)");
  assert.equal(run('csvCell("-100.00")'),'-100.00');
  assert.equal(run('csvCell("a\\rb")'),'"a\rb"');
  run("DB.documents=[fixture({type:'receipt',status:'issued',paidDate:null,whtRate:3})]");
  const csv=run('buildWhtCSV(null)');
  assert.doesNotMatch(csv,/2026-01-10/);
  assert.match(csv,/วันที่รับเงินไม่ชัดเจน/);
});
test('legacy draft VAT correction is explicit, unsaved and resets confirmations',()=>{
  const {run}=renderer();
  run("drawDocEditor=()=>{};editDoc=fixture({status:'draft',vatRate:7,whtReviewed:true,issueConfirmed:true});clearDraftVat()");
  assert.equal(run('editDoc.vatRate'),0);
  assert.equal(run('editDoc.whtReviewed'),false);
  assert.equal(run('editDoc.issueConfirmed'),false);
  assert.equal(run('DB.documents.length'),0);
});
test('imported draft numeric/date fields cannot break out of editor attributes',()=>{
  const {run,elements}=renderer();
  run(`drawLadder=()=>{};drawItems=()=>{};editDoc=fixture({status:'draft',issueDate:'" autofocus onfocus="attack()',paidDate:'" onfocus="attack()',whtRate:'" onfocus="attack()'});drawDocEditor();`);
  const html=elements.get('modal').innerHTML;
  assert.doesNotMatch(html,/value="" autofocus/);
  assert.doesNotMatch(html,/value="" onfocus/);
  assert.match(html,/&quot;/);
  assert.match(source,/value="\$\{attr\(it\.qty\)\}"/);
  assert.match(source,/value="\$\{attr\(it\.price\)\}"/);
});
