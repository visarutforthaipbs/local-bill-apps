'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../web/mobile-ui.js'),'utf8');
const start=source.indexOf('restoreBackupFile=async function(name){'),end=source.indexOf('render=function(){',start);
function fixture(options={}){
 const calls=[];
 const ctx=vm.createContext({restoreBackupFile:null,loadFailed:true,pendingDataUpgrade:!!options.upgrade,tr:s=>s,
 window:{billingAPI:{syncV3Status:async()=>{calls.push('status');if(options.statusError)throw Error(options.statusError);return {connected:!!options.connected};},restoreBackup:async name=>{calls.push('native restore '+name);if(options.restoreError)throw Error(options.restoreError);return JSON.stringify({synthetic:true});}}},
 askConfirm:async()=>{calls.push('confirm');return options.confirm!==false;},adoptDatabase:db=>{assert.equal(db.synthetic,true);calls.push('adopt');},persist:async()=>{calls.push('persist');return options.persist!==false;},render:()=>calls.push('render'),toast:(text,type)=>calls.push(type+':'+text)});
 vm.runInContext(source.slice(start,end),ctx);return {ctx,calls};
}
test('connected recovery and a failed status check cannot reach confirmation/native restore',async()=>{
 for(const options of [{connected:true},{statusError:'DATA_CHANGED_ON_DISK'}]){const f=fixture(options);assert.equal(await f.ctx.restoreBackupFile('copy.json'),false);assert.equal(f.calls.some(c=>c.startsWith('native restore')),false);assert.equal(f.calls.includes('confirm'),false);}
});
test('canceling recovery changes nothing',async()=>{const f=fixture({confirm:false});assert.equal(await f.ctx.restoreBackupFile('copy.json'),false);assert.deepEqual(f.calls,['status','confirm']);assert.equal(f.ctx.loadFailed,true);});
test('only native acknowledged restore adopts/persists and announces completion',async()=>{const f=fixture();assert.equal(await f.ctx.restoreBackupFile('copy.json'),true);assert.deepEqual(f.calls,['status','confirm','native restore copy.json','adopt','persist','render','ok:กู้คืนข้อมูลแล้ว']);assert.equal(f.ctx.loadFailed,false);});
test('bound-workspace race refusal and failed persistence never report restored',async()=>{for(const options of [{restoreError:'SYNC_DISCONNECT_REQUIRED'},{persist:false}]){const f=fixture(options);assert.equal(await f.ctx.restoreBackupFile('copy.json'),false);assert.equal(f.calls.some(c=>c.startsWith('ok:')),false);assert.equal(f.calls.some(c=>c.includes('SYNC_DISCONNECT_REQUIRED')),false);}});
test('legacy recovery leaves normalization held for explicit upgrade review',async()=>{const f=fixture({upgrade:true});assert.equal(await f.ctx.restoreBackupFile('copy.json'),true);assert.equal(f.calls.includes('persist'),false);assert.equal(f.calls.some(c=>c.startsWith('ok:')),false);assert.equal(f.calls.includes('render'),true);});
