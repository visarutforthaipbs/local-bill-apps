'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../web/mobile-bridge.js'),'utf8');
function bridge(plugin){const ctx=vm.createContext({window:{Capacitor:{registerPlugin:name=>{assert.equal(name,'BillNgaiNative');return plugin;}}},setTimeout});vm.runInContext(source,ctx);return ctx.window.billingAPI;}
test('native load and ordered saves use acknowledged revisions, not browser cache',async()=>{
 const calls=[];let revision='r1';const api=bridge({load:async()=>({text:'stored',revision}),save:async args=>{assert.equal(args.expectedRevision,revision);calls.push(args.text);await new Promise(r=>setTimeout(r,5));revision='r'+(calls.length+1);return {revision};}});
 assert.equal(await api.load(),'stored');await Promise.all([api.save('first'),api.save('second')]);assert.deepEqual(calls,['first','second']);
});
test('failed save does not advance revision and later calls cannot bypass stale write guard',async()=>{
 const revisions=[];let count=0;const api=bridge({load:async()=>({text:null,revision:'empty'}),save:async args=>{revisions.push(args.expectedRevision);if(++count===1)throw Error('DATA_CHANGED_ON_DISK');return {revision:'r2'};}});
 await api.load();await assert.rejects(api.save('first'),/DATA_CHANGED_ON_DISK/);await api.save('second');assert.deepEqual(revisions,['empty','empty']);
});
test('cloud, imports and external activation fail explicitly; no fake connected result',async()=>{
 const api=bridge({});assert.equal(api.capabilities.cloudSync,false);assert.equal((await api.syncV3Status()).connected,false);
 for(const name of ['syncV3Connect','syncV3Reserve','syncV3Run','importData'])await assert.rejects(api[name](),/MOBILE_CAPABILITY_NOT_READY/);
});
test('native file export preserves text and filename and distinguishes cancellation',async()=>{
 let completed=false;const api=bridge({exportFile:async args=>{assert.equal(args.text,'ภาษาไทย,970.00');assert.equal(args.name,'report.csv');return {path:completed?args.name:null};}});
 assert.equal(await api.exportFile('ภาษาไทย,970.00','report.csv'),null);
 completed=true;assert.equal(await api.exportFile('ภาษาไทย,970.00','report.csv'),'report.csv');
});
test('PDF export identifies the selected document, so a changed view cannot export under its name',async()=>{
 const api=bridge({exportPDF:async args=>{assert.equal(args.name,'RC-69-001.pdf');assert.equal(args.documentId,'receipt1');return {path:null};}});
 assert.equal(await api.exportPDF('RC-69-001.pdf','receipt1'),null);
});
test('backup history adapts native dates and byte sizes to the renderer contract',async()=>{
 const api=bridge({backups:async()=>({items:[{name:'synthetic.json',bytes:2048,at:'2026-10-03T12:00:00Z'}]})});
 const [copy]=await api.listBackups();assert.equal(copy.size,2048);assert.equal(copy.mtime,'2026-10-03T12:00:00Z');assert.equal(copy.name,'synthetic.json');
});
test('mobile package preserves existing identity and has no remote executable UI',()=>{
 const root=path.join(__dirname,'..'),config=JSON.parse(fs.readFileSync(path.join(root,'capacitor.config.json')));
 assert.equal(config.appId,'com.visarut.billngai');assert.equal(config.server.url,undefined);assert.equal(config.server.allowNavigation,undefined);
 assert.equal(config.loggingBehavior,'none');
 const html=fs.readFileSync(path.join(root,'www/index.html'),'utf8');assert.match(html,/connect-src 'none'/);assert.match(html,/object-src 'none'/);
 assert.ok(html.indexOf('mobile-bridge.js')<html.indexOf('let DB = null'));
 assert.equal(fs.existsSync(path.join(root,'www/secrets')),false);assert.equal(fs.existsSync(path.join(root,'www/main.js')),false);
 assert.equal(fs.existsSync(path.join(root,'www/mobile-qa.js')),false);
 assert.equal(fs.existsSync(path.join(root,'www/mobile-ui-audit.js')),false);
 assert.equal(fs.existsSync(path.join(root,'www/mobile-recovery-qa.js')),false);
 assert.doesNotMatch(html,/https:\/\/lin\.ee\/pSl8nEH|Early Bird|ซื้อ Pro: สแกนจ่ายผ่าน PromptPay/);
 const colors=JSON.parse(fs.readFileSync(path.join(root,'ios/App/App/Assets.xcassets/BillNgaiCanvas.colorset/Contents.json'))).colors[0].color.components;
 // Expected components come from the shared --bg token exactly as prepare-web.cjs derives them.
 const canvas=fs.readFileSync(path.join(root,'../billing.html'),'utf8').match(/--bg:\s*#([0-9a-f]{6})\s*;/i)?.[1];assert.ok(canvas,'approved background token');
 const expected=Object.fromEntries(['red','green','blue'].map((key,index)=>[key,(parseInt(canvas.slice(index*2,index*2+2),16)/255).toFixed(6)]));
 assert.deepEqual(colors,{...expected,alpha:'1.000000'});
 assert.match(html,/mobile-iphone-ui.js/);assert.match(html,/mobile-print-preview.js/);
 assert.ok(!html.includes("toast(tr('ส่งออก CSV แล้ว'),'ok');"));
 const icon=fs.readFileSync(path.join(root,'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png'));
 assert.equal(icon.readUInt32BE(16),1024);assert.equal(icon.readUInt32BE(20),1024);assert.equal(icon[25],2,'iOS icon is RGB without alpha');
});

test('print preview token binds the shared file to the exact displayed PDF',async()=>{
 const api=bridge({preparePrintPreview:async args=>{assert.deepEqual(JSON.parse(JSON.stringify(args)),{documentId:'receipt1'});return {documentId:'receipt1',token:'preview-1',pageCount:1};},showPrintPreview:async args=>({presented:args.token==='preview-1'}),exportPDF:async args=>{assert.equal(args.previewToken,'preview-1');assert.equal(args.documentId,'receipt1');return {path:'RC.pdf'};}});
 const value=await api.preparePrintPreview('receipt1');assert.equal((await api.showPrintPreview({token:value.token,documentId:'receipt1'})).presented,true);assert.equal(await api.exportPDF('RC.pdf','receipt1',value.token),'RC.pdf');
});

test('explicit recovery and backup restore serialize with saves and return the restored text contract',async()=>{
 let revision='r1',text='original';const calls=[];const api=bridge({load:async()=>({text,revision}),recover:async args=>{calls.push('recover');text=args.text;revision='restored';return {revision};},restoreBackup:async args=>{assert.equal(args.name,'synthetic.json');calls.push('backup');text='backup data';revision='backup';return {revision};},save:async args=>{assert.equal(args.expectedRevision,revision);calls.push('save');return {revision};}});
 await api.load();await Promise.all([api.recoverData('selected'),api.save('after')]);assert.deepEqual(calls,['recover','save']);assert.equal(await api.restoreBackup('synthetic.json'),'backup data');
});
