const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { mainHarness } = require('./helpers/main-harness.cjs');
const data = extra => JSON.stringify({version:2,business:{businessName:'Synthetic'},clients:[],documents:[],recurring:[],...extra});
async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'billngai-204-main-'));
  t.after(() => fs.rm(root, {recursive:true,force:true}));
  const profile = path.join(root, 'profile'); await fs.mkdir(profile);
  return {root,profile,file:path.join(profile,'billing.json'),...mainHarness(profile)};
}
test('IPC rejects missing, foreign-window and subframe callers', async t => {
  const h=await fixture(t);
  assert.throws(()=>h.callAs(null,'data:load'),/IPC_UNTRUSTED/);
  assert.throws(()=>h.callAs({sender:{},senderFrame:{}},'data:load'),/IPC_UNTRUSTED/);
  assert.throws(()=>h.callAs({sender:h.context.testWindow.webContents,senderFrame:{url:h.context.testWindow.webContents.mainFrame.url}},'data:load'),/IPC_UNTRUSTED/);
  assert.equal(await h.call('data:load'),null);
});
test('nested malformed restore rejects before changing active bytes', async t => {
  const h=await fixture(t), original=data(); await fs.writeFile(h.file,original); await h.call('data:load');
  for(const invalid of [{clients:[null]},{documents:[{items:{}}]},{documents:[{items:[null]}]},{documents:[{items:[{qty:{},price:1}]}]},{documents:[{issuedSnapshot:{document:{items:'bad'}}}]},{business:{numberFormats:[]}}]) {
    await assert.rejects(h.call('data:recover',data(invalid)),/DATA_INVALID_SCHEMA/);
    assert.equal(await fs.readFile(h.file,'utf8'),original);
  }
});
test('legacy unknown fields and missing historical particulars survive validation', async t => {
  const h=await fixture(t), original=data({documents:[{id:'legacy',type:'invoice',customEvidence:{unknown:true},items:[{description:'Legacy',qty:'2',price:'3'}]}],customRoot:{preserved:true}});
  await h.call('data:recover',original); assert.equal(await h.call('data:load'),original);
});
test('pre-2.0.4 exact source copy is permanent, verified and not repeated on restart', async t => {
  const h=await fixture(t), original=data({clients:[{id:'retained',name:'Old buyer',deletedAt:'2000-01-01'}]});
  await fs.writeFile(h.file,original); await h.call('data:load');
  const dir=path.join(h.profile,'backups'), names=await fs.readdir(dir);
  assert.equal(names.length,1); assert.match(names[0],/^billing-pre-2\.0\.4-/);
  assert.equal(await fs.readFile(path.join(dir,names[0]),'utf8'),original);
  await h.call('data:save',data()); await mainHarness(h.profile).call('data:load');
  assert.equal((await fs.readdir(dir)).filter(n=>n.startsWith('billing-pre-2.0.4-')).length,1);
  await fs.writeFile(path.join(dir,names[0]),'damaged preservation copy');
  await assert.rejects(mainHarness(h.profile).call('data:load'),/DATA_PRESERVATION_INVALID/);
});
test('preservation failure fails load closed and leaves original store intact', async t => {
  const h=await fixture(t), original=data(); await fs.writeFile(h.file,original);
  await fs.writeFile(path.join(h.profile,'backups'),'not a directory');
  await assert.rejects(h.call('data:load'));
  await assert.rejects(h.call('data:save',data({documents:[{id:'new',type:'invoice'}]})),/DATA_NOT_LOADED/);
  assert.equal(await fs.readFile(h.file,'utf8'),original);
});
test('quit drains delayed local queue even after renderer acknowledgment', async t => {
  const h=await fixture(t);
  vm.runInContext('let releaseAuditSave; let auditSaved=false; withDataLock(async()=>{await new Promise(resolve=>releaseAuditSave=resolve);auditSaved=true;});',h.context);
  await Promise.resolve(); const quitting=h.quit(); h.emit('app:quitFlushDone',{ok:true});
  await Promise.resolve(); await Promise.resolve();
  assert.equal(h.context.testWindow.isDestroyed(),false);
  assert.equal(vm.runInContext('quitFlushDone',h.context),false);
  vm.runInContext('releaseAuditSave()',h.context); await quitting;
  assert.equal(vm.runInContext('auditSaved && quitFlushDone',h.context),true);
});
test('renderer save rejection cancels quit without discarding state', async t => {
  const h=await fixture(t); const quitting=h.quit(); h.emit('app:quitFlushDone',{ok:false}); await quitting;
  assert.equal(vm.runInContext('quitFlushDone',h.context),false); assert.equal(h.messages.length,1);
  assert.equal(h.sent.at(-1)[0],'app:quitCancelled');
});
test('window close drains queue and correlated acknowledgment before destroying renderer',async t=>{
  const h=await fixture(t);
  vm.runInContext('let releaseWindowSave;withDataLock(()=>new Promise(resolve=>releaseWindowSave=resolve));',h.context);
  await Promise.resolve();const closing=h.closeWindow();
  assert.equal(h.sent.at(-1)[1].reason,'window');
  h.emit('app:quitFlushDone',{requestId:'stale-attempt',ok:true});
  await Promise.resolve();assert.equal(h.context.testWindow.isDestroyed(),false);
  h.emit('app:quitFlushDone',{ok:true});await Promise.resolve();assert.equal(h.context.testWindow.isDestroyed(),false);
  vm.runInContext('releaseWindowSave()',h.context);await closing;
  assert.equal(h.context.testWindow.isDestroyed(),true);
  assert.equal(vm.runInContext('quitFlushDone',h.context),false);
});
test('window close failure stays open and sends correlated cancellation',async t=>{
  const h=await fixture(t),closing=h.closeWindow();const request=h.sent.at(-1)[1];
  h.emit('app:quitFlushDone',{ok:false});await closing;
  assert.equal(h.context.testWindow.isDestroyed(),false);
  assert.equal(h.sent.at(-1)[0],'app:quitCancelled');assert.equal(h.sent.at(-1)[1].requestId,request.requestId);
});
test('window close timeout keeps renderer alive and discards stale acknowledgment',async t=>{
  const h=await fixture(t);let expire;h.context.setTimeout=fn=>{expire=fn;return 1;};h.context.clearTimeout=()=>{};
  let closing=h.closeWindow();const first=h.sent.at(-1)[1];expire();await closing;
  assert.equal(h.context.testWindow.isDestroyed(),false);assert.equal(h.sent.at(-1)[0],'app:quitCancelled');
  closing=h.closeWindow();h.emit('app:quitFlushDone',{requestId:first.requestId,ok:true});
  await Promise.resolve();assert.equal(h.context.testWindow.isDestroyed(),false);
  h.emit('app:quitFlushDone',{ok:false});await closing;assert.equal(h.context.testWindow.isDestroyed(),false);
});
test('review event shapes reject malformed payloads before replacement; extra provenance remains',async t=>{
  const h=await fixture(t),original=data();await fs.writeFile(h.file,original);await h.call('data:load');
  const base={id:'note1',type:'note',documentId:'legacy1',recordedAt:'2026-09-24T00:00:00Z',note:'Review',evidence:[]};
  for(const event of [{...base,evidence:{}},{...base,evidence:[null]},{...base,evidence:[{sha256:'../file'}]}, {...base,type:'legacy_payment',paymentId:'pay1',issuer:{},buyer:{},gross:null}]){
    await assert.rejects(h.call('data:recover',data({reviewEvents:[event]})),/DATA_INVALID_SCHEMA/);
    assert.equal(await fs.readFile(h.file,'utf8'),original);
  }
  const accepted=data({reviewEvents:[{...base,customProvenance:{source:'retained'}}]});await h.call('data:recover',accepted);
  assert.equal(await fs.readFile(h.file,'utf8'),accepted);
});
test('native failed save blocks quit until successful retry', async t => {
  const h=await fixture(t); await h.call('data:load');
  await assert.rejects(h.call('data:save','{}'),/DATA_INVALID_SCHEMA/);
  let quitting=h.quit();h.emit('app:quitFlushDone',{ok:true});await quitting;
  assert.equal(vm.runInContext('quitFlushDone',h.context),false);
  await h.call('data:save',data());quitting=h.quit();h.emit('app:quitFlushDone',{ok:true});await quitting;
  assert.equal(vm.runInContext('quitFlushDone',h.context),true);
});
async function attach(h, bytes=Buffer.from('%PDF-1.7\nsynthetic evidence\n%%EOF')) {
  const file=path.join(h.root,'original.pdf');await fs.writeFile(file,bytes);
  h.dialogs.open={canceled:false,filePaths:[file]};return h.call('evidence:attach');
}
test('evidence attach deduplicates immutable bytes, exports exact original, exposes no path', async t => {
  const h=await fixture(t), meta=await attach(h);assert.equal(meta.mime,'application/pdf');assert.equal('path' in meta,false);
  assert.equal((await attach(h)).sha256,meta.sha256);
  assert.equal((await fs.readdir(path.join(h.profile,'evidence'))).length,1);
  assert.equal((await h.call('evidence:info',meta.sha256)).available,true);
  h.dialogs.save={canceled:false,filePath:path.join(h.root,'export.pdf')};await h.call('evidence:export',meta.sha256);
  assert.deepEqual(await fs.readFile(h.dialogs.save.filePath),await fs.readFile(path.join(h.root,'original.pdf')));
});
test('evidence rejects unknown type, oversized files, invalid hashes and corrupt retained bytes', async t => {
  const h=await fixture(t); await assert.rejects(attach(h,Buffer.from('<html>not an image</html>')),/UNSUPPORTED_TYPE/);
  const meta=await attach(h); await assert.rejects(h.call('evidence:info','../billing.json'),/INVALID_HASH/);
  const big=path.join(h.root,'large.pdf');const handle=await fs.open(big,'w');await handle.truncate(20*1024*1024+1);await handle.close();
  h.dialogs.open={canceled:false,filePaths:[big]};await assert.rejects(h.call('evidence:attach'),/INVALID_SIZE/);
  await fs.writeFile(path.join(h.profile,'evidence',meta.sha256+'.bin'),'%PDF-corrupted');
  await assert.rejects(h.call('evidence:export',meta.sha256),/HASH_MISMATCH/);
  const missing=crypto.createHash('sha256').update('missing').digest('hex');assert.equal((await h.call('evidence:info',missing)).available,false);
});
test('evidence bundle round-trip validates all entries before copying and does not touch DB', async t => {
  const h=await fixture(t), meta=await attach(h), bundleFile=path.join(h.root,'bundle.json');
  h.dialogs.save={canceled:false,filePath:bundleFile};await h.call('evidence:exportBundle',[meta.sha256,meta.sha256]);
  const otherDir=path.join(h.root,'other-profile');await fs.mkdir(otherDir);const other=mainHarness(otherDir);
  other.dialogs.open={canceled:false,filePaths:[bundleFile]};const result=await other.call('evidence:importBundle');
  assert.equal(result.files.length,1);assert.equal((await other.call('evidence:info',meta.sha256)).available,true);
  await assert.rejects(fs.stat(path.join(otherDir,'billing.json')),/ENOENT/);
  const manifest=JSON.parse(await fs.readFile(bundleFile,'utf8'));manifest.files.push({...manifest.files[0],sha256:'f'.repeat(64)});
  await fs.writeFile(bundleFile,JSON.stringify(manifest));const thirdDir=path.join(h.root,'third-profile');await fs.mkdir(thirdDir);const third=mainHarness(thirdDir);
  third.dialogs.open={canceled:false,filePaths:[bundleFile]};await assert.rejects(third.call('evidence:importBundle'),/HASH_MISMATCH/);
  await assert.rejects(fs.stat(path.join(thirdDir,'evidence')),/ENOENT/);
});
test('evidence exports cannot overwrite internal app data',async t=>{
  const h=await fixture(t),meta=await attach(h);h.dialogs.save={canceled:false,filePath:h.file};
  await assert.rejects(h.call('evidence:export',meta.sha256),/PROTECTED_DESTINATION/);
  const alias=path.join(h.root,'profile-alias');await fs.symlink(h.profile,alias);
  h.dialogs.save.filePath=path.join(alias,'billing.json');await assert.rejects(h.call('evidence:export',meta.sha256),/PROTECTED_DESTINATION/);
  const external=path.join(h.root,'external.json');await fs.writeFile(external,data());
  h.dialogs.open={canceled:false,filePaths:[external]};await h.call('data:linkExisting');
  h.dialogs.save.filePath=external;await assert.rejects(h.call('evidence:export',meta.sha256),/PROTECTED_DESTINATION/);
});
