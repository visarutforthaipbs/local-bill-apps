'use strict';
// Touch navigation reuses the existing renderer and document workflows.
Object.assign(I18N_EN,{
 'หน้าหลัก':'Home','เพิ่มเติม':'More','เมนู':'Navigation',
 'บันทึกในเครื่องนี้':'Saved on this device',
 'ต้นแบบมือถือ — ยังไม่เชื่อมข้อมูลข้ามเครื่อง':'Mobile prototype — cross-device data is not connected yet',
 'ใช้ Pro เดิมจาก App Store':'Use your existing App Store Pro',
 'กู้คืนการซื้อ':'Restore purchase','ซื้อ Pro ผ่าน App Store':'Buy Pro in the App Store',
 'ยังไม่มีราคาใน App Store':'App Store pricing is unavailable',
 'รออนุมัติการซื้อ':'Purchase approval is pending',
 'การซื้อถูกยกเลิก':'Purchase canceled',
 'กู้คืนแล้ว ไม่พบการซื้อ Pro':'Restore completed; no Pro purchase found',
 'ตรวจการซื้อไม่สำเร็จ ลองอีกครั้ง':'Could not verify the purchase. Try again.',
 'สำเนาสำรองในเครื่อง':'Local backup copies',
 'ข้อมูลยังอยู่ในเครื่องเดิม':'Your data stays on the original device',
 'เชื่อมข้อมูลข้ามเครื่องยังอยู่ระหว่างพัฒนา':'Cross-device connection is still in development'
 ,'ส่งให้แอปที่เลือกแล้ว':'Passed to the selected app','แชร์ PDF':'Share PDF','ส่งออกไฟล์ไม่สำเร็จ':'Could not export the file',
 'ส่งออก JSON เพื่อเก็บสำเนานอกแอปนี้':'Export JSON to keep a copy outside this app',
 'อ่านบนมือถือ · ไฟล์ PDF ใช้รูปแบบ A4':'Mobile reading view · PDF uses A4 layout',
 'สำเนาข้อมูลในเครื่อง':'On-device data copies',
 'เก็บสำเนาก่อนบันทึกข้อมูลที่เปลี่ยน เลือกสำเนาด้านล่างเพื่อกู้คืน':'A copy is kept before changed data is saved. Choose a copy below to restore.',
 'สร้างสำเนาในเครื่อง':'Create an on-device copy',
 'กู้คืนสำเนา {when}':'Restore copy from {when}',
 'ตัดการเชื่อมต่อ Google Drive ก่อนกู้คืนสำเนาในเครื่อง':'Disconnect Google Drive before restoring an on-device copy.',
 'ตารางเลื่อนได้':'Scrollable table',
 'ปิด':'Close',
 'เชื่อมต่อ Google Drive เพื่อใช้ข้อมูลร่วมกัน':'Connect Google Drive to share your workspace',
 'กู้คืนไม่สำเร็จ':'Could not restore the backup',
 'นำเข้าไฟล์สำรอง…':'Import backup file…',
 'ข้อมูลที่บันทึกไว้ในเครื่องนี้จะถูกแทนที่ด้วยข้อมูลในไฟล์สำรอง ไม่มีการรวมข้อมูลสองชุดเข้าด้วยกัน และจะเก็บสำเนาข้อมูลปัจจุบันไว้ก่อนกู้คืน':'Saved data on this device is replaced by the backup. The two data sets are never merged. A copy of current data is kept first.',
 'ไฟล์สำรองใหญ่เกิน 64MB':'Backup file is larger than 64 MB',
 'ไฟล์นี้ไม่ใช่สำเนาข้อมูล BillNgai ที่ถูกต้อง':'This file is not a valid BillNgai backup'
});
let mobileMore=false;
function mobileSyncNote(){return tr(syncV3Info.configured?(syncV3Info.connected?'ซิงก์ Google Drive':'เชื่อมต่อ Google Drive เพื่อใช้ข้อมูลร่วมกัน'):'เชื่อมข้อมูลข้ามเครื่องยังอยู่ระหว่างพัฒนา');}
window.addEventListener('billngaiProChanged',event=>{PRO=event.detail;render();});
const desktopRender=render,desktopSettings=renderSettings;
const desktopOpenModal=openModal;
function hideMobileUnavailable(container){
 // elImport is the reviewed mobile JSON backup import; importJSON/restoreLocalBackup stay unavailable.
 const selectors=['elCreate','elLink','elReveal','elRevealBackups','elUseDefault','importJSON','restoreLocalBackup','openAiSettings','deactivateLicense','attachReviewEvidence','exportReviewEvidence','evidenceBundle','exportAccountantZip','printDocument'];
 container.querySelectorAll('button[onclick]').forEach(button=>{if(selectors.some(name=>button.getAttribute('onclick').includes(name+'(')))button.hidden=true;});
}
function enhanceMobileForm(container){
 container.querySelectorAll('.field').forEach(field=>{
  const label=field.querySelector('label'),control=field.querySelector('input:not([type=checkbox]),select,textarea');
  if(label&&control&&control.id&&!label.querySelector('input'))label.htmlFor=control.id;
 });
 container.querySelectorAll('.x').forEach(button=>button.setAttribute('aria-label',tr('ปิด')));
 const contactTypes={c_email:'email',s_email:'email',c_phone:'tel',s_phone:'tel'};
 Object.entries(contactTypes).forEach(([id,type])=>{const e=container.querySelector('#'+id);if(e){e.type=type;e.autocapitalize='none';e.spellcheck=false;}});
 ['c_taxid','s_taxid'].forEach(id=>{const e=container.querySelector('#'+id);if(e)e.inputMode='numeric';});
 const split=container.querySelector('.split-rows');
 if(split){const labels=[...split.querySelectorAll('tr:first-child th')].map(th=>th.textContent.trim());split.querySelectorAll('tr:not(:first-child)').forEach((row,rowIndex)=>[...row.children].forEach((cell,index)=>{cell.dataset.mobileLabel=labels[index]||tr('ลบ');cell.querySelectorAll('input,button').forEach(control=>control.setAttribute('aria-label',(labels[index]||tr('ลบ'))+' '+(rowIndex+1)));}));}
}
function containMobileTables(container){
 container.querySelectorAll('table:not(.lines):not(.items-table):not(.split-rows)').forEach(table=>{
  if(table.parentElement.classList.contains('mobile-table-scroll'))return;
  if([...table.rows].some(row=>row.cells.length>3))table.classList.add('mobile-wide-table');
  const region=document.createElement('div');region.className='mobile-table-scroll';region.tabIndex=0;region.setAttribute('role','region');region.setAttribute('aria-label',tr('ตารางเลื่อนได้'));
  table.before(region);region.append(table);
 });
}
openModal=function(){const m=document.getElementById('modal');hideMobileUnavailable(m);enhanceMobileForm(m);containMobileTables(m);prepareMobilePaper();desktopOpenModal();observeMobileForm(m);};
// Opening a form should not summon the keyboard until the user chooses a field.
focusModal=function(){const m=document.getElementById('modal'),h=m.querySelector('.modal-head h3');if(h){h.id='modalTitle';m.setAttribute('aria-labelledby',h.id);}m.focus({preventScroll:true});};
const desktopSetAppInert=setAppInert;
setAppInert=function(on){desktopSetAppInert(on);const nav=document.getElementById('mobileNav');if(nav)nav.inert=on;};
function labelMobileItems(body){
 const labels=['รายละเอียด','จำนวน','หน่วย','ราคา/หน่วย','รวม','ลบ'];
 document.querySelectorAll(body+' tr').forEach((row,rowIndex)=>[...row.children].forEach((cell,index)=>{
  const label=tr(labels[index]||'รายการ');cell.dataset.mobileLabel=label;
  cell.querySelectorAll('input,button').forEach(control=>control.setAttribute('aria-label',label+' '+(rowIndex+1)));
 }));
}
const desktopDrawItems=drawItems,desktopDrawRecItems=drawRecItems;
drawItems=function(){desktopDrawItems();labelMobileItems('#itemsBody');};
drawRecItems=function(){desktopDrawRecItems();labelMobileItems('#recItemsBody');};
function prepareMobilePaper(){
 document.querySelectorAll('#content > .paper,#modal .modal-body > .paper').forEach(paper=>{
  const wrapper=document.createElement('section');wrapper.className='mobile-paper-preview';paper.before(wrapper);wrapper.append(paper);
  const headers=[...paper.querySelectorAll('table.lines th')].map(th=>th.textContent.trim());
  paper.querySelectorAll('table.lines tbody tr').forEach(row=>[...row.children].forEach((cell,index)=>{cell.dataset.mobileLabel=headers[index]||'';}));
  if(wrapper.parentElement.id==='content'){const note=document.createElement('p');note.className='mobile-preview-note';note.textContent=tr('อ่านบนมือถือ · ไฟล์ PDF ใช้รูปแบบ A4');wrapper.before(note);}
 });
}
let mobileFocusFrame;
function revealMobileFocus(){
 cancelAnimationFrame(mobileFocusFrame);
 mobileFocusFrame=requestAnimationFrame(()=>{
  const field=document.activeElement,formBody=field?.closest('.modal-body');if(!formBody)return;
  const body=document.documentElement.dataset.mobileLargeText==='true'?field.closest('#modal'):formBody;
  const b=body.getBoundingClientRect(),group=field.closest('.field'),g=group?.getBoundingClientRect();
  const f=g&&g.height<=b.height-16?g:field.getBoundingClientRect();
  if(f.bottom>b.bottom-8)body.scrollTop+=f.bottom-b.bottom+8;
  else if(f.top<b.top+8)body.scrollTop-=b.top-f.top+8;
 });
}
const mobileFormResize=new ResizeObserver(revealMobileFocus);
function observeMobileForm(modal){
 mobileFormResize.disconnect();
 const body=modal.querySelector('.modal-body');if(body)mobileFormResize.observe(body);
 revealMobileFocus();
}
function updateMobileViewport(){
 const viewport=window.visualViewport;
 const height=viewport?.height||innerHeight;
 document.documentElement.style.setProperty('--mobile-visual-height',height+'px');
 document.documentElement.style.setProperty('--mobile-visual-top',(viewport?.offsetTop||0)+'px');
 document.documentElement.classList.toggle('mobile-field-editing',height<500&&!!document.activeElement?.matches('input,textarea,select'));
 revealMobileFocus();
}
window.visualViewport?.addEventListener('resize',updateMobileViewport);
window.visualViewport?.addEventListener('scroll',updateMobileViewport);
window.addEventListener('resize',updateMobileViewport);updateMobileViewport();
document.addEventListener('focusin',updateMobileViewport);
document.addEventListener('focusout',()=>requestAnimationFrame(updateMobileViewport));
document.fonts.ready.then(revealMobileFocus);
const desktopDrawDocEditor=drawDocEditor,desktopDrawRecEditor=drawRecEditor;
drawDocEditor=function(){desktopDrawDocEditor();const m=document.getElementById('modal');enhanceMobileForm(m);observeMobileForm(m);};
drawRecEditor=function(){desktopDrawRecEditor();const m=document.getElementById('modal');enhanceMobileForm(m);observeMobileForm(m);};
// Keep native backup metadata and recovery capability truthful, including async renders.
loadBackupHistory=async function(){
 const el=document.getElementById('backupHist');if(!el)return;
 try{const list=await window.billingAPI.listBackups();if(!el.isConnected)return;
  el.innerHTML=list.length?list.map(b=>`<div class="mobile-status mobile-backup-row"><span>${escapeHtml(backupTimeLabel(b))}</span><span>${Math.max(1,Math.round(b.size/1024))} KB</span><button type="button" class="btn btn-sm" onclick="restoreBackupFile(${jsArg(b.name)})" aria-label="${attr(tr('กู้คืนสำเนา {when}').replace('{when}',backupTimeLabel(b)))}">${tr('กู้คืน')}</button></div>`).join(''):`<p class="hint">${tr('ยังไม่มีไฟล์สำรอง — จะถูกสร้างอัตโนมัติระหว่างใช้งาน')}</p>`;
 }catch(e){if(el.isConnected)el.textContent=tr('สำรองข้อมูลไม่สำเร็จ');}
};
// Local recovery never overwrites a connected cloud workspace.
restoreBackupFile=async function(name){
 try{
  const status=await window.billingAPI.syncV3Status();
  if(status.connected){toast(tr('ตัดการเชื่อมต่อ Google Drive ก่อนกู้คืนสำเนาในเครื่อง'),'err');return false;}
  if(!await askConfirm(tr('กู้คืนข้อมูลจากไฟล์สำรองนี้?'),{detail:tr('ข้อมูลปัจจุบันจะถูกสำรองไว้ให้ก่อนโดยอัตโนมัติ'),confirmLabel:tr('กู้คืน')}))return false;
  const text=await window.billingAPI.restoreBackup(name);
  adoptDatabase(JSON.parse(text));loadFailed=false;
  if(pendingDataUpgrade){render();return true;}
  if(!await persist(true))return false;
  render();toast(tr('กู้คืนข้อมูลแล้ว'),'ok');return true;
 }catch(error){
  toast(tr(String(error.message).includes('SYNC_DISCONNECT_REQUIRED')?'ตัดการเชื่อมต่อ Google Drive ก่อนกู้คืนสำเนาในเครื่อง':'กู้คืนไม่สำเร็จ:'),'err');return false;
 }
};
render=function(){
 desktopRender();
 if(currentView==='dashboard')document.getElementById('pageTitle').textContent=tr('หน้าหลัก');
 document.querySelectorAll('[onclick="savePDF()"]')?.forEach(button=>{button.innerHTML=ic('download')+' '+tr('แชร์ PDF');});
 if(currentView==='documents'){
  document.querySelectorAll('#topActions button').forEach(button=>{button.hidden=button.getAttribute('onclick')!=='newDocumentFromList()';});
  document.querySelectorAll('#content .audio-guide').forEach(guide=>guide.hidden=true);
  if(!activeDocs().some(d=>d.type==='tax_invoice')){const receipts=document.querySelector('#docTabs [data-f="receipt"]');if(receipts)receipts.textContent=tr('ใบเสร็จรับเงิน');}
 }
 if(mobileMore)renderMobileMore();
 prepareMobilePaper();containMobileTables(document.getElementById('content'));
 if(currentView==='docview'){const guide=document.querySelector('#content>.audio-guide');if(guide)document.getElementById('content').append(guide);}
 hideMobileUnavailable(document.getElementById('content'));
 hideMobileUnavailable(document.getElementById('topActions'));
 updateMobileNav();
};
const desktopSetView=setView;
setView=function(v){mobileMore=false;desktopSetView(v);updateMobileNav();};
function renderMobileMore(){
 document.getElementById('pageTitle').textContent=tr('เพิ่มเติม');
 document.getElementById('topActions').innerHTML='';
 const actions=[['settings','ตั้งค่า','settings'],['report','สรุปรายรับ','barChart'],['wht','หัก ณ ที่จ่าย (50 ทวิ)','receipt'],['recurring','รายการประจำ','fileText']];
 if((paymentReview().unansweredGroups||[]).length)actions.push(['legacy','ตรวจข้อมูลเดิม','fileText']);
 document.getElementById('content').innerHTML=`<div class="mobile-status">${ic(loadFailed||dirty?'alert':'check',16)} ${loadFailed||dirty?tr('หยุดบันทึกเพื่อป้องกันข้อมูลเดิม'):tr('บันทึกในเครื่องนี้')}</div><div class="card-block mobile-more">${actions.map(([v,label,icon])=>`<button class="btn" onclick="navTo('${v}')">${ic(icon)} ${tr(label)}</button>`).join('')}<button class="btn" onclick="openMobileArchive()">${ic('fileText')} ${tr('คลังเอกสาร')}</button><button class="btn" onclick="openUpgradeModal()">${tr('ใช้ Pro เดิมจาก App Store')}</button></div>${renderAudioGuide('first-bill')}<p class="mobile-stage">${mobileSyncNote()}</p>`;
}
function openMobileArchive(){setView('documents');openDocumentArchive();}
async function openMobileMore(){
 if(currentView==='settings'&&settingsDirty&&!await saveSettings())return;
 mobileMore=true;renderMobileMore();updateMobileNav();
}
function updateMobileNav(){
 const nav=document.getElementById('mobileNav');if(!nav)return;
 const active=mobileMore||['settings','report','filing','wht','legacy','corrections','recurring'].includes(currentView)?'more':currentView==='docview'?'documents':currentView;
 nav.querySelectorAll('button').forEach(b=>{
  if(b.dataset.mobileView===active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');
  b.querySelector('span').textContent=tr(b.dataset.label);
 });
}
renderSettings=function(c,ta){
 desktopSettings(c,ta);
 // Host capabilities deliberately do not expose desktop file paths or external licensing.
 hideMobileUnavailable(c);
 const history=c.querySelector('#backupHist');
 if(history){const block=history.closest('.card-block');block.innerHTML=`<h4>${tr('สำเนาข้อมูลในเครื่อง')}</h4><p class="desc">${tr('เก็บสำเนาก่อนบันทึกข้อมูลที่เปลี่ยน เลือกสำเนาด้านล่างเพื่อกู้คืน')}</p><div class="toolbar"><button class="btn" onclick="makeManualSnapshot()">${tr('สร้างสำเนาในเครื่อง')}</button><button class="btn" onclick="elImport()">${tr('นำเข้าไฟล์สำรอง…')}</button><button class="btn btn-primary" onclick="elExport()">${tr('ส่งออกไฟล์สำรอง…')}</button></div><div id="backupHist"></div><p class="hint">${lastBackupLine()}</p>`;loadBackupHistory();}
 c.querySelectorAll('details.card-block').forEach(card=>{const buttons=[...card.querySelectorAll('button[onclick]')];if(buttons.length&&buttons.every(button=>button.hidden))card.hidden=true;});
 enhanceMobileForm(c);
 const card=c.querySelector('.settings-panel')||c;
 const note=document.createElement('p');note.className='mobile-stage';note.textContent=mobileSyncNote();card.prepend(note);
};
openUpgradeModal=async function(){
 const m=document.getElementById('modal');
 m.innerHTML=`<div class="modal-head"><h3>${tr('ใช้ Pro เดิมจาก App Store')}</h3><div class="spacer"></div><button class="x" onclick="closeModal()">${ic('close')}</button></div><div class="modal-body"><p>${mobileSyncNote()}</p><p id="mobilePrice">${tr('ยังไม่มีราคาใน App Store')}</p><div class="toolbar"><button class="btn" onclick="mobilePurchase(true)">${tr('กู้คืนการซื้อ')}</button><button class="btn btn-primary" id="mobileBuy" disabled onclick="mobilePurchase(false)">${tr('ซื้อ Pro ผ่าน App Store')}</button></div></div>`;
 openModal();
 try{const result=await window.billingAPI.licenseStatus(true);PRO=result;const price=document.getElementById('mobilePrice');if(price)price.textContent=result.valid?tr('สถานะ Pro')+' · '+tr('ตลอดชีพ'):(result.verificationUnavailable?tr('ตรวจการซื้อไม่สำเร็จ ลองอีกครั้ง'):result.price||tr('ยังไม่มีราคาใน App Store'));const buy=document.getElementById('mobileBuy');if(buy)buy.disabled=!result.price||result.valid;}catch(e){}
};
async function mobilePurchase(restore){
 document.querySelectorAll('#modal button').forEach(b=>b.disabled=true);
 try{const result=await window.billingAPI[restore?'restorePro':'purchasePro']();PRO=result;
  if(result.valid){closeModal();render();toast(tr('สถานะ Pro'),'ok');}
  else{toast(tr(result.pending?'รออนุมัติการซื้อ':result.canceled?'การซื้อถูกยกเลิก':'กู้คืนแล้ว ไม่พบการซื้อ Pro'),'err');await openUpgradeModal();}
 }catch(e){toast(tr('ตรวจการซื้อไม่สำเร็จ ลองอีกครั้ง'),'err');await openUpgradeModal();}
}
// Existing desktop Pro can sign in before local PRO is known: native connect verifies
// Google identity and entitlement itself, so never gate on isPro() or fake PRO here.
connectSyncV3=async function(){
 if(!await askConfirm(tr('เชื่อมต่อ Google Drive?'),{detail:tr('ข้อมูลเอกสารเก็บใน Google Drive ของคุณ ทุกเครื่องที่ใช้บัญชีเดียวกันจะเห็นข้อมูลชุดเดียวกัน เครื่องนี้จะสำรองข้อมูลไว้ก่อนเชื่อมต่อ'),confirmLabel:tr('เชื่อมต่อ Google Drive')}))return;
 if(!await approveSyncProtocol())return;
 if(!await persist(true))return;
 try{syncV3Info=await window.billingAPI.syncV3Connect({approveProtocol:true});}
 catch(e){
  if(String(e.message)!=='SYNC_JOIN_REQUIRES_EMPTY_PROFILE'){toast(syncErrorText(e),'err');return;}
  if(!await askConfirm(tr('Google Drive นี้มีข้อมูล BillNgai อยู่แล้ว ใช้ข้อมูลจาก Drive แทนข้อมูลในเครื่องนี้ไหม?'),{detail:tr('ข้อมูลในเครื่องนี้จะถูกสำรองไว้ก่อน แล้วแทนที่ด้วยข้อมูลจาก Google Drive ไม่มีการรวมข้อมูลสองชุดเข้าด้วยกัน'),confirmLabel:tr('ใช้ข้อมูลจาก Drive'),danger:true}))return;
  try{syncV3Info=await window.billingAPI.syncV3Connect({approveProtocol:true,replaceLocal:true});}
  catch(error){toast(syncErrorText(error),'err');return;}
 }
 PRO=await window.billingAPI.licenseStatus();
 await runSyncV3(false);
};
savePDF=async function(){
 const d=getViewingDocument();if(!d)return false;
 if(documentOutputBlocked(d)){toast(documentBlockMessage(d),'err');return false;}
 const name=String(d.number||'document').replace(/[\/\\:*?"<>|]/g,'-')+'.pdf';
 try{await document.fonts.ready;applyPrintZoom();const result=await window.billingAPI.exportPDF(name,d.id);if(result)toast(tr('ส่งให้แอปที่เลือกแล้ว'),'ok');return !!result;}
 catch(e){toast(tr('บันทึก PDF ไม่สำเร็จ'),'err');return false;}
 finally{clearPrintZoom();}
};
downloadFile=async function(content,filename){
 try{const result=await window.billingAPI.exportFile(String(content),String(filename));if(result)toast(tr('ส่งให้แอปที่เลือกแล้ว'),'ok');return !!result;}
 catch(e){toast(tr('ส่งออกไฟล์ไม่สำเร็จ'),'err');return false;}
};
exportJSON=async function(){return elExport();};
// OS sharing does not certify that another app retained a recoverable backup.
elExport=async function(){
 try{const result=await window.billingAPI.exportData(JSON.stringify(exportableDB(),null,2));if(result)toast(tr('ส่งให้แอปที่เลือกแล้ว'),'ok');return !!result;}
 catch(e){toast(tr('ส่งออกไฟล์ไม่สำเร็จ'),'err');return false;}
};
lastBackupLine=function(){return tr('ส่งออก JSON เพื่อเก็บสำเนานอกแอปนี้');};
// JSON backup import: pick one file first, validate strictly, confirm the replace,
// and only then let the native strict guard swap storage. Nothing mutates before
// recoverData succeeds; cancel/status/validation/native failures never adopt or report success.
function mobileImportErrorText(error){
 const message=String(error&&error.message||error||'');
 if(message.includes('SYNC_DISCONNECT_REQUIRED')||message.includes('BOUND'))return tr('ตัดการเชื่อมต่อ Google Drive ก่อนกู้คืนสำเนาในเครื่อง');
 if(message.includes('TOO_LARGE')||message.includes('TOO LARGE'))return tr('ไฟล์สำรองใหญ่เกิน 64MB');
 if(/INVALID|SCHEMA|PARSE|FORMAT|MALFORMED/.test(message))return tr('ไฟล์นี้ไม่ใช่สำเนาข้อมูล BillNgai ที่ถูกต้อง');
 return tr('กู้คืนไม่สำเร็จ');
}
elImport=async function(){
 let text;
 try{text=await window.billingAPI.importData();}
 catch(error){toast(mobileImportErrorText(error),'err');return false;}
 if(text==null)return false;
 let parsed;
 try{parsed=JSON.parse(text);if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw Error('IMPORT_INVALID');}
 catch(error){toast(tr('ไฟล์นี้ไม่ใช่สำเนาข้อมูล BillNgai ที่ถูกต้อง'),'err');return false;}
 try{BillingData.validate(parsed,{strictLiveDocuments:true});}
 catch(error){toast(tr('ไฟล์นี้ไม่ใช่สำเนาข้อมูล BillNgai ที่ถูกต้อง'),'err');return false;}
 let status;
 try{status=await window.billingAPI.syncV3Status();}
 catch(error){toast(tr('กู้คืนไม่สำเร็จ:'),'err');return false;}
 if(status&&status.connected){toast(tr('ตัดการเชื่อมต่อ Google Drive ก่อนกู้คืนสำเนาในเครื่อง'),'err');return false;}
 if(!await askConfirm(tr('กู้คืนข้อมูลจากไฟล์สำรองนี้?'),{detail:tr('ข้อมูลที่บันทึกไว้ในเครื่องนี้จะถูกแทนที่ด้วยข้อมูลในไฟล์สำรอง ไม่มีการรวมข้อมูลสองชุดเข้าด้วยกัน และจะเก็บสำเนาข้อมูลปัจจุบันไว้ก่อนกู้คืน'),confirmLabel:tr('กู้คืน'),danger:true}))return false;
 try{
  await window.billingAPI.recoverData(text);
  // Read the acknowledged native result; it strips foreign binding and meta approval.
  adoptDatabase(JSON.parse(await window.billingAPI.load()));loadFailed=false;
  if(pendingDataUpgrade){render();return true;}
  if(!await persist(true))return false;
  render();toast(tr('กู้คืนข้อมูลแล้ว'),'ok');return true;
 }catch(error){toast(mobileImportErrorText(error),'err');return false;}
};
// Keep mobile operation lifetime independent of a desktop quit event.
let mobileDraftTimer=null;
document.addEventListener('input',e=>{
 if(!e.target.closest('#modal,.settings-panel'))return;
 clearTimeout(mobileDraftTimer);
 mobileDraftTimer=setTimeout(()=>{if(typeof autoSaveDraft==='function')autoSaveDraft();},400);
});
document.addEventListener('visibilitychange',()=>{if(document.hidden){stopAppAudio();autoSaveDraft();captureLegacyDraft();}});
const nav=document.createElement('nav');nav.id='mobileNav';nav.className='mobile-nav';nav.setAttribute('aria-label',tr('เมนู'));
nav.innerHTML='<div class="mobile-nav-brand"><img src="logo.svg" width="32" height="32" alt=""><strong>BillNgai</strong></div>'+[['dashboard','หน้าหลัก','dashboard'],['documents','เอกสาร','fileText'],['clients','ลูกค้า','users'],['more','เพิ่มเติม','settings']].map(([v,label,icon])=>`<button type="button" data-mobile-view="${v}" data-label="${label}" onclick="${v==='more'?'openMobileMore()':`navTo('${v}')`}">${ic(icon,20)}<span>${tr(label)}</span></button>`).join('');
document.body.append(nav);
nav.inert=!!document.querySelector('.app')?.inert;
updateMobileNav();
