// Offline audio UI smoke in an isolated synthetic profile, using the supported signed development runtime.
const {_electron}=require('playwright'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
(async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'billngai-audio-')),profile=path.join(dir,'profile');await fs.mkdir(profile);
 await fs.writeFile(path.join(profile,'config.json'),'{"externalPath":null}');
 await fs.writeFile(path.join(profile,'billing.json'),JSON.stringify({version:2,business:{businessName:'Synthetic audio seller',address:'Sample address',taxId:'1234567890123',vatStatus:'non_registered'},clients:[],documents:[],reviewEvents:[],recurring:[],counters:{},meta:{setupDone:true}}));
 const exe=process.argv[2]||path.join(os.homedir(),'.local/share/billngai-dev/43.7.3/Electron.app/Contents/MacOS/Electron');
 const app=await _electron.launch({executablePath:exe,args:[...(process.argv[2]?[]:[path.resolve(__dirname,'..')]),'--user-data-dir='+profile]});
 try{
  assert.equal(await app.evaluate(({app})=>app.getPath('userData')),await fs.realpath(profile));
  const page=await app.firstWindow(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.waitForFunction(()=>DB&&!loadFailed&&dataLoc.path);
  await page.context().setOffline(true);
  // Decode every real packaged-source clip offline. Muted playback avoids disturbing the user's desktop.
  const decoded=await page.evaluate(async()=>{
   const paths=[...Object.values(APP_SFX),...Object.values(APP_AUDIO_GUIDES).map(g=>g.path)];
   return Promise.all(paths.map(src=>new Promise((resolve,reject)=>{const a=new Audio(src);a.muted=true;a.onloadedmetadata=()=>resolve({src,duration:a.duration});a.onerror=()=>reject(Error('Decode failed: '+src));a.load();})));
  });assert.equal(decoded.length,11);assert.ok(decoded.every(x=>x.duration>0));
  const diskBefore=await fs.readFile(path.join(profile,'billing.json'),'utf8');
  await page.evaluate(()=>{const NativeAudio=Audio;window.testClips=[];window.Audio=function(src){const a=new NativeAudio(src);a.muted=true;testClips.push(a);return a;};settingsTab='sounds';setView('settings');});
  assert.deepEqual(await page.locator('.settings-grid > .tabs button').allTextContents(),['ธุรกิจของฉัน','เอกสารและภาษี','ข้อมูลและสำรอง','เสียง']);
  await page.locator('.settings-grid > .tabs button').nth(1).click();assert.equal(await page.locator('.audio-settings').count(),0);
  await page.locator('.settings-grid > .tabs button').nth(3).click();assert.equal(await page.locator('.audio-settings').count(),1);
  assert.equal(await page.locator('#audioSfxToggle').isChecked(),false);assert.equal(await page.evaluate(()=>testClips.length),0);
  await page.locator('#audioSfxToggle').focus();await page.locator('#audioSfxToggle').press('Space');assert.equal(await page.evaluate(()=>sfxEnabled()),true);assert.equal(await page.evaluate(()=>settingsDirty),false);
  assert.equal(await fs.readFile(path.join(profile,'billing.json'),'utf8'),diskBefore,'local audio preference must not write billing data');
  await page.reload();await page.waitForFunction(()=>DB&&!loadFailed&&dataLoc.path);assert.equal(await page.evaluate(()=>sfxEnabled()),true);
  await page.evaluate(()=>{const NativeAudio=Audio;window.testClips=[];window.Audio=function(src){const a=new NativeAudio(src);a.muted=true;testClips.push(a);return a;};settingsTab='sounds';setView('settings');});
  const first=page.locator('.audio-settings [data-audio-guide="first-bill"]');await first.locator('summary').click();await first.locator('button').click();
  await page.waitForFunction(()=>activeAppAudio&&!activeAppAudio.paused);assert.equal(await first.locator('button').getAttribute('aria-pressed'),'true');
  assert.match(await page.evaluate(()=>activeAppAudio.src),/help-first-bill-th\.mp3$/);
  await page.evaluate(()=>playAppSfx('issued'));assert.equal(await page.evaluate(()=>testClips.length),1,'effects must not interrupt voice');
  await first.locator('summary').click();await page.waitForFunction(()=>activeAppAudio===null&&testClips[0].paused);
  await page.evaluate(()=>{setView('documents');});const guide=page.locator('#content [data-audio-guide="first-bill"]');await guide.locator('summary').click();await guide.locator('button').click();await page.waitForFunction(()=>activeAppAudio&&!activeAppAudio.paused);
  await page.evaluate(()=>setView('clients'));assert.equal(await page.evaluate(()=>activeAppAudio===null&&testClips.every(a=>a.paused)),true);
  // Contextual payment help must preserve the entered payment facts and stop with the modal.
  await page.evaluate(()=>openPaymentDialog('synthetic-placeholder'));await page.locator('#paymentDate').fill('2026-10-02');await page.locator('#paymentFull').check();
  const payment=page.locator('#modal [data-audio-guide="payment"]');await payment.locator('summary').click();await payment.locator('button').click();await page.waitForFunction(()=>activeAppAudio&&!activeAppAudio.paused);
  assert.equal(await page.locator('#paymentDate').inputValue(),'2026-10-02');assert.equal(await page.locator('#paymentFull').isChecked(),true);
  await page.evaluate(()=>closeModal());assert.equal(await page.evaluate(()=>activeAppAudio===null&&testClips.every(a=>a.paused)),true);
  await page.evaluate(()=>{settingsTab='sounds';DB.business.uiLang='en';setView('settings');});assert.equal(await page.locator('.settings-grid > .tabs button.active').textContent(),'Sounds');assert.equal(await page.locator('.audio-settings [data-audio-play]').count(),6);
  assert.deepEqual(await page.locator('.audio-settings [data-audio-play]').allTextContents(),Array(6).fill('Listen in Thai'));
  const out=path.resolve(__dirname,'../review/2026-10-03/audio-implementation');await page.locator('.audio-settings').screenshot({path:path.join(out,'settings-en.png')});
  await page.setViewportSize({width:600,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.locator('.audio-settings').screenshot({path:path.join(out,'settings-narrow.png')});
  await page.evaluate(()=>{DB.business.uiLang='th';render();});await page.locator('.audio-settings').screenshot({path:path.join(out,'settings-th.png')});
  // Trusted keyboard activation of a navigation button produces the subtle tap after render.
  const priorTaps=await page.evaluate(()=>testClips.filter(a=>a.src.endsWith('/button-tap.mp3')).length);
  await page.locator('#nav button[data-view="documents"]').focus();await page.locator('#nav button[data-view="documents"]').press('Enter');
  await page.waitForFunction(prior=>testClips.filter(a=>a.src.endsWith('/button-tap.mp3')).length>prior,priorTaps);
  assert.equal(await page.evaluate(()=>testClips.filter(a=>a.src.endsWith('/button-tap.mp3')).length),priorTaps+1);
  // Programmatic clicks deliberately remain silent.
  await page.evaluate(()=>{stopAppAudio();document.querySelector('#nav button[data-view="clients"]').click();});
  assert.equal(await page.evaluate(()=>testClips.filter(a=>a.src.endsWith('/button-tap.mp3')).length),priorTaps+1);
  assert.equal(await page.evaluate(()=>DB.clients.length+DB.documents.length),0);assert.deepEqual(errors,[]);
  console.log('PASS: 11 real MP3s decode offline; female guides only; default off and local preference survive reload without billing writes; explicit voice play, section/navigation/modal stop; voice excludes SFX; help preserves payment fields; TH/EN labels and narrow layout; zero page errors.');console.log('SYNTHETIC_PROFILE='+profile);
 }finally{await app.evaluate(({app})=>app.exit(0)).catch(()=>{});}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
