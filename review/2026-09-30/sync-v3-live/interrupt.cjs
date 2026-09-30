// Kill lighthouse-field's test app (profile-B only) at a chosen moment during issuance,
// restart it, and check the outcome after sync on both Macs.
const {chromium}=require('playwright'),fs=require('fs'),{execSync}=require('child_process');
const delay=Number(process.argv[2]||500),label='Interrupted issue '+delay+'ms';
const at=async port=>{for(let i=0;i<60;i++){try{const b=await chromium.connectOverCDP('http://127.0.0.1:'+port);const p=b.contexts().flatMap(c=>c.pages()).find(x=>x.url().includes('billing.html'));if(p){await p.waitForFunction(()=>typeof DB!=='undefined'&&DB&&!loadFailed,{},{timeout:30000});return p;}}catch{}await new Promise(r=>setTimeout(r,1000));}throw Error('no page on '+port);};
const ssh=cmd=>execSync(`ssh -o BatchMode=yes lighthouse-field '${cmd}'`,{encoding:'utf8'});
(async()=>{
  let B=await at(9333);const A=await at(9334);
  await B.evaluate(()=>{askConfirm=async()=>true;window.confirm=()=>true;});
  // Fire issuance without waiting, then hard-kill the process mid-flight.
  B.evaluate(([label])=>{editDoc={id:null,type:'invoice',number:null,status:'draft',clientId:'c-beta',currency:'THB',issueDate:todayISO(),vatRate:0,whtRate:0,whtReviewed:true,items:[{description:label,qty:1,unit:'งาน',price:700}],issueConfirmed:true};saveDoc();},[label]).catch(()=>{});
  await new Promise(r=>setTimeout(r,delay));
  ssh('pkill -9 -f "user-data-dir=/Users/visarutsankham/BillNgai-sync-test/profile-B"');
  await new Promise(r=>setTimeout(r,2500));
  ssh('open ~/BillNgai-sync-test/start-B.command');
  B=await at(9333);
  const local=await B.evaluate(label=>{const d=DB.documents.find(x=>x.items?.[0]?.description===label);return {present:!!d,number:d?.number||null,status:d?.status||null,pending:Object.keys(DB.syncV3?.intents||{}).length,mode:DB.syncV3?.mode};},label);
  const sync=p=>p.evaluate(async()=>{syncErr='';await refreshSyncInfo();await runSyncV3(true);await refreshSyncInfo();return {err:syncErr,pending:syncV3Info.pending,conflicts:syncV3Info.conflicts.map(c=>c.key)};});
  const s1=await sync(B),s2=await sync(A),s3=await sync(B);
  const view=p=>p.evaluate(label=>({copies:DB.documents.filter(x=>x.items?.[0]?.description===label).map(d=>({number:d.number,status:d.status})),numbers:DB.documents.filter(d=>d.number).map(d=>d.number)}),label);
  const a=await view(A),b=await view(B);
  const out={delay,afterRestart:local,sync:{B:s1,A:s2,B2:s3},A:a.copies,B:b.copies,duplicatesA:a.numbers.length-new Set(a.numbers).size,duplicatesB:b.numbers.length-new Set(b.numbers).size,sameNumbers:JSON.stringify([...a.numbers].sort())===JSON.stringify([...b.numbers].sort()),numbers:[...a.numbers].sort()};
  console.log(JSON.stringify(out,null,1));fs.appendFileSync(__dirname+'/results.jsonl',JSON.stringify({at:new Date().toISOString(),step:'interrupt',...out})+'\n');
  setTimeout(()=>process.exit(0),100);
})().catch(e=>{console.error(e.stack||e);process.exit(1);});
