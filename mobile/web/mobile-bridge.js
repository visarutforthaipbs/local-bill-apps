'use strict';
(()=>{
 const native=window.Capacitor?.registerPlugin('BillNgaiNative');
 let revision='unloaded',tail=Promise.resolve();
 // Capture each payload at the call boundary; serialize saves using the last ACK.
 const ordered=operation=>{const next=tail.then(operation);tail=next.catch(()=>{});return next;};
 const unavailable=()=>Promise.reject(new Error('MOBILE_CAPABILITY_NOT_READY'));
 const rawRead=async()=>{const result=await native.load();revision=result.revision;return result.text??null;};
 const guardedRead=async()=>{const result=await native.load();if(revision!=='unloaded'&&result.revision!==revision)throw Error('DATA_CHANGED_ON_DISK');revision=result.revision;return result.text??null;};
 const rawWrite=async(text,sync)=>{const result=await native[sync?'syncSave':'save']({text,expectedRevision:revision});revision=result.revision;return true;};
 const adopt=async text=>{const result=await native.syncAdopt({text,expectedRevision:revision,replaceLocal:true});revision=result.revision;return true;};
 const syncHost=window.BillNgaiMobileSync?.create(native,{read:guardedRead,write:rawWrite,adopt,snapshot:label=>native.snapshot({label})});
 const status=()=>ordered(()=>syncHost?syncHost.status():Promise.resolve({configured:false,connected:false,conflicts:[],pending:0}));
 const syncAction=(name,...args)=>ordered(()=>syncHost?syncHost[name](...args):unavailable());
 if(native?.addListener)native.addListener('proStatusChanged',detail=>window.dispatchEvent(new CustomEvent('billngaiProChanged',{detail}))).catch(()=>{});
 const MAX_IMPORT_BYTES=64*1024*1024;
 let pickBusy=false;
 // WKWebView file input like business logo selection: input.click() runs synchronously
 // inside the iOS user gesture. Picking reads text only (no storage mutation, no native
 // path); the temporary input and all listeners leave on every settled path.
 const pickImportFile=()=>{
  if(typeof document==='undefined')return unavailable();
  if(pickBusy)return Promise.reject(new Error('IMPORT_BUSY'));
  pickBusy=true;
  return new Promise((resolve,reject)=>{
   const input=document.createElement('input');
   input.type='file';input.accept='.json,application/json';input.hidden=true;
   let settled=false,reading=false;
   const settle=(finish,value)=>{if(settled)return;settled=true;pickBusy=false;input.removeEventListener('change',onChange);input.removeEventListener('cancel',onCancel);window.removeEventListener('focus',onFocus);input.remove();finish(value);};
   const onChange=()=>{
    const file=input.files&&input.files[0];
    if(!file){settle(resolve,null);return;}
    if(file.size>MAX_IMPORT_BYTES){settle(reject,new Error('IMPORT_FILE_TOO_LARGE'));return;}
    reading=true;
    try{Promise.resolve(file.text()).then(text=>settle(resolve,text),()=>settle(reject,new Error('IMPORT_READ_FAILED')));}
    catch(error){settle(reject,new Error('IMPORT_READ_FAILED'));}
   };
   const onCancel=()=>settle(resolve,null);
   // Older WebKit fires no cancel event; a focus return with nothing chosen settles null.
   const onFocus=()=>setTimeout(()=>{if(!reading&&!(input.files&&input.files.length))settle(resolve,null);},300);
   input.addEventListener('change',onChange);input.addEventListener('cancel',onCancel);window.addEventListener('focus',onFocus);
   try{(document.body||document.documentElement).append(input);input.click();}
   catch(error){settle(reject,new Error('IMPORT_PICKER_FAILED'));}
  });
 };
 window.billingAPI=Object.freeze({
  isElectron:true,isMobile:true,
  capabilities:Object.freeze({nativeStorage:true,nativePDF:true,cloudSync:!!syncHost,evidence:false,externalStorage:false}),
  load:()=>ordered(rawRead),
  save:text=>ordered(()=>syncHost?syncHost.save(String(text)):rawWrite(String(text),false)),
  editorDraftLoad:key=>native.editorDraftLoad({key}),
  editorDraftSave:(key,text,expectedRevision)=>native.editorDraftSave({key,text,expectedRevision}),
  editorDraftRemove:(key,expectedRevision)=>native.editorDraftRemove({key,expectedRevision}),
  accessibilityStatus:()=>native.accessibilityStatus(),
  onAccessibilityChanged:handler=>native.addListener('accessibilityChanged',handler),
  deviceId:async()=> (await native.deviceID()).id,
  where:()=>Promise.resolve({mode:'app',storageFormat:'sqlite',path:'BillNgai / billing.sqlite'}),
  journalAppend:()=>Promise.resolve(false),
  listBackups:async()=> (await native.backups()).items.map(item=>({name:item.name,size:item.bytes,mtime:item.at})),
  snapshotBackup:async label=> (await native.snapshot({label})).name??null,
  preparePrintPreview:documentId=>native.preparePrintPreview({documentId}),
  showPrintPreview:args=>native.showPrintPreview(args),
  exportPDF:async(name,documentId,previewToken)=> (await native.exportPDF({name,documentId,...(previewToken?{previewToken}:{})})).path??null,
  exportData:async text=> (await native.exportData({text})).path??null,
  exportFile:async(text,name)=> (await native.exportFile({text,name})).path??null,
  licenseStatus:async(includePrice=false)=>Promise.race([
   native.licenseStatus({includePrice}).then(async result=>{const cloudReady=syncHost?await syncHost.cloudReady():false;return {...result,valid:!!result.valid||cloudReady,cloudReady};}),
   new Promise(resolve=>setTimeout(()=>resolve({valid:false,verificationUnavailable:true,cloudReady:false}),4000))
  ]),
  purchasePro:async()=>native.purchasePro(),
  restorePro:async()=>native.restorePro(),
  syncV3Status:status,syncStatus:status,
  aiStatus:()=>Promise.resolve({valid:false,installed:false}),
  // No local-number fallback, fake token, or successful cloud result in the prototype.
  syncV3Connect:options=>syncAction('connect',options),syncV3Run:options=>syncAction('run',options),syncV3Reserve:(key,parts)=>syncAction('reserve',key,parts),syncV3Resolve:(key,choice)=>syncAction('resolve',key,choice),syncV3Disconnect:()=>syncAction('disconnect'),
  syncConnect:unavailable,syncDisconnect:unavailable,syncPush:unavailable,syncPull:unavailable,
  recoverData:text=>ordered(async()=>{const result=await native.recover({text});revision=result.revision;return true;}),
  restoreBackup:name=>ordered(async()=>{const result=await native.restoreBackup({name});revision=result.revision;return rawRead();}),importData:pickImportFile,
  linkExisting:unavailable,createExternal:unavailable,useDefault:unavailable,
  attachEvidence:unavailable,evidenceInfo:unavailable,exportEvidence:unavailable,
  exportEvidenceBundle:unavailable,importEvidenceBundle:unavailable,
  licenseDeactivate:unavailable,
  reveal:unavailable,revealBackups:unavailable,
  pathForFile:()=>'',
  drain:()=>tail
 });
})();
