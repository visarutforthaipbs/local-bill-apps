const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../billing.html'),'utf8');
const script=source.match(/<script>([\s\S]*)<\/script>\s*<\/body>/)[1].replace(/\bboot\(\);\s*$/,'');

function setup(){
  let bootstrapping=true;
  const elements=new Map(),created=[],readers=[];
  const element=()=>({value:'',checked:false,innerHTML:'',textContent:'',files:[],style:{setProperty(){},removeProperty(){}},
    classList:{add(){},remove(){},toggle(){}},addEventListener(){},click(){this.clicked=true;}});
  const ctx=vm.createContext({
    window:{addEventListener(){},matchMedia(){return {matches:false};}},
    document:{getElementById(id){if(!elements.has(id)&&bootstrapping)elements.set(id,element());return elements.get(id)||null;},
      createElement(){const el=element();created.push(el);return el;},querySelectorAll(){return [];},querySelector(){return null;},addEventListener(){},
      body:{classList:{add(){},remove(){},toggle(){}},setAttribute(){}},documentElement:element()},
    FileReader:class{constructor(){readers.push(this);}readAsDataURL(file){this.file=file;}},
    navigator:{platform:'SyntheticSettings'},console,TextEncoder,TextDecoder,
    setTimeout(){return 0;},clearTimeout(){},setInterval(){return 0;},
    localStorage:{getItem(){return null;},setItem(){}},confirm(){return true;},prompt(){throw Error('Native prompt unsupported');}
  });
  vm.runInContext(script,ctx);bootstrapping=false;
  vm.runInContext(`DB=blankDB();DEVICE_ID='settings-regression';
    Object.assign(DB.business,{businessName:'Saved issuer',address:'Saved address',taxId:'1234567890123',logo:'ORIGINAL_LOGO'});
    DB.clients=[{id:'client',name:'Saved buyer',address:'Saved buyer address',deletedAt:null}];
    globalThis.renders=0;globalThis.closes=0;globalThis.messages=[];globalThis.saves=0;
    persist=async()=>{saves++;return true;};render=()=>{renders++;};closeModal=()=>{closes++;};
    toast=(message,kind)=>messages.push({message,kind});applyTheme=()=>{};
    function doc(extra={}){return {id:'doc',type:'invoice',number:'INV-1',status:'sent',clientId:'client',issueDate:'2025-01-01',
      currency:'THB',vatRate:0,whtRate:0,items:[{description:'Saved service',qty:1,price:100}],...extra};}
  `,ctx);
  return {run:s=>vm.runInContext(s,ctx),created,readers,field(id,value='',checked=false){const el=element();Object.assign(el,{value,checked});elements.set(id,el);return el;}};
}

test('milestone sequence and count render as inert text in list and lineage',()=>{
  const {run}=setup();
  const payload='<img src=x onerror="globalThis.milestoneAttack=true">';
  const result=JSON.parse(run(`(()=>{const parent=doc({milestone:{seq:${JSON.stringify(payload)},of:${JSON.stringify(payload)}}});
    const child=doc({id:'child',type:'receipt',parentId:'doc',number:'RC-1'});DB.documents=[parent,child];
    return JSON.stringify({table:docTable([parent]),trail:docTrail(child)});})()`));
  for(const rendered of [result.table,result.trail]){
    assert.ok(rendered.includes('&lt;img'));
    assert.equal(rendered.includes('<img src=x'),false);
  }
});

test('failed settings save retains original data and entered form value without success',async()=>{
  const h=setup();h.field('s_name','Unsaved new issuer');
  const before=h.run('JSON.stringify(DB)');
  await h.run('persist=async()=>false;saveSettings()');
  assert.equal(h.run('JSON.stringify(DB)'),before);
  assert.equal(h.run("document.getElementById('s_name').value"),'Unsaved new issuer');
  assert.equal(h.run("messages.some(m=>m.kind==='ok')"),false);
  await h.run("persist=async()=>{throw Error('Synthetic disk failure');};saveSettings()");
  assert.equal(h.run('JSON.stringify(DB)'),before);
});

test('failed customer edits preserve data and keep the form available for retry',async()=>{
  const h=setup();
  for(const id of ['c_name','c_contact','c_taxid','c_addr','c_email','c_phone','c_notes','c_lang'])h.field(id,id==='c_name'?'Unsaved buyer':'');
  h.field('c_wht','',true);
  const before=h.run('JSON.stringify(DB)');
  await h.run("persist=async()=>false;saveClient('client')");
  assert.equal(h.run('JSON.stringify(DB)'),before);
  assert.equal(h.run('closes'),0);
  assert.equal(h.run('renders'),0);
  assert.equal(h.run("messages.some(m=>m.kind==='ok')"),false);
  await h.run("persist=async()=>{throw Error('Synthetic disk failure');};saveClient('client')");
  assert.equal(h.run('JSON.stringify(DB)'),before);
  await h.run("persist=async()=>true;saveClient('client')");
  assert.equal(h.run('DB.clients[0].name'),'Unsaved buyer');
  assert.equal(h.run('closes'),1);
});

test('customer deletion false/rejected saves roll back before allowing retry',async()=>{
  const {run}=setup();const before=run('JSON.stringify(DB)');
  for(const failure of ['return false;',"throw Error('Synthetic disk failure');"]){
    await run(`persist=async()=>{${failure}};deleteClient('client')`);
    assert.equal(run('JSON.stringify(DB)'),before);
    assert.equal(run('closes'),0);
    assert.equal(run('renders'),0);
  }
  assert.equal(run("messages.some(m=>m.kind==='err')"),true);
  await run("persist=async()=>true;deleteClient('client')");
  assert.ok(run('DB.clients[0].deletedAt'));
  assert.equal(run('closes'),1);
});

test('retained deleted and voided documents prevent removal of referenced customer context',async()=>{
  const {run}=setup();
  for(const extra of [{deletedAt:'2020-01-01'},{voidedAt:'2020-01-01'},{archivedAt:'2020-01-01'}]){
    run(`DB.documents=[doc(${JSON.stringify(extra)})];`);const before=run('JSON.stringify(DB)');
    await run("deleteClient('client')");
    assert.equal(run('JSON.stringify(DB)'),before);
  }
  assert.equal(run('saves'),0);
});

test('customer deletion busy guard prevents a second staged delete during a slow write',async()=>{
  const {run}=setup();run("DB.clients.push({id:'other',name:'Other buyer'});");
  const before=run('JSON.stringify(DB)');
  const first=run("persist=()=>new Promise(resolve=>{globalThis.finish=resolve;});deleteClient('client')");
  assert.equal(await run("deleteClient('other')"),false);
  assert.equal(run('DB.clients[1].deletedAt'),undefined);
  run('finish(false)');await first;
  assert.equal(run('JSON.stringify(DB)'),before);
});

test('asset removal failures retain the original image and do not render success',async()=>{
  const {run}=setup();const before=run('JSON.stringify(DB)');
  for(const failure of ['return false;',"throw Error('Synthetic disk failure');"]){
    await run(`persist=async()=>{${failure}};removeAsset('logo')`);
    assert.equal(run('JSON.stringify(DB)'),before);
    assert.equal(run('renders'),0);
  }
  await run("persist=async()=>true;removeAsset('logo')");
  assert.equal(run('DB.business.logo'),'');
  assert.equal(run('renders'),1);
});

test('asset file selection persists once and restores prior image on failure',async()=>{
  const h=setup();const before=h.run('JSON.stringify(DB)');
  h.run("persist=async()=>false;pickAsset('logo')");
  h.created[0].files=[{name:'synthetic.png'}];h.created[0].onchange();
  h.readers[0].result='data:image/png;base64,U1lOVEhFVElD';
  await h.readers[0].onload();
  assert.equal(h.run('JSON.stringify(DB)'),before);
  assert.equal(h.run('renders'),0);
  h.run('persist=async()=>true;');await h.readers[0].onload();
  assert.equal(h.run('DB.business.logo'),'data:image/png;base64,U1lOVEhFVElD');
  assert.equal(h.run('renders'),1);
});

test('late image reads cannot overwrite a changed profile or race an issuance write',async()=>{
  for(const change of ["DB.business={...DB.business,businessName:'Later profile'};","issuanceBusy=true;","appClosing=true;"]){
    const h=setup();h.run("pickAsset('logo')");
    h.created[0].files=[{name:'synthetic.png'}];h.created[0].onchange();
    h.run(change);const before=h.run('JSON.stringify(DB)');h.readers[0].result='NEW_IMAGE';
    await h.readers[0].onload();
    assert.equal(h.run('JSON.stringify(DB)'),before);
    assert.equal(h.run('saves'),0);
  }
});

test('failed image reads and unsupported asset keys never mutate business data',async()=>{
  const h=setup();const before=h.run('JSON.stringify(DB)');
  h.run("pickAsset('taxId')");assert.equal(h.created.length,0);
  await h.run("removeAsset('taxId')");assert.equal(h.run('JSON.stringify(DB)'),before);
  h.run("pickAsset('signature')");h.created[0].files=[{name:'bad.png'}];h.created[0].onchange();h.readers[0].onerror();
  assert.equal(h.run('JSON.stringify(DB)'),before);
  assert.equal(h.run('saves'),0);
});
