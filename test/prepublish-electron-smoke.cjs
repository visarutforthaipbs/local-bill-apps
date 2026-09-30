// First-day flow on a fresh isolated profile, driven through ordinary clicks:
// setup → client → quotation (checklist, 2-decimal price) → invoice → payment → receipt (inline VAT answer) → dashboard.
// Synthetic data only; never point this at a real profile.
const {_electron}=require('playwright'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
(async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'billngai-prepublish-')),profile=path.join(root,'profile');await fs.mkdir(profile);
 const exe=process.argv[2],app=await _electron.launch({executablePath:exe||require('electron'),args:[...(exe?[]:[path.resolve(__dirname,'..')]),'--user-data-dir='+profile]});
 try{
  assert.equal(await app.evaluate(({app})=>app.getPath('userData')),await fs.realpath(profile));
  const page=await app.firstWindow(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width:1280,height:860});
  await page.waitForFunction(()=>typeof DB!=='undefined'&&DB&&!loadFailed,{},{polling:100});
  const shot=name=>page.screenshot({path:path.join(root,name+'.png')});
  const confirmOk=async()=>{await page.locator('#confirmOverlay.open').waitFor();await page.locator('#confirmOk').click();await page.locator('#confirmOverlay.open').waitFor({state:'detached'}).catch(()=>{});await page.waitForFunction(()=>!document.getElementById('confirmOverlay').classList.contains('open'));};
  const settle=()=>page.waitForFunction(()=>!issuanceBusy&&!pendingPersist,{},{polling:50});

  // 1. First-run setup: tax-ID feedback, VAT left unanswered on purpose.
  if(!await page.locator('#w_name').count()) await page.evaluate(()=>openWizard());
  await page.locator('#w_name').fill('Synthetic Studio');
  await page.locator('#w_taxid').fill('12345');await page.locator('#w_taxid').blur();
  assert.equal(await page.locator('#taxIdFeedback').getAttribute('class'),'taxid-invalid','short tax ID flagged on leaving the field');
  await page.locator('#w_taxid').fill('1234567890121');assert.equal(await page.locator('#taxIdFeedback').getAttribute('class'),'taxid-valid');
  assert.equal(await page.locator('#w_vat').inputValue(),'unknown');
  await page.locator('#w_addr').fill('99 Synthetic Road, Chiang Mai 50200');await shot('01-setup');
  await page.getByRole('button',{name:'ถัดไป'}).click();await page.getByRole('button',{name:'ถัดไป'}).click();
  await page.getByRole('button',{name:'เริ่มใช้งาน'}).click();await settle();
  assert.equal(await page.evaluate(()=>DB.business.vatStatus),'unknown');

  // 2. First client.
  await page.getByRole('button',{name:'+ เอกสารใหม่'}).click();
  await page.locator('#c_name').fill('Synthetic Client Co.');await page.locator('#c_taxid').fill('abc');await page.locator('#c_taxid').blur();
  assert.equal(await page.locator('#taxIdFeedback').getAttribute('class'),'taxid-invalid');await page.locator('#c_taxid').fill('');
  await page.locator('#modal').getByRole('button',{name:'บันทึก',exact:true}).click();await settle();

  // 3. Quotation: price rounds on leaving the field; every blocker listed at once.
  await page.locator('#d_type').waitFor();assert.equal(await page.locator('#d_type').inputValue(),'quotation');
  const row=page.locator('#itemsBody tr').first();
  await row.locator('input').nth(0).fill('Website design');await row.locator('input').nth(1).fill('3');
  await row.locator('input').nth(3).fill('3333.335');await row.locator('input').nth(3).blur();
  const price=await row.locator('input').nth(3).inputValue();assert.match(price,/^\d+\.\d{1,2}$/,'price rounded to 2 decimals: '+price);
  await page.locator('#modal summary').filter({hasText:'รายละเอียดภาษี'}).click();
  await page.locator('#modal input[type="number"][max="100"]').fill('3');
  await page.locator('#modal').getByRole('button',{name:'ออกเอกสาร'}).click();
  await page.locator('#issueChecklist').waitFor();assert.equal(await page.locator('#issueChecklist li').count(),1);
  assert.match(await page.locator('#issueChecklist').innerText(),/ตรวจอัตราหัก ณ ที่จ่าย/);await shot('02-checklist');
  await page.locator('#issueChecklist').getByRole('button',{name:'ไปที่สวิตช์'}).click();
  assert.equal(await page.evaluate(()=>document.activeElement.id),'d_whtReviewed');
  await page.locator('#d_whtReviewed').check({force:true});
  await page.locator('#modal').getByRole('button',{name:'ออกเอกสาร'}).click();await confirmOk();await settle();
  const qt=await page.evaluate(()=>DB.documents.find(d=>d.type==='quotation'));
  assert.equal(qt.status,'sent');assert.ok(qt.number);
  const unit=Number(qt.issuedSnapshot.document.items[0].price);assert.equal(Math.round(unit*100),unit*100);
  assert.equal(qt.issuedSnapshot.amounts.subtotal,Math.round(3*unit*100)/100,'printed qty × unit equals the line total');

  // 4. Invoice without payment details: issuing warns but does not block.
  await page.getByRole('button',{name:'แปลงเป็นใบแจ้งหนี้'}).click();await page.locator('#d_whtReviewed').check({force:true});
  await page.locator('#modal').getByRole('button',{name:'ออกเอกสาร'}).click();
  await page.locator('#confirmOverlay.open').waitFor();assert.match(await page.locator('#confirmDetail').innerText(),/ยังไม่มีช่องทางรับเงิน/);
  await confirmOk();await settle();
  const invId=await page.evaluate(()=>DB.documents.find(d=>d.type==='invoice'&&d.status==='sent').id);

  // 5. Payment dialog shows the amount being confirmed.
  await page.getByRole('button',{name:'บันทึกรับชำระ'}).click();
  assert.match(await page.locator('#modal').innerText(),/ยอดที่ควรได้รับ/);
  await page.locator('#paymentDate').fill(await page.evaluate(()=>todayISO()));await page.locator('#paymentFull').check();
  await page.locator('#modal').getByRole('button',{name:'บันทึก',exact:true}).click();await settle();
  assert.equal(await page.evaluate(id=>DB.documents.find(d=>d.id===id).status,invId),'paid');

  // 6. Receipt: the VAT answer is asked in place, persisted, then the receipt is issued.
  await page.getByRole('button',{name:'ออกใบเสร็จรับเงิน'}).click();
  await page.locator('#confirmOverlay.open').waitFor();assert.match(await page.locator('#confirmMsg').innerText(),/ไม่ได้จดทะเบียน VAT/);await shot('03-vat-prompt');
  await confirmOk();await confirmOk();await settle();
  const saved=JSON.parse(await fs.readFile(path.join(profile,'billing.json'),'utf8'));
  assert.equal(saved.business.vatStatus,'non_registered');assert.ok(saved.business.vatStatusConfirmedAt);
  assert.equal(saved.documents.filter(d=>d.type==='receipt'&&d.status==='issued').length,1);

  // 7. Dashboard: pending certificate withholding stays visible after payment.
  await page.evaluate(()=>{setView('dashboard');render();});await page.waitForTimeout(1200);
  const card=await page.locator('.pillar.wht').innerText();assert.match(card,/300\.00/);assert.match(card,/รอใบ 50 ทวิ 1 ใบ/);await shot('04-dashboard');

  // 8. English checklist and reload.
  await page.evaluate(()=>{DB.business.uiLang='en';render();openDocEditor('quotation');});
  await page.locator('#modal').getByRole('button',{name:'Issue'}).first().click();
  const en=await page.locator('#issueChecklist').innerText();assert.match(en,/Can’t issue yet/);assert.doesNotMatch(en,/[ก-๏]/);await shot('05-checklist-en');
  await page.evaluate(()=>{editDoc=null;closeModal();});await page.reload();await page.waitForFunction(()=>DB&&!loadFailed,{},{polling:100});
  assert.equal(await page.evaluate(()=>DB.documents.filter(d=>isIssuedDocument(d)).length),3);
  assert.deepEqual(errors,[]);
  console.log('PASS: first-run setup with tax-ID feedback, full issue checklist, 2-decimal price, no-payment warning, payment amount, inline VAT answer, receipt, pending WHT card, EN checklist, reload.');
  console.log('SYNTHETIC_ARTIFACTS='+root);
 }finally{await app.evaluate(({app})=>app.exit(0)).catch(()=>{});}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
