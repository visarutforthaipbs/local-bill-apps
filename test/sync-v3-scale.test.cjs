const {test}=require('node:test');const assert=require('node:assert/strict');
const S=require('../lib/sync-v3.cjs');const B=require('../lib/sync-v3-billing.cjs');const {SyncSession}=require('../lib/sync-v3-session.cjs');
const clone=v=>JSON.parse(JSON.stringify(v));
function workspace(mode,records){const s=S.initial('acct');Object.assign(s,{root:'rootFolder',mode,counterFloors:{'invoice-2026':7}});for(const r of records)s.records['document:'+r.id]=r;return s;}
const drafts=n=>Array.from({length:n},(_,i)=>({id:'d'+i,type:'invoice',status:'draft',notes:'งานทดสอบ '+i}));
// Invoices first, then their receipts: cutting the list at 512 would split payments.
const pairs=n=>[...Array.from({length:n},(_,i)=>({id:'i'+i,type:'invoice',status:'draft'})),...Array.from({length:n},(_,i)=>({id:'r'+i,type:'receipt',status:'draft',parentId:'i'+i}))];
const acknowledge=s=>{let next=s;for(const c of s.pending.changes)next=S.attachFile(next,c.key,'file-'+c.key.replace(':','_'));const request=S.request(next);return S.acknowledge(next,{ok:true,changes:request.changes.map(c=>({...c,revision:c.base+1}))});};

test('first upload of 1,501 records is one operation, with Thai metadata counted in bytes',()=>{
 const s=workspace('initializing',drafts(1501));
 const out=S.prepare(s,key=>({number:'ใบแจ้งหนี้-'+key.slice(9),sealedHash:'a'.repeat(64)}));
 assert.equal(out.pending.changes.length,1501);assert.equal(s.pending,null);
});
test('a first upload over the count or byte bound is refused before anything is prepared',()=>{
 assert.throws(()=>S.prepare(workspace('initializing',drafts(4097))),/^Error: SYNC_BOOTSTRAP_TOO_LARGE$/);
 const wide=key=>({claims:Array.from({length:16},(_,i)=>(key.replace(':','_')+'-'+i).padEnd(200,'x'))});
 const s=workspace('initializing',drafts(600));
 assert.throws(()=>S.prepare(s,wide),/^Error: SYNC_BOOTSTRAP_TOO_LARGE$/);assert.equal(s.pending,null);
 // Thai characters are three UTF-8 bytes each: these 1,700 records fit only by character count.
 const numbered=text=>()=>({number:text.repeat(96),sealedHash:'a'.repeat(64)});
 assert.equal(S.prepare(workspace('initializing',drafts(1700)),numbered('x')).pending.changes.length,1700);
 assert.throws(()=>S.prepare(workspace('initializing',drafts(1700)),numbered('ก')),/^Error: SYNC_BOOTSTRAP_TOO_LARGE$/);
});
test('a small dirty set is prepared exactly as before',()=>{
 const s=workspace('active',drafts(512)),out=S.prepare(s);
 assert.deepEqual(out.pending.changes.map(c=>c.key),Object.keys(s.records));
 assert.deepEqual(Object.keys(out.pending.changes[0]),['key','base','hash','record']);
});
test('more than 512 changes go out in whole dependency groups, each record exactly once',()=>{
 let s=workspace('active',pairs(350));const sent=[];
 for(let round=0;round<4;round++){
  s=S.prepare(s,()=>({}),B.related);if(!s.pending)break;
  const keys=s.pending.changes.map(c=>c.key),set=new Set(keys);
  assert.ok(keys.length<=512);
  for(const key of keys){const id=key.slice(9),partner='document:'+(id[0]==='i'?'r':'i')+id.slice(1);assert.ok(set.has(partner),key+' was sent without '+partner);}
  sent.push(...keys);s=acknowledge(s);
 }
 assert.equal(s.pending,null);assert.equal(sent.length,700);assert.equal(new Set(sent).size,700);
});
test('one dependency group larger than an operation fails explicitly instead of being split',()=>{
 const chain=[{id:'root',type:'invoice',status:'draft'},...Array.from({length:520},(_,i)=>({id:'c'+i,type:'receipt',status:'draft',parentId:'root'}))];
 assert.throws(()=>S.prepare(workspace('active',chain),()=>({}),B.related),/^Error: SYNC_BATCH_TOO_LARGE$/);
 // Unrelated records still progress while the oversized group waits.
 const mixed=S.prepare(workspace('active',[...chain,...drafts(5)]),()=>({}),B.related);
 assert.deepEqual(mixed.pending.changes.map(c=>c.key),drafts(5).map(d=>'document:'+d.id));
});
test('attaching an upload does not modify the previous state',()=>{
 const s=S.prepare(workspace('active',drafts(2))),before=clone(s),next=S.attachFile(s,'document:d0','fileA');
 assert.deepEqual(s,before);assert.equal(next.pending.changes[0].file,'fileA');assert.equal(next.pending.operation,s.pending.operation);
 assert.throws(()=>S.attachFile(next,'document:d0','fileB'),/UPLOAD_ALREADY_ATTACHED/);
});

function harness(state){
 let stored=clone(state),writes=0,failAt=0,downloads=0;const files={},log=[],seen=new Map(),uploads=[];
 const transport={
  upload:async record=>{if(uploads.length+1===failAt){failAt=0;throw Error('NETWORK');}const id='file'+uploads.length;uploads.push(id);files[id]=clone(record);return id;},
  download:async id=>{downloads++;return files[id];},
  commit:async request=>{
   if(!seen.has(request.operation)){const changes=request.changes.map(c=>({...c,revision:c.base+1}));log.push({sequence:log.length+1,operation:request.operation,changes});seen.set(request.operation,{ok:true,sequence:log.length,changes});}
   return seen.get(request.operation);
  },
  pull:async cursor=>{const transactions=log.filter(t=>t.sequence>cursor).slice(0,32);return {transactions,cursor:transactions.at(-1)?.sequence||cursor};}
 };
 const session=new SyncSession({account:'acct',read:async()=>clone(stored),write:async s=>{writes++;stored=clone(s);},transport,related:B.related});
 return {session,transport,files,log,uploads,seen,state:()=>stored,writes:()=>writes,downloads:()=>downloads,failUploadAt:n=>{failAt=n;}};
}
test('one sync sends 700 linked records in two operations with far fewer saves than uploads',async()=>{
 const h=harness(workspace('active',pairs(350)));const s=await h.session.sync();
 assert.equal(h.log.length,2);assert.equal(h.uploads.length,700);assert.equal(s.pending,null);assert.equal(s.cursor,2);
 assert.equal(Object.keys(s.heads).length,700);assert.ok(h.writes()<100,'saves: '+h.writes());
 assert.equal((await h.session.sync()).cursor,2);assert.equal(h.uploads.length,700);
 assert.equal(h.downloads(),0,"own uploads are not downloaded again");
 // Another device has none of these records: it downloads and verifies every payload.
 const other=harness(workspace("active",[]));other.log.push(...h.log);other.transport.download=async id=>{other.fetched=(other.fetched||0)+1;return h.files[id];};
 const joined=await other.session.sync();assert.equal(other.fetched,700);assert.equal(Object.keys(joined.records).length,700);assert.equal(joined.cursor,2);
 // A downloaded payload that does not match its recorded hash is still refused.
 const tampered=harness(workspace("active",[]));tampered.log.push(...h.log);tampered.transport.download=async id=>({...h.files[id],notes:"changed in transit"});
 await assert.rejects(tampered.session.sync(),/PAYLOAD_HASH_MISMATCH/);
});
test('an interrupted upload keeps the operation and its saved files; only unsaved uploads repeat',async()=>{
 const h=harness(workspace('active',drafts(100)));h.failUploadAt(41);
 await assert.rejects(h.session.sync(),/NETWORK/);
 const pending=h.state().pending,attached=pending.changes.filter(c=>c.file).map(c=>c.file);
 // Six at a time, saved after every third group: 36 ids were saved before upload 41 failed.
 assert.equal(attached.length,36);assert.equal(h.log.length,0);
 await h.session.sync();
 assert.equal(h.log.length,1);assert.equal(h.log[0].operation,pending.operation);
 assert.deepEqual(h.log[0].changes.slice(0,36).map(c=>c.file),attached);
 assert.equal(h.uploads.length,41+64);assert.equal(h.state().pending,null);
});
test('a rejected operation still ends settled after pulling the competing change',async()=>{
 const h=harness(workspace('active',drafts(1)));
 const remote={id:'d0',type:'invoice',status:'draft',notes:'จากเครื่องอื่น'};
 h.log.push({sequence:1,operation:'remoteOperation',changes:[{key:'document:d0',base:0,revision:1,hash:S.digest(remote),file:'remoteFile'}]});
 h.transport.download=async()=>remote;let commits=0;
 h.transport.commit=async()=>{commits++;return {ok:false,conflicts:[{key:'document:d0',revision:1}]};};
 const s=await h.session.sync();
 assert.equal(commits,1);assert.equal(s.pending,null);assert.ok(s.conflicts['document:d0']);assert.equal(s.cursor,1);
});
test('a pull retries a failed download and keeps each verified transaction when a later one fails',async()=>{
 const source=harness(workspace('active',pairs(350)));await source.session.sync();
 const other=harness(workspace('active',[]));other.log.push(...source.log);
 let calls=0,broken=null;
 other.transport.download=async id=>{calls++;if(calls===5)throw Error('NETWORK');if(id===broken)throw Error('NETWORK');return source.files[id];};
 // One transient failure is retried: both transactions arrive.
 const first=await other.session.sync();assert.equal(first.cursor,2);assert.equal(Object.keys(first.records).length,700);assert.equal(calls,701);
 // A file that keeps failing stops the pull, but the first transaction stays applied.
 const third=harness(workspace('active',[]));third.log.push(...source.log);broken=source.log[1].changes[0].file;calls=0;
 third.transport.download=other.transport.download;
 await assert.rejects(third.session.sync(),/NETWORK/);
 assert.equal(third.state().cursor,1);assert.equal(Object.keys(third.state().records).length,512);
 broken=null;const done=await third.session.sync();assert.equal(done.cursor,2);assert.equal(Object.keys(done.records).length,700);
});
