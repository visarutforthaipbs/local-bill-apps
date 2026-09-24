const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const test=require('node:test'),assert=require('node:assert/strict');
const script=fs.readFileSync(path.join(__dirname,'../billing.html'),'utf8').match(/<script>([\s\S]*)<\/script>\s*<\/body>/)[1].replace(/\bboot\(\);\s*$/,'');
function setup(){
  const ctx=vm.createContext({window:{addEventListener(){},matchMedia(){return {matches:false}}},document:{getElementById(){return {addEventListener(){},classList:{add(){},remove(){}}}},querySelectorAll(){return []},addEventListener(){}},navigator:{platform:'Test'},console,TextEncoder,TextDecoder,setTimeout(){},clearTimeout(){},setInterval(){},localStorage:{getItem(){return null},setItem(){}},confirm(){return true}});
  vm.runInContext(script,ctx);
  vm.runInContext(`DB=blankDB();DEVICE_ID='test';DB.clients=[{id:'buyer',name:'Buyer'}];DB.recurring=[{id:'r',clientId:'buyer',nextDate:'2026-01-31',frequency:'monthly',items:[{description:'Retainer',qty:1,price:1000}],vatRate:0,whtRate:0}];persist=async()=>true;toast=()=>{};viewDoc=()=>{};render=()=>{};closeModal=()=>{};setView=()=>{};`,ctx);
  return code=>vm.runInContext(code,ctx);
}
test('month-end recurrence clamps and preserves original anchor across successive generations',async()=>{
  const run=setup();
  assert.equal(run(`advanceDate('2026-01-31','monthly')`),'2026-02-28');
  assert.equal(run(`advanceDate('2024-01-31','monthly')`),'2024-02-29');
  assert.equal(run(`advanceDate('2024-02-29','yearly')`),'2025-02-28');
  assert.equal(await run(`generateRecurring('r')`),true);
  assert.equal(run('DB.recurring[0].nextDate'),'2026-02-28');
  assert.equal(await run(`generateRecurring('r')`),true);
  assert.equal(run('DB.recurring[0].nextDate'),'2026-03-31');
});
test('failed and rejected saves roll back invoice, counters and recurring schedule',async()=>{
  for(const failure of ['return false','throw Error("disk full")']){
    const run=setup();const before=run('JSON.stringify(DB)');
    run(`persist=async()=>{${failure}}`);
    assert.equal(await run(`generateRecurring('r')`),false);
    assert.equal(run('JSON.stringify(DB)'),before);
    assert.equal(run('issuanceBusy'),false);
  }
});
test('parallel generation is serialized and cannot create duplicate invoices',async()=>{
  const run=setup();run('persist=()=>new Promise(resolve=>{finish=resolve})');
  const first=run(`generateRecurring('r')`);
  assert.equal(await run(`generateRecurring('r')`),false);
  run('finish(true)');assert.equal(await first,true);
  assert.equal(run('DB.documents.length'),1);
});
test('recurring draft numbering skips all retained numbers',async()=>{
  const run=setup();run(`DB.documents=[{id:'old',number:nextNumber('invoice','2026-01-31'),deletedAt:'2020-01-01'}]`);
  await run(`generateRecurring('r')`);
  assert.notEqual(run('DB.documents[0].number'),run('DB.documents[1].number'));
});
test('recurring template edits and deletion rollback on failed persistence',async()=>{
  const run=setup();run(`editRec=JSON.parse(JSON.stringify(DB.recurring[0]));editRec.project='changed';persist=async()=>false`);
  const before=run('JSON.stringify(DB.recurring)');
  assert.equal(await run('saveRecurring()'),false);
  assert.equal(run('JSON.stringify(DB.recurring)'),before);
  assert.equal(await run(`deleteRecurring('r')`),false);
  assert.equal(run('JSON.stringify(DB.recurring)'),before);
});
