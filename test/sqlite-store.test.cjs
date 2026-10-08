const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{DatabaseSync}=require('node:sqlite');
const {SQLiteStore}=require('../lib/sqlite-store.cjs'),D=require('../lib/billing-data.cjs');
const payload=meta=>JSON.stringify({version:3,business:{},documents:[],clients:[],recurring:[],reviewEvents:[],counters:{},meta});
function fixture(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'billngai-sql-unit-')),stores=[];t.after(()=>{for(const store of stores)store.close();fs.rmSync(dir,{recursive:true,force:true});});return {file:path.join(dir,'billing.sqlite'),open:file=>{const store=new SQLiteStore(file,{validate:text=>D.validate(JSON.parse(text))});stores.push(store);return store;}};}
test('migration backup failure leaves an empty transaction; exact JSON and unknown fields survive restart',t=>{
 const {file,open}=fixture(t),s=open(file),text=payload({unknown:'ภาษาไทย'}),origin=path.join(path.dirname(file),'billing.json');
 assert.throws(()=>s.migrate(text,{originPath:origin,backup:()=>false}),/DATA_BACKUP_FAILED/);assert.equal(s.read().text,null);
 let backed=0;const revision=s.migrate(text,{originPath:origin,backup:value=>{assert.equal(value,text);backed++;return true;}});assert.equal(backed,1);s.close();
 const next=open(file);assert.equal(next.read().text,text);assert.equal(next.read().revision,revision);assert.equal(next.migrate(text,{originPath:origin,backup:()=>{throw Error('not repeated');}}),revision);next.close();
 // Windows reports writable/readable mode bits rather than POSIX access modes.
 if(process.platform!=='win32')assert.equal(fs.statSync(file).mode&0o777,0o600);
});
test('concurrent connections compare revision inside the SQL transaction, retaining replica and outbox atomically',t=>{
 const {file,open}=fixture(t),a=open(file),b=open(file),first=payload({replica:{cursor:2,pending:'op1'},unknown:true});a.write(first,'empty');const previous=b.read();
 const second=payload({replica:{cursor:3,pending:null},unknown:true});a.write(second,a.read().revision);
 assert.throws(()=>b.write(payload({stale:true}),previous.revision),/DATA_CHANGED_ON_DISK/);assert.equal(b.read().text,second);a.close();b.close();
});
test('future SQL/schema and corrupted payload fail without changing original bytes',t=>{
 const {file,open}=fixture(t),s=open(file);s.write(payload({}), 'empty');s.close();
 const raw=new DatabaseSync(file);raw.exec('PRAGMA user_version=999');raw.close();const original=fs.readFileSync(file);
 assert.throws(()=>open(file),/DATA_FUTURE_VERSION/);assert.deepEqual(fs.readFileSync(file),original);
 const sql=new DatabaseSync(file);sql.exec('PRAGMA user_version=1');sql.prepare('UPDATE workspace SET payload=?').run('broken');sql.close();const corrupt=fs.readFileSync(file);
 assert.throws(()=>open(file),/DATA_INVALID_DATABASE/);assert.deepEqual(fs.readFileSync(file),corrupt);
});
test('missing or replaced file and symlink cannot silently become a new live store',t=>{
 const {file,open}=fixture(t),s=open(file);s.write(payload({}), 'empty');const moved=file+'.old';
 if(process.platform==='win32'){assert.throws(()=>fs.renameSync(file,moved),/(EBUSY|EPERM)/);s.close();}
 fs.renameSync(file,moved);
 assert.throws(()=>s.checkFile(),/DATA_MISSING/);fs.copyFileSync(moved,file);assert.throws(()=>s.checkFile(),/DATA_CHANGED_ON_DISK/);s.close();fs.unlinkSync(file);// Windows unprivileged directory junction exercises the same non-file guard.
 fs.symlinkSync(process.platform==='win32'?path.dirname(moved):moved,file,process.platform==='win32'?'junction':'file');assert.throws(()=>open(file),/DATA_INVALID_FILE/);
});
