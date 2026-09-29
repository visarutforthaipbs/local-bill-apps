// Fintech style acceptance: source Electron, synthetic profile, TH/EN + light/dark.
const {_electron:electron}=require('playwright');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
(async()=>{
 const repo=path.resolve(__dirname,'..'),root=await fs.mkdtemp(path.join(os.tmpdir(),'billngai-fintech-')),profile=path.join(root,'profile');await fs.mkdir(profile);
 await fs.writeFile(path.join(profile,'config.json'),'{"externalPath":null}');
 await fs.writeFile(path.join(profile,'billing.json'),JSON.stringify({version:2,business:{businessName:'ธุรกิจตัวอย่าง',address:'เชียงใหม่ ประเทศไทย',addressEn:'123 Example Road, Chiang Mai',taxId:'1234567890123',vatStatus:'non_registered',uiLang:'th'},clients:[],documents:[],recurring:[],reviewEvents:[],counters:{},meta:{setupDone:true}}));
 let app;
 try{
  app=await electron.launch({executablePath:process.argv[2]||require('electron'),args:[...(process.argv[2]?[]:[repo]),'--user-data-dir='+profile]});assert.equal(await app.evaluate(({app})=>app.getPath('userData')),await fs.realpath(profile));
  const page=await app.firstWindow(),errors=[];page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));await page.waitForFunction(()=>DB&&!loadFailed&&dataLoc.path,{},{polling:100});
  await page.evaluate(async()=>{loadDemoData();await persist(true);hideToast();});
  const original=await page.evaluate(()=>JSON.stringify([DB.documents,DB.reviewEvents]));
  const originalNet=await page.evaluate(()=>taxYearAgg(new Date().getFullYear()).agg.net);
  const report=[];
  for(const scheme of ['light','dark'])for(const lang of ['th','en']){
   await page.emulateMedia({colorScheme:scheme,reducedMotion:'reduce'});await page.setViewportSize({width:1440,height:1000});
   assert.equal(await page.locator('body').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(255, 249, 243)','Original cream canvas under '+scheme+' OS preference');
   for(const view of ['dashboard','documents','wht','clients','report','filing','settings','recurring','legacy','corrections']){
    await page.evaluate(({lang,view})=>{DB.business.uiLang=lang;settingsTab='business';setView(view);hideToast();}, {lang,view});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,scheme+' '+lang+' '+view+' overflow');
    if(['dashboard','documents','wht','settings','report'].includes(view))await page.screenshot({path:path.join(root,view+'-'+scheme+'-'+lang+'.png'),animations:'disabled'});
   }
   await page.evaluate(()=>setView('dashboard'));
   const contrast=await page.locator('#topActions .btn-primary').evaluate(el=>{
    const s=getComputedStyle(el),lum=v=>{const c=v.match(/[\d.]+/g).slice(0,3).map(Number).map(x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4;});return c[0]*.2126+c[1]*.7152+c[2]*.0722;};const a=lum(s.color),b=lum(s.backgroundColor);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
   });assert.ok(contrast>=4.5,'CTA contrast');
   assert.equal(await page.locator('#topActions .btn-primary').evaluate(el=>getComputedStyle(el).position),'static');
   assert.equal(await page.locator('.pillar').first().getAttribute('class'),'pillar received');
   report.push({scheme,lang,ctaContrast:contrast});
   // Native keyboard navigation on cards; document palette must remain independent.
   await page.evaluate(()=>setView('documents'));await page.locator('.document-main').first().press('Enter');await page.waitForFunction(()=>currentView==='docview');
   await page.evaluate(()=>viewDoc(DB.documents.find(d=>d.type==='invoice').id));await page.locator('.paper').waitFor();
   const paper=await page.locator('.paper').evaluate(el=>{const s=getComputedStyle(el);return {background:s.backgroundColor,accent:s.getPropertyValue('--accent').trim(),ink:s.color};});assert.equal(paper.background,'rgb(255, 255, 255)');assert.equal(paper.accent,'#ff6b00');assert.equal(paper.ink,'rgb(31, 28, 23)');
   await page.evaluate(()=>{settingsTab='business';setView('settings');});
   const fields=await page.evaluate(()=>['s_addr','s_addrEn'].map(id=>{const s=getComputedStyle(document.getElementById(id));return [s.padding,s.backgroundColor,s.borderRadius,s.minHeight];}));assert.deepEqual(fields[0],fields[1]);
   // Responsive app views, preserving all actions and avoiding horizontal body scroll.
   for(const width of [940,600]){await page.setViewportSize({width,height:900});for(const view of ['documents','dashboard','settings','wht']){await page.evaluate(view=>setView(view),view);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,view+' overflow '+width);}
    await page.evaluate(()=>setView('documents'));await page.screenshot({path:path.join(root,`documents-${scheme}-${lang}-${width}.png`),animations:'disabled'});}
  }
  // A realistic-sized synthetic list remains scannable and searchable with long content.
  await page.evaluate(()=>{
   globalThis.compactSavedDB=JSON.stringify(DB);
   const base=DB.documents.find(d=>d.type==='quotation');
   DB.documents=Array.from({length:79},(_,i)=>({...JSON.parse(JSON.stringify(base)),id:'compact-'+i,number:'COMPACT-'+String(i+1).padStart(3,'0'),project:i===0?'Long project / โครงการทดสอบ '.repeat(8):'Sample project',status:'draft',milestone:i===0?{seq:1,of:3}:undefined}));
   docFilter='all';docStatusFilter='all';DB.business.uiLang='en';setView('documents');
  });
  for(const width of [1440,940,600]){
   await page.setViewportSize({width,height:1000});
   assert.equal(await page.locator('.doc-list-compact .document-card').count(),79);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'79 rows at '+width);
   const action=await page.locator('#topActions .btn-primary').boundingBox(),header=await page.locator('.topbar').boundingBox();
   assert.ok(action.y>=header.y&&action.y+action.height<=header.y+header.height+1,'Primary action stays inside header');
   if(width>760){
    const dates=await page.locator('.document-date').evaluateAll(els=>els.slice(0,4).map(el=>Math.round(el.getBoundingClientRect().x)));
    assert.equal(new Set(dates).size,1,'Dates align across varied row heights');
   }else {await page.waitForFunction(()=>document.getElementById('docSearch').getBoundingClientRect().width>300);assert.ok((await page.locator('#docSearch').boundingBox()).width>300,'Search remains usable at narrow width');}
  }
  await page.locator('#docSearch').fill('COMPACT-079');assert.equal(await page.locator('.document-card').count(),1);
  await page.locator('.document-main').press('Enter');assert.equal(await page.evaluate(()=>currentView),'docview');assert.equal(await page.evaluate(()=>viewingId),'compact-78');
  await page.evaluate(()=>{DB=JSON.parse(compactSavedDB);delete globalThis.compactSavedDB;docFilter='all';docStatusFilter='all';setView('documents');});
  await page.setViewportSize({width:1440,height:1000});await page.emulateMedia({colorScheme:'light'});
  await page.evaluate(()=>{DB.business.uiLang='en';setView('documents');docFilter='invoice';render();});
  await page.locator('#topActions .btn-primary').click();assert.equal(await page.evaluate(()=>editDoc.type),'invoice');await page.keyboard.press('Escape');
  await page.evaluate(()=>{settingsTab='business';setView('settings');previewBrand('#336699');});
  assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()),'#FF6B00');
  // A branded issued document retains its frozen original brand after settings preview.
  await page.evaluate(()=>viewDoc(DB.documents.find(d=>d.type==='invoice').id));
  assert.equal(await page.locator('.paper').evaluate(el=>getComputedStyle(el).getPropertyValue('--accent').trim()),'#ff6b00');
  const pdf=await app.evaluate(async({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];await w.webContents.executeJavaScript('document.fonts.ready.then(()=>applyPrintZoom())');const b=await w.webContents.printToPDF({printBackground:true,preferCSSPageSize:true});await w.webContents.executeJavaScript('clearPrintZoom()');return b.toString('base64');});
  const bytes=Buffer.from(pdf,'base64');assert.equal(bytes.subarray(0,5).toString(),'%PDF-');await fs.writeFile(path.join(root,'invoice.pdf'),bytes);
  assert.equal(await page.evaluate(()=>JSON.stringify([DB.documents,DB.reviewEvents])),original);assert.equal(await page.evaluate(()=>taxYearAgg(new Date().getFullYear()).agg.net),originalNet);assert.deepEqual(errors,[]);
  await fs.writeFile(path.join(root,'checks.json'),JSON.stringify({contrast:report,pageErrors:errors,documentDataUnchanged:true,incomeUnchanged:true},null,2));
  console.log('PASS: TH/EN, light/dark, 40 route states, 1440/940/600px, keyboard card navigation, CTA contrast/placement, address styles, frozen document brand/PDF, unchanged records and income.');console.log('SYNTHETIC_ARTIFACTS='+root);
 }finally{if(app)await app.evaluate(({app})=>app.exit(0)).catch(()=>{});}
})().catch(e=>{console.error(e);process.exitCode=1;});
