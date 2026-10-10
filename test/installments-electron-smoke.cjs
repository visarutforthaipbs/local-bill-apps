// Installment payments on a fresh synthetic profile, through the app's own split dialog, editor and payment dialog:
// quotation 50,000 → 3 installment invoices (25,000 / 15,000 / 10,000) → each issued, paid and receipted.
// Checks the settled-invoice line on the receipt paper and PDF, the quotation progress line, the dashboard
// receivable before the last payment, reload stability, and saves light/dark screenshots for design review.
// Synthetic data only; never point this at a real profile.
const {_electron}=require('playwright'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
// macOS PDFKit text extraction (no extra dependencies). PDFKit returns decomposed sara am and maps some
// Thai tone marks of the embedded font to U+0000, so matches use the base letters only.
const pdfText=file=>execFileSync('/usr/bin/osascript',['-l','JavaScript','-e',
 'ObjC.import("PDFKit");function run(a){const d=$.PDFDocument.alloc.initWithURL($.NSURL.fileURLWithPath(a[0]));return d.string.js;}',file],{encoding:'utf8'}).replace(/ํา/g,'ำ').replace(/\u0000/g,'');
(async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'billngai-installments-')),profile=path.join(root,'profile');await fs.mkdir(profile);
 const shots=path.resolve(__dirname,'../review/2026-10-10/design/screens');await fs.mkdir(shots,{recursive:true});
 await fs.writeFile(path.join(profile,'config.json'),'{"externalPath":null}');
 await fs.writeFile(path.join(profile,'billing.json'),JSON.stringify({version:2,business:{businessName:'Synthetic Studio',address:'99 Synthetic Road, Chiang Mai 50200',taxId:'1234567890121',vatStatus:'non_registered',uiLang:'th'},
  clients:[{id:'buyer',name:'Synthetic Client Co.',address:'Bangkok 10900'}],documents:[],reviewEvents:[],meta:{setupDone:true,reviewSemanticsVersion:3},counters:{},recurring:[]}));
 const exe=process.argv[2],app=await _electron.launch({executablePath:exe||require('electron'),args:[...(exe?[]:[path.resolve(__dirname,'..')]),'--user-data-dir='+profile]});
 try{
  assert.equal(await app.evaluate(({app})=>app.getPath('userData')),await fs.realpath(profile));
  const page=await app.firstWindow(),errors=[];page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width:1440,height:1000});
  await page.waitForFunction(()=>typeof DB!=='undefined'&&DB&&!loadFailed&&dataLoc.path,{},{polling:100});
  const settle=()=>page.waitForFunction(()=>!issuanceBusy&&!pendingPersist,{},{polling:50});
  const confirmOk=async()=>{await page.locator('#confirmOverlay.open').waitFor();const before=await page.locator('#confirmMsg').innerText();await page.locator('#confirmOk').click();await page.waitForFunction(b=>!document.getElementById('confirmOverlay').classList.contains('open')||document.getElementById('confirmMsg').textContent!==b,before);await page.locator('#confirmOverlay.open').waitFor({state:'detached'}).catch(()=>{});};
  const confirmIfShown=async()=>{if(await page.locator('#confirmOverlay.open').waitFor({timeout:1500}).then(()=>true,()=>false))await confirmOk();};
  const scheme=async s=>{await app.evaluate(({nativeTheme},s)=>{nativeTheme.themeSource=s;},s);await page.emulateMedia({colorScheme:s,reducedMotion:'reduce'});await page.waitForFunction(s=>document.documentElement.classList.contains('scheme-dark')===(s==='dark'),s);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));};
  const shot=async name=>{for(const s of ['light','dark']){await scheme(s);await page.evaluate(()=>hideToast());await page.screenshot({path:path.join(shots,'installments-'+name+'-'+s+'.png'),animations:'disabled'});}await scheme('light');};
  const doc=id=>page.evaluate(id=>{const d=DB.documents.find(x=>x.id===id);return {status:d.status,number:d.number,net:compute(d).netPayable,paymentId:d.paymentId||null};},id);

  // 1. A 50,000 quotation, issued through the editor's save path.
  const qid=await page.evaluate(async()=>{editDoc={id:null,type:'quotation',number:null,status:'draft',clientId:'buyer',currency:'THB',issueDate:todayISO(),vatRate:0,whtRate:0,whtReviewed:true,
   project:'Synthetic website',items:[{description:'Website design and build',qty:1,unit:'job',price:50000}],issueConfirmed:true};await saveDoc();return DB.documents.find(d=>d.type==='quotation').id;});
  await settle();const qt=await doc(qid);assert.equal(qt.status,'sent');assert.equal(qt.net,50000);
  await page.evaluate(id=>viewDoc(id),qid);assert.equal(await page.locator('.quotation-progress').count(),0,'no progress line before the split');

  // 2. Split into three installments through the real dialog: deposit 25,000, a middle row of 15,000, the balance 10,000.
  await page.getByRole('button',{name:'แบ่งงวด'}).click();await page.locator('#modal table.split-rows').waitFor();
  await page.getByRole('button',{name:'เพิ่มงวด'}).click();
  const amounts=page.locator('#modal table.split-rows td.amt-col input');assert.equal(await amounts.count(),2);
  assert.equal(await amounts.nth(0).inputValue(),'25000');
  await amounts.nth(1).fill('15000');await amounts.nth(1).dispatchEvent('change');
  assert.match(await page.locator('#modal table.split-rows td.amt-col .bal').innerText(),/10,000\.00/,'the last installment balances automatically');
  await page.getByRole('button',{name:'สร้างใบแจ้งหนี้ 3 งวด'}).click();await settle();
  const invIds=await page.evaluate(()=>DB.documents.filter(d=>d.type==='invoice').sort((a,b)=>a.milestone.seq-b.milestone.seq).map(d=>d.id));
  assert.equal(invIds.length,3);
  assert.deepEqual(await page.evaluate(ids=>ids.map(id=>compute(DB.documents.find(d=>d.id===id)).netPayable),invIds),[25000,15000,10000]);
  assert.match(await page.locator('.quotation-progress').innerText(),/ตกลง ฿50,000\.00 · รับแล้ว ฿0\.00 \(0\/3\) · ค้าง ฿50,000\.00/);

  // 3. Issue each installment invoice from the editor (withholding reviewed), as the owner would.
  for(const id of invIds){
   await page.evaluate(id=>{viewDoc(id);openDocEditor('invoice',id);},id);
   await page.locator('label.toggle:has(#d_whtReviewed) .track').click();await page.waitForFunction(()=>document.getElementById('d_whtReviewed').checked);
   await page.locator('#modal').getByRole('button',{name:'ออกเอกสาร'}).click();await confirmOk();await settle();
   assert.equal((await doc(id)).status,'sent');
  }
  const invNumbers=[];for(const id of invIds)invNumbers.push((await doc(id)).number);
  assert.equal(new Set(invNumbers).size,3);

  // 4. Record each payment through the real dialog, then issue its receipt; the receipt names the invoice it settles.
  const receiptIds=[];
  const payAndReceipt=async(i)=>{
   const id=invIds[i],seq=i+1;
   await page.evaluate(id=>viewDoc(id),id);
   await page.getByRole('button',{name:'บันทึกรับชำระ'}).click();
   const dialog=await page.locator('#modal').innerText();
   assert.match(dialog,/ยอดที่ควรได้รับ/);assert.match(dialog,new RegExp('งวดที่ '+seq+'/3'));assert.match(dialog,/ยืนยันรับชำระงวดนี้เต็มจำนวนแล้ว/);
   if(seq===1)await page.screenshot({path:path.join(root,'payment-dialog.png')});
   await page.locator('#paymentDate').fill(await page.evaluate(()=>todayISO()));await page.locator('#paymentFull').check();
   await page.locator('#modal').getByRole('button',{name:'บันทึก',exact:true}).click();await settle();
   assert.equal((await doc(id)).status,'paid');
   await page.getByRole('button',{name:'ออกใบเสร็จรับเงิน'}).click();await confirmOk();await confirmIfShown();await settle();
   const rec=await page.evaluate(id=>{const r=DB.documents.find(d=>d.type==='receipt'&&d.parentId===id);return r&&{id:r.id,number:r.number,status:r.status,net:compute(r).netPayable,settles:r.settles,frozen:hasIssuedSnapshot(r)};},id);
   assert.ok(rec&&rec.status==='issued'&&rec.frozen,'receipt issued for installment '+seq);
   assert.equal(rec.net,[25000,15000,10000][i]);
   assert.deepEqual(rec.settles,{invoiceNumber:invNumbers[i],installment:{seq,of:3},quotationNumber:qt.number});
   await page.locator('.paper .settled-reference').waitFor();
   assert.equal(await page.locator('.paper .settled-reference').innerText(),`ชำระตามใบแจ้งหนี้ ${invNumbers[i]} · งวดที่ ${seq}/3 ของ ${qt.number}`);
   receiptIds.push(rec.id);return rec;
  };
  await payAndReceipt(0);await payAndReceipt(1);

  // 5. Before the last payment: the quotation shows 2/3 received and the dashboard owes the last installment.
  await page.evaluate(id=>viewDoc(id),qid);
  assert.match(await page.locator('.quotation-progress').innerText(),/ตกลง ฿50,000\.00 · รับแล้ว ฿40,000\.00 \(2\/3\) · ค้าง ฿10,000\.00/);
  await shot('quotation');
  await page.evaluate(()=>{setView('dashboard');render();});
  await page.waitForFunction(()=>/10,000\.00/.test(document.querySelector('.pillar.owed .val')?.textContent||''),{},{polling:100});
  assert.match(await page.locator('.pillar.owed').innerText(),/ยอดค้างรับ[\s\S]*10,000\.00/);
  assert.match(await page.locator('.pillar.received').innerText(),/40,000\.00/);
  await shot('dashboard');

  // 6. Last installment: receipt printed to PDF carries the invoice number.
  const last=await payAndReceipt(2);
  await shot('receipt');
  const pdf=await app.evaluate(async({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];await w.webContents.executeJavaScript('document.fonts.ready.then(()=>applyPrintZoom())');const b=await w.webContents.printToPDF({printBackground:true,preferCSSPageSize:true});await w.webContents.executeJavaScript('clearPrintZoom()');return b.toString('base64');});
  const bytes=Buffer.from(pdf,'base64');assert.equal(bytes.subarray(0,5).toString(),'%PDF-');
  const pdfFile=path.join(root,'receipt-3.pdf');await fs.writeFile(pdfFile,bytes);
  const paper=await page.locator('.paper').innerText();
  assert.match(paper,new RegExp('ชำระตามใบแจ้งหนี้ '+invNumbers[2]+' · งวดที่ 3/3 ของ '+qt.number));assert.match(paper,/ใบเสร็จรับเงิน/);assert.match(paper,/10,000\.00/);
  if(process.platform==='darwin'){const text=pdfText(pdfFile);assert.ok(text.includes(invNumbers[2]),'PDF text names the settled invoice');assert.match(text,new RegExp('ชำระตามใบแจ้งหนี.? '+invNumbers[2]+' · งวดที.? 3/3 ของ '+qt.number),'PDF text carries the settled-invoice line');for(const screenOnly of ['นำไปออก','สร้างจาก','ตกลง ฿','รับแล้ว ฿'])assert.ok(!text.includes(screenOnly),'screen-only text in PDF: '+screenOnly);}
  await page.evaluate(id=>viewDoc(id),qid);
  assert.match(await page.locator('.quotation-progress').innerText(),/ตกลง ฿50,000\.00 · รับแล้ว ฿50,000\.00 \(3\/3\) · ค้าง ฿0\.00/);

  // 7. Three receipts, three payments, ledger figures; saved file matches.
  const summary=await page.evaluate(()=>({receipts:DB.documents.filter(d=>d.type==='receipt').sort((a,b)=>a.settles.installment.seq-b.settles.installment.seq).map(r=>compute(r).netPayable),
   income:paymentReview().docs.length,received:taxYearAgg(new Date().getFullYear()).agg.net,issued:DB.documents.filter(isIssuedDocument).length,counters:DB.counters}));
  assert.deepEqual(summary.receipts,[25000,15000,10000]);assert.equal(summary.income,3);assert.equal(summary.received,50000);assert.equal(summary.issued,7);
  assert.deepEqual(Object.values(summary.counters).sort(),[1,3,3],'one quotation, three invoices, three receipts reserved');
  const saved=JSON.parse(await page.evaluate(()=>window.billingAPI.load()));
  assert.equal(saved.documents.filter(d=>d.type==='receipt'&&d.status==='issued').length,3);
  assert.deepEqual(saved.documents.filter(d=>d.type==='receipt').map(r=>r.settles.invoiceNumber).sort(),invNumbers.slice().sort());

  // 8. Reload: everything is still there and still renders.
  await page.reload();await page.waitForFunction(()=>DB&&!loadFailed&&dataLoc.path,{},{polling:100});
  assert.equal(await page.evaluate(()=>DB.documents.filter(d=>isIssuedDocument(d)).length),7);
  await page.evaluate(id=>viewDoc(id),last.id);
  assert.equal(await page.locator('.paper .settled-reference').innerText(),`ชำระตามใบแจ้งหนี้ ${invNumbers[2]} · งวดที่ 3/3 ของ ${qt.number}`);
  await page.evaluate(id=>viewDoc(id),qid);
  assert.match(await page.locator('.quotation-progress').innerText(),/\(3\/3\) · ค้าง ฿0\.00/);
  assert.deepEqual(errors,[]);
  console.log('PASS: quotation 50,000 split 25,000/15,000/10,000 through the split dialog, three invoices issued, three payments through the dialog, three receipts with matching nets and settled-invoice lines (paper + PDF), quotation progress 0/3 → 2/3 → 3/3, dashboard receivable 10,000 before the last payment, reload, no page errors.');
  console.log('SCREENSHOTS='+shots);console.log('SYNTHETIC_ARTIFACTS='+root);
 }finally{await app.evaluate(({app})=>app.exit(0)).catch(()=>{});}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
