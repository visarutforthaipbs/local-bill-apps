const {test}=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs/promises');const os=require('node:os');const path=require('node:path');
const S=require('../lib/sync-v3.cjs');const {SyncSession}=require('../lib/sync-v3-session.cjs');
async function fixture(t){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'billngai-sync-v3-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const file=path.join(root,'replica.json');await fs.writeFile(file,JSON.stringify(S.initial('testAccount')));
 const read=async()=>JSON.parse(await fs.readFile(file,'utf8'));
 const write=async(s)=>{const f=await fs.open(file+'.new','w');try{await f.writeFile(JSON.stringify(s));await f.sync();}finally{await f.close();}await fs.rename(file+'.new',file);};
 const files={},log=[],operations=new Map(),heads={};let calls=0,loseResponse=false;
 const transport={
  upload:async record=>{const id='file'+Object.keys(files).length;files[id]=record;return id;},download:async id=>files[id],
  commit:async request=>{
   calls++;let result=operations.get(request.operation);
   if(!result){
    const conflicts=request.changes.filter(c=>(heads[c.key]?.revision||0)!==c.base).map(c=>({key:c.key,...heads[c.key]}));
    if(conflicts.length)return {ok:false,conflicts};
    const changes=request.changes.map(c=>({...c,revision:c.base+1}));for(const c of changes)heads[c.key]=c;
    log.push({sequence:log.length+1,operation:request.operation,changes});result={ok:true,changes};operations.set(request.operation,result);
   }
   if(loseResponse){loseResponse=false;throw Error('SIMULATED_CONNECTION_LOST');}return result;
  },
  pull:async cursor=>({transactions:log.slice(cursor),cursor:log.length})
 };
 const session=()=>new SyncSession({account:'testAccount',read,write,transport});
 return {root,file,read,write,transport,files,log,session,lose:()=>{loseResponse=true;},calls:()=>calls};
}
test('disk restart retries unknown result once and keeps payment history singular',async t=>{
 const f=await fixture(t);let app=f.session();await app.edit([{key:'reviewEvent:payment1',record:{id:'payment1',type:'legacy_payment',amount:1500}}]);
 f.lose();await assert.rejects(app.sync(),/SIMULATED_CONNECTION_LOST/);assert.ok((await f.read()).pending);
 app=f.session();await app.sync();const state=await f.read();assert.equal(state.pending,null);assert.equal(state.cursor,1);assert.equal(f.log.length,1);assert.equal(f.calls(),2);
 assert.equal(Object.keys(state.records).length,1);
});
test('failed atomic local acknowledgment retains retryable pending operation',async t=>{
 const f=await fixture(t);let fail=false;
 const app=new SyncSession({account:'testAccount',read:f.read,write:async s=>{if(fail&&!s.pending&&s.heads['document:a'])throw Error('DISK_FULL');return f.write(s);},transport:f.transport});
 await app.edit([{key:'document:a',record:{amount:10}}]);fail=true;await assert.rejects(app.sync(),/DISK_FULL/);
 assert.ok((await f.read()).pending);fail=false;await app.sync();assert.equal(f.log.length,1);assert.equal((await f.read()).cursor,1);
});
test('corrupted remote file leaves cursor and records unchanged on disk',async t=>{
 const f=await fixture(t);const c={key:'document:a',base:0,hash:S.digest({amount:10}),file:'broken'};f.files.broken={amount:99};await f.transport.commit({operation:'other',changes:[c]});
 const before=await fs.readFile(f.file,'utf8');await assert.rejects(f.session().pull(),/PAYLOAD_HASH_MISMATCH/);assert.equal(await fs.readFile(f.file,'utf8'),before);
});
test('two disk replicas retain concurrent draft variants and resolve explicitly',async t=>{
 const f=await fixture(t);const first=f.session();await first.edit([{key:'document:a',record:{amount:10}}]);await first.sync();
 let disk2=JSON.parse(JSON.stringify(await f.read()));const second=new SyncSession({account:'testAccount',read:async()=>JSON.parse(JSON.stringify(disk2)),write:async s=>{disk2=JSON.parse(JSON.stringify(s));},transport:f.transport});
 await first.edit([{key:'document:a',record:{amount:20}}]);await second.edit([{key:'document:a',record:{amount:30}}]);await first.sync();await second.sync();
 assert.equal(disk2.conflicts['document:a'].local.amount,30);assert.equal(disk2.conflicts['document:a'].remote.record.amount,20);
 await second.resolve('document:a','local');await second.sync();await first.pull();assert.equal((await f.read()).records['document:a'].amount,30);
});
