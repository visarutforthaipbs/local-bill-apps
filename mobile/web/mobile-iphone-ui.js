'use strict';
// Mobile presentation only. Inputs, save handlers and recoverable drafts stay connected.
(()=>{
 if(!window.billingAPI?.isMobile)return;
 Object.assign(I18N_EN,{'ข้อมูลติดต่อและบันทึก':'Contact & notes','ภาษาเอกสาร':'Document language','ประเภทเงินได้':'Income category','ตัวเลือกเพิ่มเติม':'Options','ดูเอกสาร PDF':'View PDF','เอกสารใหม่':'New document'});
 function reveal(control){for(let details=control?.closest('details');details;details=details.parentElement?.closest('details'))if(!details.matches('.doc-more'))details.open=true;}
 document.addEventListener('focusin',event=>reveal(event.target));
 // Keep a pop-up menu inside the screen when its button sits at the left edge.
 document.addEventListener('toggle',event=>{const details=event.target,menu=details.matches?.('details.doc-more')&&details.querySelector('.doc-more-menu');if(!menu)return;menu.style.right='';menu.style.left='';if(!details.open)return;const r=menu.getBoundingClientRect();if(r.left<8){menu.style.right='auto';menu.style.left='0';}},true);
 document.addEventListener('invalid',event=>reveal(event.target),true);
 function field(id){return document.getElementById(id)?.closest('.field');}
 function disclosure(body,label){const details=document.createElement('details');details.className='tax-details mobile-optional';const summary=document.createElement('summary');summary.textContent=tr(label);details.append(summary);body.append(details);return details;}
 function client(body){
  if(!body.querySelector('#c_name')||body.dataset.mobileCompactClient)return;body.dataset.mobileCompactClient='true';
  const defaults=body.querySelector('details.tax-details');
  if(defaults){defaults.classList.add('mobile-optional');['c_lang','c_incat'].forEach(id=>{const item=field(id);if(item)defaults.append(item);});}
  const contact=disclosure(body,'ข้อมูลติดต่อและบันทึก');
  ['c_contact','c_email','c_phone','c_notes'].forEach(id=>{const item=field(id);if(item)contact.append(item);});
  body.querySelectorAll('.grid-2').forEach(grid=>{if(!grid.children.length)grid.remove();else if(grid.children.length===1)grid.classList.add('mobile-single-field');});
  [['c_lang','ภาษาเอกสาร'],['c_incat','ประเภทเงินได้']].forEach(([id,label])=>{const item=field(id),heading=item?.querySelector('label');if(heading)heading.textContent=tr(label);});
 }
 function recurring(body){
  if(!body.querySelector('#r_next')||body.dataset.mobileCompactRecurring)return;body.dataset.mobileCompactRecurring='true';
  const notes=field('r_notes');if(notes){const details=disclosure(body,'หมายเหตุ');details.append(notes);}
 }
 function utility(button,label,icon){
  const markup=ic(icon,20);if(button.dataset.mobileUtility===label)return;
  button.dataset.mobileUtility=label;button.classList.add('mobile-utility');button.setAttribute('aria-label',tr(label));button.title=tr(label);button.innerHTML=markup;
 }
 function decorate(){
  document.querySelectorAll('button[onclick]').forEach(button=>{
   const action=button.getAttribute('onclick').trim();
   if(button.closest('.paper,.doc-more-menu,.mobile-nav'))return;
   if(action==='savePDF()')utility(button,'แชร์ PDF','upload');
   else if(action==="setView('documents')"&&button.closest('#topActions'))utility(button,'กลับ','arrowLeft');
   else if(action==='newDocumentFromList()'&&button.closest('#topActions'))utility(button,'เอกสารใหม่','plus');
   else if(/^openClientEditor\(\)$/.test(action)&&button.closest('#topActions'))utility(button,'เพิ่มลูกค้า','plus');
   else if(action==='addItem()'||action==='recAddItem()')utility(button,'เพิ่มรายการ','plus');
  });
  document.querySelectorAll('details.doc-more>summary').forEach(summary=>{summary.setAttribute('aria-label',tr('ตัวเลือกเพิ่มเติม'));summary.title=tr('ตัวเลือกเพิ่มเติม');});
  const body=document.querySelector('#modal>.modal-body');if(body){client(body);recurring(body);}
  const nav=document.getElementById('mobileNav');if(nav){nav.querySelectorAll('button').forEach(button=>{
   button.setAttribute('aria-label',tr(button.dataset.label));
   const span=button.querySelector('span');if(span&&button.dataset.mobileView==='documents'){const text=DB?.business?.uiLang==='en'?'Docs':tr('เอกสาร');if(span.textContent!==text)span.textContent=text;}
  });}
 }
 let queued=false;
 function schedule(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;decorate();});}
 Promise.resolve(window.BillNgaiMobileBoot).then(()=>{
  const observer=new MutationObserver(schedule);
  ['content','modal','topActions','mobileNav'].forEach(id=>{const node=document.getElementById(id);if(node)observer.observe(node,{childList:true,subtree:true});});
  decorate();window.mobileIPhoneUI={decorate};
 });
})();
