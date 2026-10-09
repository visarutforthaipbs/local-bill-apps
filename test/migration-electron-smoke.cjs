// Direct build → App Store build move on synthetic profiles only (PRD-SIMPLIFY-2026-10 §5.3).
// A direct-flavoured app issues 10 corrected receipts on a 52-document profile and exports the move file;
// an empty MAS-flavoured app (BILLNGAI_FAKE_MAS=1) imports it from the setup sheet. Income review, documents,
// counters, corrections, clients, images and settings must be identical. The owner's live profile is never opened.
// NODE_PATH=<Playwright directory> node test/migration-electron-smoke.cjs   (BILLNGAI_MIGRATION_SHOTS=<dir> keeps the screenshots)
const {_electron}=require('playwright');const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const PNG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
function seed(){
 const ts='2026-01-10T00:00:00.000Z',day=i=>'2026-'+String(1+Math.floor(i/28)).padStart(2,'0')+'-'+String(1+i%28).padStart(2,'0'),buyer=i=>i%2?'buyer-b':'buyer-a';
 const base=(i,o)=>({clientId:buyer(i),currency:'THB',issueDate:day(i),vatRate:0,whtRate:3,incomeCategory:'40(2)',createdAt:ts,updatedAt:ts,deletedAt:null,...o});
 const documents=[];
 for(let i=0;i<10;i++)documents.push(base(i,{id:'tx-'+i,type:'tax_invoice',number:'TX-'+String(i+1).padStart(2,'0'),status:'issued',paidDate:day(i),items:[{description:'งวดงานที่ '+(i+1)+' · synthetic',qty:1,unit:'งวด',price:10000+i*500}],legacy_review_required:true}));
 for(let i=0;i<22;i++)documents.push(base(i,{id:'rc-'+i,type:'receipt',number:'RC-69-'+String(i+1).padStart(3,'0'),status:'issued',paidDate:day(i),project:'งานรับเงิน '+(i+1),items:[{description:'ค่าบริการรายเดือน',qty:1,unit:'เดือน',price:8000+i*100}],...(i%3===0?{whtCertReceived:true,whtCertNo:'50TAWI-'+(i+1),whtCertDate:day(i)}:{})}));
 for(let i=0;i<15;i++)documents.push(base(i,{id:'inv-'+i,type:'invoice',number:'INV-69-'+String(i+1).padStart(3,'0'),status:i%2?'paid':'sent',dueDate:day(i+7),paidDate:i%2?day(i+3):null,project:'งานออกแบบ '+(i+1),items:[{description:'ออกแบบสื่อ',qty:2,unit:'ชิ้น',price:3500+i*50}]}));
 for(let i=0;i<5;i++)documents.push(base(i,{id:'qt-'+i,type:'quotation',number:'QT-69-'+String(i+1).padStart(3,'0'),status:i%2?'accepted':'sent',project:'ข้อเสนอ '+(i+1),items:[{description:'ที่ปรึกษา',qty:10,unit:'ชม.',price:1200}]}));
 return {version:3,
  business:{businessName:'ผู้รับเงินตัวอย่าง',businessNameEn:'Synthetic issuer',address:'เชียงใหม่',taxId:'1234567890123',phone:'0812345678',promptpayId:'0812345678',vatStatus:'non_registered',uiLang:'th',brandColor:'#1f5d43',logo:PNG,signature:PNG},
  clients:[{id:'buyer-a',name:'ลูกค้าตัวอย่าง ก',address:'กรุงเทพฯ',taxId:'1234567890123',defaultWht:true,updatedAt:ts,deletedAt:null},{id:'buyer-b',name:'ลูกค้าตัวอย่าง ข',address:'เชียงใหม่',taxId:'1234567890123',docLang:'bilingual',updatedAt:ts,deletedAt:null}],
  documents,recurring:[{id:'rec-1',clientId:'buyer-a',frequency:'monthly',nextDate:'2026-11-01',anchorDay:1,currency:'THB',vatRate:0,whtRate:3,project:'ดูแลระบบรายเดือน',items:[{description:'ดูแลระบบ',qty:1,unit:'เดือน',price:8000}],updatedAt:ts}],
  reviewEvents:[],counters:{'quotation-2026':5,'invoice-2026':15,'receipt-2026':22},meta:{reviewSemanticsVersion:3,setupDone:true}};
}
async function launch(profile,env){
 const app=await _electron.launch({executablePath:process.argv[2]||require('electron'),args:[...(process.argv[2]?[]:[path.resolve(__dirname,'..')]),'--user-data-dir='+profile],env:{...process.env,...env}});
 assert.equal(await app.evaluate(({app})=>app.getPath('userData')),await fs.realpath(profile));
 const page=await app.firstWindow();page.setDefaultTimeout(20000);await page.setViewportSize({width:1440,height:1000});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.waitForFunction(()=>DB&&!loadFailed&&dataLoc.path,{},{polling:100});return {app,page,errors};
}
async function scheme(app,page,mode){
 await app.evaluate(({nativeTheme},mode)=>{nativeTheme.themeSource=mode;},mode);await page.emulateMedia({colorScheme:mode,reducedMotion:'reduce'});
 await page.waitForFunction(mode=>document.documentElement.classList.contains('scheme-dark')===(mode==='dark'),mode);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
}
const capture=page=>page.evaluate(()=>({review:JSON.stringify(paymentReview()),documents:JSON.stringify(DB.documents),counters:JSON.stringify(DB.counters),reissues:JSON.stringify(receiptReissues()),
 extras:JSON.stringify({clients:DB.clients,business:DB.business,assets:DB.assets,recurring:DB.recurring,semantics:DB.meta.reviewSemanticsVersion,wht:whtTrackedDocs().map(d=>d.id)})}));
const settled=page=>page.waitForFunction(()=>!issuanceBusy&&pendingPersist===0&&!dirty);
(async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'billngai-migration-smoke-')),shots=process.env.BILLNGAI_MIGRATION_SHOTS?path.resolve(process.env.BILLNGAI_MIGRATION_SHOTS):root;await fs.mkdir(shots,{recursive:true});
 const direct=path.join(root,'direct'),store=path.join(root,'store'),moveFile=path.join(root,'exported','billngai-move-test.json');
 for(const dir of [direct,store,path.dirname(moveFile)])await fs.mkdir(dir,{mode:0o700});
 await fs.writeFile(path.join(direct,'config.json'),'{"externalPath":null}');await fs.writeFile(path.join(direct,'billing.json'),JSON.stringify(seed()));
 await fs.writeFile(path.join(store,'config.json'),'{"externalPath":null}');
 const apps=[];
 try{
  /* ---- source: direct build ---- */
  const src=await launch(direct,{BILLNGAI_FAKE_MAS:'0'});apps.push(src.app);let page=src.page;
  assert.deepEqual(await page.evaluate(()=>[IS_MAS,IS_STORE_BUILD,DB.documents.length,activeClients().length]),[false,false,52,2]);
  await page.evaluate(()=>openReceiptReissues());assert.equal(await page.locator('[data-reissue-id]').count(),10);
  for(const id of ['reissueVat','reissueParties','reissuePayment'])await page.locator('#'+id).check();
  await page.locator('button[onclick="confirmReceiptReissues()"]').click();await page.locator('#confirmOk').click();await page.waitForFunction(()=>!issuanceBusy&&receiptReissues().length===10);await settled(page);
  await page.reload();await page.waitForFunction(()=>DB&&!loadFailed&&dataLoc.path,{},{polling:100});
  const before=await capture(page);assert.equal(JSON.parse(before.reissues).length,10);assert.equal(JSON.parse(before.documents).length,52);assert.ok(JSON.parse(before.extras).wht.length>=20,'WHT entries seeded');
  const reissueId=await page.evaluate(()=>receiptReissues()[3].receipt.id);
  await page.evaluate(id=>viewDoc(id),reissueId);const paperBefore=await page.locator('.paper').first().innerText();assert.match(paperBefore,/ใบเสร็จรับเงิน/);
  // Settings → data & backup: the move card, the store-only notice, no store-build import action.
  for(const mode of ['light','dark']){await scheme(src.app,page,mode);await page.evaluate(()=>{settingsTab='data';setView('settings');hideToast();});await page.locator('button[onclick="elMoveExport()"]').waitFor();
   await page.screenshot({path:path.join(shots,'migration-move-card-'+mode+'.png'),animations:'disabled'});}
  await scheme(src.app,page,'light');
  const panel=await page.locator('.settings-panel').innerText();assert.match(panel,/รุ่นต่อไปจะมีใน App Store เท่านั้น/);assert.match(panel,/ย้ายไป App Store/);assert.doesNotMatch(panel,/https?:\/\//);
  assert.equal(await page.locator('button[onclick="importFromPreviousVersion(false)"]').count(),0);assert.equal(await page.locator('.settings-panel .card-block').first().locator('.btn-primary').count(),1);
  await src.app.evaluate(({dialog},file)=>{globalThis.__moveSave=null;dialog.showSaveDialog=async(_w,opts)=>{globalThis.__moveSave=opts;return {canceled:false,filePath:file};};},moveFile);
  await page.locator('button[onclick="elMoveExport()"]').click();await page.locator('#modal .step-list li').nth(2).waitFor();
  const steps=await page.locator('#modal').innerText();assert.match(steps,/App Store/);assert.match(steps,/เปิดแอป/);assert.match(steps,/นำเข้าจากเวอร์ชันเดิม…/);assert.match(steps,/billngai-move-test\.json/);
  assert.match(path.basename((await src.app.evaluate(()=>globalThis.__moveSave)).defaultPath),/^billngai-move-\d{4}-\d{2}-\d{2}\.json$/);
  await page.locator('#modal .modal-foot .btn-primary').click();await page.waitForFunction(()=>!modalIsOpen());await settled(page);
  const exported=JSON.parse(await fs.readFile(moveFile,'utf8'));
  assert.equal(Object.hasOwn(exported,'syncV3'),false);assert.equal(exported.documents.length,52);assert.equal(exported.reviewEvents.filter(e=>e.type==='receipt_reissue').length,10);assert.equal(exported.meta.reviewSemanticsVersion,3);assert.equal(exported.clients.length,2);assert.equal(exported.recurring.length,1);
  assert.equal(await page.evaluate(()=>typeof DB.meta.lastBackupAt==='string'&&DB.meta.lastBackupAt.length>0),true);
  assert.deepEqual(src.errors,[]);await src.app.evaluate(({app})=>app.exit(0));apps.pop();

  /* ---- target: App Store flavour, empty store ---- */
  const dst=await launch(store,{BILLNGAI_FAKE_MAS:'1'});apps.push(dst.app);page=dst.page;
  assert.deepEqual(await page.evaluate(()=>[IS_MAS,IS_STORE_BUILD,storeIsEmpty(),modalIsOpen()]),[true,true,true,true]);
  assert.equal(await page.locator('button[onclick="importFromPreviousVersion(true)"]').count(),1);assert.equal(await page.locator('button[onclick="elMoveExport()"]').count(),0);
  for(const mode of ['light','dark']){await scheme(dst.app,page,mode);await page.screenshot({path:path.join(shots,'migration-setup-'+mode+'.png'),animations:'disabled'});}
  await scheme(dst.app,page,'light');
  await dst.app.evaluate(({dialog},file)=>{globalThis.__opens=0;dialog.showOpenDialog=async()=>{globalThis.__opens++;return {canceled:false,filePaths:[file]};};},moveFile);
  await page.locator('button[onclick="importFromPreviousVersion(true)"]').click();
  await page.waitForFunction(()=>!modalIsOpen()&&!pendingDataUpgrade&&receiptReissues().length===10);await settled(page);
  assert.equal(await dst.app.evaluate(()=>globalThis.__opens),1);assert.equal(await page.locator('#confirmOverlay.open').count(),0,'an empty store imports without a confirmation');
  const after=await capture(page);assert.deepEqual(after,before);
  assert.equal(await page.evaluate(()=>DB.meta.reviewSemanticsVersion),3);
  const raw=JSON.parse(await page.evaluate(()=>window.billingAPI.load()));assert.equal(raw.reviewEvents.filter(e=>e.type==='receipt_reissue').length,10);assert.equal(Object.hasOwn(raw,'syncV3'),false);
  await fs.access(path.join(store,'.data-initialized'));
  // A corrected receipt prints from the imported store exactly as it did at the source.
  await page.evaluate(id=>viewDoc(id),reissueId);assert.equal(await page.evaluate(()=>documentOutputBlocked(getViewingDocument())),false);assert.equal(await page.locator('.paper').first().innerText(),paperBefore);
  const pdf=await dst.app.evaluate(async({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];await w.webContents.executeJavaScript('document.fonts.ready.then(()=>applyPrintZoom())');const b=await w.webContents.printToPDF({printBackground:true,preferCSSPageSize:true});await w.webContents.executeJavaScript('clearPrintZoom()');return b.toString('base64');});
  const bytes=Buffer.from(pdf,'base64');assert.equal(bytes.subarray(0,5).toString(),'%PDF-');await fs.writeFile(path.join(root,'corrected-receipt.pdf'),bytes);
  // Reload keeps everything; the setup sheet no longer appears.
  await page.reload();await page.waitForFunction(()=>DB&&!loadFailed&&dataLoc.path,{},{polling:100});
  assert.deepEqual(await capture(page),before);assert.equal(await page.evaluate(()=>modalIsOpen()),false);
  // Settings → data & backup in the store build: the same action, guarded, replaces a non-empty store after a backup.
  await page.evaluate(()=>{settingsTab='data';setView('settings');hideToast();});
  assert.equal(await page.locator('button[onclick="importFromPreviousVersion(false)"]').count(),1);assert.equal(await page.locator('button[onclick="elMoveExport()"]').count(),0);assert.doesNotMatch(await page.locator('.settings-panel').innerText(),/รุ่นต่อไปจะมีใน App Store เท่านั้น/);
  // The action's own promise says when the import has finished (the button only starts it).
  const cancelled=page.evaluate(()=>importFromPreviousVersion(false));await page.locator('#confirmOverlay.open').waitFor();
  assert.equal(await page.locator('#confirmOk').getAttribute('class'),'btn btn-danger-solid');assert.equal(await page.locator('#confirmOk').innerText(),'เลือกไฟล์แล้วแทนที่');
  await page.locator('#confirmCancel').click();assert.equal(await cancelled,false);assert.equal(await dst.app.evaluate(()=>globalThis.__opens),1);assert.deepEqual(await capture(page),before);
  const replaced=page.evaluate(()=>importFromPreviousVersion(false));await page.locator('#confirmOverlay.open').waitFor();await page.locator('#confirmOk').click();assert.equal(await replaced,true);
  await settled(page);assert.equal(await dst.app.evaluate(()=>globalThis.__opens),2);assert.equal(await page.evaluate(()=>receiptReissues().length),10);
  assert.deepEqual(await capture(page),before);
  const backups=await fs.readdir(path.join(store,'backups'));assert.ok(backups.some(f=>f.startsWith('billing-pre-restore-')),'a non-empty store is backed up before it is replaced');
  assert.deepEqual(dst.errors,[]);
  console.log('PASS: 52 documents, 2 clients, 10 corrected receipts, WHT entries and images exported from the direct build (billngai-move-<date>.json, no sync binding) and imported into an empty App Store profile from the setup sheet; income review, documents, counters, corrections, clients, settings, assets and recurring identical; corrected receipt prints; reload stable; Settings import confirms and backs up a non-empty store; no page errors.');
  console.log('ARTIFACTS='+root+(shots!==root?' SCREENSHOTS='+shots:''));
 }finally{for(const app of apps)await app.evaluate(({app})=>app.exit(0)).catch(()=>{});}
})().catch(e=>{console.error(e);process.exitCode=1;});
