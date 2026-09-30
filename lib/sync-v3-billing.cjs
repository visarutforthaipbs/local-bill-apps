'use strict';
const S=require('./sync-v3.cjs');
const arrays={document:'documents',client:'clients',recurring:'recurring',reviewEvent:'reviewEvents'};
const clone=v=>JSON.parse(JSON.stringify(v));
const issued=d=>d&&['quotation','invoice','receipt','tax_invoice'].includes(d.type)&&d.status!=='draft';
const paperKeys=['id','type','number','clientId','issueDate','dueDate','currency','fxRate','vatRate','whtRate','items','notes','project','docLang','parentId','reissueOf','reissueOfNumber','reissueOfDate','issuedSnapshot'];
function facts(d){return Object.fromEntries(paperKeys.filter(k=>Object.hasOwn(d,k)).map(k=>[k,d[k]]));}
function seal(key,record){
 if(key.startsWith('reviewEvent:'))return {sealedHash:S.digest(record),...(record.type==='receipt_reissue'?{number:record.receipt.number}:{}),claims:claims(key,record)};
 if(key.startsWith('document:')&&issued(record))return {sealedHash:S.digest(facts(record)),...(record.number?{number:record.number}:{}),claims:claims(key,record)};
 if(key.startsWith('document:')&&record.number&&record.status!=='draft')return {sealedHash:S.digest(record),number:record.number};
 return {};
}
function claims(key,r){
 if(key.startsWith('reviewEvent:')){
  if(r.type==='receipt_reissue')return ['correction:'+r.documentId];
  if(r.type==='legacy_payment')return ['legacy-payment:'+r.documentId];
  if(r.type==='payment_match')return ['payment-match:'+r.documentId];
 }
 // A receipt shares the payment ID with its invoice. Claim the receipt slot,
 // never claim both papers as separate income transactions.
 if(key.startsWith('document:')&&r.type==='receipt'&&issued(r)&&r.parentId)return ['receipt-for:'+r.parentId];
 return [];
}
// Records whose meaning depends on another record: they wait while that record is under review.
function related(key,r){
 if(!r||typeof r!=='object')return [];
 if(key.startsWith('document:')&&typeof r.parentId==='string'&&r.parentId)return ['document:'+r.parentId];
 if(key.startsWith('reviewEvent:')&&typeof r.documentId==='string'&&r.documentId)return ['document:'+r.documentId];
 return [];
}
function flatten(db){
 const records={'business:main':clone(db.business)};
 for(const [type,field] of Object.entries(arrays))for(const r of db[field]||[]){
  if(!r||typeof r.id!=='string'||!/^[A-Za-z0-9_-]{1,128}$/.test(r.id))throw Error('SYNC_RECORD_ID_UNSUPPORTED');
  const key=type+':'+r.id;if(Object.hasOwn(records,key))throw Error('SYNC_DUPLICATE_ID');records[key]=clone(r);
 }
 return records;
}
function project(db,state){
 const out=clone(db);out.business=clone(state.records['business:main']||db.business);
 for(const [type,field] of Object.entries(arrays))out[field]=Object.entries(state.records).filter(([k])=>k.startsWith(type+':')).map(([,r])=>clone(r));
 return out;
}
function validateTransition(before,after){
 const old=flatten(before),next=flatten(after);
 for(const [key,r] of Object.entries(old)){
  const n=next[key];
  if(key.startsWith('reviewEvent:')&&S.digest(r)!==S.digest(n??null))throw Error('SYNC_REVIEW_EVENT_IMMUTABLE');
  if(key.startsWith('document:')&&issued(r)){
   if(!n||!issued(n)||S.digest(facts(r))!==S.digest(facts(n)))throw Error('SYNC_ISSUED_FACTS_IMMUTABLE');
   if((r.paymentId&&n.paymentId!==r.paymentId)||(r.paidDate&&n.paidDate!==r.paidDate))throw Error('SYNC_PAYMENT_FACTS_IMMUTABLE');
  }
  // A deletion must be an explicit tombstone, never inferred from an absent row.
  if(!n)throw Error('SYNC_USE_TOMBSTONE');
 }
}
function numberParts(format,year){
 if(typeof format!=='string'||typeof year!=='string')throw Error('SYNC_INVALID_NUMBER_FORMAT');
 const expanded=format.replace('{YY}',year),match=expanded.match(/\{?(#+)\}?/);
 const prefix=match?expanded.slice(0,match.index):expanded+'-',suffix=match?expanded.slice(match.index+match[0].length):'',width=match?match[1].length:3;
 if(/[{}#\x00-\x1f]/.test(prefix+suffix)||prefix.length+suffix.length>64||width>9)throw Error('SYNC_INVALID_NUMBER_FORMAT');
 return {prefix,suffix,width};
}
function counterFloors(db){
 const floors={};for(const [key,value] of Object.entries(db.counters||{})){const m=key.match(/^(.*)-(\d{4})$/);const normalized=m&&Number(m[2])>=2500?m[1]+'-'+(Number(m[2])-543):key;floors[normalized]=Math.max(floors[normalized]||0,value);}
 for(const d of [...db.documents,...(db.reviewEvents||[]).filter(e=>e.type==='receipt_reissue').map(e=>e.receipt)]){
  if(!['quotation','invoice','receipt','tax_invoice'].includes(d?.type)||!d?.number||!/^\d{4}-\d{2}-\d{2}$/.test(d.issueDate||''))continue;
  const year=Number(d.issueDate.slice(0,4)),key=d.type+'-'+year;
  const format=db.business.numberFormats?.[d.type]||d.type.toUpperCase()+'-{YY}-{###}';
  for(const yr of [year,year+543]){
   const p=numberParts(format,String(yr).slice(-2));
   if(!d.number.startsWith(p.prefix)||!d.number.endsWith(p.suffix))continue;
   const middle=d.number.slice(p.prefix.length,p.suffix?-p.suffix.length:undefined);
   if(/^\d+$/.test(middle)&&Number.isSafeInteger(Number(middle)))floors[key]=Math.max(floors[key]||0,Number(middle));
  }
 }
 return floors;
}
module.exports={counterFloors,flatten,project,seal,claims,related,validateTransition,numberParts};
