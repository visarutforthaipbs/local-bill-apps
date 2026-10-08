const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {mainHarness}=require('./helpers/main-harness.cjs');
const blank=()=>({version:2,business:{businessName:'Synthetic'},documents:[],clients:[],recurring:[],reviewEvents:[],counters:{},meta:{},unknown:{keep:'ภาษาไทย'}});
const root=()=>fs.mkdtempSync(path.join(os.tmpdir(),'billngai-sqlite-native-'));
const app=p=>mainHarness(p,undefined,fs,{sqlite:true});
test('native launch migrates exact JSON after a backup, reopens SQLite, and retains portable recovery',async t=>{
 const p=root();t.after(()=>fs.rmSync(p,{recursive:true,force:true}));const original=JSON.stringify(blank(),null,2);fs.writeFileSync(path.join(p,'billing.json'),original);
 const a=app(p);assert.equal(await a.call('data:load'),original);assert.equal((await a.call('data:where')).storageFormat,'sqlite');
 assert.equal(fs.readFileSync(path.join(p,'billing.json'),'utf8'),original);
 assert.ok(fs.readdirSync(path.join(p,'backups')).some(n=>n.includes('before-sqlite-migration')));
 const next=JSON.stringify({...blank(),version:3,meta:{ready:true}});await a.call('data:save',next);
 assert.equal(await app(p).call('data:load'),next);const name=await a.call('backups:snapshot','synthetic');
 assert.ok(name);assert.equal(fs.readFileSync(path.join(p,'backups',name),'utf8'),next);
 await a.call('data:recover',original);assert.equal(await app(p).call('data:load'),original);
});
test('native SQLite rejects stale writers and preserves sync/outbox as one durable payload',async t=>{
 const p=root();t.after(()=>fs.rmSync(p,{recursive:true,force:true}));const a=app(p);assert.equal(await a.call('data:load'),null);
 await a.call('data:save',JSON.stringify(blank()));const b=app(p);await b.call('data:load');
 const next=JSON.stringify({...blank(),meta:{changed:true}});await a.call('data:save',next);
 await assert.rejects(b.call('data:save',JSON.stringify({...blank(),meta:{changed:'stale'}})),/DATA_CHANGED_ON_DISK/);
 assert.equal(await app(p).call('data:load'),next);
});
test('an old JSON writer or missing initialized SQLite cannot be silently ignored',async t=>{
 const p=root();t.after(()=>fs.rmSync(p,{recursive:true,force:true}));const original=JSON.stringify(blank());fs.writeFileSync(path.join(p,'billing.json'),original);
 const a=app(p);await a.call('data:load');fs.writeFileSync(path.join(p,'billing.json'),JSON.stringify({...blank(),meta:{oldApp:true}}));
 await assert.rejects(a.call('data:save',original),/DATA_LEGACY_FILE_CHANGED/);await assert.rejects(app(p).call('data:load'),/DATA_LEGACY_FILE_CHANGED/);
 fs.writeFileSync(path.join(p,'billing.json'),original);fs.unlinkSync(path.join(p,'billing.sqlite'));
 await assert.rejects(app(p).call('data:load'),/DATA_MISSING/);assert.equal(fs.existsSync(path.join(p,'billing.sqlite')),false);
});
test('future JSON schema blocks migration and never creates an authoritative database',async t=>{
 const p=root();t.after(()=>fs.rmSync(p,{recursive:true,force:true}));const text=JSON.stringify({...blank(),version:999});fs.writeFileSync(path.join(p,'billing.json'),text);
 await assert.rejects(app(p).call('data:load'),/DATA_FUTURE_VERSION/);assert.equal(fs.existsSync(path.join(p,'billing.sqlite')),false);assert.equal(fs.readFileSync(path.join(p,'billing.json'),'utf8'),text);
});
test('explicit missing/corrupt SQLite recovery preserves evidence, while normal saves remain blocked',async t=>{
 for(const damaged of ['missing','corrupt']){
  const p=root();t.after(()=>fs.rmSync(p,{recursive:true,force:true}));const a=app(p);await a.call('data:load');await a.call('data:save',JSON.stringify(blank()));
  const file=path.join(p,'billing.sqlite');if(damaged==='missing')fs.unlinkSync(file);else fs.writeFileSync(file,'Synthetic damaged database');
  await assert.rejects(app(p).call('data:load'),/DATA_(MISSING|INVALID_DATABASE)/);
  await assert.rejects(a.call('data:save',JSON.stringify(blank())),/DATA_(MISSING|INVALID_DATABASE)/);
  const recovered=JSON.stringify({...blank(),meta:{restored:true}});await a.call('data:recover',recovered);assert.equal(await app(p).call('data:load'),recovered);
  if(damaged==='corrupt')assert.ok(fs.readdirSync(path.join(p,'backups')).some(n=>n.endsWith('billing.sqlite')&&fs.readFileSync(path.join(p,'backups',n),'utf8')==='Synthetic damaged database'));
 }
});
test('failed explicit recovery does not replace corruption, and future SQLite cannot be downgraded',async t=>{
 const p=root();t.after(()=>fs.rmSync(p,{recursive:true,force:true}));const a=app(p);await a.call('data:load');await a.call('data:save',JSON.stringify(blank()));const file=path.join(p,'billing.sqlite');
 fs.writeFileSync(file,'Damaged synthetic bytes');
 const failingFs={...fs,promises:{...fs.promises,rename:async(from,to)=>{if(from.endsWith('.restore'))throw Error('SYNTHETIC_RESTORE_FAILURE');return fs.promises.rename(from,to);}}};
 await assert.rejects(mainHarness(p,undefined,failingFs,{sqlite:true}).call('data:recover',JSON.stringify(blank())),/SYNTHETIC_RESTORE_FAILURE/);assert.equal(fs.readFileSync(file,'utf8'),'Damaged synthetic bytes');
 fs.unlinkSync(file);const sql=new(require('node:sqlite').DatabaseSync)(file);sql.exec('PRAGMA user_version=99');sql.close();const bytes=fs.readFileSync(file);
 await assert.rejects(a.call('data:recover',JSON.stringify(blank())),/DATA_FUTURE_VERSION/);assert.deepEqual(fs.readFileSync(file),bytes);
});
test('unreadable sync-bound SQLite cannot bypass account/disconnect protections',async t=>{
 const p=root();t.after(()=>fs.rmSync(p,{recursive:true,force:true}));const a=app(p);await a.call('data:load');await a.call('data:save',JSON.stringify(blank()));
 const cfg=JSON.parse(fs.readFileSync(path.join(p,'config.json')));cfg.syncBound=true;fs.writeFileSync(path.join(p,'config.json'),JSON.stringify(cfg));fs.unlinkSync(path.join(p,'billing.sqlite'));
 await assert.rejects(a.call('data:recover',JSON.stringify(blank())),/SYNC_DISCONNECT_REQUIRED/);assert.equal(fs.existsSync(path.join(p,'billing.sqlite')),false);
});
test('recovery retains default/external JSON origin after both missing and corrupt SQLite',async t=>{
 for(const external of [false,true])for(const corrupt of [false,true]){
  const p=root();t.after(()=>fs.rmSync(p,{recursive:true,force:true}));const origin=path.join(p,external?'External-Drive/billing.json':'billing.json');fs.mkdirSync(path.dirname(origin),{recursive:true});const text=JSON.stringify(blank());fs.writeFileSync(origin,text);
  if(external)fs.writeFileSync(path.join(p,'config.json'),JSON.stringify({externalPath:origin}));
  const a=app(p);await a.call('data:load');const file=path.join(p,'billing.sqlite');if(corrupt)fs.writeFileSync(file,'Damaged synthetic SQLite');else fs.unlinkSync(file);
  await a.call('data:recover',text);assert.equal(await app(p).call('data:load'),text);
  fs.writeFileSync(origin,JSON.stringify({...blank(),meta:{oldWriter:true}}));await assert.rejects(a.call('data:save',text),/DATA_LEGACY_FILE_CHANGED/);await assert.rejects(app(p).call('data:load'),/DATA_LEGACY_FILE_CHANGED/);
 }
});

test('failed SQLite swap restores quarantined sidecars; interrupted recovery blocks ordinary loading',async t=>{
 const p=root();t.after(()=>fs.rmSync(p,{recursive:true,force:true}));const a=app(p);await a.call('data:load');await a.call('data:save',JSON.stringify(blank()));
 const file=path.join(p,'billing.sqlite');fs.writeFileSync(file,'Synthetic damaged SQLite');fs.writeFileSync(file+'-journal','Synthetic retained journal');
 const failingFs={...fs,promises:{...fs.promises,rename:async(from,to)=>{if(from.endsWith('.restore'))throw Error('SYNTHETIC_SWAP_FAILURE');return fs.promises.rename(from,to);}}};
 await assert.rejects(mainHarness(p,undefined,failingFs,{sqlite:true}).call('data:recover',JSON.stringify(blank())),/SYNTHETIC_SWAP_FAILURE/);assert.equal(fs.readFileSync(file+'-journal','utf8'),'Synthetic retained journal');assert.equal(fs.existsSync(file+'.restore-in-progress'),false);
 fs.writeFileSync(file+'.restore-in-progress','Synthetic interrupted recovery');await assert.rejects(app(p).call('data:load'),/DATA_RECOVERY_REQUIRED/);
 await a.call('data:recover',JSON.stringify(blank()));assert.equal(fs.existsSync(file+'.restore-in-progress'),false);assert.equal(await app(p).call('data:load'),JSON.stringify(blank()));
});

test('explicit recovery never rolls back a concurrent external change observed before replacement',async t=>{
 const p=root();t.after(()=>fs.rmSync(p,{recursive:true,force:true}));const a=app(p);await a.call('data:load');await a.call('data:save',JSON.stringify(blank()));const file=path.join(p,'billing.sqlite');let reads=0;
 const racingFs={...fs,promises:{...fs.promises,readFile:async(candidate,...args)=>{if(candidate===file&&++reads===3)fs.writeFileSync(file,'Synthetic concurrent external change');return fs.promises.readFile(candidate,...args);}}};
 await assert.rejects(mainHarness(p,undefined,racingFs,{sqlite:true}).call('data:recover',JSON.stringify(blank())),/DATA_CHANGED_ON_DISK/);assert.equal(fs.readFileSync(file,'utf8'),'Synthetic concurrent external change');
});
