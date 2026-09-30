'use strict';
const S=require('./sync-v3.cjs');
// Transport/storage injected: production adapter must atomically persist ONE replica
// alongside its projected billing data and backup before adoption of a cloud workspace.
class SyncSession {
 constructor({account,read,write,transport,metadata=()=>({}),validateRecord=()=>{},validateReplica=()=>{},related=()=>[]}){
  Object.assign(this,{account,read,write,transport,metadata,validateRecord,validateReplica,related});this.tail=Promise.resolve();
 }
 exclusive(fn){const next=this.tail.then(fn);this.tail=next.catch(()=>{});return next;}
 async load(){const s=await this.read();S.bound(s,this.account);return s;}
 async persist(s){S.bound(s,this.account);this.validateReplica(s);await this.write(s);return s;}
 edit(changes){return this.exclusive(async()=>{
  let s=await this.load();for(const {key,record} of changes){this.validateRecord(key,record);s=S.edit(s,key,record);}return this.persist(s);
 });}
 async pullLocked(s){
  // Limit work per invocation. A later invocation resumes from the durable cursor.
  for(let i=0;i<32;i++){
   const page=await this.transport.pull(s.cursor),payloads={};
   if(!page||!Array.isArray(page.transactions))throw Error('INVALID_PULL');
   for(const tx of page.transactions)for(const c of tx.changes){
    if(!Object.hasOwn(payloads,c.file))payloads[c.file]=await this.transport.download(c.file);
   }
   s=await this.persist(S.ingest(s,page,payloads,this.validateRecord,this.related));
   if(!page.transactions.length)return s;
  }
  return s;
 }
 pull(){return this.exclusive(async()=>this.pullLocked(await this.load()));}
 sync(){return this.exclusive(async()=>{
  let s=await this.load();
  // Settle uncertain request before pulling: its server result can already exist.
  if(!s.pending)s=await this.persist(S.prepare(s,this.metadata));
  if(s.pending){
   for(const change of s.pending.changes){
    if(change.file)continue;
    // Uploads are immutable, unique files. An interrupted response can orphan a file,
    // but it cannot overwrite data or publish the operation twice.
    const file=await this.transport.upload(change.record);
    s=await this.persist(S.attachFile(s,change.key,file));
   }
   const result=await this.transport.commit(S.request(s));
   if(result.ok)s=await this.persist(S.acknowledge(s,result));
   else{
    s=await this.pullLocked(s);
    s=await this.persist(S.rejected(s,result));
   }
  }
  return this.pullLocked(s);
 });}
 resolve(key,choice){return this.exclusive(async()=>this.persist(S.resolve(await this.load(),key,choice)));}
}
module.exports={SyncSession};
