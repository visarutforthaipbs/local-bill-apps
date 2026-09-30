const {chromium}=require('playwright'),fs=require('fs'),path=require('path');
(async()=>{const b=await chromium.connectOverCDP('http://127.0.0.1:9334');let A=b.contexts().flatMap(c=>c.pages()).find(x=>x.url().includes('billing.html'));
 await A.reload();await A.waitForFunction(()=>typeof DB!=='undefined'&&DB&&!loadFailed);await A.evaluate(()=>{askConfirm=async()=>true;window.confirm=()=>true;});
 await A.evaluate(async()=>{syncErr='';await runSyncV3(true);});
 const before=await A.evaluate(()=>DB.documents.filter(d=>d.type==='invoice'&&d.number).map(d=>d.number).sort());
 fs.writeFileSync(path.join(__dirname,'faults-profile-A.json'),JSON.stringify({'/v3/reserve':{mode:'after',count:1}}));
 const r=await A.evaluate(async()=>{editDoc={id:null,type:'invoice',number:null,status:'draft',clientId:'c-alpha',currency:'THB',issueDate:todayISO(),vatRate:0,whtRate:0,whtReviewed:true,items:[{description:'Retry same document',qty:1,unit:'งาน',price:900}],issueConfirmed:true};
   await saveDoc();const firstToast=document.getElementById('toast').textContent;const stillOpen=!!editDoc;
   await saveDoc();   // user presses Issue again on the same open document
   const d=DB.documents.find(x=>x.items?.[0]?.description==='Retry same document');return {firstToast,stillOpenAfterFailure:stillOpen,number:d?.number,status:d?.status,pendingNewIdSaved:Object.hasOwn(d||{},'pendingNewId')};});
 await A.evaluate(async()=>{await runSyncV3(true);});
 const after=await A.evaluate(()=>DB.documents.filter(d=>d.type==='invoice'&&d.number).map(d=>d.number).sort());
 const last=Math.max(...before.map(n=>+n.split('-').pop()));const got=+String(r.number).split('-').pop();
 const outp={...r,previousHighest:last,noGap:got===last+1,duplicates:after.length-new Set(after).size};console.log(JSON.stringify(outp,null,1));
 fs.appendFileSync(path.join(__dirname,'results.jsonl'),JSON.stringify({at:new Date().toISOString(),step:'reserve-retry',...outp})+'\n');
 fs.writeFileSync(path.join(__dirname,'faults-profile-A.json'),'{}');setTimeout(()=>process.exit(0),100);})().catch(e=>{console.error(e);process.exit(1);});
