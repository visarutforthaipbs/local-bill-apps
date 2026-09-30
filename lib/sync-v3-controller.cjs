'use strict';
const {randomUUID}=require('node:crypto');
const S=require('./sync-v3.cjs');const B=require('./sync-v3-billing.cjs');const {SyncSession}=require('./sync-v3-session.cjs');
const clone=v=>JSON.parse(JSON.stringify(v));
const issued=r=>r&&['quotation','invoice','receipt','tax_invoice'].includes(r.type)&&r.status!=='draft';
// Main-process adapter. read/write refer to the SAME billing.json and the host's
// data lock, schema validator and backup routine. No parallel sidecar cursor.
class BillingSyncController {
 constructor({account,read,write,transport,validateDatabase}){Object.assign(this,{account,read,write,transport,validateDatabase});}
 async state(){const db=await this.read();S.bound(db.syncV3,this.account);return db.syncV3;}
 async persist(state){
  const db=await this.read();S.bound(state,this.account);
  // An online finalization is invisible in the ledger until its commit is known.
  const view=clone(state);view.intents=view.intents||{};
  for(const [key,intent] of Object.entries(view.intents)){
   if(!view.pending&&!view.conflicts[key]&&view.heads[key]?.hash===intent.hash){delete view.intents[key];continue;}
   if(intent.present)view.records[key]=clone(intent.before);else delete view.records[key];
  }
  const next=B.project(db,view);next.syncV3={...state,intents:view.intents};
  this.validateDatabase(next);B.validateTransition(db,next);await this.write(next);return next.syncV3;
 }
 session(){return new SyncSession({account:this.account,read:()=>this.state(),write:s=>this.persist(s),transport:this.transport,related:B.related,
  metadata:(key,r)=>({...B.seal(key,r),...(this.currentReservations?.[key]?{reservation:this.currentReservations[key].operation}:{})})});}
 async sync(){const s=await this.state();this.currentReservations=s.reservations||{};await this.session().sync();return this.read();}
 async reserve(key,parts){
  if(typeof key!=='string'||!/^(document|reviewEvent):[A-Za-z0-9_-]{1,128}$/.test(key)||!parts||typeof parts.prefix!=='string'||typeof parts.suffix!=='string'||parts.prefix.length+parts.suffix.length>64||/[{}#\x00-\x1f]/.test(parts.prefix+parts.suffix)||!Number.isInteger(parts.width)||parts.width<1||parts.width>9)throw Error('SYNC_INVALID_RESERVATION');
  let s=await this.state();if(s.conflicts[key]||s.intents?.[key])throw Error('SYNC_RECORD_NEEDS_REVIEW');
  const previous=s.reservations?.[key];
  const request=previous&&S.canonical(previous.parts)===S.canonical(parts)?{operation:previous.operation,key,...parts}:{operation:randomUUID(),key,...parts};
  s.reservations=s.reservations||{};s.reservations[key]={operation:request.operation,parts};await this.persist(s);
  const result=await this.transport.reserve(request);
  if(typeof result?.number!=='string'||result.reservation!==request.operation)throw Error('SYNC_INVALID_RESERVATION');
  s=await this.state();s.reservations[key].number=result.number;await this.persist(s);return result.number;
 }
 async save(next){
  const current=await this.read();S.bound(current.syncV3,this.account);this.validateDatabase(next);B.validateTransition(current,next);
  const before=B.flatten(current),after=B.flatten(next);let s=clone(current.syncV3),online=false;
  s.intents=s.intents||{};
  for(const [key,record] of Object.entries(after)){
   if(Object.hasOwn(before,key)&&S.digest(before[key])===S.digest(record))continue;
   if(s.intents[key])throw Error('SYNC_FINALIZATION_PENDING');
   s=S.edit(s,key,record);
   const needsOnline=(key.startsWith('document:')&&issued(record))||key.startsWith('reviewEvent:');
   if(needsOnline){
    if(Object.keys(current.syncV3.intents||{}).length)throw Error('SYNC_FINALIZATION_PENDING');
    const paper=record.type==='receipt_reissue'?record.receipt:record;
    if((record.type==='receipt_reissue'||(key.startsWith('document:')&&issued(record)&&!issued(before[key])))&&paper.number!==s.reservations?.[key]?.number)throw Error('SYNC_NUMBER_RESERVATION_REQUIRED');
    s.intents[key]={present:Object.hasOwn(before,key),before:before[key]||null,hash:S.digest(record)};online=true;
   }
  }
  // Preserve unrelated local settings/counters. Replicated records and metadata
  // are written atomically, including pending finalizations invisible to reports.
  const basis=clone(next);basis.syncV3=s;
  const visible=clone(s);for(const [key,intent] of Object.entries(s.intents)){if(intent.present)visible.records[key]=intent.before;else delete visible.records[key];}
  const stored=B.project(basis,visible);stored.syncV3=s;this.validateDatabase(stored);await this.write(stored);
  if(online){
   // A prior uncertain operation must settle first, then send the new finalization.
   try { await this.sync(); } catch { throw Error('SYNC_FINALIZATION_PENDING'); } const remaining=await this.state();if(Object.keys(remaining.intents||{}).length&&!remaining.pending)await this.sync();
   if(Object.keys((await this.state()).intents||{}).length)throw Error('SYNC_FINALIZATION_PENDING');
  }
  return this.read();
 }
 async resolve(key,choice){
  const state=await this.state();if(state.intents?.[key]&&choice==='local')throw Error('SYNC_FINALIZATION_REQUIRES_REVIEW');
  const group=Object.entries(state.conflicts).filter(([,c])=>c.operation===state.conflicts[key]?.operation).map(([k])=>k);
  const resolved=S.resolve(state,key,choice);
  // An accepted remote transaction replaces, rather than publishes, local intents.
  if(choice==='remote')for(const k of group)if(resolved.intents)delete resolved.intents[k];
  const projected=B.project(await this.read(),resolved);this.validateDatabase(projected);
  await this.persist(resolved);return this.read();
 }
}
module.exports={BillingSyncController};
