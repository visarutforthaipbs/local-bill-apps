const {chromium}=require('playwright'),fs=require('fs');
(async()=>{const at=async port=>{const b=await chromium.connectOverCDP('http://127.0.0.1:'+port);return b.contexts().flatMap(c=>c.pages()).find(x=>x.url().includes('billing.html'));};
const A=await at(9334),B=await at(9333);
const pay=p=>p.evaluate(async()=>{askConfirm=async()=>true;window.confirm=()=>true;const inv=DB.documents.find(d=>d.number==='INV-69-002');
  let r1,r2;try{r1=await setStatus(inv.id,'paid',{paidDate:todayISO(),fullPaymentConfirmed:true});}catch(e){r1='ERR '+e.message;}
  try{const rc=await createReceipt(inv.id);r2=rc?.number||null;}catch(e){r2='ERR '+e.message;}
  await refreshSyncInfo();return {setStatus:r1,receipt:r2,err:syncErr,toast:document.getElementById('toast').textContent,conflicts:syncV3Info.conflicts.map(c=>c.key)};});
const [ra,rb]=await Promise.all([pay(A),pay(B)]);console.log('A',JSON.stringify(ra));console.log('B',JSON.stringify(rb));
const sync=p=>p.evaluate(async()=>{syncErr='';await runSyncV3(true);await refreshSyncInfo();return {err:syncErr,pending:syncV3Info.pending,conflicts:syncV3Info.conflicts.map(c=>c.key)};});
for(let i=0;i<2;i++)console.log('sync',i,'A',JSON.stringify(await sync(A)),'B',JSON.stringify(await sync(B)));
const view=p=>p.evaluate(()=>{const inv=DB.documents.find(d=>d.number==='INV-69-002');return {inv:inv.status,paymentId:inv.paymentId||null,receipts:DB.documents.filter(d=>d.type==='receipt'&&d.parentId===inv.id&&!d.deletedAt).map(d=>d.number+'/'+d.paymentId),received:paymentReview().docs.map(d=>d.number).sort()};});
const a=await view(A),b=await view(B);const out={A:ra,B:rb,afterA:a,afterB:b,identical:JSON.stringify(a)===JSON.stringify(b)};
console.log(JSON.stringify({afterA:a,afterB:b,identical:out.identical},null,1));fs.appendFileSync('results.jsonl',JSON.stringify({at:new Date().toISOString(),step:'doublepay',...out})+'\n');setTimeout(()=>process.exit(0),100);})();
