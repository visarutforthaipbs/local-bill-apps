// Owner answers for unresolved historical payment groups (2.0.8). Synthetic data only.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../billing.html'),'utf8');
const script=html.match(/<script>([\s\S]*)<\/script>\s*<\/body>/)[1].replace(/\bboot\(\);\s*$/,'');
function setup(backup=async()=>'synthetic-backup.json'){
  const element=()=>({innerHTML:'',textContent:'',value:'',checked:false,style:{},addEventListener(){},classList:{add(){},remove(){},toggle(){}}});
  const ctx=vm.createContext({window:{addEventListener(){},matchMedia(){return {matches:false};},billingAPI:{snapshotBackup:(...a)=>backup(...a)}},
    document:{getElementById:element,querySelectorAll(){return [];},addEventListener(){}},navigator:{platform:'Synthetic'},console,
    TextEncoder,TextDecoder,setTimeout(){},clearTimeout(){},setInterval(){},localStorage:{getItem(){return null;},setItem(){}},confirm(){return true;}});
  vm.runInContext(script,ctx);
  vm.runInContext(`DB=blankDB();DB.business.uiLang='en';DEVICE_ID='synthetic';DB.clients=[{id:'c',name:'Synthetic buyer'}];
    function doc(extra={}){return {id:'i',type:'invoice',number:'INV-1',clientId:'c',status:'paid',paidDate:'2026-01-10',issueDate:'2026-01-10',
      currency:'THB',vatRate:0,whtRate:3,items:[{description:'Service',qty:1,price:10000}],...extra};}
    // G1: both records deleted (test documents). G2: invoice + old tax invoice with VAT.
    DB.documents=[doc({id:'i1',number:'INV-DEL',deletedAt:'2026-01-11T00:00:00.000Z'}),
      doc({id:'t1',type:'tax_invoice',number:'TX-DEL',status:'issued',parentId:'i1',deletedAt:'2026-01-11T00:00:00.000Z'}),
      doc({id:'i2',number:'INV-VAT',vatRate:7}),doc({id:'t2',type:'tax_invoice',number:'TX-VAT',status:'issued',parentId:'i2',vatRate:7})];
    persist=async()=>true;render=()=>{};toast=(m,k)=>{globalThis.lastToast={m,k};};
    function groupKey(id){return paymentReview().legacyGroups.find(x=>x.group.some(d=>d.id===id)).key;}
    function answer(id,decision,rep){const r=paymentReview().legacyGroups.find(x=>x.group.some(d=>d.id===id));
      return {key:r.key,sourceJSON:JSON.stringify(r.group),decision,representativeId:rep};}`,ctx);
  return s=>{const v=vm.runInContext(s,ctx);if(v&&typeof v.then==='function')return v;const j=JSON.stringify(v);return j===undefined?null:JSON.parse(j);};
}
test('unanswered groups stay unallocated and are listed for review',()=>{
  const run=setup();
  const r=run(`(()=>{const p=paymentReview();return {groups:p.legacyGroups.length,unanswered:p.unansweredGroups.length,ambiguous:p.ambiguousCount,docs:p.docs.length};})()`);
  assert.deepEqual(r,{groups:2,unanswered:2,ambiguous:2,docs:0});
});
test('answers resolve groups: not income is excluded, one payment counts once, accountant stays open',async()=>{
  const run=setup();run(`const original=JSON.stringify(DB.documents);globalThis.original=original;`);
  assert.equal(await run(`saveLegacyAnswers([answer('i1','not_income'),answer('i2','same_payment','t2')],true,'Owner checked bank statement')`),true);
  const r=run(`(()=>{const p=paymentReview();return {unanswered:p.unansweredGroups.length,ambiguous:p.ambiguousCount,notIncome:p.notIncomeCount,
    docs:p.docs.map(d=>d.id),dup:p.duplicateCount,net:taxYearAgg(2026).agg.net,same:JSON.stringify(DB.documents)===globalThis.original,
    events:DB.reviewEvents.length,valid:DB.reviewEvents.every(validLegacyGroupReview)};})()`);
  assert.deepEqual(r.docs,['t2']);assert.equal(r.unanswered,0);assert.equal(r.ambiguous,0);assert.equal(r.notIncome,1);
  assert.equal(r.net,10400);assert.equal(r.same,true);assert.equal(r.events,2);assert.equal(r.valid,true);
  assert.equal(run(`validateRendererData(JSON.parse(JSON.stringify(DB)))`),null);
  // Changing an answer: the latest valid answer wins.
  assert.equal(await run(`saveLegacyAnswers([answer('i2','needs_accountant')],true,'Ask accountant about VAT')`),true);
  const r2=run(`(()=>{const p=paymentReview();return {docs:p.docs.length,ambiguous:p.ambiguousCount,accountant:p.accountantCount,unanswered:p.unansweredGroups.length};})()`);
  assert.deepEqual(r2,{docs:0,ambiguous:1,accountant:1,unanswered:0});
});
test('a changed source record invalidates its answer instead of silently keeping it',async()=>{
  const run=setup();
  assert.equal(await run(`saveLegacyAnswers([answer('i2','same_payment','t2')],true,'Checked')`),true);
  run(`DB.documents.find(d=>d.id==='t2').notes='edited later'`);
  assert.deepEqual(run(`(()=>{const p=paymentReview();return {docs:p.docs.length,unanswered:p.unansweredGroups.length};})()`),{docs:0,unanswered:2});
});
test('requires confirmation, a note, a valid decision and a countable representative',async()=>{
  const run=setup();
  for(const call of [`saveLegacyAnswers([answer('i1','not_income')],false,'n')`,`saveLegacyAnswers([answer('i1','not_income')],true,'  ')`,
    `saveLegacyAnswers([],true,'n')`,`saveLegacyAnswers([answer('i1','guess')],true,'n')`,
    `saveLegacyAnswers([answer('i2','same_payment','missing')],true,'n')`])
    assert.equal(await run(call),false,call);
  // All-deleted group: deleted records with valid dates may represent money only when chosen explicitly.
  assert.equal(run(`legacyRepresentatives(paymentReview().legacyGroups.find(x=>x.group.some(d=>d.id==='i2')).group).map(d=>d.id)[0]`),'t2');
  assert.equal(run('DB.reviewEvents.length'),0);
});
test('stale preview, failed backup and failed save never store answers',async()=>{
  let run=setup();run(`globalThis.stale=answer('i2','same_payment','t2');DB.documents.find(d=>d.id==='t2').notes='changed';`);
  assert.equal(await run(`saveLegacyAnswers([globalThis.stale],true,'n')`),false);assert.equal(run('DB.reviewEvents.length'),0);
  run=setup(async()=>null);
  assert.equal(await run(`saveLegacyAnswers([answer('i1','not_income')],true,'n')`),false);assert.equal(run('DB.reviewEvents.length'),0);
  run=setup();run(`persist=async()=>false`);
  assert.equal(await run(`saveLegacyAnswers([answer('i1','not_income')],true,'n')`),false);assert.equal(run('DB.reviewEvents.length'),0);
  // Source changes during the backup are caught by the second check.
  let during;run=setup(async()=>{during("DB.documents.find(d=>d.id==='t1').notes='changed during backup'");return 'b';});during=run;
  assert.equal(await run(`saveLegacyAnswers([answer('i1','not_income')],true,'n')`),false);assert.equal(run('DB.reviewEvents.length'),0);
});
test('busy guard blocks a second save while the first is writing',async()=>{
  const run=setup();run(`persist=()=>new Promise(resolve=>{globalThis.finish=resolve;})`);
  const first=run(`saveLegacyAnswers([answer('i1','not_income')],true,'n')`);
  await new Promise(r=>setImmediate(r));
  assert.equal(await run(`saveLegacyAnswers([answer('i2','needs_accountant')],true,'n')`),false);
  run('finish(false)');assert.equal(await first,false);assert.equal(run('DB.reviewEvents.length'),0);
});
test('main and renderer reject malformed answers and accept the valid shape',async()=>{
  const run=setup();assert.equal(await run(`saveLegacyAnswers([answer('i2','same_payment','t2')],true,'Checked')`),true);
  const data=run('DB'),event=data.reviewEvents[0];
  const {mainHarness}=require('./helpers/main-harness.cjs'),fsp=require('node:fs/promises'),os=require('node:os');
  const root=await fsp.mkdtemp(path.join(os.tmpdir(),'billngai-legacy-review-test-'));
  try{
    await mainHarness(root).call('data:recover',JSON.stringify(data));
    assert.equal(JSON.parse(await mainHarness(root).call('data:load')).reviewEvents.length,1);
    for(const change of [{decision:'guess'},{ownerConfirmed:false},{note:''},{recordedAt:'2026-02-31'},{representativeId:'nope'},
      {decision:'not_income'},{sourceRecords:[]},{documentId:'elsewhere'},{groupKey:''}]){
      const bad={...data,reviewEvents:[{...event,...change}]};
      await assert.rejects(mainHarness(root).call('data:recover',JSON.stringify(bad)),/DATA_INVALID_SCHEMA/,JSON.stringify(change));
      assert.throws(()=>run(`validateRendererData(${JSON.stringify(bad)})`),/DATA_SCHEMA_INVALID/);
    }
  }finally{await fsp.rm(root,{recursive:true,force:true});}
});
test('dashboard shows one to-do line instead of an empty pair card, and the received tag explains the gap',()=>{
  const run=setup();
  const html=run(`(()=>{const c={innerHTML:'',querySelectorAll(){return [];}},ta={innerHTML:''};renderDashboard(c,ta);return c.innerHTML;})()`);
  assert.doesNotMatch(html,/id="pendingPayments"/);
  assert.match(html,/2 old record group\(s\) to review|<b>2<\/b> old record group/);
  assert.match(html,/Excludes 2 older record group/);
});
