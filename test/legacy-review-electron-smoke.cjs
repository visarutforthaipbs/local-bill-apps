// Native old-record review (2.0.8): answer groups, backup, reload, clean dashboard.
// Synthetic isolated profile only; never opens the customer's BillNgai profile.
// NODE_PATH=<Playwright directory> node test/legacy-review-electron-smoke.cjs [packaged executable]
const {_electron:electron}=require('playwright');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
(async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'billngai-legacy-review-')),profile=path.join(root,'profile');await fs.mkdir(profile,{mode:0o700});
  const base={clientId:'buyer',currency:'THB',issueDate:'2026-01-10',paidDate:'2026-01-10',vatRate:0,whtRate:3,items:[{description:'บริการทดสอบ',qty:1,price:1000}]};
  const deleted='2026-01-11T00:00:00.000Z';
  const documents=[
    {...base,id:'i1',type:'invoice',number:'INV-DEL',status:'paid',deletedAt:deleted},
    {...base,id:'t1',type:'tax_invoice',number:'TX-DEL',status:'issued',parentId:'i1',deletedAt:deleted},
    {...base,id:'i2',type:'invoice',number:'INV-VAT',status:'paid',vatRate:7},
    {...base,id:'t2',type:'tax_invoice',number:'TX-VAT',status:'issued',parentId:'i2',vatRate:7}];
  const data={version:2,business:{uiLang:'th',businessName:'ผู้ทดสอบ',vatStatus:'non_registered'},clients:[{id:'buyer',name:'ลูกค้าทดสอบ'}],
    documents,recurring:[],reviewEvents:[],counters:{},meta:{setupDone:true,lastBackupAt:new Date().toISOString()}};
  await fs.writeFile(path.join(profile,'config.json'),JSON.stringify({externalPath:null}));
  await fs.writeFile(path.join(profile,'billing.json'),JSON.stringify(data));
  let app;
  try{
    const exe=process.argv[2];
    app=await electron.launch({executablePath:exe||require('electron'),args:[...(exe?[]:[path.resolve(__dirname,'..')]),'--user-data-dir='+profile],timeout:30000});
    assert.equal(await app.evaluate(({app})=>app.getPath('userData')),await fs.realpath(profile));
    const page=await app.firstWindow(),errors=[];page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
    await page.waitForFunction(()=>DB&&!loadFailed&&DB.documents.length===4);
    const originals=await page.evaluate(()=>JSON.stringify(DB.documents));
    // Dashboard: no empty pair card; one to-do line leads to the review.
    assert.equal(await page.locator('#pendingPayments').count(),0);
    await page.locator('.todo-row').filter({hasText:'ข้อมูลเดิมรอตรวจ'}).getByRole('button',{name:'ตรวจข้อมูลเดิม',exact:true}).click();
    await page.waitForFunction(()=>currentView==='legacy');
    assert.equal(await page.locator('.legacy-group').count(),2);
    // Missing confirmation/note is rejected without saving.
    await page.locator('.legacy-group').nth(0).locator('input[value="not_income"]').check({force:true});
    await page.getByRole('button',{name:'บันทึกคำตอบ',exact:true}).click();
    assert.equal(await page.evaluate(()=>DB.reviewEvents.length),0);
    const idx=await page.evaluate(()=>legacyRendered.findIndex(r=>JSON.parse(r.sourceJSON).some(d=>d.id==='i1')));
    await page.locator(`.legacy-group[data-legacy-index="${idx}"] input[value="not_income"]`).check({force:true});
    await page.locator(`.legacy-group[data-legacy-index="${1-idx}"] input[value="same_payment"]`).check({force:true});
    await page.locator('#legacyConfirmed').check({force:true});
    await page.locator('#legacyNote').fill('ตรวจกับรายการเดินบัญชีแล้ว (ข้อมูลทดสอบ)');
    await page.getByRole('button',{name:'บันทึกคำตอบ',exact:true}).click();
    await page.waitForFunction(()=>DB.reviewEvents.length===2&&!issuanceBusy);
    assert.ok((await fs.readdir(path.join(profile,'backups'))).some(n=>n.startsWith('billing-before-legacy-review-')));
    assert.equal(await page.evaluate(()=>JSON.stringify(DB.documents)),originals);
    await page.reload();await page.waitForFunction(()=>DB&&!loadFailed&&DB.reviewEvents.length===2);
    const r=await page.evaluate(()=>{const p=paymentReview();return {unanswered:p.unansweredGroups.length,ambiguous:p.ambiguousCount,docs:p.docs.map(d=>d.id),net:taxYearAgg(2026).agg.net};});
    assert.deepEqual(r,{unanswered:0,ambiguous:0,docs:['t2'],net:1040});
    assert.equal(await page.evaluate(()=>JSON.stringify(DB.documents)),originals);
    // Clean state: no to-do line, no old-record button on Documents, answers still reachable from Settings.
    await page.evaluate(()=>setView('dashboard'));
    assert.equal(await page.locator('.todo-row').filter({hasText:'ข้อมูลเดิม'}).count(),0);
    assert.equal(await page.locator('.pillar.received .val-tag').count(),0);
    await page.evaluate(()=>setView('documents'));
    assert.equal(await page.locator('#topActions').getByRole('button',{name:/ตรวจข้อมูลเดิม/}).count(),0);
    await page.evaluate(()=>{settingsTab='data';setView('settings');});
    await page.locator('#content').getByRole('button',{name:'ตรวจข้อมูลเดิม',exact:true}).click();
    await page.waitForFunction(()=>currentView==='legacy');
    assert.match(await page.locator('#content').innerText(),/ตรวจข้อมูลเดิมครบแล้ว/);
    for(const lang of ['th','en']) await page.evaluate(lang=>{DB.business.uiLang=lang;setView('legacy');},lang);
    await page.screenshot({path:path.join(root,'legacy-review-done.png'),fullPage:true,animations:'disabled'});
    assert.deepEqual(errors,[]);
    console.log('PASS: '+(exe?'packaged executable':'source runtime')+', dashboard to-do, answer validation, backed-up save, originals preserved, reload, one payment counted, clean dashboard/documents, settings access, TH/EN.');
    console.log('SYNTHETIC_ARTIFACTS='+root);
  }finally{if(app)await app.evaluate(({app})=>app.exit(0)).catch(()=>{});}
})().catch(e=>{console.error(e);process.exitCode=1;});
