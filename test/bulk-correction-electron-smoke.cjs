// Synthetic source runtime only. Never opens the customer's BillNgai profile.
const {_electron:electron}=require('playwright');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
(async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'billngai-bulk-review-')),profile=path.join(root,'profile');await fs.mkdir(profile,{mode:0o700});
  const invoice={id:'inv',type:'invoice',number:'INV-SYNTHETIC',status:'paid',clientId:'buyer',currency:'THB',issueDate:'2026-01-10',paidDate:'2026-01-10',vatRate:0,whtRate:0,items:[{description:'บริการทดสอบ',qty:1,price:1000}]};
  const receipt={...invoice,id:'tx',type:'tax_invoice',number:'TX-SYNTHETIC',status:'issued',parentId:'inv'};
  const data={version:2,business:{uiLang:'th',businessName:'ผู้ทดสอบ',vatStatus:'unknown'},clients:[{id:'buyer',name:'ลูกค้าทดสอบ'}],documents:[invoice,receipt,{...receipt,id:'deleted',number:'TX-DELETED',deletedAt:'2026-01-12T00:00:00.000Z'},{...receipt,id:'vat',number:'TX-VAT',vatRate:7}],recurring:[],reviewEvents:[],counters:{},meta:{setupDone:true}};
  await fs.writeFile(path.join(profile,'config.json'),JSON.stringify({externalPath:null}));await fs.writeFile(path.join(profile,'billing.json'),JSON.stringify(data));
  let app;
  try{
    app=await electron.launch({executablePath:require('electron'),args:[path.resolve(__dirname,'..'),'--user-data-dir='+profile],timeout:30000});
    assert.equal(await app.evaluate(({app})=>app.getPath('userData')),await fs.realpath(profile));
    const page=await app.firstWindow(),errors=[];page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
    await page.waitForFunction(()=>DB&&!loadFailed&&DB.documents.length===4);
    const originals=await page.evaluate(()=>JSON.stringify(DB.documents));
    await page.locator('#nav button[data-view="documents"]').click();
    await page.getByRole('button',{name:'ตรวจและเตรียมแก้เอกสารเดิม',exact:true}).click();
    assert.equal(await page.locator('#correctionDelivery').inputValue(),'unknown');assert.equal(await page.locator('#correctionVat').isChecked(),false);
    await page.getByRole('button',{name:'เลือกทั้งหมดที่เตรียมข้อเสนอได้',exact:true}).click();
    assert.equal(await page.locator('[data-correction-id]:checked').count(),1);
    await page.locator('#correctionVat').check();await page.locator('#correctionNote').fill('ยืนยันไม่จด VAT ตอนออก ยังไม่แน่ใจว่าส่งหรือไม่');
    await page.getByRole('button',{name:'เตรียมข้อเสนอใบเสร็จธรรมดา',exact:true}).click();
    await page.locator('#modal').getByRole('button',{name:'ยกเลิก',exact:true}).click();
    assert.equal(await page.evaluate(()=>DB.reviewEvents.length),0);
    await page.getByRole('button',{name:'เตรียมข้อเสนอใบเสร็จธรรมดา',exact:true}).click();
    await page.locator('#modal').getByRole('button',{name:'บันทึกชุดนี้',exact:true}).click();
    await page.waitForFunction(()=>DB.reviewEvents.length===1&&!issuanceBusy);
    assert.equal(await page.evaluate(()=>JSON.stringify(DB.documents)),originals);
    assert.ok((await fs.readdir(path.join(profile,'backups'))).some(n=>n.startsWith('billing-before-bulk-correction-')));
    await page.getByRole('button',{name:'ดูข้อเสนอ',exact:true}).click();
    await page.locator('#modal').getByText('ข้อเสนอใบเสร็จธรรมดา ไม่ใช่ใบเสร็จที่ออกแล้ว',{exact:true}).waitFor();
    assert.equal(await page.locator('#modal .paper').count(),0);
    await page.locator('#modal').getByRole('button',{name:'ปิด',exact:true}).click();
    await page.screenshot({path:path.join(root,'bulk-review-th.png'),fullPage:true});
    await page.reload();await page.waitForFunction(()=>DB&&!loadFailed&&DB.reviewEvents.length===1);
    assert.equal(await page.evaluate(()=>JSON.stringify(DB.documents)),originals);
    await page.evaluate(()=>{DB.business.uiLang='en';setView('corrections');});
    await page.getByRole('button',{name:'View proposal',exact:true}).waitFor();
    await page.screenshot({path:path.join(root,'bulk-review-en.png'),fullPage:true});
    const packet=await page.evaluate(()=>correctionReviewPacket());assert.equal(packet.events.length,1);assert.equal(packet.events[0].deliveryStatus,'unknown');
    assert.equal(packet.events[0].proposal.status,'review_only');assert.deepEqual(errors,[]);
    console.log('PASS: TH/EN bulk selection, exclusions, cancel, atomic backed-up save, original preservation, review-only proposal, reload and export packet.');
    console.log('SYNTHETIC_ARTIFACTS='+root);
  }finally{if(app)await app.evaluate(({app})=>app.exit(0)).catch(()=>{});}
})().catch(e=>{console.error(e);process.exitCode=1;});
