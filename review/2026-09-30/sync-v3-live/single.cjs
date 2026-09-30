// Single-Mac live checks on profile-A: token renewal, server-side Pro licence, simulated network loss.
const {chromium}=require('playwright'),fs=require('fs'),path=require('path');
const ROOT=__dirname,FAULTS=path.join(ROOT,'faults-profile-A.json');
const faults=rules=>fs.writeFileSync(FAULTS,JSON.stringify(rules));
const out={};const log=(k,v)=>{out[k]=v;console.log(k,JSON.stringify(v));};
(async()=>{
 const b=await chromium.connectOverCDP('http://127.0.0.1:9334');const A=b.contexts().flatMap(c=>c.pages()).find(x=>x.url().includes('billing.html'));
 await A.evaluate(()=>{askConfirm=async()=>true;window.confirm=()=>true;});
 log('code',await A.evaluate(()=>({disconnectAvailable:typeof disconnectSyncV3==='function',connected:syncV3Info.connected})));
 const sync=()=>A.evaluate(async()=>{syncErr='';await runSyncV3(true);await refreshSyncInfo();return {err:syncErr,pending:syncV3Info.pending,conflicts:syncV3Info.conflicts.length,cursor:DB.syncV3?.cursor};});
 const head=key=>A.evaluate(key=>DB.syncV3.heads[key]?.revision,key);
 // T1 — Google ID/access tokens are hours old; a sync must renew them transparently.
 log('T1-renewal',await sync());
 // T2 — the server accepts this Mac only through its Pro licence (staging allow-list is empty).
 const key=JSON.parse(fs.readFileSync(path.join(ROOT,'profile-A/config.json'),'utf8')).licenseKey;
 await A.evaluate(()=>window.billingAPI.licenseDeactivate());
 const noLicence=await sync();
 await A.evaluate(k=>window.billingAPI.licenseActivate(k),key);
 log('T2-licence',{withoutLicence:noLicence,refused:/PRO_REQUIRED/.test(noLicence.err),afterReactivate:await sync()});
 // T3 — network loss while saving a draft change, at each step.
 const editDraft=note=>A.evaluate(async note=>{const d=DB.documents.find(x=>x.id==='d-draft');d.notes=note;touch(d);return persist(true);},note);
 for(const [name,rule] of [['upload-request-lost',{'upload/drive':{mode:'before',count:1}}],['upload-response-lost',{'upload/drive':{mode:'after',count:1}}],
   ['commit-request-lost',{'/v3/commit':{mode:'before',count:1}}],['commit-response-lost',{'/v3/commit':{mode:'after',count:1}}],['pull-lost',{'/v3/pull':{mode:'before',count:1}}]]){
  const before=await head('document:d-draft');
  faults(rule);await editDraft('network test '+name);
  const first=await sync();const second=await sync();const third=await sync();
  const after=await head('document:d-draft');
  log('T3-'+name,{first,second,third,revisionBefore:before,revisionAfter:after,oneNewRevision:after===before+1,settled:third.pending===0&&!third.err&&third.conflicts===0});
 }
 // T3b — issuing an invoice while the number-reservation response is lost: no duplicate, no reused number.
 faults({'/v3/reserve':{mode:'after',count:1}});
 const issue=label=>A.evaluate(async label=>{editDoc={id:null,type:'invoice',number:null,status:'draft',clientId:'c-alpha',currency:'THB',issueDate:todayISO(),vatRate:0,whtRate:0,whtReviewed:true,items:[{description:label,qty:1,unit:'งาน',price:900}],issueConfirmed:true};
   try{await saveDoc();}catch(e){return {error:e.message};}const d=DB.documents.find(x=>x.items?.[0]?.description===label);editDoc=null;closeModal();return {number:d?.number||null,toast:document.getElementById('toast').textContent};},label);
 const i1=await issue('Reserve lost 1');const i2=await issue('Reserve lost 2');await sync();
 const nums=await A.evaluate(()=>DB.documents.filter(d=>d.type==='invoice'&&d.number).map(d=>d.number).sort());
 log('T3-reserve-lost',{firstAttempt:i1,secondAttempt:i2,invoiceNumbers:nums,duplicates:nums.length-new Set(nums).size});
 faults({});
 fs.appendFileSync(path.join(ROOT,'results.jsonl'),JSON.stringify({at:new Date().toISOString(),step:'single-mac',...out})+'\n');
 setTimeout(()=>process.exit(0),100);
})().catch(e=>{console.error(e.stack||e);process.exit(1);});
