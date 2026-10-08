'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {normalizeStatus,splitSelectors,screenSelector,scaledFontRules,inlinePixelSize,bottomNavigationHeight,imageAlternative,createController}=require('../web/mobile-accessibility.js');
function rule(selector,size){return {selectorText:selector,style:{getPropertyValue:property=>property==='font-size'?size:''}};}
test('native text scale is finite and preferences do not change billing facts',()=>{
 const initial=normalizeStatus({textScale:3.12,reduceMotion:true,voiceOver:true,contentSizeCategory:'AXXXL'});
 assert.equal(initial.textScale,3.12);assert.equal(initial.reduceMotion,true);assert.equal(initial.voiceOver,true);
 assert.deepEqual(normalizeStatus({textScale:NaN,voiceOver:'true'},initial),initial);
 assert.equal(normalizeStatus({textScale:999}).textScale,4);assert.equal(normalizeStatus({textScale:.1}).textScale,1);
});
test('font scaling preserves responsive conditions and excludes canonical paper from font scaling',()=>{
 const css=scaledFontRules([rule('.btn,.field label','13px'),rule('.paper,.paper .totals','13px'),{cssText:'@media (max-width:767px) { }',cssRules:[rule('.topbar h2','24px')]},{cssText:'@container (max-width:600px) { }',cssRules:[rule('.hint','12px')]},rule('.box','inherit')]);
 assert.match(css,/calc\(13px \* var\(--mobile-text-scale,1\)\)/);
 assert.match(css,/@media \(max-width:767px\)/);assert.match(css,/@container \(max-width:600px\)/);
 assert.ok(!css.includes('.mobile-paper-preview .paper .totals'));assert.ok(!css.includes('.box'));
 assert.ok(css.split('\n').every(line=>!line.includes('font-size:')||line.includes(':not(.paper *):not(svg):not(svg *)')||line.includes('.mobile-paper-preview .paper')));
});
test('selector parsing preserves pseudo elements and commas inside selectors',()=>{
 assert.deepEqual(splitSelectors('.items td::before,:is(.btn,.pill),[title="a,b"]'),['.items td::before',':is(.btn,.pill)','[title="a,b"]']);
 assert.equal(screenSelector('.items td::before'),'.items td:not(.paper):not(.paper *):not(svg):not(svg *):not([data-mobile-inline-font])::before');
 assert.equal(screenSelector('.paper table.lines'),null);
});
test('inline UI pixels are scaled once and paper/print measurement clones are excluded',()=>{
 const element=(size,inPaper=false,inSVG=false,inPreview=false)=>({closest:selector=>selector==='.paper'?inPaper:selector==='.mobile-paper-preview'?inPreview:inSVG,style:{getPropertyValue:()=>size}});
 assert.equal(inlinePixelSize(element('12px')),'12px');assert.equal(inlinePixelSize(element('12px',true)),null);
 assert.equal(inlinePixelSize(element('12px',false,true)),null);assert.equal(inlinePixelSize(element('inherit')),null);
 assert.equal(inlinePixelSize(element('12px',true,false,true)),null);
});
test('bottom padding follows the phone bar, not the full-height tablet sidebar',()=>{
 assert.equal(bottomNavigationHeight({display:'grid',bottom:'0px'},128.3),129);
 assert.equal(bottomNavigationHeight({display:'flex',bottom:'0px'},1024),0);
 assert.equal(bottomNavigationHeight({display:'none',bottom:'0px'},0),0);
});
test('VoiceOver labels distinguish signatures/stamps without repeating issuer logos',()=>{
 const image=(kind,preview=true,asset=false,existing=false)=>({hasAttribute:()=>existing,closest:selector=>selector==='.asset-prev'?asset:preview,classList:{contains:value=>value===kind}});
 const translate=key=>({'ลายเซ็น':'Signature','ตราประทับ':'Stamp'}[key]);
 assert.equal(imageAlternative(image('logo-img'),translate),'');
 assert.equal(imageAlternative(image('sig'),translate),'Signature');assert.equal(imageAlternative(image('stamp'),translate),'Stamp');
 assert.equal(imageAlternative(image('sig',false),translate),null);assert.equal(imageAlternative(image('sig',true,false,true),translate),null);
 assert.equal(imageAlternative(image('',false,true),translate),'');
});
test('a newer accessibility event wins over a delayed initial bridge response',async()=>{
 let resolve,listener;const changes=[];
 const native={accessibilityStatus:()=>new Promise(done=>resolve=done),addListener:(name,callback)=>{assert.equal(name,'accessibilityChanged');listener=callback;return Promise.resolve({remove(){}});}};
 const controller=createController(native,status=>changes.push(status));const started=controller.start();
 listener({textScale:2.5,voiceOver:true,reduceMotion:true});resolve({textScale:1,voiceOver:false,reduceMotion:false});await started;
 assert.equal(controller.getStatus().textScale,2.5);assert.equal(controller.getStatus().voiceOver,true);assert.equal(changes.at(-1).reduceMotion,true);
});
test('bridge errors preserve preferences and OS reduced motion still applies',async()=>{
 let change;const media={matches:true,addEventListener:(event,callback)=>{assert.equal(event,'change');change=callback;}};
 const states=[];const controller=createController({accessibilityStatus:async()=>{throw Error('not ready');},addListener:()=>Promise.reject(Error('not ready'))},status=>states.push(status),media);
 await controller.start();assert.equal(controller.getStatus().reduceMotion,true);assert.equal(controller.getStatus().textScale,1);
 media.matches=false;change();assert.equal(states.at(-1).reduceMotion,false);
});
test('larger text and reduced motion CSS applies only to screen, leaving A4 unchanged',()=>{
 const css=fs.readFileSync(path.join(__dirname,'../web/mobile.css'),'utf8');
 const marker='/* Native accessibility preferences';const start=css.indexOf(marker);assert.ok(start>=0);
 const additions=css.slice(start);assert.match(additions,/@media screen/);assert.ok(!additions.includes('@media print'));
 assert.match(additions,/--mobile-nav-height/);assert.match(additions,/data-mobile-reduce-motion/);assert.match(additions,/data-mobile-large-text/);
 const source=fs.readFileSync(path.join(__dirname,'../web/mobile-accessibility.js'),'utf8');
 assert.match(source,/fonts\.textContent='@media screen/);assert.ok(!source.includes('DB.'));assert.ok(!source.includes('localStorage'));
});
