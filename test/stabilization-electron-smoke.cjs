// Source or explicit packaged runtime, always an isolated synthetic profile.
// NODE_PATH=<bundled Playwright directory> node test/stabilization-electron-smoke.cjs
const {_electron:electron}=require('playwright');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const assert=require('node:assert/strict');
const project=path.resolve(__dirname,'..');
(async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'billngai-204-native-'));
  const profile=path.join(root,'profile'),store=path.join(root,'synthetic.json');
  await fs.mkdir(profile);
  await fs.writeFile(path.join(profile,'config.json'),JSON.stringify({externalPath:store}));
  const fixture={version:2,business:{businessName:'ผู้ทดสอบ บิลง่าย',address:'เชียงใหม่ ประเทศไทย',taxId:'1234567890123',vatStatus:'non_registered',uiLang:'th'},clients:[{id:'buyer',name:'ลูกค้าทดสอบ',address:'กรุงเทพฯ'}],documents:[
    {id:'old',type:'invoice',number:'OLD-204',status:'sent',clientId:'buyer',currency:'THB',issueDate:'2025-01-10',dueDate:'2025-02-10',vatRate:0,whtRate:0,items:[{description:'บริการเดิมที่เก็บไว้',qty:1,price:1000}],notes:'Retained original facts'},
    {id:'draft',type:'invoice',number:'DRAFT-204',status:'draft',clientId:'buyer',currency:'THB',issueDate:'2026-09-20',vatRate:0,whtRate:0,items:[{description:'บริการทดสอบร่าง',qty:1,price:1000}]},
    {id:'tax-draft',type:'tax_invoice',number:'TAX-OLD',status:'draft',clientId:'buyer',currency:'THB',issueDate:'2026-09-20',vatRate:7,whtRate:0,items:[{description:'Retained tax draft',qty:1,price:1000}]}
  ],recurring:[],counters:{},meta:{setupDone:true},reviewEvents:[]};
  await fs.writeFile(store,JSON.stringify(fixture));
  let app;
  try{
    const packagedExecutable=process.argv[2];
    app=await electron.launch({executablePath:packagedExecutable?path.resolve(packagedExecutable):require('electron'),args:[...(packagedExecutable?[]:[project]),'--user-data-dir='+profile],timeout:30000});
    assert.equal(await app.evaluate(({app})=>app.getPath('userData')),await fs.realpath(profile));
    assert.equal(await app.evaluate(({app})=>app.getVersion()),'2.0.4');
    const page=await app.firstWindow(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.waitForFunction(()=>DB&&!loadFailed&&DB.documents.length===3);
    await page.evaluate(()=>viewDoc('old'));
    await page.getByText('บริการเดิมที่เก็บไว้',{exact:true}).first().waitFor();
    assert.equal(await page.locator('.paper').count(),0);
    const old=await page.evaluate(()=>JSON.stringify(DB.documents[0]));
    await page.getByRole('button',{name:'ยกเลิกและเก็บเอกสาร',exact:true}).click();
    await page.locator('#voidReason').waitFor();
    await page.locator('#modal').getByRole('button',{name:'ยกเลิก',exact:true}).click();
    assert.equal(await page.evaluate(()=>JSON.stringify(DB.documents[0])),old);
    await page.getByRole('button',{name:'ยกเลิกและเก็บเอกสาร',exact:true}).click();
    await page.locator('#voidReason').fill('Synthetic duplicate cancellation');
    await page.locator('#modal').getByRole('button',{name:'ยกเลิกและเก็บเอกสาร',exact:true}).click();
    await page.waitForFunction(()=>!!DB.documents[0].voidedAt&&!issuanceBusy);
    assert.equal(JSON.parse(await fs.readFile(store,'utf8')).documents[0].voidReason,'Synthetic duplicate cancellation');
    await page.reload();await page.waitForFunction(()=>DB&&!loadFailed&&!!DB.documents[0].voidedAt);
    // Create a supported issued invoice only in the verified synthetic profile.
    await page.evaluate(async()=>{
      const d={id:'issued',type:'invoice',clientId:'buyer',number:'NEW-204',status:'sent',issueDate:'2026-09-20',currency:'THB',vatRate:0,whtRate:0,whtReviewed:true,items:[{description:'บริการใหม่',qty:1,price:1000}]};
      freezeIssuedDocument(d);DB.documents.push(d);if(!await persist(true))throw Error('fixture save');viewDoc(d.id);
    });
    await page.getByRole('button',{name:'บันทึกรับชำระ',exact:true}).click();
    await page.locator('#paymentDate').fill('2026-09-21');
    await page.locator('#paymentFull').check();
    await page.locator('#modal').getByRole('button',{name:'บันทึก',exact:true}).click();
    await page.waitForFunction(()=>DB.documents.find(d=>d.id==='issued').status==='paid'&&!issuanceBusy);
    assert.equal(JSON.parse(await fs.readFile(store,'utf8')).documents.find(d=>d.id==='issued').paidDate,'2026-09-21');
    await page.evaluate(()=>viewDoc('draft'));
    await page.locator('.draft-print-marker').waitFor();
    await page.screenshot({path:path.join(root,'draft-screen.png'),animations:'disabled'});
    const pdf=await app.evaluate(async({BrowserWindow})=>{
      const win=BrowserWindow.getAllWindows()[0];
      await win.webContents.executeJavaScript('document.fonts.ready.then(()=>applyPrintZoom())');
      const bytes=await win.webContents.printToPDF({printBackground:true,preferCSSPageSize:true});
      await win.webContents.executeJavaScript('clearPrintZoom()');return bytes.toString('base64');
    });
    await fs.writeFile(path.join(root,'draft.pdf'),Buffer.from(pdf,'base64'));
    await page.evaluate(()=>viewDoc('tax-draft'));
    assert.equal(await page.locator('.paper').count(),0);
    assert.equal(await page.evaluate(()=>documentOutputBlocked(DB.documents.find(d=>d.id==='tax-draft'))),true);
    await page.screenshot({path:path.join(root,'historical-review.png'),animations:'disabled',fullPage:true});
    // Exercise real evidence IPC + disk, with deterministic native picker destinations.
    // The OS picker presentation itself is not being automated/claimed here.
    await app.evaluate(({dialog},file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]});},path.join(root,'draft.pdf'));
    await page.evaluate(async original=>{
      const d=JSON.parse(original);d.id='legacy-payment';d.number='LEGACY-PAY-204';DB.documents.push(d);
      if(!await persist(true))throw Error('legacy fixture save');viewDoc(d.id);
    },old);
    const paymentOriginal=await page.evaluate(()=>JSON.stringify(DB.documents.find(d=>d.id==='legacy-payment')));
    await page.getByRole('button',{name:'ตรวจรับเงินของใบแจ้งหนี้เดิม',exact:true}).click();
    for(const [key,value] of Object.entries({issuerName:'Reviewed synthetic seller',issuerAddress:'Chiang Mai',issuerTaxId:'1234567890123',buyerName:'Reviewed synthetic buyer',buyerAddress:'Bangkok',buyerTaxId:'',gross:'1000',wht:'0',net:'1000'}))await page.locator('#legacy_'+key).fill(value);
    await page.locator('#paymentDate').fill('2025-02-20');await page.locator('#legacyVat').check();await page.locator('#paymentFull').check();
    await page.locator('#reviewNote').fill('Synthetic evidence and full payment checked');
    await page.getByRole('button',{name:'แนบหลักฐานต้นฉบับ',exact:true}).click();
    await page.waitForFunction(()=>reviewDraft.evidence.length===1);
    await page.locator('#modal').getByRole('button',{name:'บันทึก',exact:true}).click();
    await page.waitForFunction(()=>DB.reviewEvents.length===1&&!issuanceBusy);
    assert.equal(await page.evaluate(()=>JSON.stringify(DB.documents.find(d=>d.id==='legacy-payment'))),paymentOriginal);
    assert.equal(await page.evaluate(()=>taxYearAgg(2025).agg.subtotal),1000);
    const hash=await page.evaluate(()=>DB.reviewEvents[0].evidence[0].sha256);
    assert.deepEqual(await fs.readFile(path.join(profile,'evidence',hash+'.bin')),await fs.readFile(path.join(root,'draft.pdf')));
    page.once('dialog',dialog=>dialog.accept());
    await page.getByRole('button',{name:'ออกใบเสร็จรับเงิน',exact:true}).click();
    await page.waitForFunction(()=>DB.documents.some(d=>d.reviewEventId)&&!issuanceBusy);
    assert.equal(await page.evaluate(()=>taxYearAgg(2025).agg.subtotal),1000);
    assert.equal(await page.evaluate(()=>JSON.stringify(DB.documents.find(d=>d.id==='legacy-payment'))),paymentOriginal);
    assert.match(await page.locator('.paper').innerText(),/Reviewed synthetic seller/);
    assert.match(await page.locator('.paper').innerText(),/ไม่ใช่ใบกำกับภาษี/);
    await app.evaluate(({dialog},file)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:file});},path.join(root,'evidence-bundle.json'));
    await page.evaluate(()=>evidenceBundle('export'));
    assert.equal(JSON.parse(await fs.readFile(path.join(root,'evidence-bundle.json'),'utf8')).purpose,'billngai-evidence-bundle');
    for(const lang of ['th','en'])for(const view of ['dashboard','documents','wht','report','filing','settings'])await page.evaluate(({lang,view})=>{DB.business.uiLang=lang;setView(view);},{lang,view});
    assert.deepEqual(errors,[]);
    // Exercise the actual renderer/native window-close handshake during a local save.
    await page.evaluate(()=>{DB.meta.nativeCloseCanary='saved-before-window-close';void persist(true);});
    await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].close());
    await page.waitForEvent('close',{timeout:20000}).catch(async error=>{
      if(!page.isClosed())throw error;
    });
    assert.equal(JSON.parse(await fs.readFile(store,'utf8')).meta.nativeCloseCanary,'saved-before-window-close');
    console.log('PASS: '+(packagedExecutable?'packaged executable':'source runtime')+', native void/payment dialogs, reload, draft PDF, tax-draft block, evidence IPC/bundle, legacy payment/new receipt counted once, TH/EN views and close drain.');
    console.log('SYNTHETIC_ARTIFACTS='+root);
  }finally{if(app)await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
