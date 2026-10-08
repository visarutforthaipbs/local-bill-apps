'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {createEditorDraftController}=require('../web/mobile-editor-recovery.js');
function fixture(){
 const copies=new Map(),calls=[],database={clients:[],recurring:[],meta:{}};
 let counter=0,failSave=false,failRemove=false,saveGate=null;
 const api={
  editorDraftLoad:async key=>copies.get(key)||{text:null,revision:'empty'},
  editorDraftSave:async(key,text,expected)=>{
   calls.push(['save',key,text,expected]);if(saveGate)await saveGate;
   if(failSave)throw Error('CACHE_WRITE_FAILED');
   assert.equal(expected,(copies.get(key)||{revision:'empty'}).revision,'native optimistic revision');
   const revision='revision-'+(++counter);copies.set(key,{text,revision});return {revision};
  },
  editorDraftRemove:async(key,expected)=>{
   calls.push(['remove',key,expected]);if(failRemove)throw Error('CACHE_REMOVE_FAILED');
   assert.equal(expected,(copies.get(key)||{revision:'empty'}).revision);copies.delete(key);return {revision:'empty'};
  }
 };
 const readBase=(kind,id)=>id?JSON.stringify(database[kind==='client'?'clients':'recurring'].find(row=>row.id===id)||null):'null';
 let token=0;
 const controller=()=>createEditorDraftController({api,readBase,isCommitted:value=>database.meta.mobileEditorDraftCommits?.[value]===true,token:()=>'anonymous-'+(++token)});
 const open=(kind='client',id=null,value={name:''},scope='synthetic-workspace')=>controller().open({key:kind+':'+scope+':'+(id||'new'),kind,id,baseJSON:readBase(kind,id),value});
 return {api,database,copies,calls,controller,open,readBase,set failSave(value){failSave=value;},set failRemove(value){failRemove=value;},set saveGate(value){saveGate=value;}};
}
test('raw client fields survive a fresh controller and require explicit recovery',async()=>{
 const f=fixture(),raw={name:'  Synthetic name  ',address:'line one\nline two\n',email:'NOT-FINISHED@',defaultWht:false};
 const session=await f.open();await session.update(raw);
 const recovered=await f.open();assert.ok(recovered.pending);assert.equal(recovered.dirty,false);
 assert.throws(()=>recovered.update({name:'new attempt'}),/CHOICE_REQUIRED/);
 assert.deepEqual(recovered.restore(),raw);assert.equal(recovered.token,session.token);
 assert.equal(f.database.clients.length,0,'restoring scratch work never inserts a client');
});
test('recurring raw item actions and edited dates recover without coercion',async()=>{
 const f=fixture(),value={id:null,clientId:'synthetic',items:[{description:'',qty:'1.50',unit:'job',price:'0.10'},{description:'second',qty:'',unit:'',price:''}],frequency:'monthly',nextDate:'',whtRate:5,notes:'unfinished'};
 const session=await f.open('recurring',null,{id:null,items:[]});await session.update(value);
 const recovered=await f.open('recurring',null,{id:null,items:[]});assert.deepEqual(recovered.restore(),value);
 assert.equal(f.database.recurring.length,0);
});
test('edits arriving while an ACK is pending are serialized and the latest reversion is durable',async()=>{
 const f=fixture();let release;f.saveGate=new Promise(resolve=>release=resolve);
 const session=await f.open();const first=session.update({name:'typed'});const second=session.update({name:'latest'});const reverted=session.update({name:''});
 release();await Promise.all([first,second,reverted]);
 const stored=JSON.parse(f.copies.get(session.key).text);assert.deepEqual(stored.value,{name:''});
 assert.equal(f.calls.filter(call=>call[0]==='save').length,2,'coalesces intermediate edits without losing latest input');
});
test('failed native draft ACK does not advance revision or permit a DB commit',async()=>{
 const f=fixture(),session=await f.open();f.failSave=true;
 await assert.rejects(session.update({name:'still in the form'}),/CACHE_WRITE_FAILED/);assert.equal(session.revision,'empty');
 let saves=0;await assert.rejects(session.commit(f.database,async()=>{saves++;return true;}),/CACHE_WRITE_FAILED/);
 assert.equal(saves,0);assert.equal(session.value.name,'still in the form');assert.equal(session.committed,false);
 f.failSave=false;await session.flush();assert.equal(JSON.parse(f.copies.get(session.key).text).value.name,'still in the form');
});
test('stale original blocks recovery and subsequent save without overwriting saved data',async()=>{
 const f=fixture();f.database.clients=[{id:'existing',name:'saved',updatedAt:'first'}];
 const session=await f.open('client','existing',{name:'saved'});await session.update({name:'old unsaved edit'});
 f.database.clients[0].name='a different saved update';
 const recovered=await f.open('client','existing',{name:'a different saved update'});
 assert.equal(recovered.stale(),true);assert.throws(()=>recovered.restore(),/BASE_CHANGED/);
 await recovered.discard();assert.deepEqual(recovered.value,{name:'a different saved update'});
 assert.equal(f.database.clients[0].name,'a different saved update');
 const clean=await f.open('client','existing',{name:'a different saved update'});await clean.update({name:'new unsaved edit'});
 f.database.clients[0].updatedAt='changed again';let saves=0;
 await assert.rejects(clean.commit(f.database,async()=>{saves++;return true;}),/BASE_CHANGED/);assert.equal(saves,0);
});
test('failed shared validation/save rolls back its marker and retains recoverable work',async()=>{
 const f=fixture();f.database.meta.mobileEditorDraftCommits={previous:true};
 const session=await f.open();await session.update({name:'unfinished'});
 assert.equal(await session.commit(f.database,async()=>undefined),false,'shared validation can return undefined');
 assert.deepEqual(f.database.meta.mobileEditorDraftCommits,{previous:true});assert.equal(session.committed,false);
 assert.ok((await f.open()).pending);
 await assert.rejects(session.commit(f.database,async()=>{throw Error('DB_WRITE_FAILED');}),/DB_WRITE_FAILED/);
 assert.deepEqual(f.database.meta.mobileEditorDraftCommits,{previous:true});
});
test('new-record commit marker is included in the same DB transaction and suppresses duplicates after cleanup failure',async()=>{
 const f=fixture(),session=await f.open();await session.update({name:'Synthetic saved client'});f.failRemove=true;
 let disk=null;
 assert.equal(await session.commit(f.database,async()=>{
  assert.equal(f.database.meta.mobileEditorDraftCommits[session.token],true);
  f.database.clients.push({id:'new-record',name:session.value.name});disk=JSON.parse(JSON.stringify(f.database));return true;
 }),true);
 assert.equal(disk.meta.mobileEditorDraftCommits[session.token],true);assert.equal(session.committed,true);
 assert.ok(f.copies.has(session.key),'failed cleanup left the old scratch copy');
 const restarted=await f.open();assert.equal(restarted.pending,null,'committed scratch work is never offered as a new record');
 assert.equal(f.database.clients.length,1);assert.throws(()=>session.update({name:'duplicate'}),/ALREADY_COMMITTED/);
});
test('crash or UI exception after acknowledged DB save cannot roll back the durable commit marker',async()=>{
 const f=fixture(),session=await f.open();await session.update({name:'saved before UI failed'});f.failRemove=true;
 assert.equal(await session.commit(f.database,async()=>{
  f.database.clients.push({id:'saved',name:session.value.name});session.acknowledgeDB();throw Error('UI_RENDER_FAILED');
 }),true);
 assert.equal(f.database.meta.mobileEditorDraftCommits[session.token],true);assert.equal((await f.open()).pending,null);
});
test('explicit discard requires a native removal ACK and never changes saved records',async()=>{
 const f=fixture(),session=await f.open();await session.update({name:'unsaved'});const recovery=await f.open();
 f.failRemove=true;await assert.rejects(recovery.discard(),/CACHE_REMOVE_FAILED/);assert.ok(recovery.pending);
 f.failRemove=false;assert.deepEqual(await recovery.discard(),{name:''});assert.equal(recovery.pending,null);
 assert.equal(f.database.clients.length,0);assert.equal((await f.open()).pending,null);
});
test('workspace keys isolate native scratch copies and malformed or cross-record envelopes cannot restore',async()=>{
 const f=fixture(),session=await f.open('client',null,{name:''},'workspace-one');await session.update({name:'workspace one'});
 assert.equal((await f.open('client',null,{name:''},'workspace-two')).pending,null);
 f.copies.set('recurring:synthetic-workspace:new',{text:JSON.stringify({version:1,kind:'recurring',id:null,token:'foreign',baseJSON:'null',value:{id:'another-record',items:[]}}),revision:'malformed'});
 const other=await f.open('recurring',null,{id:null,items:[]});assert.equal(other.invalid,true);assert.throws(()=>other.restore(),/INVALID/);
 await other.discard();assert.equal(other.invalid,false);
 f.copies.set('client:synthetic-workspace:new',{text:'{broken',revision:'broken'});
 const broken=await f.open();assert.equal(broken.invalid,true);assert.throws(()=>broken.update({name:'would overwrite'}),/CHOICE_REQUIRED/);
});
test('rejected native load never creates an editable recovery session',async()=>{
 const f=fixture();f.api.editorDraftLoad=async()=>{throw Error('EDITOR_DRAFT_TOO_LARGE');};
 await assert.rejects(f.open(),/TOO_LARGE/);assert.equal(f.calls.length,0);assert.equal(f.database.clients.length,0);
});

// Run the actual mobile wrappers around the shared client save function. The DOM
// here models control lifetime, not geometry (covered by the native UI matrix).
function browserFixture(){
 const f=fixture(),elements=new Map(),listeners={},notices=[],events=[];
 const fields={name:'c_name',contactPerson:'c_contact',address:'c_addr',taxId:'c_taxid',email:'c_email',phone:'c_phone',docLang:'c_lang',defaultIncomeCategory:'c_incat',notes:'c_notes'};
 let saveDBGate=null,saveDBFails=false,anonymous=0,recRows=[];
 function element(id,value=''){
  const e={id,value:String(value),checked:false,disabled:false,dataset:{},style:{},isConnected:true,kind:'input',setAttribute(){},closest:selector=>selector==='#modal'?elements.get('modal'):null,remove(){elements.delete(this.id);this.isConnected=false;}};
  if(id)elements.set(id,e);return e;
 }
 const body={prepend:e=>elements.set(e.id,e)},foot={prepend:e=>elements.set(e.id,e)};
 elements.set('modal',element('modal'));
 const document={hidden:false,
  getElementById:id=>elements.get(id)||null,createElement:()=>element(''),
  querySelector:selector=>selector==='#modal .modal-body'?body:selector==='#modal .modal-foot'?foot:null,
  querySelectorAll:selector=>{
   if(selector==='#recItemsBody tr')return recRows;
   if(selector.includes('button[onclick="closeModal()"]'))return [...elements.values()].filter(e=>e.kind==='button'&&e.close&&e.disabled);
   if(selector.startsWith('#modal input'))return [...elements.values()].filter(e=>e.id.startsWith('c_')||e.id.startsWith('r_')||e.kind==='button');
   return [];
  },addEventListener:(name,fn)=>(listeners[name]||=[]).push(fn)
 };
 const context={document,DB:f.database,I18N_EN:{},crypto:{randomUUID:()=>`browser-anonymous-${++anonymous}`},JSON,Promise,console,
  billingAPI:{...f.api,isMobile:true,deviceId:async()=> 'synthetic-device'},
  tr:value=>value,escapeHtml:value=>String(value),toast:(...args)=>notices.push(args),askConfirm:async()=>true,
  localDraftScope:()=> 'synthetic-workspace',clientById:id=>f.database.clients.find(row=>row.id===id),
  issuanceBusy:false,pendingNewDocType:null,editRec:null,uid:()=>`client-${f.database.clients.length+1}`,touch:record=>record.updatedAt='synthetic-time',
  openClientEditor:id=>{
   const row=id?f.database.clients.find(row=>row.id===id):{};
   Object.entries(fields).forEach(([key,id])=>element(id,row[key]||''));const checkbox=element('c_wht');checkbox.checked=row.defaultWht!==false;
   const cancel=element('cancel');cancel.kind='button';cancel.close=true;const save=element('save');save.kind='button';
  },
  openRecurringEditor:id=>{
   context.editRec=id?JSON.parse(JSON.stringify(f.database.recurring.find(row=>row.id===id))):{id:null,clientId:'synthetic',project:'',frequency:'monthly',nextDate:'2026-10-03',active:true,items:[{description:'',qty:1,unit:'',price:0}],whtRate:3,vatRate:0,notes:''};
   context.drawRecEditor();
  },deleteClient:async()=>false,deleteRecurring:async()=>false,
  drawRecEditor:()=>{
   const row=context.editRec;element('recItemsBody');
   for(const [key,id] of Object.entries({clientId:'r_client',frequency:'r_freq',nextDate:'r_next',project:'r_proj',notes:'r_notes'}))element(id,row[key]||'');
   element('r_active').checked=row.active!==false;
   const cancel=element('cancel');cancel.kind='button';cancel.close=true;const save=element('save');save.kind='button';context.drawRecItems();
  },
  drawRecItems:()=>{recRows=context.editRec.items.map(item=>({querySelectorAll:()=>['description','qty','unit','price'].map(key=>({get value(){return String(item[key]??'');},set value(value){item[key]=value;}}))}));},
  drawRecLadder(){},recAddItem(){context.editRec.items.push({description:'',qty:1,unit:'',price:0});context.drawRecItems();},
  recDelItem(index){context.editRec.items.splice(index,1);if(!context.editRec.items.length)context.recAddItem();context.drawRecItems();},recSetWht(rate){context.editRec.whtRate=rate;},
  closeModal:()=>{events.push('closed');for(const [id,e] of elements){if(id!=='modal'){elements.delete(id);e.isConnected=false;}}},
  setView:v=>events.push('view:'+v),render:()=>events.push('render'),openDocEditor:type=>events.push('document:'+type),
  persist:async()=>{if(saveDBGate)await saveDBGate;events.push('db-ack');return !saveDBFails;},
  validDocumentDate:date=>/^\d{4}-\d{2}-\d{2}$/.test(date),parseDate:date=>new Date(date+'T12:00:00'),
 };
 context.window=context;
 const ctx=vm.createContext(context),renderer=fs.readFileSync(path.join(__dirname,'../../billing.html'),'utf8');
 vm.runInContext(renderer.slice(renderer.indexOf('async function saveClient(id){'),renderer.indexOf('async function deleteClient(id){')),ctx);
 vm.runInContext(renderer.slice(renderer.indexOf('async function saveRecurring(){'),renderer.indexOf('async function deleteRecurring(id){')),ctx);
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../web/mobile-editor-recovery.js'),'utf8'),ctx);
 return {...f,ctx,elements,events,notices,set saveDBGate(value){saveDBGate=value;},set saveDBFails(value){saveDBFails=value;},
  async input(id,value){const e=elements.get(id);e.value=value;for(const listener of listeners.input||[])listener({target:e});await ctx.mobileEditorRecovery.flush();},
  setNativeWriteFailure(value){f.failSave=value;},setNativeRemoveFailure(value){f.failRemove=value;}
 };
}
test('mobile Cancel waits for native scratch ACK and a failed ACK keeps the form open',async()=>{
 const b=browserFixture();assert.equal(await b.ctx.openClientEditor(),true);
 b.elements.get('c_name').value='Raw unfinished client';b.setNativeWriteFailure(true);
 assert.equal(await b.ctx.closeModal(),false);assert.ok(b.elements.has('c_name'));assert.equal(b.events.includes('closed'),false);
 assert.match(b.elements.get('mobileEditorDraftStatus').textContent,/เก็บงานค้างไม่สำเร็จ/);
 b.setNativeWriteFailure(false);assert.equal(await b.ctx.closeModal(),true);assert.equal(b.elements.has('c_name'),false);
 const stored=JSON.parse(b.copies.get('client:synthetic-device:synthetic-workspace:new').text);assert.equal(stored.value.name,'Raw unfinished client');
});
test('mobile reopen requires Restore/Discard and pending cancellation can open the editor again',async()=>{
 const b=browserFixture();await b.ctx.openClientEditor();await b.input('c_name','  Recover this client  ');await b.ctx.closeModal();
 await b.ctx.openClientEditor();assert.equal(b.ctx.mobileEditorRecovery.state().pending,true);assert.equal(b.elements.get('c_name').disabled,true);
 assert.equal(await b.ctx.saveClient(''),false);assert.equal(b.database.clients.length,0);
 assert.equal(await b.ctx.openClientEditor(),true,'closing a pending choice returns explicit success');
 assert.equal(b.ctx.mobileRestoreEditorDraft(),true);assert.equal(b.elements.get('c_name').value,'  Recover this client  ');assert.equal(b.elements.get('c_name').disabled,false);
 assert.equal(await b.ctx.saveClient(''),true);assert.equal(b.database.clients.length,1);assert.equal(b.database.clients[0].name,'Recover this client');
});
test('mobile Escape/close is blocked until the actual shared DB save acknowledges',async()=>{
 const b=browserFixture();await b.ctx.openClientEditor();await b.input('c_name','Save synthetic client');
 let release;b.saveDBGate=new Promise(resolve=>release=resolve);
 const saving=b.ctx.saveClient('');
 for(let i=0;i<10&&!b.ctx.issuanceBusy;i++)await Promise.resolve();
 assert.equal(b.ctx.issuanceBusy,true);assert.equal(await b.ctx.closeModal(),false);assert.ok(b.elements.has('c_name'));
 release();assert.equal(await saving,true);assert.equal(b.elements.has('c_name'),false);
 assert.ok(b.events.indexOf('db-ack')<b.events.indexOf('closed'));
});
test('shared DB rejection retains form/cache, rolls back client and anonymous marker, then retries once',async()=>{
 const b=browserFixture();await b.ctx.openClientEditor();await b.input('c_name','Retry synthetic client');b.saveDBFails=true;
 assert.equal(await b.ctx.saveClient(''),false);assert.ok(b.elements.has('c_name'));assert.equal(b.database.clients.length,0);
 assert.equal(b.database.meta.mobileEditorDraftCommits,undefined);assert.equal(b.ctx.mobileEditorRecovery.state().saving,false);
 b.saveDBFails=false;assert.equal(await b.ctx.saveClient(''),true);assert.equal(b.database.clients.length,1);
});
test('successful shared client save plus failed cleanup cannot offer a duplicate new client',async()=>{
 const b=browserFixture();await b.ctx.openClientEditor();await b.input('c_name','Only one synthetic client');b.setNativeRemoveFailure(true);
 assert.equal(await b.ctx.saveClient(''),true);assert.equal(b.database.clients.length,1);
 await b.ctx.openClientEditor();assert.equal(b.ctx.mobileEditorRecovery.state().pending,false);assert.equal(b.elements.get('c_name').value,'');
});
test('after-new-client document flow survives the asynchronous mobile editor wrapper',async()=>{
 const b=browserFixture();b.ctx.pendingNewDocType='invoice';await b.ctx.openClientEditor();await b.input('c_name','Document synthetic client');
 assert.equal(await b.ctx.saveClient(''),true);assert.ok(b.events.includes('document:invoice'));assert.equal(b.ctx.pendingNewDocType,null);
});
test('mobile recurring add/delete/WHT actions preserve raw items and actual shared save commits only once',async()=>{
 const b=browserFixture();await b.ctx.openRecurringEditor();b.ctx.editRec.items[0].description='Synthetic recurring service';b.ctx.editRec.items[0].price='1000.25';
 b.ctx.recAddItem();b.ctx.editRec.items[1].description='Second service';b.ctx.editRec.items[1].qty='1.50';b.ctx.editRec.items[1].price='20.10';b.ctx.recSetWht(5);
 await b.ctx.mobileEditorRecovery.flush();await b.ctx.closeModal();
 await b.ctx.openRecurringEditor();assert.equal(b.ctx.mobileEditorRecovery.state().pending,true);assert.equal(b.ctx.mobileRestoreEditorDraft(),true);
 assert.equal(b.ctx.editRec.items.length,2);assert.equal(b.ctx.editRec.items[1].qty,'1.50');assert.equal(b.ctx.editRec.whtRate,5);
 b.ctx.recDelItem(0);await b.ctx.mobileEditorRecovery.flush();assert.equal(await b.ctx.saveRecurring(),true);
 assert.equal(b.database.recurring.length,1);assert.equal(b.database.recurring[0].items.length,1);assert.equal(b.database.recurring[0].items[0].description,'Second service');
 assert.equal(b.database.recurring[0].anchorDay,3);assert.ok(b.events.includes('view:recurring'));
});
test('recurring validation failure keeps the cache and rolls back marker before a valid retry',async()=>{
 const b=browserFixture();await b.ctx.openRecurringEditor();b.ctx.editRec.items[0].description='Synthetic recurring';b.ctx.editRec.items[0].price='100';b.elements.get('r_next').value='';b.ctx.editRec.nextDate='';
 assert.equal(await b.ctx.saveRecurring(),false);assert.ok(b.elements.has('recItemsBody'));assert.equal(b.database.meta.mobileEditorDraftCommits,undefined);assert.equal(b.database.recurring.length,0);
 b.elements.get('r_next').value='2026-10-03';b.ctx.editRec.nextDate='2026-10-03';assert.equal(await b.ctx.saveRecurring(),true);assert.equal(b.database.recurring.length,1);
});
