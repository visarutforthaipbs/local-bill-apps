// Public users upgrade directly from 2.0.4. This builds a profile with the real 2.0.4 source
// (legacy pre-2.0.3 records + 2.0.4-issued documents), opens it with this source, then reopens
// it with 2.0.4 to check rollback. Isolated synthetic profile only.
// NODE_PATH=<playwright> node test/upgrade-2.0.4-electron-smoke.cjs <path to a v2.0.4 checkout>
const {_electron}=require('playwright'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const current=path.resolve(__dirname,'..'),old=path.resolve(process.argv[2]||'');
(async()=>{
 assert.equal(JSON.parse(await fs.readFile(path.join(old,'package.json'),'utf8')).version,'2.0.4','pass a v2.0.4 checkout');
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'billngai-upgrade-204-')),profile=path.join(root,'profile');await fs.mkdir(profile);
 const legacy=(id,extra)=>({id,clientId:'buyer',currency:'THB',issueDate:'2025-03-01',vatRate:0,whtRate:3,items:[{description:'Legacy design work',qty:1,price:20000}],createdAt:'2025-03-01T03:00:00.000Z',updatedAt:'2025-03-02T03:00:00.000Z',...extra});
 // Older users: no VAT answer yet, Buddhist-year counters, issued records without frozen snapshots.
 await fs.writeFile(path.join(profile,'billing.json'),JSON.stringify({version:2,business:{businessName:'Synthetic Freelancer',address:'Chiang Mai',taxId:'1234567890121',uiLang:'th'},
  clients:[{id:'buyer',name:'Synthetic Buyer Co.',address:'Bangkok',taxId:'0105555555555'}],
  documents:[legacy('old-inv',{type:'invoice',number:'INV-68-001',status:'paid',paidDate:'2025-03-10',paymentId:'legacy-pay'}),
   legacy('old-tax',{type:'tax_invoice',number:'TAX-68-001',status:'issued',parentId:'old-inv',paidDate:'2025-03-10',paymentId:'legacy-pay'}),
   legacy('old-unpaid',{type:'invoice',number:'INV-68-002',status:'sent',items:[{description:'Legacy retainer',qty:2,price:5000}]})],
  recurring:[],counters:{'invoice-2568':2,'tax_invoice-2568':1},meta:{setupDone:true},reviewEvents:[]}));
 const launch=async source=>{const app=await _electron.launch({executablePath:require('electron'),args:[source,'--user-data-dir='+profile]});
  assert.equal(await app.evaluate(({app})=>app.getPath('userData')),await fs.realpath(profile));
  const page=await app.firstWindow(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.waitForFunction(()=>typeof DB!=='undefined'&&DB&&!loadFailed&&DB.documents.length>0,{},{polling:100});
  await page.evaluate(()=>{window.confirm=()=>true;if(typeof askConfirm==='function')askConfirm=async()=>true;});
  return {app,page,errors,version:await app.evaluate(({app})=>app.getVersion())};};
 const close=async s=>{await s.app.evaluate(({app})=>app.exit(0)).catch(()=>{});};
 const backups=async()=>(await fs.readdir(path.join(profile,'backups')).catch(()=>[])).sort();

 // 1. 2.0.4 opens the old profile and issues a normal quotation → invoice → payment → receipt.
 const a=await launch(old);let issued;
 try{
  assert.equal(a.version,'2.0.4');
  await a.page.evaluate(()=>{DB.business.vatStatus='non_registered';DB.business.vatStatusConfirmedAt=new Date().toISOString();});
  issued=await a.page.evaluate(async()=>{
   const base={clientId:'buyer',currency:'THB',issueDate:todayISO(),vatRate:0,whtRate:3,whtReviewed:true,items:[{description:'2.0.4 website work',qty:1,price:12000}]};
   editDoc={id:null,type:'invoice',number:null,status:'draft',...base,issueConfirmed:true};await saveDoc();
   const inv=DB.documents.find(d=>d.type==='invoice'&&d.issuedSnapshot);
   await setStatus(inv.id,'paid',{paidDate:todayISO(),fullPaymentConfirmed:true});
   await createReceipt(inv.id);
   editDoc={id:null,type:'quotation',number:null,status:'draft',...base,issueConfirmed:true};await saveDoc();
   return JSON.parse(JSON.stringify(DB.documents.filter(d=>d.issuedSnapshot).map(d=>({id:d.id,number:d.number,type:d.type,snapshot:d.issuedSnapshot}))));
  });
  assert.equal(issued.length,3,'2.0.4 issued invoice, receipt and quotation');
  assert.deepEqual(a.errors,[]);
 }finally{await close(a);}
 const afterOld=JSON.parse(await fs.readFile(path.join(profile,'billing.json'),'utf8'));
 assert.ok((await backups()).some(n=>n.startsWith('billing-pre-2.0.4-')),'2.0.4 preserved the pre-2.0.4 file');

 // 2. This source opens the same profile directly.
 const b=await launch(current);
 try{
  assert.notEqual(b.version,'2.0.4');
  const state=await b.page.evaluate(()=>({count:DB.documents.length,numbers:DB.documents.map(d=>d.number).sort(),
   snapshots:DB.documents.filter(d=>d.issuedSnapshot).map(d=>({id:d.id,number:d.number,type:d.type,snapshot:d.issuedSnapshot})),
   legacyFlags:DB.documents.filter(d=>d.legacy_review_required).map(d=>d.id).sort(),
   review:(r=>({counted:r.docs.map(d=>d.id).sort(),legacy:r.legacyCount,unanswered:(r.unansweredGroups||[]).length}))(paymentReview()),vat:DB.business.vatStatus}));
  assert.equal(state.count,afterOld.documents.length);
  assert.deepEqual(state.numbers,afterOld.documents.map(d=>d.number).sort());
  for(const doc of issued) assert.deepEqual(state.snapshots.find(s=>s.id===doc.id),doc,'frozen 2.0.4 document unchanged: '+doc.number);
  assert.deepEqual(state.legacyFlags,['old-inv','old-tax','old-unpaid']);
  assert.equal(state.vat,'non_registered');
  // The legacy invoice and tax invoice share one payment: counted once, no duplicate income.
  assert.equal(state.review.counted.filter(id=>['old-inv','old-tax'].includes(id)).length,1);
  assert.equal(state.review.legacy,1);assert.equal(state.review.unanswered,0);
  await b.page.evaluate(()=>{setView('dashboard');render();});await b.page.waitForTimeout(1200);
  const dash=await b.page.locator('main, #content, body').first().innerText();
  assert.match(dash,/31,040\.00/,'legacy payment 19,400 + 2.0.4 receipt 11,640, each counted once');
  await b.page.screenshot({path:path.join(root,'upgraded-dashboard.png')});
  // Ordinary use after upgrade: a new invoice continues the number sequence without duplicates.
  const next=await b.page.evaluate(async()=>{editDoc={id:null,type:'invoice',number:null,status:'draft',clientId:'buyer',currency:'THB',issueDate:todayISO(),vatRate:0,whtRate:0,whtReviewed:true,items:[{description:'After upgrade',qty:1,price:1000}],issueConfirmed:true};await saveDoc();
   return DB.documents.filter(d=>d.type==='invoice').map(d=>d.number);});
  assert.equal(new Set(next).size,next.length,'no duplicate invoice numbers');
  assert.deepEqual(b.errors,[]);
 }finally{await close(b);}
 const afterNew=JSON.parse(await fs.readFile(path.join(profile,'billing.json'),'utf8'));
 for(const doc of issued) assert.deepEqual(afterNew.documents.find(d=>d.id===doc.id).issuedSnapshot,doc.snapshot,'saved snapshot unchanged: '+doc.number);
 for(const id of ['old-inv','old-tax','old-unpaid']){
  const before=afterOld.documents.find(d=>d.id===id),after=afterNew.documents.find(d=>d.id===id);
  for(const key of ['number','status','paidDate','paymentId','items','whtRate','vatRate','issueDate']) assert.deepEqual(after[key],before[key],id+'.'+key);
 }

 // 3. Rollback: 2.0.4 still opens the file written by the new version.
 const c=await launch(old);
 try{
  assert.equal(await c.page.evaluate(()=>DB.documents.length),afterNew.documents.length);
  assert.deepEqual(c.errors,[]);
 }finally{await close(c);}
 console.log('PASS: 2.0.4-built profile opens directly in '+b.version+': frozen documents, legacy originals, numbering and VAT answer preserved; legacy invoice/tax-invoice payment and 2.0.4 receipt each counted once; rollback to 2.0.4 loads.');
 console.log('SYNTHETIC_ARTIFACTS='+root);
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
