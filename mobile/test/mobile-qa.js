// Invoked only by the debug native host with --billngai-qa in isolated simulators.
const check=(condition,label)=>{if(!condition)throw Error(label);};
function checkDocumentLayout(){
 const nav=[...document.querySelectorAll('#mobileNav button')].filter(button=>button.getBoundingClientRect().height>0);
 check(nav.length===4,'four visible destinations');
 check(nav.every(button=>button.getBoundingClientRect().height>=44&&button.getBoundingClientRect().width>=44),'navigation touch targets');
 const info=document.querySelector('.document-info');
 check(info&&info.getBoundingClientRect().width>=96,'document identity readable width');
 check(document.documentElement.scrollWidth<=document.documentElement.clientWidth+1,'no page horizontal overflow');
 return {navButtons:nav.length,documentInfoWidth:Math.round(info.getBoundingClientRect().width)};
}
check(window.billingAPI.isMobile,'native mobile bridge');
check(!loadFailed,'native boot load');
const first=await window.billingAPI.load();
if(first&&JSON.parse(first).meta?.mobileSynthetic){
 check(DB.documents.length===2,'relaunch documents retained');
 check(DB.documents.find(d=>d.type==='receipt')?.issuedSnapshot,'relaunch issued receipt retained');
 openDocEditor('quotation');
 check(pendingEditorDraft?.doc.notes==='Synthetic unsaved edit survives termination','unsaved edit recovery offered');
 restoreEditorDraft();
 check(editDoc.notes==='Synthetic unsaved edit survives termination','unsaved edit recovery retained content');
 clearDraft();closeModal();
 setView('documents');
 const layout=checkDocumentLayout();
 return {phase:'relaunch',documents:DB.documents.length,receiptTitle:true,unsavedEditRecovered:true,cloudConnected:syncV3Info.connected,layout};
}
check(!first,'synthetic tests require empty profile');
closeModal();
Object.assign(DB.business,{businessName:'BillNgai synthetic studio',businessNameEn:'BillNgai synthetic studio',address:'Bangkok',taxId:'1234567890123',vatStatus:'non_registered',isVatRegistered:false,uiLang:'en'});
DB.meta.setupDone=true;DB.meta.mobileSynthetic=true;
DB.clients=[{id:'qa_client',name:'Synthetic client',address:'Bangkok',docLang:'bilingual'}];
check(await persist(true),'native profile save');
openDocEditor('invoice');
editDoc.items=[{description:'Synthetic design service',qty:1,unit:'job',price:1000}];
editDoc.clientId='qa_client';editDoc.whtRate=3;editDoc.whtReviewed=true;
editDoc.issueDate='2026-10-03';editDoc.dueDate='2026-10-30';
await saveDraft();
check(DB.documents.length===1&&DB.documents[0].status==='draft','draft saved');
openDocEditor('invoice',DB.documents[0].id);
async function confirmed(action){
 const timer=setInterval(()=>{if(document.getElementById('confirmOverlay').classList.contains('open'))settleConfirm(true);},25);
 try{return await action();}finally{clearInterval(timer);}
}
await confirmed(()=>issueDoc());
const invoice=DB.documents.find(d=>d.type==='invoice');
check(invoice?.status==='sent'&&invoice.issuedSnapshot,'invoice issuance');
await setStatus(invoice.id,'paid',{paidDate:'2026-10-03',fullPaymentConfirmed:true});
await confirmed(()=>createReceipt(invoice.id));
const receipt=DB.documents.find(d=>d.type==='receipt');
check(receipt?.paymentId===DB.documents.find(d=>d.id===invoice.id).paymentId,'one payment across invoice and receipt');
const paper=new DOMParser().parseFromString(receipt.issuedSnapshot.renderedHtml,'text/html');
const title=paper.querySelector('.doc-title')?.textContent||'';
check(title.includes('ใบเสร็จรับเงิน')&&title.includes('Receipt'),'receipt title');
check(!title.includes('ใบกำกับภาษี')&&!paper.querySelector('.tax-stamp'),'no tax invoice title');
const income=realizedDocs();check(income.length===1&&compute(income[0]).netPayable===970,'income counted once');
const saved=JSON.parse(await window.billingAPI.load());
check(saved.documents.length===2,'durable records');
const modified=structuredClone(saved);modified.documents.find(d=>d.type==='invoice').items[0].price=5000;
let guarded=false;try{await window.billingAPI.save(JSON.stringify(modified));}catch(e){guarded=String(e).includes('IMMUTABLE');}
check(guarded,'native issued facts guard');
check((await window.billingAPI.listBackups()).length>0,'native backups');
viewDoc(receipt.id);await document.fonts.ready;applyPrintZoom();
const native=window.Capacitor.registerPlugin('BillNgaiNative');
let wrongSelectionRejected=false;try{await native.qaPDF({documentId:'qa_wrong_document'});}catch(e){wrongSelectionRejected=String(e).includes('PDF_OUTPUT_BLOCKED');}
check(wrongSelectionRejected,'PDF rejects a changed selection');
const pdf=await native.qaPDF({documentId:receipt.id});clearPrintZoom();
check(pdf.pages===1&&pdf.receipt&&pdf.netAmount,'native receipt PDF');
setView('documents');
const layout=checkDocumentLayout();
openDocEditor('quotation');editDoc.notes='Synthetic unsaved edit survives termination';markDirty();await Promise.resolve();
check(loadDraft()?.doc.notes===editDoc.notes,'unsaved edit captured');
return {phase:'first',documents:saved.documents.length,incomeItems:income.length,netIncome:970,receiptTitle:true,issuedGuard:guarded,pdf,unsavedEditCaptured:true,cloudConnected:syncV3Info.connected,layout};
