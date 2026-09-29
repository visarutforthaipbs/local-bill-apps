// Native workflow on synthetic records only. The owner's live profile is never opened.
const {_electron}=require('playwright');const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
(async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'billngai-reissue-smoke-')),profile=path.join(root,'profile');await fs.mkdir(profile);await fs.writeFile(path.join(profile,'config.json'),'{"externalPath":null}');
 const tax=(id,price,extra={})=>({id,type:'tax_invoice',number:'TX-'+id,status:'issued',clientId:'buyer',currency:'THB',issueDate:'2026-01-10',paidDate:'2026-01-10',vatRate:0,whtRate:3,items:[{description:'งวดที่ 1/3 · Synthetic <img src=x onerror=alert(1)>',qty:1,unit:'งวด',price}],legacy_review_required:true,...extra});
 const seed={version:2,business:{businessName:'ผู้รับเงินตัวอย่าง',businessNameEn:'Synthetic issuer',address:'เชียงใหม่',taxId:'1234567890123',vatStatus:'non_registered',uiLang:'th'},clients:[{id:'buyer',name:'ลูกค้าตัวอย่าง',address:'เชียงใหม่',taxId:'1234567890123'}],documents:[tax('one',25000),tax('two',15000,{archivedAt:'2026-01-11T00:00:00.000Z',milestone:{seq:2,of:3}}),tax('deleted',100,{deletedAt:'2026-01-11T00:00:00.000Z'})],recurring:[],reviewEvents:[],counters:{},meta:{setupDone:true}};
 await fs.writeFile(path.join(profile,'billing.json'),JSON.stringify(seed));let app;
 try{
  app=await _electron.launch({executablePath:process.argv[2]||require('electron'),args:[...(process.argv[2]?[]:[path.resolve(__dirname,'..')]),'--user-data-dir='+profile]});assert.equal(await app.evaluate(({app})=>app.getPath('userData')),await fs.realpath(profile));
  const page=await app.firstWindow();page.setDefaultTimeout(15000);await page.setViewportSize({width:1440,height:1000});const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.waitForFunction(()=>DB&&!loadFailed&&dataLoc.path,{},{polling:100});
  const original=await page.evaluate(()=>JSON.stringify(DB.documents)),income=await page.evaluate(()=>JSON.stringify(paymentReview()));
  for(const lang of ['th','en']){
   await page.evaluate(lang=>{DB.business.uiLang=lang;viewDoc('one');},lang);await page.locator('#topActions button[onclick^="openReceiptReissues"]').click();
   assert.equal(await page.locator('[data-reissue-id]').count(),1);await page.locator('button[onclick^="showReceiptReissuePreview"]').click();
   assert.match(await page.locator('#modal .doc-title').innerText(),/ใบเสร็จรับเงิน/);assert.equal(await page.locator('#modal .tax-stamp').count(),0);
   assert.match(await page.locator('#modal .reissue-reference').innerText(),/TX-one/);
   await page.screenshot({path:path.join(root,'preview-'+lang+'.png')});await page.locator('button[onclick="renderReceiptReissueWizard()"]').click();await page.keyboard.press('Escape');
  }
  await page.evaluate(()=>{DB.business.uiLang='th';openReceiptReissues();});assert.equal(await page.locator('[data-reissue-id]').count(),2);await page.locator('#modal details summary').click();assert.match(await page.locator('#modal details').innerText(),/TX-deleted/);
  await page.locator('button[onclick="confirmReceiptReissues()"]').click();assert.equal(await page.evaluate(()=>receiptReissues().length),0);
  for(const id of ['reissueVat','reissueParties','reissuePayment'])await page.locator('#'+id).check();
  await page.locator('button[onclick="confirmReceiptReissues()"]').click();await page.locator('#confirmCancel').click();assert.equal(await page.evaluate(()=>receiptReissues().length),0);
  await page.locator('button[onclick="confirmReceiptReissues()"]').click();await page.locator('#confirmOk').click();await page.waitForFunction(()=>!issuanceBusy&&receiptReissues().length===2);
  assert.equal(await page.evaluate(()=>JSON.stringify(DB.documents)),original);assert.equal(await page.evaluate(()=>JSON.stringify(paymentReview())),income);
  assert.equal(await page.locator('.tax-stamp').count(),0);assert.match(await page.locator('.doc-title').innerText(),/ใบเสร็จรับเงิน/);
  const numbers=await page.evaluate(()=>receiptReissues().map(e=>e.receipt.number));assert.equal(new Set(numbers).size,2);
  const backups=await fs.readdir(path.join(profile,'backups'));assert.ok(backups.some(f=>f.includes('before-receipt-reissue')));
  const raw=JSON.parse(await fs.readFile(path.join(profile,'billing.json'),'utf8'));assert.equal(raw.reviewEvents.filter(e=>e.type==='receipt_reissue').length,2);
  const ids=await page.evaluate(()=>receiptReissues().map(e=>e.receipt.id));
  for(const [i,id] of ids.entries()){
   await page.evaluate(id=>viewDoc(id),id);assert.equal(await page.evaluate(()=>documentOutputBlocked(getViewingDocument())),false);
   const pdf=await app.evaluate(async({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];await w.webContents.executeJavaScript('document.fonts.ready.then(()=>applyPrintZoom())');const b=await w.webContents.printToPDF({printBackground:true,preferCSSPageSize:true});await w.webContents.executeJavaScript('clearPrintZoom()');return b.toString('base64');});
   const bytes=Buffer.from(pdf,'base64');assert.equal(bytes.subarray(0,5).toString(),'%PDF-');await fs.writeFile(path.join(root,'receipt-'+i+'.pdf'),bytes);
  }
  await page.reload();await page.waitForFunction(()=>DB&&!loadFailed&&dataLoc.path,{},{polling:100});assert.equal(await page.evaluate(()=>receiptReissues().length),2);assert.equal(await page.evaluate(()=>JSON.stringify(DB.documents)),original);assert.equal(await page.evaluate(()=>JSON.stringify(paymentReview())),income);
  await page.evaluate(()=>openReceiptReissues());assert.equal(await page.locator('[data-reissue-id]').count(),0);await page.locator('#modal details summary').click();assert.match(await page.locator('#modal').innerText(),/TX-one/);
  assert.deepEqual(errors,[]);console.log('PASS: bilingual previews, excluded deleted record, explicit confirmations, cancel, backed-up batch issuance, shared unique numbers, frozen PDF, save/reload, originals and income unchanged, repeat prevention.');console.log('ARTIFACTS='+root);
 }finally{if(app)await app.evaluate(({app})=>app.exit(0)).catch(()=>{});}
})().catch(e=>{console.error(e);process.exitCode=1;});
