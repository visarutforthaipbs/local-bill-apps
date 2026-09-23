// Synthetic browser-only workflow. A fresh ephemeral browser context and random
// localhost port ensure that no existing user profile or customer data is used.
const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const assert=require('node:assert/strict');
const project=path.resolve(__dirname,'..');
(async()=>{
  const server=http.createServer((req,res)=>{
    const file=path.resolve(project,'.'+new URL(req.url,'http://localhost').pathname);
    if(!file.startsWith(project+path.sep)){res.writeHead(403).end();return;}
    try{res.setHeader('Content-Type',file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.svg')?'image/svg+xml':'application/octet-stream');res.end(fs.readFileSync(file));}
    catch{res.writeHead(404).end();}
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  let browser;
  const artifacts=path.join(project,'test-artifacts'); fs.mkdirSync(artifacts,{recursive:true});
  try{
    browser=await chromium.launch({headless:true,channel:'chrome'});
    const page=await browser.newPage({viewport:{width:1440,height:1000},timezoneId:'Asia/Bangkok'});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/billing.html`);
    await page.waitForFunction(()=>typeof DB==='object'&&DB!==null);
    await page.evaluate(()=>{
      closeModal();DB=blankDB();DEVICE_ID='browser-test';DB.meta.setupDone=true;
      Object.assign(DB.business,{businessName:'ผู้ทดสอบ ใบเสร็จ',address:'เชียงใหม่ ประเทศไทย',taxId:'1234567890123'});
      DB.clients=[{id:'buyer-test',name:'ลูกค้าทดสอบ',address:'กรุงเทพฯ',deletedAt:null}];render();
      openDocEditor('receipt');
    });
    assert.equal(await page.locator('#d_type option[value="tax_invoice"]').count(),0);
    await page.locator('#itemsBody input').nth(0).fill('ค่าบริการออกแบบ');
    await page.locator('#itemsBody input').nth(3).fill('10000');
    await page.locator('#d_paid').fill('2026-09-20');
    await page.locator('#d_incat').selectOption('40(2)');
    await page.locator('label').filter({has:page.locator('#d_whtReviewed')}).click();
    await page.locator('label').filter({has:page.locator('input[onchange="editField(\'fullPaymentConfirmed\',this.checked)"]')}).click();
    await page.locator('label').filter({has:page.locator('input[onchange="editField(\'issueConfirmed\',this.checked)"]')}).click();
    await page.locator('button[onclick="saveDoc()"]').click();
    assert.equal(await page.evaluate(()=>DB.documents.length),0,'unknown VAT status must reject');
    await page.evaluate(()=>{closeModal();setView('settings');setSettingsTab('docs');});
    // VAT confirmation lives in the business/documents settings; choose the tab
    // through the app rather than altering customer data or browser storage.
    if(await page.locator('#s_vatStatus').count()===0) await page.evaluate(()=>setSettingsTab('business'));
    await page.locator('#s_vatStatus').selectOption('non_registered');
    await page.evaluate(()=>saveSettings(true));
    await page.evaluate(()=>{drawDocEditor();openModal();});
    await page.locator('button[onclick="saveDoc()"]').click();
    await page.waitForFunction(()=>DB.documents.length===1&&!!DB.documents[0].issuedSnapshot);
    assert.match(await page.locator('.paper').innerText(),/ไม่ใช่ใบกำกับภาษี/);
    const original=await page.locator('.paper').innerHTML();
    await page.screenshot({path:path.join(artifacts,'receipt-th.png'),fullPage:true,animations:'disabled'});
    await page.pdf({path:path.join(artifacts,'receipt-th.pdf'),format:'A4',printBackground:true});
    await page.evaluate(()=>{
      DB.business.businessName='Changed';DB.business.address='Changed';DB.business.isVatRegistered=true;DB.business.lang='en';DB.business.yearMode='ce';DB.clients[0].name='Changed buyer';render();
    });
    assert.equal(await page.locator('.paper').innerHTML(),original,'issued paper remains stable');
    assert.equal(await page.locator('button[onclick^="openDocEditor"]').count(),0);
    await page.evaluate(()=>duplicateDoc(DB.documents[0].id));
    assert.equal(await page.evaluate(()=>DB.documents.length),1);
    assert.equal(await page.evaluate(()=>editDoc.status),'draft');
    assert.equal(await page.evaluate(()=>editDoc.paidDate),null);
    await page.evaluate(()=>{closeModal();DB.business.uiLang='en';setView('filing');});
    await page.getByText('Tax payable or refund calculation is unavailable',{exact:true}).waitFor();
    await page.screenshot({path:path.join(artifacts,'bookkeeping-en.png'),fullPage:true,animations:'disabled'});
    for(const lang of ['th','en']) for(const view of ['dashboard','documents','wht','report','filing','settings']){
      await page.evaluate(({lang,view})=>{DB.business.uiLang=lang;setView(view);},{lang,view});
    }
    assert.deepEqual(errors,[]);
    await page.evaluate(()=>localStorage.clear());
    console.log('PASS: unknown VAT rejected; explicit confirmation; real receipt UI; frozen paper; duplicate draft; TH/EN screens; PDF. Artifacts:',artifacts);
  }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
