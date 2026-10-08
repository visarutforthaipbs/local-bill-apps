(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.BillingData=api;})(globalThis,function(){
'use strict';
function canonical(value){
 if(Array.isArray(value))return '['+value.map(v=>canonical(v)??'null').join(',')+']';
 if(value && typeof value==='object')return '{'+Object.keys(value).filter(k=>value[k]!==undefined).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
 return JSON.stringify(value);
}
// Synchronous SHA-256 of ASCII text. Every host of this validator (Electron renderer and main
// process, WKWebView, JavaScriptCore) needs the same check, and only some have a native one.
function sha256(text){
 const K=sha256.K||(sha256.K=Array.from({length:64},(_,i)=>{let n=2,c=0;for(;;n++){let p=true;for(let d=2;d*d<=n;d++)if(n%d===0){p=false;break;}if(p&&c++===i)break;}return Math.floor((Math.cbrt(n)%1)*4294967296);}));
 const h=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19],n=text.length,w=new Int32Array(64);
 const bytes=new Uint8Array(((n+8>>6)+1)<<6);for(let i=0;i<n;i++)bytes[i]=text.charCodeAt(i);bytes[n]=0x80;
 const view=new DataView(bytes.buffer);view.setUint32(bytes.length-8,Math.floor(n/536870912));view.setUint32(bytes.length-4,n<<3);
 const r=(x,k)=>(x>>>k)|(x<<(32-k));
 for(let o=0;o<bytes.length;o+=64){
  for(let i=0;i<16;i++)w[i]=view.getInt32(o+i*4);
  for(let i=16;i<64;i++){const a=w[i-15],b=w[i-2];w[i]=(w[i-16]+(r(a,7)^r(a,18)^(a>>>3))+w[i-7]+(r(b,17)^r(b,19)^(b>>>10)))|0;}
  let [a,b,c,d,e,f,g,k]=h;
  for(let i=0;i<64;i++){
   const t1=(k+(r(e,6)^r(e,11)^r(e,25))+((e&f)^(~e&g))+K[i]+w[i])|0,t2=((r(a,2)^r(a,13)^r(a,22))+((a&b)^(a&c)^(b&c)))|0;
   k=g;g=f;f=e;e=(d+t1)|0;d=c;c=b;b=a;a=(t1+t2)|0;
  }
  [a,b,c,d,e,f,g,k].forEach((v,i)=>{h[i]=(h[i]+v)|0;});
 }
 return h.map(v=>(v>>>0).toString(16).padStart(8,'0')).join('');
}
// A business image stored once and named by the SHA-256 of its text. Issued originals refer
// to it as "asset:<hash>" instead of carrying their own copies.
const ASSET_MAX=4*1024*1024,ASSET_DATA=/^data:image\/(?:png|jpe?g|gif|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$/;
const verifiedAssets=new Map(); // hash -> text already checked, so each save does not hash it again
function validAsset(hash,value){
 if(!/^[a-f0-9]{64}$/.test(hash)||typeof value!=='string'||value.length>ASSET_MAX||!ASSET_DATA.test(value))return false;
 if(verifiedAssets.get(hash)===value)return true;
 if(sha256(value)!==hash)return false;
 verifiedAssets.set(hash,value);return true;
}
function paymentFacts(record){const facts=JSON.parse(JSON.stringify(record));for(const key of ['whtCertReceived','whtCertNo','whtCertNumber','whtCertDate','updatedAt','legacy_review_required','archivedAt'])delete facts[key];return facts;}
function validReceiptReissueEvent(e){
  const obj=v=>!!v&&typeof v==='object'&&!Array.isArray(v),str=v=>typeof v==='string'&&!!v.trim();
  const date=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;
  const num=v=>(typeof v==='number'||(typeof v==='string'&&!!v.trim()))&&Number.isFinite(Number(v));
  const party=(p,seller)=>obj(p)&&str(seller?p.businessName:p.name)&&str(p.address)&&(!seller||/^\d{13}$/.test(p.taxId||''));
  if(!obj(e)||e.type!=='receipt_reissue'||!str(e.id)||!str(e.documentId)||e.purpose!=='document_correction_only'||
    e.historicalVatConfirmed!==true||e.partyDetailsConfirmed!==true||e.paymentFactsConfirmed!==true||!str(e.note)||e.note.length>4000||
    typeof e.recordedAt!=='string'||!Number.isFinite(Date.parse(e.recordedAt))||new Date(e.recordedAt).toISOString()!==e.recordedAt)return false;
  const src=e.sourceRecordAtReview,r=e.receipt,s=r&&r.issuedSnapshot;
  if(!obj(src)||src.id!==e.documentId||src.type!=='tax_invoice'||src.status!=='issued'||src.deletedAt||src.voidedAt||src.syncConflict||
    !str(src.number)||![0,'0'].includes(src.vatRate)||src.currency!=='THB'||!date(src.paidDate)||!date(src.issueDate)||
    !num(src.whtRate)||Number(src.whtRate)<0||Number(src.whtRate)>100||!Array.isArray(src.items)||!src.items.length||
    src.items.some(i=>!obj(i)||!str(i.description)||!num(i.qty)||Number(i.qty)<=0||!num(i.price)||Number(i.price)<0))return false;
  if(!obj(r)||r.id!=='reissue:'+e.id||r.type!=='receipt'||r.status!=='issued'||!str(r.number)||r.number===src.number||
    r.reissueOf!==src.id||r.reissueOfNumber!==src.number||r.reissueOfDate!==src.issueDate||r.clientId!==src.clientId||r.paidDate!==src.paidDate||r.currency!=='THB'||r.vatRate!==0||
    Number(r.whtRate)!==Number(src.whtRate)||!date(r.issueDate)||r.issueDate<r.paidDate||r.deletedAt||r.voidedAt||r.legacy_review_required||
    r.paymentId||r.fullPaymentConfirmed||canonical(r.items)!==canonical(src.items))return false;
  if(!obj(s)||s.schemaVersion!==1||!party(s.business,true)||s.business.vatStatus!=='non_registered'||!party(s.buyer,false)||
    !['th','bilingual'].includes(s.docLang)||!obj(s.document)||!obj(s.amounts)||typeof s.renderedHtml!=='string'||typeof s.shareText!=='string')return false;
  const plain={...r};delete plain.issuedSnapshot;
  if(canonical(plain)!==canonical(s.document))return false;
  const round=n=>Math.round((n+Number.EPSILON)*100)/100;
  const subtotal=round(src.items.reduce((sum,i)=>sum+round(Number(i.qty)*Number(i.price)),0)),wht=round(subtotal*Number(src.whtRate)/100);
  const expected={subtotal,vatRate:0,whtRate:Number(src.whtRate),vatAmount:0,whtAmount:wht,grandTotal:subtotal,netPayable:round(subtotal-wht),currency:'THB'};
  return subtotal>0&&subtotal<=Number.MAX_SAFE_INTEGER/100&&expected.netPayable>0&&Object.entries(expected).every(([k,v])=>s.amounts[k]===v);
}
function validReceiptReissueSet(data){
  const sources=new Set(),numbers=new Set((data.documents||[]).map(d=>d.number).filter(Boolean));
  for(const e of data.reviewEvents||[]){
    if(e.type!=='receipt_reissue')continue;
    if(!validReceiptReissueEvent(e)||sources.has(e.documentId)||numbers.has(e.receipt.number))return false;
    sources.add(e.documentId);numbers.add(e.receipt.number);
  }
  return true;
}

function validCorrectionReviewEvent(event) {
  const object = value => !!value && typeof value === 'object' && !Array.isArray(value);
  if (!object(event) || typeof event.id !== 'string' || !event.id || event.type !== 'correction_review'
    || typeof event.documentId !== 'string' || !event.documentId || typeof event.batchId !== 'string' || !event.batchId
    || !['unknown','not_sent','sent'].includes(event.deliveryStatus) || event.historicalVatConfirmed !== true
    || event.vatStatus !== 'non_registered' || !['review','prepare_proposal'].includes(event.action)
    || typeof event.note !== 'string' || !event.note.trim() || event.note.length > 4000
    || typeof event.recordedAt !== 'string' || !Number.isFinite(Date.parse(event.recordedAt))
    || new Date(event.recordedAt).toISOString() !== event.recordedAt) return false;
  const source = event.sourceRecordAtReview;
  if (!object(source) || source.id !== event.documentId || source.type !== 'tax_invoice') return false;
  if (event.action === 'review') return event.proposal === undefined;
  const numeric = value => (typeof value === 'number' || (typeof value === 'string' && !!value.trim())) && Number.isFinite(Number(value));
  if (!Array.isArray(source.items) || !source.items.length || source.items.some(item => !object(item)
    || typeof item.description !== 'string' || !item.description.trim() || !numeric(item.qty) || Number(item.qty) <= 0
    || !numeric(item.price) || Number(item.price) < 0) || !numeric(source.whtRate) || Number(source.whtRate) < 0 || Number(source.whtRate) > 100) return false;
  const proposal = event.proposal;
  return object(proposal) && Object.keys(proposal).length === 3 && proposal.type === 'receipt'
    && proposal.status === 'review_only' && proposal.sourceDocumentId === event.documentId
    && !source.deletedAt && !source.voidedAt && source.status !== 'void' && !source.milestone
    && [0,'0'].includes(source.vatRate) && source.currency === 'THB';
}
// Owner's answer for one unresolved historical payment group. Append-only; the latest
// valid answer whose source records still match the group exactly is the one used.
function validLegacyGroupReview(event) {
  const object = value => !!value && typeof value === 'object' && !Array.isArray(value);
  if (!object(event) || event.type !== 'legacy_group_review' || typeof event.id !== 'string' || !event.id
    || !['same_payment','not_income','needs_accountant'].includes(event.decision) || event.ownerConfirmed !== true
    || typeof event.note !== 'string' || !event.note.trim() || event.note.length > 4000
    || typeof event.recordedAt !== 'string' || !Number.isFinite(Date.parse(event.recordedAt))
    || new Date(event.recordedAt).toISOString() !== event.recordedAt
    || typeof event.groupKey !== 'string' || !event.groupKey || event.groupKey.length > 200
    || !Array.isArray(event.sourceRecords) || !event.sourceRecords.length || event.sourceRecords.length > 50
    || event.sourceRecords.some(record => !object(record) || typeof record.id !== 'string' || !record.id)) return false;
  if(event.supersedes!==undefined&&(!Array.isArray(event.supersedes)||event.supersedes.length>500||event.supersedes.some(id=>typeof id!=='string'||!id||id===event.id)||new Set(event.supersedes).size!==event.supersedes.length))return false;
  const ids = event.sourceRecords.map(record => record.id);
  if (new Set(ids).size !== ids.length || !ids.includes(event.documentId)) return false;
  return event.decision === 'same_payment'
    ? typeof event.representativeId === 'string' && ids.includes(event.representativeId)
    : event.representativeId === undefined;
}
function isLegacyDeletionMarker(record) {
  const timestamp = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)
    && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().replace('.000Z','Z') === value.replace('.000Z','Z');
  return !!record && typeof record === 'object' && !Array.isArray(record)
    && typeof record.id === 'string' && !!record.id && !Object.hasOwn(record,'type')
    && timestamp(record.deletedAt) && timestamp(record.updatedAt)
    && Object.keys(record).every(key => ['id','deletedAt','updatedAt','currency','archivedAt'].includes(key))
    && (record.currency === undefined || typeof record.currency === 'string')
    && (record.archivedAt == null || timestamp(record.archivedAt));
}
function validate(data,{strictLiveDocuments=false}={}) {
  if(data && typeof data==='object' && Object.hasOwn(data,'version')){
    if(typeof data.version!=='number'||!Number.isInteger(data.version)||data.version<1) throw Error('DATA_INVALID_SCHEMA');
    if(data.version>3)throw Error('DATA_FUTURE_VERSION');
  }
  if (!data || typeof data !== 'object' || Array.isArray(data) ||
      !data.business || typeof data.business !== 'object' || Array.isArray(data.business) ||
      !Array.isArray(data.documents) || !Array.isArray(data.clients) ||
      (data.recurring != null && !Array.isArray(data.recurring))) throw new Error('DATA_INVALID_SCHEMA');
  const object = value => value && typeof value === 'object' && !Array.isArray(value);
  const invalid = () => { throw new Error('DATA_INVALID_SCHEMA'); };
  const strings = (record, keys) => keys.forEach(key => {
    if (record[key] != null && typeof record[key] !== 'string') invalid();
  });
  const party = record => {
    if (!object(record)) invalid();
    strings(record, ['id','name','businessName','businessNameEn','address','addressEn','taxId','phone','email','contactPerson','notes','docLang','lang','uiLang','yearMode','updatedAt','deletedAt','createdAt']);
    if ('name' in record && typeof record.name !== 'string') invalid();
  };
  const document = record => {
    if (!object(record)) invalid();
    strings(record, ['id','type','number','status','clientId','parentId','paymentId','issueDate','dueDate','paidDate','currency','project','notes','docLang','incomeCategory','updatedAt','deletedAt','createdAt','voidedAt','voidReason','whtCertNo','whtCertDate']);
    for (const key of ['vatRate','whtRate','fxRate']) {
      if (record[key] != null && !((typeof record[key] === 'number' || typeof record[key] === 'string') && Number.isFinite(Number(record[key])))) invalid();
    }
    if (record.items !== undefined) {
      if (!Array.isArray(record.items)) invalid();
      record.items.forEach(item => {
        if (!object(item)) invalid();
        strings(item, ['description','unit']);
        for (const key of ['qty','price']) if (item[key] != null &&
          !((typeof item[key] === 'number' || typeof item[key] === 'string') && Number.isFinite(Number(item[key])))) invalid();
      });
    }
    if (record.milestone != null && !object(record.milestone)) invalid();
  };
  party(data.business);
  if (data.business.numberFormats != null && !object(data.business.numberFormats)) invalid();
  if (data.business.numberFormats) strings(data.business.numberFormats, ['quotation','invoice','receipt','tax_invoice']);
  for (const key of ['meta','counters','assets']) if (data[key] !== undefined && !object(data[key])) invalid();
  for (const [hash,value] of Object.entries(data.assets||{})) if (!validAsset(hash,value)) invalid();
  // An issued original that refers to a stored image must find it in this workspace.
  const images = business => { for (const key of ['logo','signature','stamp']) {
    const value = business && business[key];
    if (typeof value === 'string' && value.startsWith('asset:') && !Object.hasOwn(data.assets||{}, value.slice(6))) invalid();
  } };
  for (const key of ['clients','documents','recurring','reviewEvents']) {
    if (data[key] === undefined) continue;
    if (!Array.isArray(data[key])) invalid();
    const ids = new Set();
    for (const record of data[key]) {
      if (!object(record) || typeof record.id !== 'string' || !record.id || ids.has(record.id)) invalid();
      ids.add(record.id);
      if (key === 'documents' && !['quotation','invoice','receipt','tax_invoice'].includes(record.type) && !isLegacyDeletionMarker(record)) invalid();
    }
  }
  const amount=value=>(typeof value==='number'||(typeof value==='string'&&value.trim()!==''))&&Number.isFinite(Number(value))&&Number(value)>=0;
  for(const record of data.documents){
    if(isLegacyDeletionMarker(record))continue;
    if(record.deletedAt){if(typeof record.deletedAt!=='string'||!Number.isFinite(Date.parse(record.deletedAt)))invalid();continue;}
    const statuses=['draft','sent','accepted','declined','paid','overdue','issued','void','archived'];
    // Retained desktop history may lack particulars. Missing facts are never invented;
    // mobile keeps its existing stricter live-document boundary, including null deletion.
    if((record.status!==undefined||strictLiveDocuments)&&!statuses.includes(record.status))invalid();
    if((strictLiveDocuments||record.items!==undefined)&&!Array.isArray(record.items))invalid();
    for(const item of record.items||[]){
      if(!object(item))invalid();
      if(strictLiveDocuments&&(typeof item.description!=='string'||!amount(item.qty)||!amount(item.price)))invalid();
      for(const key of ['qty','price'])if(item[key]!==undefined&&(!amount(item[key])))invalid();
    }
    for(const key of ['vatRate','whtRate'])if(record[key]!==undefined&&record[key]!==null&&!amount(record[key]))invalid();
  }
  data.clients.forEach(party);
  for (const record of [...data.documents, ...(data.recurring || [])]) {
    document(record);
    const snapshot = record.issuedSnapshot;
    // Missing historical particulars stay missing; validate structure, never invent them.
    if (snapshot != null) {
      if (!object(snapshot)) invalid();
      if (snapshot.document != null) document(snapshot.document);
      if (snapshot.business != null) { party(snapshot.business); images(snapshot.business); }
      if (snapshot.buyer != null) party(snapshot.buyer);
      if (snapshot.amounts != null) {
        if (!object(snapshot.amounts)) invalid();
        strings(snapshot.amounts, ['currency']);
        for (const key of ['subtotal','vatRate','whtRate','vatAmount','whtAmount','grandTotal','netPayable'])
          if (snapshot.amounts[key] != null && (typeof snapshot.amounts[key] !== 'number' || !Number.isFinite(snapshot.amounts[key]))) invalid();
      }
    }
  }
  for (const event of data.reviewEvents || []) {
    if (event.type === 'payment_match') {
      if (event.samePaymentConfirmed !== true || typeof event.note !== 'string' || !event.note.trim() || event.note.length > 4000 ||
        typeof event.representativeId !== 'string' || !Array.isArray(event.sourceRecords) || event.sourceRecords.length !== 2 ||
        event.sourceRecords.some(record => !object(record) || typeof record.id !== 'string' || !record.id) ||
        new Set(event.sourceRecords.map(record => record.id)).size !== 2 ||
        !event.sourceRecords.some(record => record.type === 'invoice' && record.id === event.documentId) ||
        !event.sourceRecords.some(record => ['receipt','tax_invoice'].includes(record.type) && record.id === event.representativeId)) invalid();
      event.sourceRecords.forEach(document);
    }
    if (event.type === 'correction_review' && !validCorrectionReviewEvent(event)) invalid();
    if (event.type === 'legacy_group_review') {
      if (!validLegacyGroupReview(event)) invalid();
      event.sourceRecords.forEach(record => { if (!isLegacyDeletionMarker(record)) document(record); });
    }
    strings(event, ['documentId','type','recordedAt','note','paymentId','paidDate','currency','vatStatus']);
    if (!event.documentId || !event.type || !event.recordedAt) invalid();
    if (event.evidence !== undefined) {
      if (!Array.isArray(event.evidence)) invalid();
      for (const evidence of event.evidence) {
        if (!object(evidence) || typeof evidence.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(evidence.sha256)) invalid();
        strings(evidence, ['fileName','mime','attachedAt']);
        if (evidence.size != null && (!Number.isInteger(evidence.size) || evidence.size < 1 || evidence.size > 20 * 1024 * 1024)) invalid();
      }
    }
    for (const key of ['issuer','buyer']) if (event[key] !== undefined) party(event[key]);
    if (event.sourceRecordAtReview !== undefined) document(event.sourceRecordAtReview);
    if (object(event.receipt) && object(event.receipt.issuedSnapshot)) images(event.receipt.issuedSnapshot.business);
    if (event.type === 'legacy_payment') {
      if (!event.paymentId || !event.paidDate || !event.currency || !object(event.issuer) || !object(event.buyer) ||
          typeof event.fullPaymentConfirmed !== 'boolean' || typeof event.historicalVatConfirmed !== 'boolean' ||
          !['gross','wht','net'].every(key => typeof event[key] === 'number' && Number.isFinite(event[key]))) invalid();
    }
  }
  if(!validReceiptReissueSet(data)) invalid();
  return data;
}

function resolveReviews(events,groupKey,currentGroup,representativeIds){
 const all=events.filter(e=>e?.type==='legacy_group_review'&&e.groupKey===groupKey);
 const result=(status,answer=null,heads=[])=>({status,answer,heads});
 if(!all.length)return result('empty');
 const nodes=new Map(),superseded=new Set();
 for(const e of all){if(!validLegacyGroupReview(e)||nodes.has(e.id))return result('invalid');nodes.set(e.id,e);}
 for(const e of all)for(const id of e.supersedes||[]){if(!nodes.has(id))return result('invalid');superseded.add(id);}
 const remaining=new Map(),children=new Map();
 for(const e of all){remaining.set(e.id,(e.supersedes||[]).length);for(const parent of e.supersedes||[]){if(!children.has(parent))children.set(parent,[]);children.get(parent).push(e.id);}}
 const queue=all.filter(e=>remaining.get(e.id)===0).map(e=>e.id);let processed=0;
 for(let i=0;i<queue.length;i++){processed++;for(const child of children.get(queue[i])||[]){remaining.set(child,remaining.get(child)-1);if(remaining.get(child)===0)queue.push(child);}}
 if(processed!==all.length)return result('invalid');
 const heads=all.filter(e=>!superseded.has(e.id)).map(e=>e.id).sort();
 const tipEvents=heads.map(id=>nodes.get(id));
 const facts=records=>canonical(records.map(paymentFacts).sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0));
 const source=facts(currentGroup);
 if(tipEvents.some(e=>facts(e.sourceRecords)!==source||(e.decision==='same_payment'&&!representativeIds.includes(e.representativeId))))return result('stale',null,heads);
 const decisions=new Set(tipEvents.map(e=>canonical([e.decision,e.representativeId||null])));
 if(decisions.size>1)return result('conflict',null,heads);
 return result('resolved',tipEvents[0],heads);
}
return {canonical,sha256,ASSET_MAX,ASSET_DATA,paymentFacts,validate,resolveReviews,validReceiptReissueEvent,validReceiptReissueSet,validCorrectionReviewEvent,validLegacyGroupReview,isLegacyDeletionMarker};
});
