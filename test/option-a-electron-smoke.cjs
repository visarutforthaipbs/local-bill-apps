// Native UI regression checks; synthetic profile and stubbed license IPC only.
// NODE_PATH=<Playwright directory> node test/option-a-electron-smoke.cjs
const {_electron:electron}=require('playwright');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
(async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'billngai-option-a-'));
  const profile=path.join(root,'profile');await fs.mkdir(profile,{mode:0o700});
  const legacy={id:'legacy-tax',type:'tax_invoice',number:'TX-SYNTHETIC',status:'issued',clientId:'buyer',currency:'THB',issueDate:'2026-01-10',updatedAt:'2026-01-10T00:00:00Z',vatRate:0,whtRate:0,items:[{description:'Synthetic service',qty:1,price:1000}]};
  const fixture={version:2,business:{businessName:'Synthetic studio',address:'Synthetic address',taxId:'0000000000000',uiLang:'th',vatStatus:'non_registered'},clients:[{id:'buyer',name:'Synthetic buyer'}],documents:[legacy],recurring:[],reviewEvents:[],counters:{},meta:{reviewSemanticsVersion:3,setupDone:true}};
  await fs.writeFile(path.join(profile,'config.json'),JSON.stringify({externalPath:null}));
  await fs.writeFile(path.join(profile,'billing.json'),JSON.stringify(fixture));
  let app;
  try{
    app=await electron.launch({executablePath:require('electron'),args:[path.resolve(__dirname,'..'),'--user-data-dir='+profile],timeout:30000});
    assert.equal(await app.evaluate(({app})=>app.getPath('userData')),await fs.realpath(profile));
    const page=await app.firstWindow(),errors=[];page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message));
    await page.waitForFunction(()=>DB&&!loadFailed&&DB.meta.setupDone);
    const original=await page.evaluate(()=>JSON.stringify(DB.documents));
    // Stub only license availability. No actual license is installed.
    await app.evaluate(({ipcMain})=>{
      for(const channel of ['license:status','license:deactivate'])ipcMain.removeHandler(channel);
      const pro={valid:true,email:'synthetic@example.invalid',validUntil:'2099-01-01'};
      ipcMain.handle('license:status',()=>pro);
      ipcMain.handle('license:deactivate',()=>({valid:false}));
    });
    await page.reload();await page.waitForFunction(()=>DB&&!loadFailed&&isPro());
    // The local AI add-on is gone (2.0.15): no add-on rail, no "TOR → Invoice" view, no AI bridge, for Pro or free.
    for(const pro of [true,false]){
      await page.evaluate(pro=>{PRO={valid:pro};setView('dashboard');},pro);
      assert.equal(await page.locator('#addonNav').count(),0);
      assert.equal(await page.locator('#nav button').count(),6);
      assert.equal(/TOR|Add-on/i.test(await page.locator('.sidebar').innerText()),false);
    }
    assert.deepEqual(await page.evaluate(()=>['renderAi','openAiSettings','refreshAiAddonStatus'].filter(n=>typeof window[n]==='function')),[]);
    assert.deepEqual(await page.evaluate(()=>Object.keys(window.billingAPI).filter(k=>/^ai|Tor$|AiFolder$/.test(k))),[]);
    // Add-on feature strings are gone; the Pro pitch inside openDirectUpgradeModal() leaves with stream C of the PRD.
    assert.deepEqual(await page.evaluate(()=>Object.keys(I18N_EN).filter(k=>/TOR → Invoice|Add-on|โมดูล AI|ร่าง AI|นำเข้า TOR|เลือกไฟล์ TOR/.test(k))),[]);
    await page.evaluate(()=>{PRO={valid:false};setView('settings');settingsTab='business';render();});
    await page.locator('#s_name').fill('Saved through tab switch');
    await page.locator('.tabs button').nth(1).click();await page.locator('#s_vatStatus').waitFor();
    assert.equal(JSON.parse(await page.evaluate(()=>window.billingAPI.load())).business.businessName,'Saved through tab switch');
    for(const lang of ['th','en']){
      await page.evaluate(lang=>{DB.business.uiLang=lang;settingsTab='docs';render();},lang);
      assert.equal(await page.locator('.tabs button').count(),3);   // business, documents & tax, data & backup
      await page.locator('button[onclick="openSafetyLimits()"]').click();
      assert.doesNotMatch(await page.locator('#modal').innerText(),/2\.0\.4/);
      await page.evaluate(()=>closeModal());
      await page.locator('.tabs button').nth(2).click();await page.locator('#backupHist').waitFor();
      const text=await page.locator('#content').innerText();
      assert.doesNotMatch(text,/e-Tax|XML|ซิงก์|sync|Workspace/i);
      assert.equal(await page.locator('button[onclick="makeManualSnapshot()"]').count(),1);
      assert.equal(await page.locator('button[onclick="exportCSV()"]').count(),1);
      await page.locator('button[onclick="openUpgradeModal()"]').click();await page.locator('#modal .modal-foot button').waitFor();
      assert.match(await page.locator('#modal').innerText(),/App Store/);assert.equal(await page.locator('#lic_key').count(),0);
      assert.doesNotMatch(await page.locator('#modal').innerHTML(),/lin\.ee|Early Bird|PromptPay|฿/);await page.evaluate(()=>closeModal());
      await page.evaluate(()=>window.scrollTo(0,0));
      await page.screenshot({path:path.join(root,`settings-${lang}.png`),fullPage:true,animations:'disabled'});
    }
    // No key entry remains (2.0.15): the upgrade button opens the App Store-only notice; a key already stored in config.json (final direct build) is still honoured through license:status.
    assert.equal(await page.locator('button[onclick="openAiSettings()"]').count(),0);   // the "add-on" settings block is gone
    await page.locator('button[onclick="openUpgradeModal()"]').click();assert.equal(await page.locator('#lic_key').count(),0);
    assert.equal(/lin\.ee|Early Bird|PromptPay|฿/.test(await page.locator('#modal').innerText()),false);await page.evaluate(()=>closeModal());
    await page.evaluate(async()=>{PRO=await window.billingAPI.licenseStatus();render();});await page.waitForFunction(()=>isPro());
    assert.equal(await page.locator('#addonNav').count(),0);
    await page.evaluate(()=>{setView('settings');settingsTab='data';render();});
    assert.match(await page.locator('#content').innerText(),/Valid until/);
    assert.doesNotMatch(await page.locator('#content').innerText(),/Lifetime/);
    await page.evaluate(()=>{PRO.validUntil=null;render();});assert.match(await page.locator('#content').innerText(),/Lifetime/);
    await page.locator('button[onclick="deactivateLicense()"]').click();await page.locator('#confirmOk').click();
    await page.waitForFunction(()=>!isPro());
    // Failed save must retain entered settings and block tab navigation.
    await page.evaluate(()=>{settingsTab='business';render();window.optionASavedPersist=persist;persist=async()=>false;});
    await page.locator('#s_name').fill('Unsaved change');
    await page.locator('.tabs button').nth(2).click();
    assert.equal(await page.evaluate(()=>settingsTab),'business');
    assert.equal(await page.locator('#s_name').inputValue(),'Unsaved change');
    assert.equal(await page.evaluate(()=>DB.business.businessName),'Saved through tab switch');
    await page.evaluate(()=>{persist=window.optionASavedPersist;delete window.optionASavedPersist;});
    await page.locator('.tabs button').nth(2).click();await page.locator('#backupHist').waitFor();
    await page.locator('button[onclick="makeManualSnapshot()"]').click();
    await page.getByText('Backup created',{exact:true}).waitFor();
    assert.ok((await fs.readdir(path.join(profile,'backups'))).some(n=>n.startsWith('billing-manual-')));
    for(const type of ['quotation','invoice','receipt']){
      await page.evaluate(type=>openDocEditor(type),type);await page.locator('#d_type').waitFor();
      assert.deepEqual(await page.locator('#d_type option').evaluateAll(els=>els.map(el=>el.value)),['quotation','invoice','receipt']);
      assert.equal(await page.locator('#d_type').inputValue(),type);
      if(type==='receipt')assert.match(await page.locator('#modal').innerText(),/THB receipts, no VAT, full payment only/);
      await page.evaluate(()=>closeModal());
    }
    await page.evaluate(()=>viewDoc('legacy-tax'));
    assert.equal(await page.locator('.paper').count(),0);
    assert.equal(await page.evaluate(()=>documentOutputBlocked(DB.documents[0])),true);
    assert.equal(await page.evaluate(()=>JSON.stringify(DB.documents)),original);
    const missing=await page.evaluate(()=>{
      const source=[...document.scripts].map(s=>s.textContent).join('\n');
      const keys=[...source.matchAll(/\btr\('((?:\\.|[^'\\])*)'\)/g)].map(m=>Function('return \''+m[1]+'\'')());
      return [...new Set(keys.filter(key=>!(key in I18N_EN)))];
    });assert.deepEqual(missing,[]);
    await page.evaluate(()=>setView('dashboard'));assert.doesNotMatch(await page.locator('#content').innerText(),/2\.0\.4/);
    await page.evaluate(()=>window.scrollTo(0,0));
    await page.screenshot({path:path.join(root,'dashboard.png'),fullPage:true,animations:'disabled'});
    await page.reload();await page.waitForFunction(()=>DB&&!loadFailed);
    assert.equal(await page.evaluate(()=>JSON.stringify(DB.documents)),original);
    assert.deepEqual(errors,[]);
    console.log('PASS: Option A TH/EN Settings, save/failure navigation, license lifecycle, no add-on navigation, backup, document types, historical preservation, translations and reload.');
    console.log('SYNTHETIC_ARTIFACTS='+root);
  }finally{if(app)await app.evaluate(({app})=>app.exit(0)).catch(()=>{});}
})().catch(error=>{console.error(error);process.exitCode=1;});
