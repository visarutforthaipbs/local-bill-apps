'use strict';
// A replica is persisted as ONE object: records + heads + conflicts + in-flight operation.
// The host must serialize calls and atomically replace this object on disk. Never
// persist a cursor separately from the records/conflicts it acknowledges.
const {createHash,randomUUID}=require('node:crypto');
const clone=x=>JSON.parse(JSON.stringify(x));
function canonical(v){
  if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';
  if(v!==null&&typeof v==='object')return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';
  return JSON.stringify(v);
}
const digest=v=>createHash('sha256').update(canonical(v)).digest('hex');
function need(v,code){if(!v)throw Error(code);}
const validKey=k=>/^(document|client|recurring|reviewEvent|business):[A-Za-z0-9_-]{1,128}$/.test(k);
function initial(account){need(typeof account==='string'&&account.length>0,'ACCOUNT_REQUIRED');return {version:3,account,cursor:0,records:{},heads:{},conflicts:{},pending:null};}
function validate(s){
 need(s&&s.version===3&&typeof s.account==='string'&&Number.isSafeInteger(s.cursor)&&s.cursor>=0,'SYNC_STATE_INVALID');
 for(const name of ['records','heads','conflicts'])need(s[name]&&typeof s[name]==='object'&&!Array.isArray(s[name]),'SYNC_STATE_INVALID');
 for(const key of [...Object.keys(s.records),...Object.keys(s.heads),...Object.keys(s.conflicts)])need(validKey(key),'SYNC_STATE_INVALID');
 return s;
}
function bound(s,account){validate(s);need(s.account===account,'SYNC_ACCOUNT_MISMATCH');}
function edit(s,key,record){
 validate(s);need(validKey(key),'INVALID_KEY');
 need(!s.conflicts[key],'RECORD_NEEDS_REVIEW');
 need(record!==undefined,'INVALID_RECORD');
 // Host validator enforces issued facts and schema before this generic layer.
 const out=clone(s);out.records[key]=clone(record);return out;
}
function prepare(s,metadata=()=>({})){
 validate(s);if(s.pending)return clone(s); // An uncertain operation is NEVER rewritten or given a new ID.
 const changes=[];
 for(const [key,record] of Object.entries(s.records)){
  if(s.conflicts[key])continue;
  const hash=digest(record);if(s.heads[key]?.hash===hash)continue;
  changes.push({key,base:s.heads[key]?.revision||0,hash,record:clone(record),...metadata(key,record)});
 }
 if(!changes.length)return clone(s);
 need(changes.length<=512,'SYNC_BATCH_TOO_LARGE');
 const out=clone(s);out.pending={operation:randomUUID(),changes};return out;
}
function attachFile(s,key,file){
 need(s.pending&&/^[A-Za-z0-9_-]{1,128}$/.test(file),'INVALID_UPLOAD');
 const out=clone(s),c=out.pending.changes.find(c=>c.key===key);need(c,'INVALID_UPLOAD');
 need(!c.file||c.file===file,'UPLOAD_ALREADY_ATTACHED');c.file=file;return out;
}
function request(s){
 need(s.pending,'NO_PENDING_OPERATION');return {operation:s.pending.operation,changes:s.pending.changes.map(({record,...change})=>{need(change.file,'UPLOAD_INCOMPLETE');return change;})};
}
function acknowledge(s,result){
 need(s.pending&&result?.ok===true&&Array.isArray(result.changes),'INVALID_ACK');
 const out=clone(s);
 need(result.changes.length===s.pending.changes.length,'INVALID_ACK');
 for(const sent of s.pending.changes){
  const ack=result.changes.find(c=>c.key===sent.key);
  need(ack&&ack.hash===sent.hash&&ack.file===sent.file&&ack.base===sent.base&&ack.revision===sent.base+1,'INVALID_ACK');
  const head=out.heads[sent.key];
  // A pull may already have applied our own operation and subsequent revisions.
  if(!head||head.revision<ack.revision)out.heads[sent.key]={revision:ack.revision,hash:ack.hash};
 }
 out.pending=null;return out; // Cursor moves only when the ordered pull log is validated.
}
function ingest(s,page,payloads,validateRecord=()=>{},related=()=>[]){
 validate(s);need(page&&Array.isArray(page.transactions),'INVALID_PULL');
 const out=clone(s);
 for(const tx of page.transactions){
  need(tx.sequence===out.cursor+1&&typeof tx.operation==='string'&&Array.isArray(tx.changes)&&tx.changes.length>0,'SYNC_LOG_GAP');
  const seen=new Set();
  // Hold a dependent transaction together when any member conflicts. Applying
  // only its invoice or only its receipt can temporarily change income facts.
  const holdGroup=tx.changes.some(c=>{
   const head=out.heads[c.key];if(head&&head.revision>=c.revision)return false;
   if(out.conflicts[c.key])return true;
   // A record that depends on one under review (e.g. a receipt for a conflicting
   // invoice) waits with it, so a Mac never shows half of a payment.
   const payload=Object.hasOwn(payloads,c.file)?payloads[c.file]:null;
   if(payload&&related(c.key,payload).some(k=>out.conflicts[k]))return true;
   if(!Object.hasOwn(out.records,c.key))return false;
   const h=digest(out.records[c.key]);
   const own=out.pending?.operation===tx.operation&&out.pending.changes.some(sent=>sent.key===c.key&&sent.hash===c.hash);
   return !own&&h!==c.hash&&h!==head?.hash;
  });
  if(holdGroup){
   // Join every conflict this transaction touches or depends on into one review group.
   const touched=tx.changes.flatMap(c=>[c.key,...(Object.hasOwn(payloads,c.file)?related(c.key,payloads[c.file]):[])]);
   const joined=new Set(touched.map(k=>out.conflicts[k]?.operation).filter(Boolean));
   for(const conflict of Object.values(out.conflicts))if(joined.has(conflict.operation))conflict.operation=tx.operation;
  }
  for(const c of tx.changes){
   need(validKey(c.key)&&!seen.has(c.key)&&Number.isSafeInteger(c.revision)&&c.revision===c.base+1,'INVALID_REMOTE_REVISION');seen.add(c.key);
   need(Object.hasOwn(payloads,c.file),'PAYLOAD_MISSING');const remote=payloads[c.file];
   need(digest(remote)===c.hash,'PAYLOAD_HASH_MISMATCH');validateRecord(c.key,remote);
   const head=out.heads[c.key];
   // ACK can be ahead of pull. Still verify every payload and sequence, but don't regress.
   if(head&&head.revision>=c.revision){if(head.revision===c.revision)need(head.hash===c.hash,'REVISION_CHANGED');continue;}
   need((head?.revision||0)===c.base,'SYNC_REVISION_GAP');
   const hasLocal=Object.hasOwn(out.records,c.key),local=out.records[c.key];
   const same=hasLocal&&digest(local)===c.hash;
   const ownPending=out.pending?.operation===tx.operation && out.pending.changes.some(sent=>sent.key===c.key&&sent.hash===c.hash);
   const clean=!hasLocal||head?.hash===digest(local);
   if(out.conflicts[c.key]){
    const conflict=out.conflicts[c.key];
    if(conflict.localPresent!==false&&digest(conflict.local)===c.hash){
     // Both Macs now hold exactly the same content: nothing is left to choose.
     out.resolutions=out.resolutions||[];
     out.resolutions.push({key:c.key,choice:'identical',conflict:clone(conflict),at:new Date().toISOString()});
     delete out.conflicts[c.key];out.records[c.key]=clone(remote);
    }else{
     // Never clear an existing conflict just because the next sync is quiet or changed.
     conflict.remote={revision:c.revision,record:clone(remote),hash:c.hash};
    }
   }else if(holdGroup&&!same){
    out.conflicts[c.key]={local:hasLocal?clone(local):null,localPresent:hasLocal,remote:{revision:c.revision,record:clone(remote),hash:c.hash},operation:tx.operation};
   }else if(ownPending){ /* Keep any edits made after this operation was prepared. */ }
   else if(same||clean){out.records[c.key]=clone(remote);}
   else{
    out.conflicts[c.key]={local:clone(local),remote:{revision:c.revision,record:clone(remote),hash:c.hash},operation:tx.operation};
   }
   out.heads[c.key]={revision:c.revision,hash:c.hash};
  }
  out.cursor=tx.sequence;
 }
 need(page.cursor===out.cursor,'INVALID_CURSOR');return out;
}
function resolve(s,key,choice){
 need(s.conflicts[key]&&['local','remote'].includes(choice),'INVALID_RESOLUTION');
 need(!s.pending,'PENDING_OPERATION_MUST_SETTLE');
 const out=clone(s),conflict=out.conflicts[key];
 const group=Object.entries(out.conflicts).filter(([,c])=>c.operation===conflict.operation);
 need(choice==='remote'||group.length===1,'TRANSACTION_REVIEW_REQUIRED');
 out.resolutions=out.resolutions||[];
 for(const [recordKey,c] of group){
  need(choice==='remote'||c.localPresent!==false,'TRANSACTION_REVIEW_REQUIRED');
  out.records[recordKey]=clone(choice==='remote'?c.remote.record:c.local);
  // Preserve both variants in the explicit resolution audit trail.
  out.resolutions.push({key:recordKey,choice,conflict:c,at:new Date().toISOString()});
  delete out.conflicts[recordKey];
 }
 return out;
}
function rejected(s,result){
 need(s.pending&&result?.ok===false&&Array.isArray(result.conflicts)&&result.conflicts.length,'INVALID_REJECTION');
 // Caller must pull and persist remote variants BEFORE dropping the pending batch.
 need(result.conflicts.every(c=>s.conflicts[c.key]||((s.heads[c.key]?.revision||0)>=c.revision&&digest(s.records[c.key])===s.heads[c.key]?.hash)),'PULL_BEFORE_REJECT');
 const out=clone(s);out.pending=null;return out;
}
module.exports={canonical,digest,initial,validate,bound,edit,prepare,attachFile,request,acknowledge,ingest,resolve,rejected};
