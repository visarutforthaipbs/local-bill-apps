// Read-only input, isolated profile only. Never pass the live profile as a destination.
// NODE_PATH=<playwright> node test/backup-recovery-smoke.cjs INPUT_JSON [PACKAGED_EXECUTABLE]
const {_electron:electron}=require('playwright');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
(async()=>{
  const source=path.resolve(process.argv[2]),original=await fs.readFile(source,'utf8'),data=JSON.parse(original);
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'billngai-recovery-check-')),profile=path.join(root,'profile');
  await fs.mkdir(profile,{mode:0o700});
  await fs.writeFile(path.join(profile,'config.json'),JSON.stringify({externalPath:null}),{mode:0o600});
  await fs.writeFile(path.join(profile,'billing.json'),original,{mode:0o600});
  let app;
  try{
    const exe=process.argv[3];app=await electron.launch({executablePath:exe?path.resolve(exe):require('electron'),args:[...(exe?[]:[path.resolve(__dirname,'..')]),'--user-data-dir='+profile],timeout:30000});
    assert.equal(await app.evaluate(({app})=>app.getPath('userData')),await fs.realpath(profile));
    assert.equal(await app.evaluate(({app})=>app.getVersion()),require('../package.json').version);
    const page=await app.firstWindow(),errors=[];page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
    console.log('Isolated window opened');
    await page.waitForFunction(count=>typeof DB!=='undefined'&&DB&&!loadFailed&&DB.documents.length===count,data.documents.length,{timeout:15000});
    console.log('Isolated backup loaded');
    const loaded=await page.evaluate(()=>JSON.parse(JSON.stringify(DB)));
    assert.equal(loaded.clients.length,data.clients.length);assert.equal(loaded.documents.length,data.documents.length);
    for(const d of data.documents){const actual=loaded.documents.find(x=>x.id===d.id);assert.ok(actual);
      for(const key of Object.keys(d))assert.deepEqual(actual[key],d[key],'Retained document field '+key);
      if(!d.type&&d.deletedAt)assert.deepEqual(actual,d,'Deletion marker must remain exact');
    }
    for(const c of data.clients){const actual=loaded.clients.find(x=>x.id===c.id);assert.ok(actual);for(const key of Object.keys(c))assert.deepEqual(actual[key],c[key],'Retained client field '+key);}
    for(const view of ['dashboard','documents','wht','report','filing','settings'])await page.evaluate(v=>setView(v),view);
    const markers=await page.evaluate(()=>DB.documents.filter(isLegacyDeletionMarker).map(d=>({blocked:documentOutputBlocked(d),text:shareText(d)})));
    assert.ok(markers.every(m=>m.blocked&&m.text===''));
    await page.evaluate(()=>{for(const d of DB.documents)if(d.deletedAt)renderHistoricalReview(d);});
    assert.equal(await page.evaluate(()=>persist(true)),true);
    await page.reload();await page.waitForFunction(count=>typeof DB!=='undefined'&&DB&&!loadFailed&&DB.documents.length===count,data.documents.length,{timeout:15000});
    const disk=JSON.parse(await fs.readFile(path.join(profile,'billing.json'),'utf8'));
    assert.equal(disk.documents.length,data.documents.length);
    assert.equal(disk.clients.length,data.clients.length);
    for(const collection of ['documents','clients'])for(const originalRecord of data[collection]){
      const stored=disk[collection].find(record=>record.id===originalRecord.id);assert.ok(stored);
      for(const key of Object.keys(originalRecord))assert.deepEqual(stored[key],originalRecord[key],'Saved '+collection+' field '+key);
      if(collection==='documents'&&!originalRecord.type&&originalRecord.deletedAt)assert.deepEqual(stored,originalRecord);
    }
    assert.equal(await fs.readFile(source,'utf8'),original,'Input backup must remain untouched');
    assert.deepEqual(errors,[]);
    console.log(JSON.stringify({pass:true,version:await app.evaluate(({app})=>app.getVersion()),clients:loaded.clients.length,documentEntries:loaded.documents.length,notDeleted:loaded.documents.filter(d=>!d.deletedAt).length,markers:markers.length,profile}));
  }catch(e){console.error('Isolated test failed:',e.message);throw e;}
  finally{if(app)await app.evaluate(({app})=>app.exit(0)).catch(()=>{});}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
