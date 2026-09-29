// Audit fixes: real source Electron, isolated synthetic profile only.
const {_electron:electron}=require('playwright');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
(async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'billngai-design-fixes-')),profile=path.join(root,'profile');await fs.mkdir(profile,{mode:0o700});
 const base={clientId:'buyer',currency:'THB',issueDate:'2026-01-10',paidDate:'2026-01-10',vatRate:7,whtRate:3,items:[{description:'Synthetic service',qty:1,price:10000}]};
 const data={version:2,business:{uiLang:'en',businessName:'Synthetic issuer',address:'Synthetic address',taxId:'1234567890123',vatStatus:'non_registered'},clients:[{id:'buyer',name:'Synthetic buyer'}],documents:[{...base,id:'inv',type:'invoice',number:'OLD-I',status:'paid'},{...base,id:'tax',type:'tax_invoice',number:'OLD-T',status:'issued',parentId:'inv'},{...base,id:'draft',type:'quotation',number:'DRAFT',status:'draft',vatRate:7,paidDate:null,notes:'Original'}],recurring:[],reviewEvents:[],counters:{},meta:{setupDone:true,lastBackupAt:new Date().toISOString()}};
 await fs.writeFile(path.join(profile,'config.json'),JSON.stringify({externalPath:null}));await fs.writeFile(path.join(profile,'billing.json'),JSON.stringify(data));let app;
 try{
 app=await electron.launch({executablePath:process.argv[2]||require('electron'),args:[...(process.argv[2]?[]:[path.resolve(__dirname,'..')]),'--user-data-dir='+profile],timeout:30000});assert.equal(await app.evaluate(({app})=>app.getPath('userData')),await fs.realpath(profile));
 const page=await app.firstWindow(),errors=[];page.setDefaultTimeout(10000);await page.setViewportSize({width:1280,height:900});page.on('pageerror',e=>errors.push(e.message));await page.waitForFunction(()=>DB&&!loadFailed&&dataLoc.path&&DB.documents.length===3);
 assert.equal(await page.locator('#nav button').count(),6);
 // Pending legacy answers are recoverable, not applied to the ledger.
 await page.evaluate(()=>setView('legacy'));assert.equal(await page.locator('#nav button.active').getAttribute('data-view'),'documents');
 await page.locator('input[value="same_payment"]').check();await page.locator('#legacyNote').fill('Synthetic unfinished review');
 await page.locator('#nav button[data-view="dashboard"]').click();await page.evaluate(()=>setView('legacy'));
 assert.equal(await page.locator('input[value="same_payment"]').isChecked(),true);assert.equal(await page.locator('#legacyNote').inputValue(),'Synthetic unfinished review');assert.equal(await page.evaluate(()=>DB.reviewEvents.length),0);
 await page.reload();await page.waitForFunction(()=>DB&&!loadFailed&&dataLoc.path,{},{polling:100});await page.evaluate(()=>setView('legacy'));
 assert.equal(await page.locator('input[value="same_payment"]').isChecked(),true);assert.equal(await page.locator('#legacyConfirmed').isChecked(),false);
 // Changed source facts reject pending answers and explain why; no answer is silently applied.
 await page.evaluate(()=>{setView('documents');DB.documents.find(d=>d.id==='tax').items[0].price=11000;setView('legacy');});assert.equal(await page.locator('input[value="same_payment"]').isChecked(),false);assert.match(await page.locator('#content').innerText(),/Old records changed/);assert.equal(await page.evaluate(()=>DB.reviewEvents.length),0);
 await page.evaluate(()=>{setView('documents');DB.documents.find(d=>d.id==='tax').items[0].price=10000;setView('legacy');});await page.locator('input[value="same_payment"]').check();await page.locator('#legacyNote').fill('Reviewed changed synthetic facts');
 await page.locator('label.toggle').filter({has:page.locator('#legacyConfirmed')}).click();await page.getByRole('button',{name:'Save answers',exact:true}).click();await page.waitForFunction(()=>DB.reviewEvents.length===1&&!issuanceBusy);
 assert.equal(await page.evaluate(()=>taxYearAgg(2026).agg.net),10400);
 // Certificate metadata must not remove the reviewed payment.
 await page.locator('#nav button[data-view="wht"]').click();await page.locator('button[onclick*="openWhtCert"]').click();await page.locator('label.toggle').filter({has:page.locator('#w_got')}).click();await page.locator('#w_no').fill('SYNTHETIC-CERT');await page.locator('#w_date').fill('2026-01-11');await page.locator('button[onclick*="saveWhtCert"]').click();await page.waitForFunction(()=>!issuanceBusy&&DB.documents.find(d=>d.id==='tax').whtCertReceived);
 assert.equal(await page.evaluate(()=>taxYearAgg(2026).agg.net),10400);await page.reload();await page.waitForFunction(()=>DB&&!loadFailed&&dataLoc.path,{},{polling:100});assert.equal(await page.evaluate(()=>taxYearAgg(2026).agg.net),10400);
 // Existing draft edits survive dismissal, unrelated modals, and reload.
 await page.evaluate(()=>{setView('documents');openDocEditor('quotation','draft');});await page.locator('#d_notes').fill('Recovered synthetic edit');await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>DB.documents.find(d=>d.id==='draft').notes),'Original');
 await page.evaluate(()=>openClientEditor());await page.keyboard.press('Escape');await page.reload();await page.waitForFunction(()=>DB&&!loadFailed&&dataLoc.path,{},{polling:100});await page.evaluate(()=>openDocEditor('quotation','draft'));
 await page.keyboard.press('Escape');await page.evaluate(()=>openDocEditor('quotation','draft'));
 await page.getByRole('button',{name:'Restore',exact:true}).click();assert.equal(await page.locator('#d_notes').inputValue(),'Recovered synthetic edit');assert.equal(await page.evaluate(()=>editDoc.vatRate),7);
 // Full storage must keep the editor open rather than dropping edits.
 await page.evaluate(()=>{globalThis.oldSet=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw Error('Synthetic quota');};});await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>modalIsOpen()),true);await page.evaluate(()=>{Storage.prototype.setItem=oldSet;});await page.keyboard.press('Escape');
 // Source changes make a saved edit ineligible to restore.
 await page.evaluate(()=>{DB.documents.find(d=>d.id==='draft').notes='Changed externally';openDocEditor('quotation','draft');});assert.equal(await page.getByRole('button',{name:'Restore',exact:true}).count(),0);await page.keyboard.press('Escape');
 // A draft saved by 2.0.8 remains recoverable after upgrading.
 await page.evaluate(()=>{localStorage.setItem(EDIT_DRAFT_KEY,JSON.stringify({doc:{id:null,type:'receipt',clientId:'buyer',currency:'THB',notes:'Older recovery',paidDate:'2026-01-10',fullPaymentConfirmed:true,whtReviewed:true,items:[{description:'Old draft',qty:1,price:100}]},savedAt:new Date().toISOString()}));openDocEditor('receipt');});
 await page.getByRole('button',{name:'Restore',exact:true}).click();assert.equal(await page.locator('#d_notes').inputValue(),'Older recovery');assert.equal(await page.locator('#d_paid').inputValue(),'2026-01-10');assert.equal(await page.evaluate(()=>editDoc.fullPaymentConfirmed||editDoc.whtReviewed),false);await page.keyboard.press('Escape');
 await page.evaluate(()=>{openDocEditor('receipt');discardEditorDraft();closeModal();});
 // Type-specific creation; supported receipt choices and upfront prerequisites.
 await page.evaluate(()=>{docFilter='invoice';setView('documents');});await page.locator('#topActions .btn-primary').click();assert.equal(await page.evaluate(()=>editDoc.type),'invoice');await page.keyboard.press('Escape');
 await page.evaluate(()=>openDocEditor('receipt'));assert.deepEqual(await page.locator('#d_cur option').evaluateAll(a=>a.filter(x=>!x.disabled).map(x=>x.value)),['THB']);await page.keyboard.press('Escape');
 await page.evaluate(()=>{DB.business.vatStatus='unknown';openDocEditor('receipt');});assert.equal(await page.locator('#d_notes').count(),0);await page.getByRole('button',{name:'Set VAT status',exact:true}).click();assert.equal(await page.locator('#s_vatStatus').count(),1);
 // Backup results and scope are named explicitly; unavailable numbering is absent.
 await page.evaluate(()=>{settingsTab='data';setView('settings');});assert.equal(await page.getByRole('button',{name:'Create a local restore point',exact:true}).count(),1);assert.equal(await page.getByRole('button',{name:'Export backup file…',exact:true}).count(),1);
 await page.evaluate(()=>{settingsTab='docs';render();});assert.equal(await page.locator('#s_fmt_t').count(),0);
 await page.evaluate(()=>setView('report'));await page.getByRole('button',{name:'Accounting summary',exact:true}).click();assert.equal(await page.evaluate(()=>currentView),'filing');assert.equal(await page.locator('#nav button.active').getAttribute('data-view'),'report');
 await page.evaluate(()=>setView('report'));assert.equal(await page.locator('.chart-card').first().evaluate(el=>getComputedStyle(el).padding),'24px');
 await page.evaluate(()=>document.getElementById('toast').classList.remove('show'));
 for(const lang of ['th','en']){await page.evaluate(lang=>{DB.business.uiLang=lang;setView('report');},lang);await page.screenshot({path:path.join(root,'report-'+lang+'.png'),fullPage:false,animations:'disabled'});await page.evaluate(()=>{settingsTab='data';setView('settings');});await page.screenshot({path:path.join(root,'settings-'+lang+'.png'),fullPage:false,animations:'disabled'});}
 await page.evaluate(()=>{DB.documents.forEach(d=>d.vatRate=0);DB.reviewEvents=[];DB.documents=DB.documents.filter(d=>d.id==='inv');DB.business.uiLang='th';setView('report');});assert.equal(await page.locator('#content details').first().getAttribute('open'),null);await page.screenshot({path:path.join(root,'report-non-vat-th.png'),animations:'disabled'});
 await page.setViewportSize({width:940,height:900});await page.evaluate(()=>{DB.business.uiLang='en';setView('report');});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);await page.screenshot({path:path.join(root,'report-narrow-en.png'),animations:'disabled'});
 // A fresh list supplies an achievable next step and resumes the requested type.
 await page.evaluate(()=>{DB.documents=[];DB.clients=[];DB.business.uiLang='en';docFilter='receipt';setView('documents');});assert.match(await page.locator('#content').innerText(),/No documents yet/);await page.getByRole('button',{name:'Add client',exact:true}).click();await page.locator('#c_name').fill('New synthetic buyer');await page.getByRole('button',{name:'Save',exact:true}).click();await page.waitForFunction(()=>!!editDoc);assert.equal(await page.evaluate(()=>editDoc.type),'receipt');
 const missing=await page.evaluate(()=>{
   const source=[...document.scripts].map(s=>s.textContent).join('\n');
   const keys=[...source.matchAll(/\btr\('((?:\\.|[^'\\])*)'\)/g)].map(m=>Function('return \''+m[1]+'\'')());
   return [...new Set(keys.concat([...document.querySelectorAll('[data-t]')].map(el=>el.dataset.t)).filter(key=>!(key in I18N_EN)))];
 });assert.deepEqual(missing,[]);
 assert.deepEqual(errors,[]);console.log('PASS: six navigation items, recoverable legacy answers and existing drafts, quota protection, stale-source protection, stable income after WHT save/reload, receipt prerequisites, contextual creation, backup labels, TH/EN.');console.log('SYNTHETIC_ARTIFACTS='+root);
 }finally{if(app)await app.evaluate(({app})=>app.exit(0)).catch(()=>{});}
})().catch(e=>{console.error(e);process.exitCode=1;});
