// Explicit DEBUG entry point, on isolated synthetic simulator or physical QA profiles only.
if (!DB.meta?.mobileSynthetic) throw Error('UI audit requires the isolated synthetic profile');
if(auditScreen==='backupImport'){
 if(DB.syncV3)throw Error('Import test requires the isolated unbound profile');
 const S=window.BillNgaiSyncCore.S,B=window.BillNgaiSyncCore.B;
 const before=JSON.parse(await billingAPI.load()),selected=structuredClone(before);
 selected.clients[0].notes='Synthetic native file import checked';selected.meta.protocolUpgradeApproved=true;
 selected.meta.importUnknown={keep:true};selected.syncV3=S.initial('synthetic_foreign_account');selected.syncV3.records=B.flatten(selected);
 const text=JSON.stringify(selected),facts=S.canonical({documents:before.documents,reviewEvents:before.reviewEvents});
 return await new Promise((resolve,reject)=>{
  let cancels=0;const timeout=setTimeout(()=>reject(Error('Physical import interaction timed out')),600000);
  window.qaExportImportFixture=()=>billingAPI.exportFile(text,'BillNgai-synthetic-import.json');
  window.qaImportFixture=async()=>{
   try{
    if(!await elImport()){
     if(S.canonical(JSON.parse(await billingAPI.load()))!==S.canonical(before))throw Error('Canceled import changed stored data');
     cancels++;return;
    }
    const saved=JSON.parse(await billingAPI.load());
    if(saved.syncV3||saved.meta.protocolUpgradeApproved||!saved.meta.importUnknown?.keep)throw Error('Native import binding/unknown-field handling failed');
    if(saved.clients[0].notes!==selected.clients[0].notes||S.canonical({documents:saved.documents,reviewEvents:saved.reviewEvents})!==facts)throw Error('Imported facts mismatch');
    const copies=await billingAPI.listBackups();if(!copies.some(b=>b.name.startsWith('pre-restore-')&&b.name.endsWith('.json')))throw Error('Import safety backup missing');
    clearTimeout(timeout);resolve({screen:auditScreen,nativeFileImport:true,cancels,financialDocumentsUnchanged:true,foreignBindingRemoved:true,approvalRemoved:true,unknownFieldsPreserved:true,preRestoreCopy:true,nativeAccessibility:await billingAPI.accessibilityStatus()});
   }catch(error){clearTimeout(timeout);reject(error);}
  };
  document.getElementById('content').innerHTML='<div class="card-block"><h3>Synthetic backup import check</h3><div class="toolbar"><button class="btn" onclick="qaExportImportFixture()">Export synthetic file</button><button class="btn btn-primary" onclick="qaImportFixture()">Import synthetic file</button></div></div>';
 });
}
// Explicit synthetic profile only: exercise the real UI/native backup-first restore.
if(auditScreen==='backupRestore'){
 if(DB.syncV3)throw Error('Backup recovery test must use the isolated unbound profile');
 const before=window.BillNgaiSyncCore.S.canonical({clients:DB.clients,documents:DB.documents,recurring:DB.recurring,reviewEvents:DB.reviewEvents});
 const name=await billingAPI.snapshotBackup('qa-restore');if(!name)throw Error('Native checkpoint missing');
 DB.clients[0].notes='Synthetic later edit to restore';if(!await persist(true))throw Error('Synthetic edit failed');
 const timer=setInterval(()=>{if(document.getElementById('confirmOverlay').classList.contains('open'))settleConfirm(true);},25);
 let restored;try{restored=await restoreBackupFile(name);}finally{clearInterval(timer);}
 if(!restored)throw Error('Native UI restore failed');
 const after=window.BillNgaiSyncCore.S.canonical({clients:DB.clients,documents:DB.documents,recurring:DB.recurring,reviewEvents:DB.reviewEvents});
 if(before!==after)throw Error('Restored records changed');
 const copies=await billingAPI.listBackups();if(!copies.some(b=>b.name.startsWith('pre-restore-')&&b.name.endsWith('.json')))throw Error('Pre-restore safety copy missing');
 return {screen:auditScreen,restored:true,originalRecordsRetained:true,preRestoreCopy:true,nativeAccessibility:await billingAPI.accessibilityStatus()};
}
// Live transport checks stay in the existing DEBUG-only synthetic audit bundle.
// Unbound synthetic profile only: a newly issued original keeps its images once, through the
 // real native store and validator.
 if(auditScreen==='storedImages'){
  if(DB.syncV3)throw Error('Stored-image check requires the unbound synthetic profile');
  const draw=(w,h,label)=>{const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');g.fillStyle='#ff6a00';g.fillRect(0,0,w,h);g.fillStyle='#fff';g.font='bold 40px sans-serif';g.fillText(label,10,60);return c.toDataURL('image/png');};
  if(!await saveBusinessAsset('logo',draw(300,120,'LOGO'))||!await saveBusinessAsset('signature',draw(240,90,'SIGN')))throw Error('Synthetic image save failed');
  const id='stored_images_'+Date.now();
  const d={id,type:'receipt',number:null,clientId:DB.clients[0].id,issueDate:todayISO(),paidDate:todayISO(),status:'issued',currency:'THB',vatRate:0,whtRate:3,whtReviewed:true,fullPaymentConfirmed:true,issueConfirmed:true,items:[{description:'Synthetic stored image check',qty:1,price:100}]};
  if(!await persistDocumentMutation(d,null))throw Error('Synthetic issue failed');
  const stored=JSON.parse(await billingAPI.load()),saved=stored.documents.find(x=>x.id===id);
  if(!saved)throw Error('Issued document missing from the native store');
  const b=saved.issuedSnapshot.business;viewDoc(id);await new Promise(resolve=>setTimeout(resolve,600));
  const images=[...document.querySelectorAll('.paper img')].map(i=>i.complete&&i.naturalWidth>0);
  return {screen:auditScreen,references:[b.logo,b.signature].every(v=>/^asset:[a-f0-9]{64}$/.test(v)),storedImages:Object.keys(stored.assets||{}).length,documentBytes:JSON.stringify(saved).length,embeddedCopies:JSON.stringify(saved).includes('data:image'),imagesShown:images.length===2&&images.every(Boolean),number:saved.number,nativeAccessibility:await billingAPI.accessibilityStatus()};
 }
if (['syncPull','syncEdit','syncProStatus','syncAppleGrant','syncAuthorize','syncRestore','syncReviewResolve'].includes(auditScreen)) {
 await closeModal();clearDraft();
 const native=window.Capacitor.registerPlugin('BillNgaiNative');
 if(auditScreen==='syncProStatus')return {screen:auditScreen,nativePro:await native.licenseStatus({includePrice:true}),cloud:await billingAPI.licenseStatus()};
 if(auditScreen==='syncAuthorize'){await native.syncAuthorize();return {screen:auditScreen,authorized:true};}
 if(auditScreen==='syncAppleGrant')return {screen:auditScreen,grant:await native.syncVerifyPro()};
 if(auditScreen==='syncRestore')return {screen:auditScreen,ownership:await native.restorePro(),grant:await native.syncVerifyPro()};
 if(!DB.syncV3)throw Error('Live sync check requires a connected synthetic workspace');
 if(auditScreen==='syncReviewResolve'){
  const pulled=await billingAPI.syncV3Run({});adoptDatabase(JSON.parse(pulled.text));
  const i=DB.documents.find(d=>d.type==='invoice'),r=DB.documents.find(d=>d.type==='receipt');
  const key='legacy-parent:'+i.id,heads=['live_control_answer','live_pc_answer'];
  const before=BillingData.resolveReviews(DB.reviewEvents,key,[i,r],[r.id]);
  if(before.status!=='conflict'||JSON.stringify(before.heads)!==JSON.stringify(heads))throw Error('Expected live review conflict missing');
  DB.reviewEvents.push({id:'live_phone_resolution',type:'legacy_group_review',documentId:i.id,groupKey:key,sourceRecords:structuredClone([i,r]),decision:'same_payment',representativeId:r.id,ownerConfirmed:true,note:'Synthetic phone explicitly resolves both concurrent answers',recordedAt:new Date().toISOString(),supersedes:heads});
  if(!await persist(true))throw Error('Native review resolution save failed');
 }
 if(auditScreen==='syncEdit'){
  const client=DB.clients.find(c=>c.id==='qa_client');if(!client)throw Error('Expected synthetic client missing');
  client.notes='Physical iPhone live sync edit';touch(client);if(!await persist(true))throw Error('Physical sync edit failed');
 }
 const result=await billingAPI.syncV3Run({});adoptDatabase(JSON.parse(result.text));
 const S=window.BillNgaiSyncCore.S,B=window.BillNgaiSyncCore.B;
 const i=DB.documents.find(d=>d.type==='invoice'),r=DB.documents.find(d=>d.type==='receipt');
 return {screen:auditScreen,mode:DB.syncV3.mode,cursor:DB.syncV3.cursor,clients:DB.clients.length,documents:DB.documents.length,recurring:DB.recurring.length,reviewResolution:BillingData.resolveReviews(DB.reviewEvents,'legacy-parent:'+i.id,[i,r],[r.id]),income:realizedDocs().reduce((sum,d)=>sum+compute(d).netPayable,0),conflicts:Object.keys(DB.syncV3.conflicts).length,intents:Object.keys(DB.syncV3.intents).length,pending:!!DB.syncV3.pending,digest:S.digest(B.flatten(DB)),nativeAccessibility:await native.accessibilityStatus()};
}
await closeModal(); clearDraft();
DB.business.uiLang = auditLanguage;
const pause = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
const receipt = DB.documents.find(d => d.type === 'receipt');
let keyboardBaseline=null,upgradeResult=null;
function longDocument(type,lang){
 const original=receipt.issuedSnapshot;
 const d=structuredClone(original.document);delete d.issuedSnapshot;
 Object.assign(d,{id:'qa_long_'+type,number:'SYNTHETIC-DOCUMENT-IDENTIFIER-WITHOUT-SPACES-00001',type,status:type==='receipt'?'issued':'sent',docLang:lang,project:'Synthetic project '.repeat(12),items:Array.from({length:6},(_,i)=>({description:'Synthetic service '+i+' '+('LongDescriptionWithoutSpaces').repeat(4),qty:2,unit:'long synthetic unit',price:123456.78})),notes:'Synthetic note '.repeat(15)});
 const business={...original.business,businessName:'SyntheticBusinessWithoutSpaces'.repeat(3),businessNameEn:'SyntheticBusinessWithoutSpaces'.repeat(3),bankName:'Synthetic bank',bankAccount:'0000000000',bankAccountName:'Synthetic studio',promptpayId:'0810000000'};
 const buyer={...original.buyer,name:'SyntheticClientWithoutSpaces'.repeat(3),address:'Synthetic address '.repeat(12)};
 freezeIssuedDocument(d,{business,buyer,docLang:lang,yearMode:original.yearMode});
 DB.documents.push(d);return d;
}
const screens = {
 legacyUpgrade: async () => {
  const original=JSON.stringify(DB.documents),legacy=structuredClone(DB);legacy.version=2;delete legacy.meta.reviewSemanticsVersion;
  await billingAPI.recoverData(JSON.stringify(legacy));adoptDatabase(legacy);render();
  if(!pendingDataUpgrade||await persist(true)!==false)throw Error('Legacy upgrade gate missing');
  const backups=(await billingAPI.listBackups()).length;
  if(!await approveDataUpgrade()||pendingDataUpgrade)throw Error('Legacy activation failed');
  const saved=JSON.parse(await billingAPI.load());
  if(saved.meta.reviewSemanticsVersion!==3||JSON.stringify(saved.documents)!==original)throw Error('Legacy documents changed');
  const after=(await billingAPI.listBackups()).length;
  if(after<=backups)throw Error('Legacy activation backup missing');
  upgradeResult={backupCreated:true,originalDocumentsPreserved:true,activatedVersion:3};
  setView('documents');
 },
 client: async () => { setView('clients'); await openClientEditor('qa_client'); },
 clientKeyboard: async () => {
  setView('clients');await openClientEditor('qa_client');await document.fonts.ready;await pause();
  keyboardBaseline={height:innerHeight,visualHeight:visualViewport?.height||innerHeight};
  const host=document.documentElement.dataset.mobileLargeText==='true'?document.getElementById('modal'):document.querySelector('.modal-body');const notes=document.getElementById('c_notes');for(let d=notes.closest('details');d;d=d.parentElement.closest('details'))d.open=true;host.scrollTop=100000;notes.focus();
  // WKWebView may require a real user tap to present its software keyboard.
  for(let i=0;i<50&&(visualViewport?.height||innerHeight)>keyboardBaseline.visualHeight-100;i++)await new Promise(resolve=>setTimeout(resolve,400));
  await new Promise(resolve=>setTimeout(resolve,500));
 },
 editor: () => { setView('documents'); openDocEditor('quotation'); },
 receipt: () => viewDoc(receipt.id),
 receiptNative: () => viewDoc(receipt.id),
 receiptLong: () => viewDoc(longDocument('receipt','bilingual').id),
 invoiceLong: () => viewDoc(longDocument('invoice','en').id),
 quotationLong: () => viewDoc(longDocument('quotation','th').id),
 correctedPreview: () => {const d=longDocument('receipt','bilingual');document.getElementById('modal').innerHTML=`<div class="modal-head"><h3>Corrected receipt preview</h3></div><div class="modal-body">${d.issuedSnapshot.renderedHtml}</div><div class="modal-foot"><button class="btn" onclick="closeModal()">${tr('กลับ')}</button></div>`;openModal();},
 confirm: async () => {setView('clients');await openClientEditor('qa_client');askConfirm('Synthetic confirmation',{confirmLabel:tr('ยืนยัน')});},
 recurring: async () => { setView('recurring'); await openRecurringEditor(); },
 split: () => {
  const q = {...DB.documents.find(d => d.type === 'invoice'),id:'qa_split',type:'quotation',status:'accepted',issuedSnapshot:null,number:'QT-SYNTHETIC'};
  DB.documents.push(q); setView('documents'); openSplitDialog(q.id);
 },
 more: () => openMobileMore(),
 settings: () => { settingsTab='data'; setView('settings'); },
 settingsBusiness: () => {const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9XkAAAAASUVORK5CYII=';Object.assign(DB.business,{logo:image,signature:image,stamp:image});settingsTab='business';setView('settings');},
 dashboard: () => setView('dashboard'),
 documents: () => setView('documents'),
 clients: () => setView('clients'),
 report: () => setView('report'),
 wht: () => setView('wht')
};
if(!screens[auditScreen]) throw Error('Unknown audit screen');
await screens[auditScreen](); await document.fonts.ready; await pause();
await window.mobilePrintPreview?.ready();await pause();
if(auditScreen==='receiptNative'){
 const opened=await window.mobilePrintPreview.zoom();
 const state=await window.Capacitor.registerPlugin('BillNgaiNative').qaPrintPreviewStatus();
 const violations=[];
 if(!opened||!state.nativeViewer||!state.presented)violations.push('Native PDF viewer did not open');
 if(state.viewer.pages!==1||!state.viewer.title.startsWith('A4')||state.viewer.maxScale<=state.viewer.minScale)violations.push('Native PDF fit/zoom missing');
 if(state.viewer.canvas[0]<.9||state.viewer.canvas[1]<.9)violations.push('Native viewer did not retain the approved canvas');
 return {auditScreen,auditLanguage,violations,nativePDF:state};
}
document.getAnimations().forEach(animation=>animation.finish());
await pause();
// Let any asynchronous local-backup cards settle before measuring Settings.
if(auditScreen==='settings') { await loadBackupHistory(); await pause(); }
const box = e => {const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
const visible = e => {const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(e).visibility!=='hidden';};
const violations = [];
if(['client','editor','recurring','split','correctedPreview'].includes(auditScreen)&&!document.querySelector('.overlay.open .modal-body'))violations.push('Expected form did not open');
if(['receipt','receiptLong','invoiceLong','quotationLong'].includes(auditScreen)&&!document.querySelector('#content .paper'))violations.push('Expected document did not open');
const viewport = {width:innerWidth,height:innerHeight,visualHeight:visualViewport?.height,visualTop:visualViewport?.offsetTop,pageTop:visualViewport?.pageTop,scrollTop:document.scrollingElement.scrollTop,overlay:box(document.getElementById('overlay')),overlayTop:getComputedStyle(document.getElementById('overlay')).top};
let focusedField=null;
if(auditScreen==='clientKeyboard'){
 const control=document.getElementById('c_notes'),field=box(control),body=box(document.documentElement.dataset.mobileLargeText==='true'?document.getElementById('modal'):document.querySelector('.modal-body')),group=box(control.closest('.field'));
 focusedField={field,body,group};
 if((visualViewport?.height||innerHeight)>=keyboardBaseline.visualHeight-100)violations.push('Software keyboard was not opened');
 if(field.y<body.y-1||field.bottom>body.bottom+1)violations.push('Focused field obscured by keyboard');
 if(group.height<body.height-16&&(group.y<body.y-1||group.bottom>body.bottom+1))violations.push('Focused field label obscured by keyboard');
}
if(document.documentElement.scrollWidth>document.documentElement.clientWidth+1)violations.push('Page overflows horizontally');
if(auditScreen==='dashboard'&&[...document.querySelectorAll('.pillar .val')].some(e=>e.scrollWidth>e.clientWidth+1))violations.push('Dashboard amount is clipped');
if(auditScreen==='dashboard'&&[...document.querySelectorAll('.pillar .val')].some(e=>parseFloat(getComputedStyle(e).fontSize)>44.1))violations.push('Dashboard amount exceeded its readable fit range');
if([...document.querySelectorAll('.field input,.field select,.field textarea')].filter(visible).some(e=>box(e).right>box(e.closest('.field')).right+1))violations.push('Form control exceeds its field');
let modal = null;
if(document.querySelector('.overlay.open')) {
 const m=document.getElementById('modal'),b=m.querySelector('.modal-body'),f=m.querySelector('.modal-foot');
 if(b&&f) {
  const wholeModal=document.documentElement.dataset.mobileLargeText==='true',scrollHost=wholeModal?m:b;
  if(auditScreen!=='clientKeyboard')scrollHost.scrollTop=scrollHost.scrollHeight;
  await pause();
  const mr=box(m),br=box(b),fr=box(f);
  modal={panel:mr,body:br,footer:fr,bodyScrollHeight:b.scrollHeight,bodyClientHeight:b.clientHeight,wholeModal,scrollTop:scrollHost.scrollTop,scrollHeight:scrollHost.scrollHeight,clientHeight:scrollHost.clientHeight};
  if(!wholeModal&&(fr.bottom>mr.bottom+1||br.bottom>mr.bottom+1)) violations.push('Modal content spills beyond panel');
  // Native WebKit scrolls the root while resizing for a keyboard; its visualViewport
  // offset and getBoundingClientRect have different origins. Use the anchored overlay.
  const overlayRect=box(document.getElementById('overlay'));
  const visibleTop=overlayRect.y,visibleBottom=visibleTop+Math.min(overlayRect.height,visualViewport?.height||innerHeight);
  if(wholeModal){
   // Record focused-field visibility above before scrolling. At native accessibility
   // sizes the footer may be taller than the keyboard viewport; every action must
   // remain individually reachable within the same scrolling dialog.
   modal.actions=[];
   for(const button of [...f.querySelectorAll('button')].filter(visible)){
    // Native VoiceOver and the first layout pass can adjust the scroll position
    // after a programmatic move. Focus the actual action, then measure after
    // bounded settling; persistent clipping still fails below.
    button.focus({preventScroll:true});
    let r,clip;
    for(let attempt=0;attempt<3;attempt++){
     r=box(button);clip=box(m);
     if(r.bottom>clip.bottom-8)m.scrollTop+=r.bottom-clip.bottom+8;
     else if(r.y<clip.y+8)m.scrollTop-=clip.y-r.y+8;
     await pause();r=box(button);clip=box(m);
     if(r.y>=clip.y+7&&r.bottom<=clip.bottom-7)break;
    }
    modal.actions.push({text:button.textContent.trim(),rect:r,panel:clip,scrollTop:m.scrollTop});
    if(r.y<Math.max(clip.y,visibleTop)-1||r.bottom>Math.min(clip.bottom,visibleBottom)+1)violations.push('Modal action unreachable: '+button.textContent.trim());
   }
  }else if(fr.bottom>visibleBottom+1||fr.y<visibleTop) violations.push('Modal actions outside viewport');
  if(m.scrollWidth>m.clientWidth+1)violations.push('Modal overflows horizontally');
 }
}
const paper=document.querySelector('#content .paper,#modal .paper');
let preview=null;
if(paper && !paper.closest('.mobile-a4-preview')) {
 preview={paper:box(paper),table:box(paper.querySelector('table.lines')),rows:[...paper.querySelectorAll('.totals .tr')].map(r=>({label:box(r.querySelector('.l')),value:box(r.querySelector('.v'))}))};
 if(preview.table.right>preview.paper.right+1)violations.push('Receipt table clipped');
 if(preview.rows.some(r=>r.label.right>r.value.x-1&&r.label.bottom>r.value.y+1&&r.value.bottom>r.label.y+1))violations.push('Total label collides with amount');
}
if(['receipt','receiptLong','invoiceLong','quotationLong','correctedPreview'].includes(auditScreen)){
 const canvas=document.querySelector('.mobile-a4-canvas'),paper=canvas?.querySelector('.paper');
 if(!canvas||!paper)violations.push('A4 document preview missing');
 else {preview={paper:box(paper),canvas:box(canvas),authoredWidth:paper.offsetWidth,authoredHeight:paper.offsetHeight};
  if(paper.offsetWidth!==820||paper.offsetHeight<1159)violations.push('Document lost A4 proportions');
  if(box(canvas).right>innerWidth+1||box(paper).right>box(canvas).right+1)violations.push('A4 page clipped');
 }
}
if(document.querySelector('.audio-guide,.audio-settings'))violations.push('Built-in voice controls remain on mobile');
const unlabeledItems=[...document.querySelectorAll('.items-table tbody td input')].filter(e=>!e.getAttribute('aria-label')||!e.closest('td').dataset.mobileLabel).length;
if(unlabeledItems)violations.push('Item editor has unlabeled inputs');
const smallTargets=[...document.querySelectorAll('#content button,#modal button,.topbar button,#mobileNav button')].filter(visible).filter(e=>{const r=box(e);return r.width<44||r.height<44;}).map(e=>({text:e.textContent.trim(),className:e.className,rect:box(e)}));
if(smallTargets.length)violations.push('Touch controls below 44 points');
const unsupported=[...document.querySelectorAll('button[onclick]')].filter(visible).filter(e=>(/elReveal\(/.test(e.getAttribute('onclick'))||(!syncV3Info.configured&&/connectSyncV3\(/.test(e.getAttribute('onclick'))))).map(e=>e.textContent.trim());
if(unsupported.length)violations.push('Visible unsupported native actions');
const dialogOpen=!!document.querySelector('.overlay.open,.confirm-overlay.open');
if(dialogOpen&&!document.getElementById('mobileNav').inert)violations.push('Background navigation remains accessible in dialog');
 // A touch at the centre of each navigation button must reach that button. The audit changes
 // screens directly, so without this an unreachable sidebar or tab bar goes unnoticed.
 const blockedNavigation=dialogOpen?[]:[...document.querySelectorAll('#mobileNav button')].filter(visible).map(button=>{
  const r=button.getBoundingClientRect(),hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
  return button.contains(hit)?null:{button:button.textContent.trim(),reached:hit?(hit.id?'#'+hit.id:hit.tagName.toLowerCase()+'.'+String(hit.className||'').trim().split(/\s+/).join('.')):'nothing'};
 }).filter(Boolean);
 if(blockedNavigation.length)violations.push('Navigation buttons cannot be reached by touch');
 // Layout rules the owner asked for: the page's own actions sit on the title line, and any
 // pop-up menu opens inside the screen. Measured, not assumed, on every screen.
 const titleRow=(()=>{const title=document.getElementById('pageTitle'),actions=[...document.querySelectorAll('#topActions button')].filter(visible);
  if(!title||!actions.length)return null;const tr=box(title);
  const n=v=>Number.isFinite(v)?Math.round(v):null;
  return {title:[n(tr.y),n(tr.bottom)],actions:actions.map(b=>{const r=box(b);return {label:(b.getAttribute('aria-label')||b.textContent).trim(),top:n(r.y),bottom:n(r.bottom),sameLine:r.y<tr.bottom&&r.bottom>tr.y};})};})();
 if(titleRow&&titleRow.actions.some(a=>!a.sameLine))violations.push('Page action not on the title line');
 const popups=[];
 for(const details of [...document.querySelectorAll('details.doc-more')].filter(visible)){
  details.open=true;await pause();const menu=details.querySelector('.doc-more-menu'),r=menu?box(menu):null;
  // Every number must be finite: the native JSON writer rejects NaN and would discard the whole result.
  const n=v=>Number.isFinite(v)?Math.round(v):null;
  popups.push({left:n(r&&r.x),right:n(r&&r.right),top:n(r&&r.y),bottom:n(r&&r.bottom),width:n(r&&r.width),onScreen:!!r&&r.x>=0&&r.right<=innerWidth+1&&r.width>0&&r.height>0});
  details.open=false;
 }
 if(popups.some(p=>!p.onScreen))violations.push('Pop-up menu opens off screen');
 // A real iOS tap focuses the summary first, then clicks it; the menu must end up open.
 const tapMenus=[];
 for(const summary of [...document.querySelectorAll('details.doc-more>summary')].filter(visible)){
  const details=summary.parentElement;details.open=false;
  summary.dispatchEvent(new FocusEvent('focusin',{bubbles:true}));summary.click();await pause();
  tapMenus.push({opened:details.open===true});details.open=false;
 }
 if(tapMenus.some(m=>!m.opened))violations.push('Pop-up menu does not open on tap');
let pdf=null;
if(auditScreen==='receipt'){
 const originalHTML=receipt.issuedSnapshot.renderedHtml;
 applyPrintZoom();try{pdf=await window.Capacitor.registerPlugin('BillNgaiNative').qaPDF({documentId:receipt.id});}finally{clearPrintZoom();}
 if(pdf.pages!==1||!pdf.receipt||!pdf.netAmount)violations.push('Canonical A4 receipt PDF regression');
 if(receipt.issuedSnapshot.renderedHtml!==originalHTML)violations.push('Frozen snapshot changed');
 const totals=document.querySelector('.paper .totals');totals.scrollIntoView({block:'center'});await pause();
}
const overflowElements=[...document.querySelectorAll('#content *,#modal *')].filter(visible).filter(e=>!e.closest('.mobile-table-scroll')&&(box(e).right>innerWidth+1||e.scrollWidth>e.clientWidth+1)).slice(-20).map(e=>({tag:e.tagName,className:e.className,width:e.clientWidth,scrollWidth:e.scrollWidth,rect:box(e)}));
const dateFields=[...document.querySelectorAll('input[type=date]')].filter(visible).map(e=>{const s=getComputedStyle(e);return {id:e.id,rect:box(e),parent:box(e.parentElement),width:s.width,minWidth:s.minWidth,boxSizing:s.boxSizing,padding:s.padding,appearance:s.appearance,display:s.display};});
const accessibility={native:await billingAPI.accessibilityStatus(),appliedScale:document.documentElement.style.getPropertyValue('--mobile-text-scale'),largeText:document.documentElement.dataset.mobileLargeText,reduceMotion:document.documentElement.dataset.mobileReduceMotion,voiceOver:document.documentElement.dataset.mobileVoiceOver,fieldFonts:[...document.querySelectorAll('.field input,.field select,.field textarea')].filter(visible).slice(0,8).map(e=>({id:e.id,fontSize:getComputedStyle(e).fontSize})),headingFonts:[...document.querySelectorAll('h2,h3')].filter(visible).slice(0,8).map(e=>({text:e.textContent,fontSize:getComputedStyle(e).fontSize}))};
return {upgradeResult,screen:auditScreen,language:auditLanguage,accessibility,viewport,violations,modal,preview,pdf,focusedField,keyboardBaseline,dateFields,unlabeledItems,smallTargets,unsupported,blockedNavigation,titleRow,popups,tapMenus,overflowElements,bodyText:document.getElementById('content').textContent.slice(0,1500)};
