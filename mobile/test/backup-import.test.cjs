'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const BillingData=require('../../lib/billing-data.cjs');
const bridgeSource=fs.readFileSync(path.join(__dirname,'../web/mobile-bridge.js'),'utf8');
const uiSource=fs.readFileSync(path.join(__dirname,'../web/mobile-ui.js'),'utf8');
const fixture=()=>({version:3,business:{businessName:'Synthetic business'},clients:[],documents:[],recurring:[],meta:{synthetic:true}});
function picker(options={}){
 const listeners=new Map(),windowListeners=new Map();let input,clicks=0,removed=0;
 const window={Capacitor:{registerPlugin:()=>({})},addEventListener:(n,f)=>windowListeners.set(n,f),removeEventListener:n=>windowListeners.delete(n)};
 const document={body:{append(){}},createElement(){input={files:[],addEventListener:(n,f)=>listeners.set(n,f),removeEventListener:n=>listeners.delete(n),remove:()=>removed++,click(){clicks++;if(options.clickError)throw Error('synthetic');}};return input;}};
 const ctx=vm.createContext({window,document,setTimeout});vm.runInContext(bridgeSource,ctx);
 return {api:window.billingAPI,select:file=>{input.files=file?[file]:[];listeners.get('change')();},cancel:()=>listeners.get('cancel')(),get clicks(){return clicks;},get removed(){return removed;},listeners,windowListeners};
}
test('picker starts within the gesture, refuses overlap, and cancellation releases all listeners',async()=>{
 const p=picker(),result=p.api.importData();assert.equal(p.clicks,1);await assert.rejects(p.api.importData(),/IMPORT_BUSY/);
 p.cancel();assert.equal(await result,null);assert.equal(p.removed,1);assert.equal(p.listeners.size,0);assert.equal(p.windowListeners.size,0);
 const again=p.api.importData();p.cancel();assert.equal(await again,null);assert.equal(p.clicks,2);
});
test('picker checks the byte limit before reading and cleans up read/launch failures',async()=>{
 const p=picker();let reads=0;const large=p.api.importData();p.select({size:64*1024*1024+1,text(){reads++;return Promise.resolve('no');}});
 await assert.rejects(large,/IMPORT_FILE_TOO_LARGE/);assert.equal(reads,0);
 const broken=p.api.importData();p.select({size:10,text(){throw Error('read');}});await assert.rejects(broken,/IMPORT_READ_FAILED/);
 const launch=picker({clickError:true});await assert.rejects(launch.api.importData(),/IMPORT_PICKER_FAILED/);assert.equal(launch.removed,1);
 assert.equal(p.listeners.size,0);assert.equal(p.windowListeners.size,0);
});
test('picker returns exact UTF-8 file text without touching native storage',async()=>{
 const p=picker(),result=p.api.importData();p.select({size:100,text:async()=>'{"name":"ภาษาไทย"}'});assert.equal(await result,'{"name":"ภาษาไทย"}');assert.equal(p.removed,1);
});
function importer(options={}){
 const calls=[];let stored=fixture(),adopted=null;const selected=options.text===undefined?JSON.stringify({...fixture(),syncV3:{account:'foreign'},meta:{synthetic:true,protocolUpgradeApproved:true},unknown:{keep:true}}):options.text;
 const context={elImport:null,tr:s=>s,BillingData,loadFailed:true,pendingDataUpgrade:!!options.upgrade,
 window:{billingAPI:{importData:async()=>{calls.push('pick');return selected;},syncV3Status:async()=>{calls.push('status');if(options.statusError)throw Error('status');return {connected:!!options.connected};},recoverData:async text=>{calls.push('recover');assert.equal(text,selected);if(options.nativeError)throw Error(options.nativeError);stored=JSON.parse(text);delete stored.syncV3;delete stored.meta.protocolUpgradeApproved;},load:async()=>{calls.push('readback');if(options.readError)throw Error('read');return JSON.stringify(stored);}}},
 askConfirm:async(text,detail)=>{calls.push('confirm');assert.match(detail.detail,/ไม่มีการรวมข้อมูล/);return options.confirm!==false;},
 adoptDatabase:db=>{adopted=db;calls.push('adopt');},persist:async()=>{calls.push('persist');return options.persist!==false;},render:()=>calls.push('render'),toast:(text,type)=>calls.push(type+':'+text)};
 const ctx=vm.createContext(context),start=uiSource.indexOf('function mobileImportErrorText('),end=uiSource.indexOf('// Keep mobile operation lifetime',start);vm.runInContext(uiSource.slice(start,end),ctx);
 return {ctx,calls,get adopted(){return adopted;}};
}
test('cancel, malformed/future/schema data never reach confirmation or native recovery',async()=>{
 for(const options of [{text:null},{text:'{bad'},{text:JSON.stringify({...fixture(),version:999})},{text:JSON.stringify({...fixture(),documents:[{id:'broken',type:'receipt',items:'invalid'}]})}]){
  const f=importer(options);assert.equal(await f.ctx.elImport(),false);assert.equal(f.calls.includes('confirm'),false);assert.equal(f.calls.includes('recover'),false);assert.equal(f.adopted,null);
 }
});
test('connected or unknown status and declined replacement leave local data untouched',async()=>{
 for(const options of [{connected:true},{statusError:true},{confirm:false}]){const f=importer(options);assert.equal(await f.ctx.elImport(),false);assert.equal(f.calls.includes('recover'),false);assert.equal(f.adopted,null);}
});
test('native race refusal, readback failure, and failed persistence never report success',async()=>{
 for(const options of [{nativeError:'SYNC_DISCONNECT_REQUIRED'},{nativeError:'DATA_INVALID_SCHEMA'},{readError:true},{persist:false}]){const f=importer(options);assert.equal(await f.ctx.elImport(),false);assert.equal(f.calls.some(c=>c.startsWith('ok:')),false);if(options.nativeError||options.readError)assert.equal(f.adopted,null);assert.equal(f.calls.some(c=>c.includes('SYNC_DISCONNECT_REQUIRED')),false);}
});
test('successful recovery adopts only the native cleaned result and preserves unknown fields',async()=>{
 const f=importer();assert.equal(await f.ctx.elImport(),true);assert.deepEqual(f.calls,['pick','status','confirm','recover','readback','adopt','persist','render','ok:กู้คืนข้อมูลแล้ว']);assert.equal(f.adopted.syncV3,undefined);assert.equal(f.adopted.meta.protocolUpgradeApproved,undefined);assert.equal(f.adopted.unknown.keep,true);
});
test('legacy import remains held for explicit upgrade, without autosaving or success claim',async()=>{
 const f=importer({upgrade:true});assert.equal(await f.ctx.elImport(),true);assert.equal(f.calls.includes('persist'),false);assert.equal(f.calls.some(c=>c.startsWith('ok:')),false);assert.equal(f.calls.includes('render'),true);
});
