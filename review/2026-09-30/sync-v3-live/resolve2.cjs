const {chromium}=require('playwright'),fs=require('fs');
(async()=>{const at=async port=>{const b=await chromium.connectOverCDP('http://127.0.0.1:'+port);return b.contexts().flatMap(c=>c.pages()).find(x=>x.url().includes('billing.html'));};
const A=await at(9334),B=await at(9333);
const r=await A.evaluate(async()=>{const out=[];for(const c of [...syncV3Info.conflicts]){try{await resolveSyncV3(c.key,'remote');out.push(c.key+' ok');}catch(e){out.push(c.key+' ERR '+e.message);}await refreshSyncInfo();}return out;});
const sync=p=>p.evaluate(async()=>{syncErr='';await runSyncV3(true);await refreshSyncInfo();return {err:syncErr,pending:syncV3Info.pending,conflicts:syncV3Info.conflicts.length,cursor:DB.syncV3.cursor};});
const s=[await sync(A),await sync(B),await sync(A)];
const view=p=>p.evaluate(()=>({docs:DB.documents.filter(d=>!d.deletedAt).map(d=>[d.number||d.id,d.status,d.paymentId||''].join(' ')).sort(),received:paymentReview().docs.map(d=>d.number).sort(),net:paymentReview().docs.reduce((t,d)=>t+compute(d).netPayable,0)}));
const a=await view(A),b=await view(B);const out={resolved:r,sync:s,identical:JSON.stringify(a)===JSON.stringify(b),A:a,B:b};
console.log(JSON.stringify(out,null,1));fs.appendFileSync('results.jsonl',JSON.stringify({at:new Date().toISOString(),step:'doublepay-resolve',...out})+'\n');setTimeout(()=>process.exit(0),100);})();
