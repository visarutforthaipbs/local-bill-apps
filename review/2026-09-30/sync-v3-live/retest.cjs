// Live retest of the 2026-09-30 findings on both Macs (synthetic test profiles only).
const {chromium}=require('playwright'),fs=require('fs');
const at=async port=>{const b=await chromium.connectOverCDP('http://127.0.0.1:'+port);const p=b.contexts().flatMap(c=>c.pages()).find(x=>x.url().includes('billing.html'));
  await p.evaluate(()=>{askConfirm=async()=>true;window.confirm=()=>true;});return p;};
const sync=p=>p.evaluate(async()=>{syncErr='';await runSyncV3(true);await refreshSyncInfo();return {err:syncErr,pending:syncV3Info.pending,conflicts:syncV3Info.conflicts.map(c=>c.key),waiting:syncV3Waiting};});
const both=async(A,B)=>({A:await sync(A),B:await sync(B),A2:await sync(A)});
const heads=p=>p.evaluate(()=>({business:DB.syncV3.heads['business:main']?.revision,cursor:DB.syncV3.cursor}));
const view=p=>p.evaluate(()=>({docs:DB.documents.filter(d=>!d.deletedAt).map(d=>[d.number||d.id,d.status,d.paymentId||'',d.notes||''].join(' ')).sort(),received:paymentReview().docs.map(d=>d.number).sort()}));
const out={};const log=(k,v)=>{out[k]=v;console.log(k,JSON.stringify(v));};
(async()=>{
 const A=await at(9334),B=await at(9333);
 // R1 — visiting and leaving Settings with no change must not publish a business version.
 const h0=await heads(A);
 await B.evaluate(async()=>{settingsTab='docs';setView('settings');await new Promise(r=>setTimeout(r,300));await saveSettings(true);setView('dashboard');});
 await A.evaluate(async()=>{settingsTab='business';setView('settings');await new Promise(r=>setTimeout(r,300));await saveSettings(true);setView('dashboard');});
 log('R1-sync',await both(A,B));const h1=await heads(A);
 log('R1',{businessRevisionBefore:h0.business,after:h1.business,unchanged:h0.business===h1.business});
 // R2 — same draft edited on both Macs: exactly one real conflict, no business conflict.
 const edit=(p,note)=>p.evaluate(async note=>{const d=DB.documents.find(x=>x.id==='d-draft');d.notes=note;touch(d);return await persist(true);},note);
 await Promise.all([edit(A,'retest CONTROL'),edit(B,'retest FIELD')]);
 const r2=await both(A,B);log('R2-sync',r2);
 const loser=r2.A2.conflicts.length?A:B,loserName=r2.A2.conflicts.length?'A':'B',allConflicts=[...r2.A2.conflicts,...r2.B.conflicts];
 log('R2',{conflicts:allConflicts,onlyTheDraft:allConflicts.length===1&&allConflicts[0]==='document:d-draft',loser:loserName});
 await loser.evaluate(async()=>{for(const c of [...syncV3Info.conflicts])await resolveSyncV3(c.key,'remote');});
 log('R2-after',{sync:await both(A,B),same:JSON.stringify(await view(A))===JSON.stringify(await view(B))});
 // R3 — both Macs pay the same invoice: the losing Mac must not show a receipt before its invoice is settled.
 const pay=p=>p.evaluate(async()=>{const inv=DB.documents.find(d=>d.number==='INV-69-004');let paid,receipt;
   try{paid=await setStatus(inv.id,'paid',{paidDate:todayISO(),fullPaymentConfirmed:true});}catch(e){paid='ERR '+e.message;}
   try{receipt=(await createReceipt(inv.id))?.number||null;}catch(e){receipt='ERR '+e.message;}return {paid,receipt};});
 const [pa,pb]=await Promise.all([pay(A),pay(B)]);log('R3-pay',{A:pa,B:pb});
 const r3=await both(A,B);log('R3-sync',r3);
 const half=async p=>p.evaluate(()=>{const inv=DB.documents.find(d=>d.number==='INV-69-004');const rc=DB.documents.filter(d=>d.type==='receipt'&&d.parentId===inv.id&&!d.deletedAt);
   return {invoice:inv.status,receiptsShown:rc.map(r=>r.number),halfState:rc.length>0&&inv.status!=='paid',conflicts:syncV3Info.conflicts.map(c=>c.key),dialogNote:(()=>{openSyncV3Conflicts();const t=document.getElementById('modal').innerText;closeModal();return /อีกเครื่องบันทึกการรับเงินนี้ไว้แล้ว/.test(t);})()};});
 log('R3-state',{A:await half(A),B:await half(B)});
 for(const p of [A,B])await p.evaluate(async()=>{for(const c of [...syncV3Info.conflicts])await resolveSyncV3(c.key,'remote');});
 const a3=await view(A),b3=await view(B);
 log('R3-after',{sync:await both(A,B),same:JSON.stringify(a3)===JSON.stringify(b3),receiptsFor003:a3.docs.filter(x=>x.startsWith('RC')).length,received:a3.received});
 // R4 — sync waits (and says so) while a window is open, then continues by itself.
 await A.evaluate(()=>openClientEditor());
 const w1=await A.evaluate(async()=>{await runSyncV3(true);return {waiting:syncV3Waiting,status:document.getElementById('fileStatus')?.innerText||document.querySelector('.file-status')?.innerText||''};});
 await A.evaluate(()=>closeModal());await new Promise(r=>setTimeout(r,17000));
 const w2=await A.evaluate(()=>({waiting:syncV3Waiting}));
 log('R4',{whileOpen:w1,after:w2,shownWaiting:/รอปิดหน้าต่าง/.test(w1.status),resumed:w2.waiting===false});
 fs.appendFileSync(__dirname+'/results.jsonl',JSON.stringify({at:new Date().toISOString(),step:'retest',...out})+'\n');
 setTimeout(()=>process.exit(0),100);
})().catch(e=>{console.error(e.stack||e);process.exit(1);});
