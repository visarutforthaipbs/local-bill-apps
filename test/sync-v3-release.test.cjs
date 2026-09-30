// Sync v3 release pieces: disconnect, licence header, production gating. Synthetic data only.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const S=require('../lib/sync-v3.cjs'),B=require('../lib/sync-v3-billing.cjs');
const {createDriveTransport}=require('../lib/sync-v3-drive.cjs');
const {mainHarness}=require('./helpers/main-harness.cjs');
async function bound(t,extra={}){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'billngai-sync-release-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const db={business:{businessName:'Synthetic'},clients:[{id:'c1',name:'Synthetic client'}],documents:[],recurring:[],reviewEvents:[]};
 const st=S.initial('synthetic-subject');st.root='r';st.mode='active';st.records=B.flatten(db);st.heads={};Object.assign(st,extra);db.syncV3=st;
 await fs.writeFile(path.join(root,'billing.json'),JSON.stringify(db));
 const h=mainHarness(root);await h.call('data:load');
 return {root,h,read:async()=>JSON.parse(await fs.readFile(path.join(root,'billing.json'),'utf8'))};
}
test('disconnect keeps local data, removes the binding and leaves a backup',async t=>{
 const p=await bound(t);
 const result=await p.h.call('syncV3:disconnect');
 const disk=await p.read();
 assert.equal(Object.hasOwn(disk,'syncV3'),false);assert.equal(disk.clients[0].name,'Synthetic client');
 assert.equal(result.status.connected,false);
 assert.ok((await fs.readdir(path.join(p.root,'backups'))).some(n=>n.startsWith('billing-before-sync-disconnect-')));
 // Once disconnected, import/restore are available again.
 await p.h.call('data:recover',JSON.stringify({business:{businessName:'Restored'},clients:[],documents:[],recurring:[],reviewEvents:[]}));
 assert.equal((await p.read()).business.businessName,'Restored');
});
test('disconnect waits while an issued document is still unconfirmed',async t=>{
 const p=await bound(t,{intents:{'document:x':{present:false,before:null,hash:'0'.repeat(64)}}});
 await assert.rejects(p.h.call('syncV3:disconnect'),/SYNC_FINALIZATION_PENDING|SYNC_LOCAL_STATE_MISMATCH/);
 assert.ok((await p.read()).syncV3,'binding kept');
});
test('the transport sends the Pro licence to the coordinator only',async()=>{
 const seen=[];
 const fetchImpl=async(url,options)=>{seen.push({url:String(url),license:options.headers['X-BillNgai-License']});
  return new Response(JSON.stringify({protocol:3,root:null,sequence:0,account:'a'}),{status:200});};
 const transport=createDriveTransport({origin:'https://sync.example.invalid',root:'pendingRoot',account:'',license:'synthetic.key',accessToken:async()=>'drive-token',identityToken:async()=>'id-token',fetchImpl});
 await transport.status();
 assert.deepEqual(seen,[{url:'https://sync.example.invalid/v3/status',license:'synthetic.key'}]);
});
test('source runs are not connected to production and the fault switch is development-only',async()=>{
 const main=await fs.readFile(path.join(__dirname,'../main.js'),'utf8');
 assert.match(main,/app\.isPackaged \? SYNC_V3_SERVICE : \(process\.env\.BILLNGAI_SYNC_V3_URL \|\| ''\)/);
 assert.match(main,/const file = !app\.isPackaged && process\.env\.BILLNGAI_SYNC_V3_FAULTS_FILE;/);
 assert.match(main,/SYNC_V3_SERVICE = 'https:\/\/billngai-sync-coordinator\.[a-z0-9-]+\.workers\.dev'/);
});
