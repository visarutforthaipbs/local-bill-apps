// UI only; separate synthetic profile, no Google login or network mutation.
const {_electron}=require('playwright');const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'billngai-sync-ui-')),profile=path.join(root,'profile');await fs.mkdir(profile);
 await fs.writeFile(path.join(profile,'config.json'),'{"externalPath":null}');await fs.writeFile(path.join(profile,'billing.json'),JSON.stringify({version:2,business:{businessName:'Synthetic seller',uiLang:'th'},documents:[],clients:[],reviewEvents:[],recurring:[],counters:{},meta:{setupDone:true}}));
 const app=await _electron.launch({executablePath:require('electron'),args:[path.resolve(__dirname,'..'),'--user-data-dir='+profile],env:{...process.env,BILLNGAI_SYNC_V3_URL:'https://sync-test.invalid'}});
 try{
  assert.equal(await app.evaluate(({app})=>app.getPath('userData')),await fs.realpath(profile));const page=await app.firstWindow(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.waitForFunction(()=>DB&&!loadFailed&&dataLoc.path);
  await page.evaluate(async()=>{await refreshSyncInfo();settingsTab='data';setView('settings');});assert.equal(await page.evaluate(()=>syncV3Info.configured),true);assert.equal(await page.getByRole('button',{name:'เชื่อมต่อ Google Drive',exact:true}).count(),1);
  await page.getByRole('button',{name:'เชื่อมต่อ Google Drive',exact:true}).click();await page.getByText('อัปเกรดเป็น BillNgai Pro',{exact:true}).waitFor();await page.evaluate(()=>closeModal());
  await page.evaluate(()=>{DB.business.uiLang='en';setView('settings');});assert.equal(await page.getByRole('button',{name:'Connect Google Drive',exact:true}).count(),1);assert.ok(await page.getByText('Use the same data on several Macs',{exact:false}).count());
  await page.evaluate(()=>{syncV3Info.conflicts=[{key:'client:synthetic',local:{id:'synthetic',name:'Local name'},remote:{record:{id:'synthetic',name:'Remote name'}},operation:'synthetic-conflict'}];openSyncV3Conflicts();});await page.getByRole('button',{name:'Use the records from the other device',exact:true}).waitFor();assert.ok(await page.getByText('Both versions are kept until you choose',{exact:true}).count());
  await page.evaluate(()=>Promise.all(document.getAnimations().filter(a=>a.effect.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{}))));
  await page.screenshot({path:path.join(root,'conflict-en.png'),animations:'disabled'});await page.evaluate(()=>closeModal());
  assert.deepEqual(errors,[]);console.log(JSON.stringify({status:'passed',profile,screenshot:path.join(root,'conflict-en.png')}));
 }finally{await app.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
