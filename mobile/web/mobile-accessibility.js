'use strict';
// Native accessibility preferences change presentation only; never billing data or paper.
(()=>{
 const defaults=Object.freeze({textScale:1,reduceMotion:false,voiceOver:false,contentSizeCategory:''});
 function normalizeStatus(value,previous=defaults){
  const raw=value&&typeof value==='object'?value:{};
  // Keep the approved readable baseline (including 16px inputs); larger categories grow it.
  const scale=typeof raw.textScale==='number'&&Number.isFinite(raw.textScale)&&raw.textScale>0?Math.min(4,Math.max(1,raw.textScale)):previous.textScale;
  return {textScale:scale,reduceMotion:typeof raw.reduceMotion==='boolean'?raw.reduceMotion:previous.reduceMotion,voiceOver:typeof raw.voiceOver==='boolean'?raw.voiceOver:previous.voiceOver,contentSizeCategory:typeof raw.contentSizeCategory==='string'?raw.contentSizeCategory:previous.contentSizeCategory};
 }
 // CSS selector commas inside :is()/attribute values are not selector boundaries.
 function splitSelectors(source){
  const result=[];let start=0,depth=0,quote='',escaped=false;
  for(let i=0;i<source.length;i++){
   const character=source[i];
   if(escaped){escaped=false;continue;}
   if(character==='\\'){escaped=true;continue;}
   if(quote){if(character===quote)quote='';continue;}
   if(character==='"'||character==="'"){quote=character;continue;}
   if(character==='('||character==='[')depth++;
   else if(character===')'||character===']')depth--;
   else if(character===','&&depth===0){result.push(source.slice(start,i).trim());start=i+1;}
  }
  result.push(source.slice(start).trim());return result.filter(Boolean);
 }
 function screenSelector(selector){
  // Frozen paper, even when cloned under body for print measurement, is canonical.
  const paper=/\.paper\b/.test(selector);
  if(paper)return null;
  const pseudo=selector.search(/::[\w-]+|:(?:before|after|first-line|first-letter)\b/);
  const subject=pseudo<0?selector:selector.slice(0,pseudo),suffix=pseudo<0?'':selector.slice(pseudo);
  // Inline authored sizes have their own override; do not replace them with a class size.
  return subject+(paper?'':':not(.paper):not(.paper *):not(svg):not(svg *)')+':not([data-mobile-inline-font])'+suffix;
 }
 function scaledFontRules(rules){
  const output=[];
  for(const rule of rules||[]){
   if(rule.selectorText&&rule.style){
    const size=rule.style.getPropertyValue('font-size').trim();
    if(!/^(?:\d+(?:\.\d+)?|\.\d+)px$/.test(size))continue;
    const selectors=splitSelectors(rule.selectorText).map(screenSelector).filter(Boolean);
    if(selectors.length)output.push(selectors.join(',')+'{font-size:calc('+size+' * var(--mobile-text-scale,1))!important}');
   }else if(rule.cssRules){
    const nested=scaledFontRules(rule.cssRules);if(!nested)continue;
    const opening=String(rule.cssText||'').split('{',1)[0].trim();
    // Preserve media/container/support conditions. Keyframes and font faces are not UI rules.
    if(/^@(media|container|supports|layer)\b/.test(opening))output.push(opening+'{'+nested+'}');
   }
  }
  return output.join('\n');
 }
 function inlinePixelSize(element){
  if(element.closest('.paper')||element.closest('svg'))return null;
  const size=element.style.getPropertyValue('font-size').trim();
  return /^(?:\d+(?:\.\d+)?|\.\d+)px$/.test(size)?size:null;
 }
 function bottomNavigationHeight(layout,height){return layout.display==='grid'&&layout.bottom==='0px'&&Number.isFinite(height)?Math.max(0,Math.ceil(height)):0;}
 function imageAlternative(image,translate){
  if(image.hasAttribute('alt'))return null;
  // Settings already supplies a nearby asset heading; the issuer name accompanies its logo.
  if(image.closest('.asset-prev'))return '';
  if(!image.closest('.mobile-paper-preview'))return null;
  if(image.classList.contains('logo-img'))return '';
  if(image.classList.contains('sig'))return translate('ลายเซ็น');
  if(image.classList.contains('stamp'))return translate('ตราประทับ');
  return null;
 }
 function createController(native,apply,mediaQuery={matches:false}){
  let state={...defaults},eventRevision=0;
  const current=()=>({...state,reduceMotion:state.reduceMotion||!!mediaQuery.matches});
  const emit=()=>apply(current());
  async function refresh(){
   const revision=eventRevision;
   try{const result=await native?.accessibilityStatus?.();if(revision===eventRevision&&result){state=normalizeStatus(result,state);emit();}}
   catch(e){/* A preference bridge failure must not stop financial work. */}
   return current();
  }
  function start(){
   emit();
   if(native?.addListener){try{Promise.resolve(native.addListener('accessibilityChanged',value=>{eventRevision++;state=normalizeStatus(value,state);emit();})).catch(()=>{});}catch(e){}}
   mediaQuery.addEventListener?.('change',emit);
   return refresh();
  }
  return {start,refresh,getStatus:current};
 }
 // Pure exports let Node test the adapter without a native session or customer profile.
 if(typeof module==='object'&&module.exports){module.exports={normalizeStatus,splitSelectors,screenSelector,scaledFontRules,inlinePixelSize,bottomNavigationHeight,imageAlternative,createController};return;}
 const root=document.documentElement;
 const mediaQuery=window.matchMedia('(prefers-reduced-motion: reduce)');
 const native=window.Capacitor?.registerPlugin('BillNgaiNative');
 const fonts=document.createElement('style');fonts.id='mobile-accessibility-fonts';
 const generated=[];
 for(const sheet of document.styleSheets){
  if(sheet.ownerNode?.id===fonts.id)continue;
  try{generated.push(scaledFontRules(sheet.cssRules));}catch(e){/* Only bundled readable styles are scaled. */}
 }
 fonts.textContent='@media screen{'+generated.join('\n')+'}';document.head.append(fonts);
 function prepareInlineFonts(container){
  if(!(container instanceof Element))return;
  const elements=[container,...container.querySelectorAll('[style]')];
  for(const element of elements){
   const size=inlinePixelSize(element);
   if(size){element.style.setProperty('--mobile-inline-font-size',size);element.setAttribute('data-mobile-inline-font','');}
   else if(element.hasAttribute('data-mobile-inline-font')){element.style.removeProperty('--mobile-inline-font-size');element.removeAttribute('data-mobile-inline-font');}
  }
  const images=[...(container.matches('img')?[container]:[]),...container.querySelectorAll('img')];
  for(const image of images){const alternative=imageAlternative(image,tr);if(alternative!==null)image.setAttribute('alt',alternative);}
 }
 prepareInlineFonts(document.body);
 let navFrame,focusFrame;
 function updateNavHeight(){
  cancelAnimationFrame(navFrame);navFrame=requestAnimationFrame(()=>{
   const nav=document.getElementById('mobileNav');if(!nav)return;
   const layout=getComputedStyle(nav);
   // The tablet sidebar also has bottom:0; only the phone's grid occupies the bottom edge.
   root.style.setProperty('--mobile-nav-height',bottomNavigationHeight(layout,nav.getBoundingClientRect().height)+'px');
  });
 }
 function focusPageHeading(){
  cancelAnimationFrame(focusFrame);focusFrame=requestAnimationFrame(()=>{
   if(!controller.getStatus().voiceOver||document.querySelector('.overlay.open,.confirm-overlay.open,.cmdk-overlay.open'))return;
   const title=document.getElementById('pageTitle');if(!title)return;
   title.tabIndex=-1;title.focus({preventScroll:true});
  });
 }
 const controller=createController(native,status=>{
  root.style.setProperty('--mobile-text-scale',String(status.textScale));
  root.dataset.mobileLargeText=String(status.textScale>1.25);
  root.dataset.mobileReduceMotion=String(status.reduceMotion);
  root.dataset.mobileVoiceOver=String(status.voiceOver);
  if(status.reduceMotion)document.getAnimations?.().forEach(animation=>animation.cancel());
  updateNavHeight();
 },mediaQuery);
 // Non-text feedback retains its spoken/live-region equivalent with Reduce Motion.
 if(typeof stampFx==='function'){
  const originalStampFx=stampFx;
  stampFx=function(text,sub){if(controller.getStatus().reduceMotion){toast(text+(sub?' · '+sub:''),'ok');return;}return originalStampFx(text,sub);};
 }
 const originalSetView=setView;
 setView=function(view){const result=originalSetView(view);focusPageHeading();return result;};
 const originalMore=openMobileMore;
 openMobileMore=async function(){const result=await originalMore();focusPageHeading();return result;};
 const observer=new MutationObserver(records=>{
  for(const record of records)for(const node of record.addedNodes)prepareInlineFonts(node);
  if(controller.getStatus().reduceMotion)document.getAnimations?.().forEach(animation=>animation.cancel());
  updateNavHeight();
 });
 observer.observe(document.body,{childList:true,subtree:true});
 const nav=document.getElementById('mobileNav');
 if(nav){const resize=new ResizeObserver(updateNavHeight);resize.observe(nav);}
 window.addEventListener('resize',updateNavHeight);document.fonts.ready.then(updateNavHeight);
 window.BillNgaiMobileAccessibility=Object.freeze({refresh:controller.refresh,getStatus:controller.getStatus});
 controller.start();
})();
