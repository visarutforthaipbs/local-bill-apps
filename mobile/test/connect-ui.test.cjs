'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../web/mobile-ui.js'),'utf8');
const start=source.indexOf('connectSyncV3=async function(){'),end=source.indexOf('savePDF=async function(){',start);assert.ok(start>=0&&end>start);
function fixture(options={}){
 const calls=[],status={valid:false,cloudReady:false};let confirmations=0,connects=0;
 const ctx=vm.createContext({connectSyncV3:null,PRO:status,syncV3Info:{configured:true,connected:false},tr:s=>s,isPro:()=>{throw Error('Do not gate auth before native verification');},
  askConfirm:async()=>{calls.push('consent');return ++confirmations===1?options.consent!==false:options.replacement!==false;},approveSyncProtocol:async()=>{calls.push('protocol');return options.protocol!==false;},persist:async force=>{assert.equal(force,true);calls.push('save');return options.save!==false;},
  window:{billingAPI:{syncV3Connect:async args=>{assert.equal(args.approveProtocol,true);assert.equal(args.replaceLocal,++connects===1?undefined:true);calls.push('connect');if(options.error&&connects===1)throw Error(options.error);if(connects===2&&options.replaceError)throw Error(options.replaceError);return {connected:true};},licenseStatus:async()=>{calls.push('pro');return status;}}},
  runSyncV3:async background=>{assert.equal(background,false);calls.push('sync');},syncErrorText:e=>e.message,toast:message=>calls.push(message)});
 vm.runInContext(source.slice(start,end),ctx);return {ctx,calls,status};
}
test('native account authorizes before learning Pro; the UI invents no access',async()=>{const f=fixture();await f.ctx.connectSyncV3();assert.deepEqual(f.calls,['consent','protocol','save','connect','pro','sync']);assert.equal(f.ctx.PRO,f.status);assert.equal(f.ctx.PRO.valid,false);});
for(const step of ['consent','protocol','save'])test('canceled or failed '+step+' never starts Google sign-in',async()=>{const f=fixture({[step]:false});await f.ctx.connectSyncV3();assert.equal(f.calls.includes('connect'),false);assert.equal(f.calls.includes('sync'),false);});
for(const error of ['PRO_REQUIRED','SYNC_OAUTH_CANCELLED'])test(error+' never replaces data or its entitlement',async()=>{const f=fixture({error});await f.ctx.connectSyncV3();assert.deepEqual(f.calls,['consent','protocol','save','connect',error]);assert.equal(f.ctx.PRO,f.status);assert.equal(f.ctx.syncV3Info.connected,false);});
test('existing Drive data requires a second explicit replacement confirmation',async()=>{const f=fixture({error:'SYNC_JOIN_REQUIRES_EMPTY_PROFILE',replacement:false});await f.ctx.connectSyncV3();assert.deepEqual(f.calls,['consent','protocol','save','connect','consent']);assert.equal(f.ctx.syncV3Info.connected,false);});
test('only confirmed replacement retries connect; failure cannot claim success',async()=>{for(const replaceError of [undefined,'DATA_CHANGED_ON_DISK']){const f=fixture({error:'SYNC_JOIN_REQUIRES_EMPTY_PROFILE',replaceError});await f.ctx.connectSyncV3();assert.deepEqual(f.calls,['consent','protocol','save','connect','consent','connect',...(replaceError?[replaceError]:['pro','sync'])]);}});
