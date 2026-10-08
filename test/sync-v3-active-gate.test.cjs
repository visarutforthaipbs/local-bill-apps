const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),vm=require('node:vm');
const {mainHarness}=require('./helpers/main-harness.cjs'),S=require('../lib/sync-v3.cjs');
async function fixture(t,{pages=33,remoteRoot='driveRoot',statusError=false}={}){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'billngai-native-joining-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const db={version:3,business:{businessName:'Synthetic'},clients:[],documents:[],recurring:[],reviewEvents:[],meta:{reviewSemanticsVersion:3},counters:{}};
 db.syncV3=S.initial('synthetic');Object.assign(db.syncV3,{root:'driveRoot',mode:'joining'});
 const file=path.join(root,'billing.json');await fs.writeFile(file,JSON.stringify(db));const h=mainHarness(root);await h.call('data:load');
 h.context.testTransport={status:async()=>{if(statusError)throw Error('NETWORK');return {root:remoteRoot,account:'synthetic',sequence:pages};},pull:async cursor=>({cursor:Math.min(cursor+1,pages),transactions:cursor<pages?[{sequence:cursor+1,operation:'page'+cursor,changes:[{key:'business:main',base:cursor,revision:cursor+1,hash:S.digest({businessName:'Synthetic '+(cursor+1)}),file:'p'+(cursor+1)}]}]:[]}),download:async file=>({businessName:'Synthetic '+file.slice(1)})};
 vm.runInContext('nativeSyncTransport=async()=>testTransport',h.context);
 return {h,read:async()=>JSON.parse(await fs.readFile(file,'utf8'))};
}
test('actual native IPC remains joining after 32-page bounded pull, then activates only when caught up',async t=>{
 const f=await fixture(t);const first=await f.h.call('syncV3:run');assert.equal(JSON.parse(first.text).syncV3.cursor,32);assert.equal((await f.read()).syncV3.mode,'joining');
 await assert.rejects(f.h.call('syncV3:reserve','document:new',{prefix:'INV-',width:3}),/SYNC_SETUP_PENDING/);
 const second=await f.h.call('syncV3:run');assert.equal(JSON.parse(second.text).syncV3.cursor,33);assert.equal((await f.read()).syncV3.mode,'active');
});
test('actual native IPC rejects changed workspace root without enabling issuance',async t=>{
 const f=await fixture(t,{pages:1,remoteRoot:'otherRoot'});await assert.rejects(f.h.call('syncV3:run'),/SYNC_WORKSPACE_CHANGED/);assert.equal((await f.read()).syncV3.mode,'joining');
});
test('actual native IPC cannot activate a joining replica when fresh status fails',async t=>{
 const f=await fixture(t,{pages:1,statusError:true});await assert.rejects(f.h.call('syncV3:run'),/NETWORK/);assert.equal((await f.read()).syncV3.mode,'joining');
});
