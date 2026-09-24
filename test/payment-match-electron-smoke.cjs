const {_electron:electron}=require('playwright');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
(async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'billngai-payment-match-')),profile=path.join(root,'profile');await fs.mkdir(profile,{mode:0o700});
  const invoice={id:'inv',type:'invoice',number:'INV-TEST',status:'paid',clientId:'buyer',currency:'THB',issueDate:'2026-01-10',paidDate:'2026-01-10',vatRate:0,whtRate:3,items:[{description:'Synthetic service',qty:1,price:1000}]};
  const receipt={...invoice,id:'tx',type:'tax_invoice',number:'TX-TEST',status:'issued',parentId:'inv'};
  const data={version:2,business:{uiLang:'th'},clients:[{id:'buyer',name:'Synthetic buyer'}],documents:[invoice,receipt],recurring:[],reviewEvents:[],counters:{},meta:{setupDone:true}};
  await fs.writeFile(path.join(profile,'config.json'),JSON.stringify({externalPath:null}));await fs.writeFile(path.join(profile,'billing.json'),JSON.stringify(data));let app;
  try{
    const exe=process.argv[2];app=await electron.launch({executablePath:exe||require('electron'),args:[...(exe?[]:[path.resolve(__dirname,'..')]),'--user-data-dir='+profile],timeout:30000});
    assert.equal(await app.evaluate(({app})=>app.getPath('userData')),await fs.realpath(profile));
    const page=await app.firstWindow(),errors=[];page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));await page.waitForFunction(()=>DB&&!loadFailed&&DB.documents.length===2);
    await page.locator('.pillar.received').getByText('ยอดยังไม่ครบ',{exact:true}).waitFor();
    assert.match(await page.locator('#pendingPayments').innerText(),/970/);
    const original=await page.evaluate(()=>JSON.stringify(DB.documents));
    await page.screenshot({path:path.join(root,'dashboard-before.png'),fullPage:true,animations:'disabled'});
    await page.getByRole('button',{name:'ดูและยืนยันคู่รับเงิน',exact:true}).click();
    await page.locator('[data-payment-match="0"]').check();await page.locator('#samePaymentConfirmed').check();await page.locator('#paymentMatchNote').fill('Verified synthetic pair represents one payment');
    await page.getByRole('button',{name:'บันทึกการจับคู่',exact:true}).click();
    await page.waitForFunction(()=>DB.reviewEvents.length===1&&!issuanceBusy);
    assert.equal(await page.evaluate(()=>paymentReview().docs.length),1);assert.equal(await page.evaluate(()=>JSON.stringify(DB.documents)),original);
    assert.ok((await fs.readdir(path.join(profile,'backups'))).some(n=>n.startsWith('billing-before-payment-match-')));
    await page.reload();await page.waitForFunction(()=>DB&&!loadFailed&&DB.reviewEvents.length===1);
    assert.equal(await page.evaluate(()=>taxYearAgg(2026).agg.net),970);
    assert.equal(await page.locator('#pendingPayments').count(),0);
    assert.equal(await page.evaluate(()=>documentOutputBlocked(DB.documents.find(d=>d.id==='tx'))),true);
    assert.deepEqual(errors,[]);console.log('PASS: provisional dashboard, explicit pair confirmation, native backup/save/reload, one payment, original and tax-output restrictions preserved.');console.log('SYNTHETIC_ARTIFACTS='+root);
  }finally{if(app)await app.evaluate(({app})=>app.exit(0)).catch(()=>{});}
})().catch(e=>{console.error(e);process.exitCode=1;});
