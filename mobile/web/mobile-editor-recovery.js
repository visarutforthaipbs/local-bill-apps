'use strict';
// Native, device-local scratch work. Shared save functions remain the only DB writers.
(function(){
 const clone=value=>JSON.parse(JSON.stringify(value));
 function createEditorDraftController({api,readBase,isCommitted,token=()=>crypto.randomUUID(),onError=()=>{}}){
  const valid=(draft,kind,id)=>draft&&draft.version===1&&draft.kind===kind&&draft.id===id&&typeof draft.token==='string'&&draft.token.length<=128&&draft.token.length>0&&typeof draft.baseJSON==='string'&&draft.value&&typeof draft.value==='object'&&!Array.isArray(draft.value)&&(kind!=='recurring'||draft.value.id===id);
  function openLoaded({key,kind,id=null,baseJSON,value},loaded){
   if(typeof loaded?.revision!=='string')throw Error('EDITOR_DRAFT_INVALID_ACK');
   let cached=null,invalid=false;
   if(loaded.text){try{cached=JSON.parse(loaded.text);invalid=!valid(cached,kind,id);}catch(e){invalid=true;}}
   const committed=!invalid&&cached&&isCommitted(cached.token);
   const initial=clone(value);
   const s={key,kind,id,baseJSON,value:clone(value),token:token(),revision:loaded.revision,pending:committed?null:cached,invalid:!committed&&invalid,dirty:false,saving:false,committed:false,error:null};
   let acknowledged=null,inflight=null;
   const envelope=()=>({version:1,kind,id,token:s.token,baseJSON:s.baseJSON,value:clone(s.value)});
   function assertReady(){if(s.pending||s.invalid)throw Error('EDITOR_DRAFT_CHOICE_REQUIRED');if(s.committed)throw Error('EDITOR_DRAFT_ALREADY_COMMITTED');}
   function assertBase(){if(readBase(kind,id)!==s.baseJSON)throw Error('EDITOR_DRAFT_BASE_CHANGED');}
   s.stale=()=>!!(s.pending&&!s.invalid&&readBase(kind,id)!==s.pending.baseJSON);
   s.update=value=>{assertReady();if(s.saving)throw Error('EDITOR_DRAFT_BUSY');s.value=clone(value);s.dirty=s.dirty||JSON.stringify(s.value)!==JSON.stringify(initial);return s.flush();};
   s.flush=async()=>{
    assertReady();
    if(inflight)return inflight;
    inflight=(async()=>{
     while(s.dirty){
      const text=JSON.stringify(envelope());if(text===acknowledged)break;
      const result=await api.editorDraftSave(key,text,s.revision);
      if(typeof result?.revision!=='string')throw Error('EDITOR_DRAFT_INVALID_ACK');
      s.revision=result.revision;acknowledged=text;s.error=null;
     }
     return true;
    })();
    try{return await inflight;}catch(e){s.error=e;onError(e);throw e;}finally{inflight=null;}
   };
   s.restore=()=>{
    if(!s.pending||s.invalid)throw Error('EDITOR_DRAFT_INVALID');
    if(s.stale())throw Error('EDITOR_DRAFT_BASE_CHANGED');
    s.token=s.pending.token;s.baseJSON=s.pending.baseJSON;s.value=clone(s.pending.value);acknowledged=JSON.stringify(s.pending);
    s.pending=null;s.dirty=JSON.stringify(s.value)!==JSON.stringify(initial);return clone(s.value);
   };
   s.discard=async()=>{
    if(inflight)await inflight;
    const result=await api.editorDraftRemove(key,s.revision);
    if(typeof result?.revision!=='string')throw Error('EDITOR_DRAFT_INVALID_ACK');
    s.revision=result.revision;s.pending=null;s.invalid=false;s.error=null;s.value=clone(initial);s.token=token();s.dirty=false;acknowledged=null;
    return clone(initial);
   };
   s.commit=async(database,save)=>{
    assertReady();if(s.saving)return false;
    s.saving=true;
    let meta,previous,hadMarker=false,marked=false,dbAcknowledged=false;
    s.dbAcknowledged=false;s.acknowledgeDB=()=>{dbAcknowledged=true;s.dbAcknowledged=true;};
    function rollback(){if(hadMarker)meta.mobileEditorDraftCommits=previous;else delete meta.mobileEditorDraftCommits;}
    async function complete(){
     s.committed=true;s.dirty=false;
     try{const result=await api.editorDraftRemove(key,s.revision);if(typeof result?.revision==='string')s.revision=result.revision;}catch(e){onError(e);}
     return true;
    }
    try{
     await s.flush();assertBase();
     database.meta=database.meta||{};meta=database.meta;previous=meta.mobileEditorDraftCommits;
     hadMarker=Object.prototype.hasOwnProperty.call(meta,'mobileEditorDraftCommits');
     meta.mobileEditorDraftCommits={...(previous&&typeof previous==='object'&&!Array.isArray(previous)?previous:{}),[s.token]:true};marked=true;
     const result=await save();
     if(result!==true&&!dbAcknowledged){rollback();return false;}
     // The marker was part of the same acknowledged DB save. A failed cleanup must
     // never offer this scratch copy again or create a duplicate new record.
     return await complete();
    }catch(e){if(dbAcknowledged)return await complete();if(marked)rollback();s.error=e;onError(e);throw e;}
    finally{s.saving=false;}
   };
   return s;
  }
  return {open:async options=>openLoaded(options,await api.editorDraftLoad(options.key)),openLoaded};
 }
 if(typeof module!=='undefined'&&module.exports){module.exports={createEditorDraftController};return;}
 if(!window.billingAPI?.isMobile)return;
 Object.assign(I18N_EN,{
  'มีงานที่ยังไม่บันทึกในเครื่องนี้':'Unsaved work is available on this device',
  'เปิดงานค้าง':'Restore unsaved work',
  'ทิ้งงานค้าง':'Discard unsaved work',
  'ข้อมูลต้นทางเปลี่ยนแล้ว เปิดงานค้างทับไม่ได้':'The saved record changed. Unsaved work cannot overwrite it.',
  'อ่านงานค้างไม่สำเร็จ ลองเปิดอีกครั้ง':'Could not read unsaved work. Try opening again.',
  'เก็บงานค้างไม่สำเร็จ กรุณาลองอีกครั้งก่อนปิด':'Could not keep unsaved work. Try again before closing.',
  'ทิ้งงานค้างนี้?':'Discard this unsaved work?',
  'งานค้างไม่ใช่ข้อมูลที่บันทึกแล้ว':'Unsaved work is separate from the saved record',
  'กำลังเก็บงานค้าง…':'Keeping unsaved work…',
  'งานค้างจะเก็บในเครื่องนี้':'Unsaved work will be kept on this device',
  'งานค้างเก็บในเครื่องแล้ว ยังไม่บันทึกข้อมูลจริง':'Unsaved work kept on this device; the record is not saved yet',
  'เก็บงานที่ยังไม่บันทึกไว้แล้ว':'Unsaved work kept',
  'กรุณาเลือกเปิดหรือทิ้งงานค้างก่อน':'Restore or discard the unsaved work first',
  'ไฟล์งานค้างอ่านไม่ได้ เลือกทิ้งเพื่อเริ่มใหม่':'The unsaved copy cannot be read. Discard it to start again'
 });
 const clientFields={name:'c_name',contactPerson:'c_contact',address:'c_addr',taxId:'c_taxid',email:'c_email',phone:'c_phone',docLang:'c_lang',defaultIncomeCategory:'c_incat',notes:'c_notes'};
 const originals={openClientEditor,openRecurringEditor,saveClient,saveRecurring,deleteClient,deleteRecurring,closeModal,setView,persist};
 let active=null,opening=0,programmatic=false,captureRequest=0;
 const base=(kind,id)=>id?JSON.stringify((kind==='client'?DB.clients:DB.recurring).find(record=>record.id===id)||null):'null';
 const committed=token=>DB.meta?.mobileEditorDraftCommits?.[token]===true;
 function formPresent(session){return active===session&&!!document.getElementById(session.kind==='client'?'c_name':'recItemsBody');}
 function readValue(kind){
  if(kind==='client')return {...Object.fromEntries(Object.entries(clientFields).map(([key,id])=>[key,document.getElementById(id)?.value||''])),defaultWht:!!document.getElementById('c_wht')?.checked};
  const result=clone(editRec);
  for(const [key,id] of Object.entries({clientId:'r_client',frequency:'r_freq',nextDate:'r_next',project:'r_proj',notes:'r_notes'})){const input=document.getElementById(id);if(input)result[key]=input.value;}
  const vat=document.getElementById('r_vat');if(vat)result.vatRate=vat.value;
  const enabled=document.getElementById('r_active');if(enabled)result.active=enabled.checked;
  result.items=[...document.querySelectorAll('#recItemsBody tr')].map(row=>{const inputs=[...row.querySelectorAll('input')];return {description:inputs[0]?.value||'',qty:inputs[1]?.value||'',unit:inputs[2]?.value||'',price:inputs[3]?.value||''};});
  return result;
 }
 function applyValue(session,value){
  programmatic=true;
  try{if(session.kind==='client'){Object.entries(clientFields).forEach(([key,id])=>{const e=document.getElementById(id);if(e)e.value=value[key]??'';});const wht=document.getElementById('c_wht');if(wht)wht.checked=value.defaultWht!==false;}
   else{editRec=clone(value);drawRecEditor();}
  }finally{programmatic=false;}
 }
 function disableForm(session,on){
  if(!formPresent(session))return;
  document.querySelectorAll('#modal input,#modal select,#modal textarea,#modal .modal-foot button,#modal .x,#modal .items-table button,#modal [onclick^="recAddItem"],#modal #recWhtPills button').forEach(control=>{
   if(on){if(!control.disabled){control.dataset.mobileDraftDisabled='1';control.disabled=true;}}
   else if(control.dataset.mobileDraftDisabled){control.disabled=false;delete control.dataset.mobileDraftDisabled;}
  });
 }
 function renderChoice(session){
  if(!formPresent(session))return;
  document.getElementById('mobileEditorDraftChoice')?.remove();
  if(!session.pending&&!session.invalid)return;
  const box=document.createElement('div');box.id='mobileEditorDraftChoice';box.className='banner info';box.setAttribute('role','status');
  const stale=session.stale();
  box.innerHTML=`<span class="banner-text">${escapeHtml(tr(session.invalid?'ไฟล์งานค้างอ่านไม่ได้ เลือกทิ้งเพื่อเริ่มใหม่':stale?'ข้อมูลต้นทางเปลี่ยนแล้ว เปิดงานค้างทับไม่ได้':'มีงานที่ยังไม่บันทึกในเครื่องนี้'))}</span><button class="btn" onclick="mobileRestoreEditorDraft()" ${stale||session.invalid?'disabled':''}>${tr('เปิดงานค้าง')}</button><button class="btn" onclick="mobileDiscardEditorDraft()">${tr('ทิ้งงานค้าง')}</button>`;
  document.querySelector('#modal .modal-body')?.prepend(box);disableForm(session,true);
  // Keep cancellation available while the explicit recovery choice is pending.
  document.querySelectorAll('#modal button[onclick="closeModal()"]:disabled').forEach(button=>{button.disabled=false;delete button.dataset.mobileDraftDisabled;});
 }
 function status(session,message){
  if(!formPresent(session))return;
  let line=document.getElementById('mobileEditorDraftStatus');
  if(!line){line=document.createElement('p');line.id='mobileEditorDraftStatus';line.className='hint';line.style.flexBasis='100%';line.setAttribute('role','status');line.setAttribute('aria-live','polite');document.querySelector('#modal .modal-foot')?.prepend(line);}
  line.textContent=message;
 }
 function errorMessage(error){return tr(String(error?.message).includes('BASE_CHANGED')?'ข้อมูลต้นทางเปลี่ยนแล้ว เปิดงานค้างทับไม่ได้':String(error?.message).includes('CHOICE_REQUIRED')?'กรุณาเลือกเปิดหรือทิ้งงานค้างก่อน':'เก็บงานค้างไม่สำเร็จ กรุณาลองอีกครั้งก่อนปิด');}
 async function capture(session=active){
  if(!session||!formPresent(session)||session.saving||programmatic||session.pending||session.invalid)return true;
  const request=++captureRequest;status(session,tr('กำลังเก็บงานค้าง…'));
  try{const result=await session.update(readValue(session.kind));if(request===captureRequest)status(session,tr(session.dirty?'งานค้างเก็บในเครื่องแล้ว ยังไม่บันทึกข้อมูลจริง':'งานค้างจะเก็บในเครื่องนี้'));return result;}
  catch(e){if(request===captureRequest)status(session,errorMessage(e));toast(errorMessage(e),'err');return false;}
 }
 async function openEditor(kind,id,show){
  if(active&&!await closeModal())return false;
  const request=++opening;
  try{
   const scope=String(await window.billingAPI.deviceId())+':'+String(localDraftScope());
   const key=kind+':'+scope+':'+(id||'new');
   // Loading before the form opens prevents new typing from racing cached work.
   const loaded=await window.billingAPI.editorDraftLoad(key);
   if(request!==opening)return false;
   if(typeof loaded?.revision!=='string')throw Error('EDITOR_DRAFT_INVALID_ACK');
   show();
   if(!document.getElementById(kind==='client'?'c_name':'recItemsBody'))return false;
   // Reuse the read ACK without a second native read or a revision race.
   const session=createEditorDraftController({api:window.billingAPI,readBase:base,isCommitted:committed,token:()=>crypto.randomUUID()}).openLoaded({key,kind,id:id||null,baseJSON:base(kind,id),value:readValue(kind)},loaded);
   active=session;renderChoice(session);status(session,tr(session.pending||session.invalid?'กรุณาเลือกเปิดหรือทิ้งงานค้างก่อน':'งานค้างจะเก็บในเครื่องนี้'));return true;
  }catch(e){toast(tr('อ่านงานค้างไม่สำเร็จ ลองเปิดอีกครั้ง'),'err');return false;}
 }
 openClientEditor=function(id){return openEditor('client',id,()=>originals.openClientEditor(id));};
 openRecurringEditor=function(id){return openEditor('recurring',id,()=>originals.openRecurringEditor(id));};
 window.mobileRestoreEditorDraft=function(){
  const session=active;if(!session||session.uiBusy||session.closing)return false;
  try{const value=session.restore();disableForm(session,false);document.getElementById('mobileEditorDraftChoice')?.remove();applyValue(session,value);status(session,tr('งานค้างเก็บในเครื่องแล้ว ยังไม่บันทึกข้อมูลจริง'));return true;}
  catch(e){toast(errorMessage(e),'err');renderChoice(session);return false;}
 };
 window.mobileDiscardEditorDraft=async function(){
  const session=active;if(!session||session.uiBusy||session.closing)return false;session.uiBusy=true;
  try{if(!await askConfirm(tr('ทิ้งงานค้างนี้?'),{detail:tr('งานค้างไม่ใช่ข้อมูลที่บันทึกแล้ว'),confirmLabel:tr('ทิ้งงานค้าง'),danger:true}))return false;
   const value=await session.discard();if(!formPresent(session))return false;disableForm(session,false);document.getElementById('mobileEditorDraftChoice')?.remove();applyValue(session,value);status(session,tr('งานค้างจะเก็บในเครื่องนี้'));return true;
  }catch(e){status(session,errorMessage(e));toast(errorMessage(e),'err');return false;}
  finally{session.uiBusy=false;}
 };
 closeModal=function(){
  ++opening;const session=active;
  if(!session)return originals.closeModal();
  if(session.uiBusy){if(session.saving&&session.dbAcknowledged){active=null;return originals.closeModal()!==false;}return false;}
  if(session.closing)return false;
  if(session.pending||session.invalid){active=null;return originals.closeModal()!==false;}
  return (async()=>{
   session.closing=true;
   disableForm(session,true);
   if(!await capture(session)){session.closing=false;disableForm(session,false);return false;}
   if(active!==session)return false;
   active=null;editRec=null;originals.closeModal();
   if(session.dirty)toast(tr('เก็บงานที่ยังไม่บันทึกไว้แล้ว'),'ok');
   return true;
  })();
 };
 setView=function(v){++opening;return originals.setView(v);};
 async function save(kind,action,args){
  const session=active;if(!session||session.kind!==kind)return action(...args);
  if(session.uiBusy||session.closing)return false;
  if(session.pending||session.invalid){toast(tr('กรุณาเลือกเปิดหรือทิ้งงานค้างก่อน'),'err');return false;}
  session.uiBusy=true;
  disableForm(session,true);
  try{
   if(!await capture(session)||!formPresent(session))return false;
   const result=await session.commit(DB,()=>action(...args));
   if(result===true&&active===session)active=null;
   return result;
  }catch(e){toast(errorMessage(e),'err');return false;}
  finally{session.uiBusy=false;if(active===session)disableForm(session,false);}
 }
 persist=async function(...args){const session=active,result=await originals.persist(...args);if(result===true&&session?.saving&&DB.meta?.mobileEditorDraftCommits?.[session.token]===true)session.acknowledgeDB();return result;};
 saveClient=function(...args){return save('client',originals.saveClient,args);};
 saveRecurring=function(...args){return save('recurring',originals.saveRecurring,args);};
 deleteClient=function(...args){return save('client',originals.deleteClient,args);};
 deleteRecurring=function(...args){return save('recurring',originals.deleteRecurring,args);};
 document.addEventListener('input',event=>{if(event.target.closest('#modal')&&active)void capture();});
 document.addEventListener('change',event=>{if(event.target.closest('#modal')&&active)void capture();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&active)void capture();});
 for(const name of ['recAddItem','recDelItem','recSetWht']){
  const original=window[name];window[name]=function(...args){const result=original(...args);if(active?.kind==='recurring')void capture();return result;};
 }
 window.mobileEditorRecovery=Object.freeze({flush:()=>capture(),state:()=>active?{kind:active.kind,id:active.id,dirty:active.dirty,pending:!!active.pending||active.invalid,stale:active.stale(),saving:active.saving}:null});
})();
