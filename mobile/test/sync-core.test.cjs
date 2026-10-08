const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const bundle=require('../scripts/bundle-sync.cjs');
const S=require('../../lib/sync-v3.cjs');
test('nonempty adoption is explicit, access-checked, revision-checked and atomically bound',async()=>{
 const ctx=vm.createContext({window:{BillingData:require('../../lib/billing-data.cjs'),BillNgaiSyncCore:{S,B:require('../../lib/sync-v3-billing.cjs'),BillingSyncController:require('../../lib/sync-v3-controller.cjs').BillingSyncController}}});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../web/mobile-sync.js'),'utf8'),ctx);
 const local={version:3,business:{businessName:'Synthetic local'},clients:[{id:'c',name:'Synthetic local client'}],documents:[],recurring:[],reviewEvents:[],counters:{},meta:{reviewSemanticsVersion:3}};
 let text=JSON.stringify(local),denied=false,changed=false,fail=false;const calls=[];
 const native={syncConfiguration:async()=>({configured:true}),syncAuthorize:async()=>{calls.push('authorize');if(changed)text=JSON.stringify({...local,business:{businessName:'Changed during authorization'}});},syncRequest:async req=>{calls.push(req.action);if(req.action==='status')return {protocol:3,account:'synthetic',root:'rootFolder'};if(req.action==='inspect'){if(denied)throw Error('SYNC_DRIVE_ACCESS_REQUIRED');return {id:'rootFolder',mimeType:'application/vnd.google-apps.folder'};}throw Error(req.action);}};
 const host=ctx.window.BillNgaiMobileSync.create(native,{read:async()=>text,write:async()=>{throw Error('Adoption must not use normal save');},snapshot:async()=>calls.push('snapshot'),adopt:async payload=>{calls.push('adopt');if(fail)throw Error('DATA_WRITE_FAILED');text=payload;}});
 await assert.rejects(host.connect({approveProtocol:true}),/SYNC_JOIN_REQUIRES_EMPTY_PROFILE/);assert.equal(text,JSON.stringify(local));
 denied=true;await assert.rejects(host.connect({approveProtocol:true,replaceLocal:true}),/SYNC_DRIVE_ACCESS_REQUIRED/);assert.equal(text,JSON.stringify(local));
 denied=false;changed=true;await assert.rejects(host.connect({approveProtocol:true,replaceLocal:true}),/DATA_CHANGED_ON_DISK/);assert.equal(JSON.parse(text).business.businessName,'Changed during authorization');
 text=JSON.stringify(local);changed=false;fail=true;await assert.rejects(host.connect({approveProtocol:true,replaceLocal:true}),/DATA_WRITE_FAILED/);assert.equal(text,JSON.stringify(local));
 fail=false;assert.equal((await host.connect({approveProtocol:true,replaceLocal:true})).mode,'joining');const next=JSON.parse(text);assert.equal(next.clients.length,0);assert.equal(next.syncV3.root,'rootFolder');assert.equal(next.meta.protocolUpgradeApproved,true);
 assert.deepEqual(calls.slice(-5),['snapshot','authorize','status','inspect','adopt']);
 await assert.rejects(host.reserve('receipt',[]),/SYNC_SETUP_PENDING/);
});
test('first-run mobile save initializes only a valid unbound profile and status survives an empty store',async()=>{
 const ctx=vm.createContext({window:{BillingData:require('../../lib/billing-data.cjs'),BillNgaiSyncCore:{S,B:require('../../lib/sync-v3-billing.cjs'),BillingSyncController:require('../../lib/sync-v3-controller.cjs').BillingSyncController}}});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../web/mobile-sync.js'),'utf8'),ctx);
 let text=null,writes=0;
 const host=ctx.window.BillNgaiMobileSync.create({syncConfiguration:async()=>({configured:false})},{read:async()=>text,write:async value=>{text=value;writes++;}});
 assert.equal((await host.status()).connected,false);
 const db={version:3,business:{},clients:[],documents:[],recurring:[],reviewEvents:[],counters:{},meta:{}};
 await assert.rejects(host.save(JSON.stringify({...db,version:4})),/DATA_FUTURE_VERSION/);
 await assert.rejects(host.save(JSON.stringify({...db,syncV3:{...S.initial('synthetic'),root:'root',mode:'active'}})),/SYNC_BINDING_REQUIRED/);
 assert.equal(writes,0);assert.equal(await host.save(JSON.stringify(db)),true);assert.equal(writes,1);
 assert.equal((await host.status()).protocolApproved,false);
 text=JSON.stringify({...db,meta:{protocolUpgradeApproved:true}});assert.equal((await host.status()).protocolApproved,true);
 const broken=ctx.window.BillNgaiMobileSync.create({}, {read:async()=>{throw Error('DATA_CORRUPT');},write:async()=>{throw Error('must not write');}});
 await assert.rejects(broken.save(JSON.stringify(db)),/DATA_CORRUPT/);
});
test('browser bundle uses the exact sync core and matches desktop hashes, including Thai and long payloads',async t=>{
 const p=fs.mkdtempSync(path.join(os.tmpdir(),'billngai-sync-bundle-'));t.after(()=>fs.rmSync(p,{recursive:true,force:true}));await bundle(p);
 const ctx=vm.createContext({window:{},crypto:crypto.webcrypto,TextEncoder,TextDecoder,Uint8Array});vm.runInContext(fs.readFileSync(path.join(p,'mobile-sync-core.js'),'utf8'),ctx);
 const mobile=ctx.window.BillNgaiSyncCore.S;
 for(const value of [null,{},'ภาษาไทย 😀',Array.from({length:1000},(_,i)=>({id:'r'+i,amount:i*970.12})),{version:3,unknown:{ไทย:'รักษาไว้'}}])assert.equal(mobile.digest(value),S.digest(value));
 const state=mobile.edit(mobile.initial('synthetic'),'client:c',{id:'c',name:'Synthetic'}),prepared=mobile.prepare(state);
 assert.match(prepared.pending.operation,/^[a-f0-9-]{36}$/);assert.equal(prepared.pending.changes[0].hash,S.digest({id:'c',name:'Synthetic'}));
});
test('mobile blocks pulling or publishing before a server compatibility upgrade',async()=>{
 const source=fs.readFileSync(path.join(__dirname,'../web/mobile-sync.js'),'utf8');const calls=[];
 const db={version:3,business:{},clients:[],documents:[],recurring:[],reviewEvents:[],counters:{},meta:{protocolUpgradeApproved:true},syncV3:{...S.initial('synthetic'),mode:'joining',root:'rootFolder'}};
 const ctx=vm.createContext({window:{BillingData:require('../../lib/billing-data.cjs'),BillNgaiSyncCore:{S,B:require('../../lib/sync-v3-billing.cjs'),BillingSyncController:require('../../lib/sync-v3-controller.cjs').BillingSyncController}}});vm.runInContext(source,ctx);
 const host=ctx.window.BillNgaiMobileSync.create({syncRequest:async args=>{calls.push(args.action);throw Error('NOT_FOUND');}}, {read:async()=>JSON.stringify(db),write:async()=>{throw Error('must not write');}});
 await assert.rejects(host.run(),/SYNC_PROTOCOL_UPGRADE_REQUIRED/);assert.deepEqual(calls,['protocol/upgrade']);
});
test('synthetic mobile sign-in and Pro exchange join, edit and replay the shared workspace without duplicate changes',async()=>{
 const B=require('../../lib/sync-v3-billing.cjs');
 const source=fs.readFileSync(path.join(__dirname,'../web/mobile-sync.js'),'utf8');
 const ctx=vm.createContext({window:{BillingData:require('../../lib/billing-data.cjs'),BillNgaiSyncCore:{S,B,BillingSyncController:require('../../lib/sync-v3-controller.cjs').BillingSyncController}}});vm.runInContext(source,ctx);
 const seed={version:3,business:{businessName:'Synthetic shared studio'},clients:[{id:'c',name:'Synthetic client'}],documents:[],recurring:[],reviewEvents:[],counters:{},meta:{reviewSemanticsVersion:3}};
 const files={},heads={},records=B.flatten(seed),logs=[{sequence:1,operation:'bootstrap',changes:Object.entries(records).map(([key,record],i)=>{
  const file='seed'+i;files[file]=record;heads[key]={revision:1,hash:S.digest(record)};return {key,base:0,revision:1,hash:S.digest(record),file};
 })}],acks=new Map(),calls=[];
 let authorized=false,pro=false,upgraded=false,proofs=0,snapshots=0;
 let text=JSON.stringify({...seed,business:{},clients:[]});
 const native={syncConfiguration:async()=>({configured:true}),syncAuthorize:async()=>{authorized=true;},syncVerifyPro:async()=>{proofs++;pro=true;},syncRequest:async req=>{
  calls.push(req.action);assert.ok(authorized,'OAuth precedes server access');if(!pro)throw Error('PRO_REQUIRED');
  if(req.action==='status')return {protocol:3,account:'synthetic',root:'rootFolder',sequence:logs.length};
  if(req.action==='inspect')return {id:'rootFolder',mimeType:'application/vnd.google-apps.folder'};
  if(req.action==='protocol/upgrade'){upgraded=true;return {capability:4,minProtocol:4};}
  assert.ok(upgraded,'protocol consent precedes reads and writes');
  if(req.action==='pull')return {transactions:logs.slice(req.body.cursor),cursor:logs.length};
  if(req.action==='download')return files[req.body.file];
  if(req.action==='upload'){const id='file'+Object.keys(files).length;files[id]=JSON.parse(req.body.text);return {id};}
  if(req.action==='commit'){
   if(acks.has(req.body.operation))return acks.get(req.body.operation);
   const changes=req.body.changes.map(c=>{assert.equal(c.base,heads[c.key]?.revision||0);heads[c.key]={revision:c.base+1,hash:c.hash};return {...c,revision:c.base+1};});
   const ack={ok:true,changes};logs.push({sequence:logs.length+1,operation:req.body.operation,changes});acks.set(req.body.operation,ack);return ack;
  }
  throw Error('unexpected '+req.action);
 }};
 const host=ctx.window.BillNgaiMobileSync.create(native,{read:async()=>text,write:async value=>{text=value;},snapshot:async()=>{snapshots++;}});
 await assert.rejects(host.connect(),/SYNC_PROTOCOL_CONSENT_REQUIRED/);assert.equal(authorized,false);
 assert.equal((await host.connect({approveProtocol:true})).mode,'joining');assert.equal(proofs,1);assert.equal(snapshots,1);
 const joined=await host.run();assert.equal(joined.status.mode,'active');assert.equal(JSON.parse(joined.text).clients[0].name,'Synthetic client');
 pro=false;await host.run();assert.equal(proofs,2,'a joined device renews an expired lease once');
 const edit=JSON.parse(text);edit.clients[0].name='Synthetic edited on phone';await host.save(JSON.stringify(edit));await host.run();await host.run();
 assert.equal(logs.length,2);assert.equal(JSON.parse(text).clients[0].name,'Synthetic edited on phone');assert.equal((await host.status()).pending,0);
 assert.ok(calls.includes('download')&&calls.includes('upload')&&calls.includes('commit'));
});

test('joined mobile retries a denied lease once; failed proof/account mismatch never mutates local data',async()=>{
 const db={version:3,business:{},clients:[],documents:[],recurring:[],reviewEvents:[],counters:{},meta:{protocolUpgradeApproved:true},syncV3:{...S.initial('synthetic'),mode:'joining',root:'rootFolder'}};
 const ctx=vm.createContext({window:{BillingData:require('../../lib/billing-data.cjs'),BillNgaiSyncCore:{S,B:require('../../lib/sync-v3-billing.cjs'),BillingSyncController:require('../../lib/sync-v3-controller.cjs').BillingSyncController}}});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'../web/mobile-sync.js'),'utf8'),ctx);
 let requests=0,proofs=0,writes=0,code='PRO_REQUIRED';
 const native={syncRequest:async()=>{requests++;throw Error(code);},syncVerifyPro:async()=>{proofs++;}};
 const host=ctx.window.BillNgaiMobileSync.create(native,{read:async()=>JSON.stringify(db),write:async()=>{writes++;}});
 await assert.rejects(host.run(),/PRO_REQUIRED/);assert.equal(requests,2);assert.equal(proofs,1);assert.equal(writes,0);
 code='SYNC_ACCOUNT_MISMATCH';await assert.rejects(host.run(),/SYNC_ACCOUNT_MISMATCH/);assert.equal(requests,3);assert.equal(proofs,1);assert.equal(writes,0);
 code='PRO_REQUIRED';native.syncVerifyPro=async()=>{proofs++;throw Error('APPSTORE_PRO_REVOKED');};
 await assert.rejects(host.run(),/APPSTORE_PRO_REVOKED/);assert.equal(requests,4);assert.equal(proofs,2);assert.equal(writes,0);
});
