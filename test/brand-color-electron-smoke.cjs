// Seller colors: native app, isolated synthetic profile, no real customer data.
const {_electron}=require('playwright'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
(async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'billngai-brand-color-')),profile=path.join(root,'profile');await fs.mkdir(profile);await fs.writeFile(path.join(profile,'config.json'),'{"externalPath":null}');
 await fs.writeFile(path.join(profile,'billing.json'),JSON.stringify({version:2,business:{businessName:'Synthetic seller',address:'Example address',taxId:'1234567890123',vatStatus:'non_registered',brandColor:'#1f5d43'},clients:[],documents:[],reviewEvents:[],meta:{setupDone:true},counters:{},recurring:[]}));
 const exe=process.argv[2],app=await _electron.launch({executablePath:exe||require('electron'),args:[...(exe?[]:[path.resolve(__dirname,'..')]),'--user-data-dir='+profile]});
 try{
  assert.equal(await app.evaluate(({app})=>app.getPath('userData')),await fs.realpath(profile));const page=await app.firstWindow(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const loaded=()=>page.waitForFunction(()=>DB&&!loadFailed&&dataLoc.path,{},{polling:100});await loaded();assert.equal(await page.evaluate(()=>DB.business.brandColor),'#1f5d43','Saved green survives migration');
  await page.evaluate(async()=>{DB.clients=[{id:'sample',name:'Sample buyer',address:'Sample address'}];const d={id:'frozen',type:'receipt',number:'RC-SAMPLE',clientId:'sample',issueDate:todayISO(),paidDate:todayISO(),status:'issued',currency:'THB',vatRate:0,whtRate:0,items:[{description:'Sample work',qty:1,price:1000}]};freezeIssuedDocument(d);DB.documents.push(d);await persist(true);});
  await page.reload();await loaded(); // Capture after normal schema metadata is applied to the synthetic fixture.
  const frozen=await page.evaluate(()=>JSON.stringify(DB.documents));const paper=await page.evaluate(()=>renderPaper(DB.documents[0]));
  const settings=()=>page.evaluate(()=>{settingsTab='business';setView('settings');});await settings();await page.setViewportSize({width:1440,height:1100});
  for(const color of await page.evaluate(()=>BRAND_PRESETS.map(p=>p.hex))){
   const swatch=page.locator('[data-brand-color="'+color+'"]');await swatch.click();assert.equal(await swatch.getAttribute('aria-pressed'),'true');assert.equal(await page.locator('[data-brand-color][aria-pressed="true"]').count(),1);
   const rect=await swatch.boundingBox();assert.equal(rect.width,rect.height);assert.ok(rect.width>=44);
   assert.equal(await page.evaluate(()=>saveSettings(true)),true);await page.reload();await loaded();assert.equal(await page.evaluate(()=>DB.business.brandColor),color);await settings();
  }
  for(const [input,expected] of [['#A1B2C3','#a1b2c3'],['123ABC','#123abc'],['#000000','#000000'],['#FFFFFF','#ffffff'],['#1f5d43','#1f5d43']]){
   await page.locator('#s_brandHex').fill(input);assert.equal(await page.locator('#s_brand').inputValue(),expected);assert.equal(await page.evaluate(()=>saveSettings(true)),true);
   await page.reload();await loaded();assert.equal(await page.evaluate(()=>DB.business.brandColor),expected);await settings();
  }
  const saved=await fs.readFile(path.join(profile,'billing.json'),'utf8');
  for(const invalid of ['#12','GGGGGG','']){await page.locator('#s_brandHex').fill(invalid);assert.equal(await page.evaluate(()=>saveSettings(true)),false);assert.equal(await page.locator('#s_brandHex').getAttribute('aria-invalid'),'true');assert.equal(await fs.readFile(path.join(profile,'billing.json'),'utf8'),saved);}
  // The native color input's input event takes the same preview/save path.
  await page.locator('#s_brand').evaluate(el=>{el.focus();el.value='#2456c8';el.dispatchEvent(new Event('input',{bubbles:true}));});assert.equal(await page.locator('#s_brandHex').inputValue(),'#2456c8');assert.equal(await page.evaluate(()=>saveSettings(true)),true);
  assert.equal(await page.evaluate(()=>JSON.stringify(DB.documents)),frozen);assert.equal(await page.evaluate(()=>renderPaper(DB.documents[0])),paper);
  assert.equal(await page.evaluate(()=>document.documentElement.style.getPropertyValue('--document-accent')),'#2456c8');
  assert.equal(await page.locator('body').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(255, 249, 243)');assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--accent').trim().toLowerCase()),'#ff6b00');
  const draft=await page.evaluate(()=>{const d={id:'new',type:'quotation',number:'NEW',status:'draft',issueDate:todayISO(),clientId:'sample',currency:'THB',vatRate:0,whtRate:0,items:[{description:'New work',qty:1,price:100}]};return renderPaper(d,clientById(d.clientId),compute(d));});assert.match(draft,/--accent:#2456c8/);
  for(const lang of ['th','en']){await page.evaluate(lang=>{DB.business.uiLang=lang;render();},lang);await page.locator('#s_brand').scrollIntoViewIfNeeded();await page.locator('.card-block').filter({has:page.locator('#s_brand')}).screenshot({path:path.join(root,'brand-'+lang+'.png')});}
  await page.setViewportSize({width:600,height:1000});await settings();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.locator('#s_brand').scrollIntoViewIfNeeded();await page.locator('.card-block').filter({has:page.locator('#s_brand')}).screenshot({path:path.join(root,'brand-narrow.png')});
  await page.getByRole('button',{name:'Reset to default',exact:true}).click();assert.equal(await page.locator('#s_brandHex').inputValue(),'#ff6b00');
  assert.deepEqual(errors,[]);console.log('PASS: all 15 presets save/reload; custom HEX and native input; invalid HEX blocks save; circular 48px targets; fixed app palette; new document color; frozen issued documents unchanged; TH/EN and narrow layout.');console.log('ARTIFACTS='+root);
 }finally{await app.evaluate(({app})=>app.exit(0)).catch(()=>{});}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
