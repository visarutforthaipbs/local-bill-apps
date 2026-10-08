'use strict';
const S=require('./sync-v3.cjs');
const PARALLEL=6; // Concurrent Drive transfers per device.
// Transport/storage injected: production adapter must atomically persist ONE replica
// alongside its projected billing data and backup before adoption of a cloud workspace.
class SyncSession {
 constructor({account,read,write,transport,metadata=()=>({}),validateRecord=()=>{},validateReplica=()=>{},related=()=>[]}){
  Object.assign(this,{account,read,write,transport,metadata,validateRecord,validateReplica,related});this.tail=Promise.resolve();
 }
 exclusive(fn){const next=this.tail.then(fn);this.tail=next.catch(()=>{});return next;}
 async load(){const s=await this.read();S.bound(s,this.account);return s;}
 // Continue from what the host actually stored: it may settle a finalization while saving,
 // and the next operation of the same run must not be prepared from the older copy.
 async persist(s){S.bound(s,this.account);this.validateReplica(s);return await this.write(s)||s;}
 edit(changes){return this.exclusive(async()=>{
  let s=await this.load();for(const {key,record} of changes){this.validateRecord(key,record);s=S.edit(s,key,record);}return this.persist(s);
 });}
 // Reading an immutable file is safe to repeat: one lost connection must not discard a
 // transaction of several hundred downloads.
 async download(file){for(let attempt=1;;attempt++){try{return await this.transport.download(file);}catch(error){if(attempt===3)throw error;}}}
 async pullLocked(s){
  // Limit work per invocation. A later invocation resumes from the durable cursor.
  for(let i=0;i<32;i++){
   const page=await this.transport.pull(s.cursor);
   if(!page||!Array.isArray(page.transactions))throw Error('INVALID_PULL');
   if(!page.transactions.length)return this.persist(S.ingest(s,page,{},this.validateRecord,this.related));
   // One transaction at a time: an interruption keeps every transaction already verified.
   for(const tx of page.transactions){
    const payloads={},wanted=[];
    for(const c of tx.changes){
     if(Object.hasOwn(payloads,c.file))continue;
     // A payload is identified by its hash: identical local content (usually our own
     // upload) is used as is instead of being downloaded again.
     if(Object.hasOwn(s.records,c.key)&&S.digest(s.records[c.key])===c.hash)payloads[c.file]=s.records[c.key];
     else{payloads[c.file]=undefined;wanted.push(c.file);}
    }
    for(let i=0;i<wanted.length;i+=PARALLEL)(await Promise.all(wanted.slice(i,i+PARALLEL).map(file=>this.download(file)))).forEach((record,j)=>{payloads[wanted[i+j]]=record;});
    s=await this.persist(S.ingest(s,{transactions:[tx],cursor:tx.sequence},payloads,this.validateRecord,this.related));
   }
   if(page.cursor!==s.cursor)throw Error('INVALID_CURSOR');
  }
  return s;
 }
 pull(){return this.exclusive(async()=>this.pullLocked(await this.load()));}
 sync(){return this.exclusive(async()=>{
  let s=await this.load();
  // A large dirty set goes out as several bounded operations; a later call continues.
  for(let sent=0;sent<16;sent++){
   // Settle uncertain request before pulling: its server result can already exist.
   if(!s.pending){const next=S.prepare(s,this.metadata,this.related);if(sent&&!next.pending)break;s=await this.persist(next);}
   if(!s.pending)break;
   // Uploads are immutable, unique files, sent a few at a time. File ids are saved every
   // 18 uploads, so an interruption can orphan a few files, but it cannot overwrite data
   // or publish twice.
   const todo=s.pending.changes.filter(change=>!change.file);
   for(let i=0;i<todo.length;i+=PARALLEL){
    const group=todo.slice(i,i+PARALLEL),files=await Promise.all(group.map(change=>this.transport.upload(change.record)));
    group.forEach((change,j)=>{s=S.attachFile(s,change.key,files[j]);});
    if((i/PARALLEL)%3===2||i+PARALLEL>=todo.length)s=await this.persist(s);
   }
   const result=await this.transport.commit(S.request(s));
   if(result.ok)s=await this.persist(S.acknowledge(s,result));
   else{
    s=await this.pullLocked(s);
    s=await this.persist(S.rejected(s,result));break;
   }
  }
  return this.pullLocked(s);
 });}
 resolve(key,choice){return this.exclusive(async()=>this.persist(S.resolve(await this.load(),key,choice)));}
}
module.exports={SyncSession};
