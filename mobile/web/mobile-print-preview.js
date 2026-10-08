'use strict';
// Keep an A4-width page layout. Open the canonical PDF on demand; never reflow paper.
(()=>{
 function createCoordinator(generate,isCurrent){
  let tail=Promise.resolve(),revision=0,record=null;
  function prepare(id){
   const version=++revision;record=null;
   const next=tail.catch(()=>{}).then(async()=>{
    if(version!==revision||!isCurrent(id))return null;
    const value=await generate(id);
    if(version!==revision||!isCurrent(id))return null;
    if(value.documentId!==id||!value.token||!Number.isInteger(value.pageCount)||value.pageCount<1)throw Error('PDF_PREVIEW_INVALID');
    record=value;return value;
   });tail=next;return next;
  }
  return {prepare,invalidate(){revision++;record=null;},current:id=>record?.documentId===id&&isCurrent(id)?record:null};
 }
 if(typeof module!=='undefined'&&module.exports){module.exports={createCoordinator};return;}
 if(!window.billingAPI?.isMobile)return;
 Object.assign(I18N_EN,{'ตัวอย่างพิมพ์ · A4':'Print preview · A4','กำลังเตรียมตัวอย่างพิมพ์':'Preparing print preview','ขยายเอกสาร':'Zoom document','พอดีหน้า':'Fit page','เตรียมตัวอย่างไม่สำเร็จ':'Could not prepare the preview','ลองอีกครั้ง':'Try again','หน้า':'Page','แบบร่างเอกสาร':'Document draft'});
 let wrapper=null,pending=Promise.resolve(null),opening=false;
 const selected=id=>{const d=getViewingDocument();return currentView==='docview'&&d?.id===id&&!documentOutputBlocked(d)&&!!wrapper?.isConnected;};
 const coordinator=createCoordinator(async id=>{
  await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  if(!selected(id))throw Error('PDF_SELECTION_CHANGED');
  applyPrintZoom();
  try{return await window.billingAPI.preparePrintPreview(id);}finally{clearPrintZoom();}
 },selected);
 const filename=d=>String(d.number||'document').replace(/[\/\\:*?"<>|]/g,'-')+'.pdf';
 async function prepare(id){
  const cached=coordinator.current(id);if(cached)return cached;
  pending=coordinator.prepare(id);return pending;
 }
 async function zoom(){
  const d=getViewingDocument();if(!d||!selected(d.id)||opening)return false;opening=true;
  try{const value=await prepare(d.id);if(!value)return false;
   await window.billingAPI.showPrintPreview({documentId:d.id,token:value.token,name:filename(d),closeLabel:tr('ปิด'),shareLabel:tr('แชร์ PDF'),fitLabel:tr('พอดีหน้า'),shareFailedLabel:tr('บันทึก PDF ไม่สำเร็จ')});return true;
  }catch(e){toast(tr('เตรียมตัวอย่างไม่สำเร็จ'),'err');return false;}finally{opening=false;}
 }
 function fit(region){
  if(region.dataset.mobileA4)return;region.dataset.mobileA4='true';region.classList.add('mobile-a4-preview');
  const paper=region.querySelector('.paper');if(!paper)return;
  const canvas=document.createElement('div');canvas.className='mobile-a4-canvas';paper.before(canvas);canvas.append(paper);
  const resize=()=>{if(!region.isConnected){observer.disconnect();return;}const scale=Math.min(1,canvas.clientWidth/820);paper.style.transform='scale('+scale+')';canvas.style.height=(paper.offsetHeight*scale)+'px';};
  const observer=new ResizeObserver(resize);observer.observe(canvas);observer.observe(paper);resize();
 }
 const base=prepareMobilePaper;
 prepareMobilePaper=function(){
  base();document.querySelectorAll('.mobile-preview-note').forEach(e=>e.remove());
  const next=document.querySelector('#content>.mobile-paper-preview');
  if(next!==wrapper){coordinator.invalidate();wrapper=next;}
  document.querySelectorAll('.mobile-paper-preview').forEach(fit);
  if(wrapper&&!wrapper.querySelector('.mobile-print-toolbar')){
   const tools=document.createElement('div');tools.className='mobile-print-toolbar';const label=document.createElement('span');label.textContent='A4';
   const open=document.createElement('button');open.type='button';open.className='btn';open.innerHTML=ic('fileText')+' PDF';open.setAttribute('aria-label',tr('ขยายเอกสาร')+' · PDF');open.title=tr('ขยายเอกสาร');open.onclick=zoom;
   tools.append(label,open);wrapper.prepend(tools);
  }
 };
 savePDF=async function(){
  const d=getViewingDocument();if(!d)return false;if(documentOutputBlocked(d)){toast(documentBlockMessage(d),'err');return false;}
  try{const value=await prepare(d.id);if(!value)return false;
   const result=await window.billingAPI.exportPDF(filename(d),d.id,value.token);if(result)toast(tr('ส่งให้แอปที่เลือกแล้ว'),'ok');return !!result;
  }catch(e){toast(tr('บันทึก PDF ไม่สำเร็จ'),'err');return false;}
 };
 window.mobilePrintPreview={ready:()=>pending.catch(()=>null),current:()=>coordinator.current(getViewingDocument()?.id),zoom};
 Promise.resolve(window.BillNgaiMobileBoot).then(prepareMobilePaper);
})();
