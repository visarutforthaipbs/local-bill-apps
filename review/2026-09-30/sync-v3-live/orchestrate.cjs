// Two-Mac sync v3 live test driver. Synthetic test profiles only:
//   A = lighthouse-control ~/BillNgai-sync-test/profile-A (CDP 127.0.0.1:9334)
//   B = lighthouse-field   ~/BillNgai-sync-test/profile-B (CDP via ssh tunnel 127.0.0.1:9333)
// Usage: NODE_PATH=~/.config/billngai/test-tools/node_modules node orchestrate.cjs <step>
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path');
const LOG=path.join(__dirname,'results.jsonl');
const record=(step,data)=>{fs.appendFileSync(LOG,JSON.stringify({at:new Date().toISOString(),step,...data})+'\n');console.log(step,JSON.stringify(data,null,1));};
async function attach(port){
  const browser=await chromium.connectOverCDP('http://127.0.0.1:'+port);
  const page=browser.contexts().flatMap(c=>c.pages()).find(p=>p.url().includes('billing.html'));
  if(!page) throw Error('no BillNgai page on port '+port);
  await page.waitForFunction(()=>typeof DB!=='undefined'&&DB,{},{timeout:30000});
  await page.evaluate(()=>{window.__confirm=window.__confirm||askConfirm;askConfirm=async()=>true;window.confirm=()=>true;});
  return {browser,page};
}
const state=page=>page.evaluate(async()=>{await refreshSyncInfo();return {info:JSON.parse(JSON.stringify(syncV3Info)),syncErr,loadFailed,
  clients:DB.clients.filter(c=>!c.deletedAt).map(c=>c.name).sort(),
  docs:DB.documents.filter(d=>!d.deletedAt).map(d=>({id:d.id,type:d.type,number:d.number,status:d.status,notes:d.notes,paidDate:d.paidDate||null})).sort((a,b)=>a.id.localeCompare(b.id))};});
const sync=page=>page.evaluate(async()=>{syncErr='';await runSyncV3(true);await refreshSyncInfo();return {err:syncErr,pending:syncV3Info.pending,conflicts:syncV3Info.conflicts.length};});
const issue=(page,label,clientId)=>page.evaluate(async([label,clientId])=>{
  editDoc={id:null,type:'invoice',number:null,status:'draft',clientId,currency:'THB',issueDate:todayISO(),vatRate:0,whtRate:0,whtReviewed:true,
    items:[{description:label,qty:1,unit:'งาน',price:2500}],issueConfirmed:true};
  try{await saveDoc();}catch(e){return {error:e.message};}
  const d=DB.documents.find(x=>x.items?.[0]?.description===label);return d?{id:d.id,number:d.number,status:d.status}:{error:'not saved'};
},[label,clientId]);

const steps={
  async status(A,B){record('status',{A:await state(A.page),B:await state(B.page)});},
  // Each connect opens Google's sign-in page on that Mac; the owner approves it there.
  async connectA(A){record('connectA',await A.page.evaluate(async()=>{try{await connectSyncV3();}catch(e){return {error:e.message};}await refreshSyncInfo();return {info:syncV3Info,syncErr};}));},
  async connectB(A,B){record('connectB',await B.page.evaluate(async()=>{try{await connectSyncV3();}catch(e){return {error:e.message};}await refreshSyncInfo();return {info:syncV3Info,syncErr};}));},
  async join(A,B){
    record('syncA',await sync(A.page));record('syncB',await sync(B.page));
    const a=await state(A.page),b=await state(B.page);
    record('join',{sameClients:JSON.stringify(a.clients)===JSON.stringify(b.clients),sameDocs:JSON.stringify(a.docs)===JSON.stringify(b.docs),A:a,B:b});
  },
  // Both Macs change the same draft before either syncs: one commit wins, the other becomes a kept conflict.
  async conflict(A,B){
    const edit=(page,note)=>page.evaluate(async note=>{const d=DB.documents.find(x=>x.id==='d-draft');d.notes=note;touch(d);const ok=await persist(true);await refreshSyncInfo();return {ok,err:syncErr,conflicts:syncV3Info.conflicts.length};},note);
    const [ra,rb]=await Promise.all([edit(A.page,'note from CONTROL'),edit(B.page,'note from FIELD')]);
    record('conflict-edits',{A:ra,B:rb});
    record('conflict-sync',{A:await sync(A.page),B:await sync(B.page)});
    record('conflict-state',{A:await state(A.page),B:await state(B.page)});
  },
  async resolveKeepRemote(A,B){
    for(const [name,x] of [['A',A],['B',B]]){
      const r=await x.page.evaluate(async()=>{await refreshSyncInfo();const c=syncV3Info.conflicts[0];if(!c)return {none:true};try{await resolveSyncV3(c.key,'remote');}catch(e){return {error:e.message};}await refreshSyncInfo();return {resolved:c.key,left:syncV3Info.conflicts.length};});
      record('resolve'+name,r);
    }
    record('after-resolve',{A:await sync(A.page),B:await sync(B.page)});
    const a=await state(A.page),b=await state(B.page);record('after-resolve-state',{sameDocs:JSON.stringify(a.docs)===JSON.stringify(b.docs),A:a.docs,B:b.docs});
  },
  // Both Macs issue an invoice at the same moment: numbers must differ and never repeat.
  async numbering(A,B){
    const [ra,rb]=await Promise.all([issue(A.page,'Concurrent from CONTROL','c-alpha'),issue(B.page,'Concurrent from FIELD','c-beta')]);
    record('numbering-issue',{A:ra,B:rb,distinct:ra.number&&rb.number&&ra.number!==rb.number});
    record('numbering-sync',{A:await sync(A.page),B:await sync(B.page)});
    const a=await state(A.page),b=await state(B.page),nums=a.docs.filter(d=>d.number).map(d=>d.number);
    record('numbering-state',{sameDocs:JSON.stringify(a.docs)===JSON.stringify(b.docs),numbers:nums,duplicates:nums.length-new Set(nums).size});
  },
  // Payment recorded on one Mac appears on the other; receipt issued once.
  async payment(A,B){
    const r=await A.page.evaluate(async()=>{const inv=DB.documents.find(d=>d.type==='invoice'&&d.status==='sent'&&!d.deletedAt);if(!inv)return {error:'no issued invoice'};
      await setStatus(inv.id,'paid',{paidDate:todayISO(),fullPaymentConfirmed:true});const rc=await createReceipt(inv.id);await refreshSyncInfo();
      return {invoice:inv.number,status:DB.documents.find(d=>d.id===inv.id).status,receipt:rc?.number||null,err:syncErr};});
    record('payment-A',r);record('payment-sync',{A:await sync(A.page),B:await sync(B.page)});
    const a=await state(A.page),b=await state(B.page);record('payment-state',{sameDocs:JSON.stringify(a.docs)===JSON.stringify(b.docs),receiptsOnB:b.docs.filter(d=>d.type==='receipt').map(d=>d.number)});
  },
};
(async()=>{
  const step=process.argv[2];if(!steps[step]) throw Error('steps: '+Object.keys(steps).join(', '));
  const A=await attach(9334),B=await attach(9333);
  // Never close the CDP browsers: that would quit the apps. Just end this driver.
  try{await steps[step](A,B);}finally{setTimeout(()=>process.exit(process.exitCode||0),200);}
})().catch(e=>{console.error(e.stack||e);process.exit(1);});
