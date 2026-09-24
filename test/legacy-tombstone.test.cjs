const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {mainHarness}=require('./helpers/main-harness.cjs');
const marker=extra=>({id:'deleted-synthetic',deletedAt:'2020-01-01T00:00:00.000Z',updatedAt:'2020-01-01T00:00:00.000Z',...extra});
const data=documents=>JSON.stringify({version:2,business:{},clients:[],documents,recurring:[],counters:{},meta:{}});
test('legacy deletion markers survive native restore/load/save/reopen with exact fields',async t=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'billngai-tombstone-'));
  t.after(()=>fs.rm(root,{recursive:true,force:true}));
  const original=data([{id:'current',type:'invoice'}]);await fs.writeFile(path.join(root,'billing.json'),original);
  const h=mainHarness(root);await h.call('data:load');
  const recovered=data([marker(),marker({id:'deleted-currency',currency:'THB'})]);
  await h.call('data:recover',recovered);assert.equal(await h.call('data:load'),recovered);
  await h.call('data:save',recovered);assert.equal(await mainHarness(root).call('data:load'),recovered);
  const backups=await fs.readdir(path.join(root,'backups'));
  assert.ok((await Promise.all(backups.map(n=>fs.readFile(path.join(root,'backups',n),'utf8')))).includes(original));
});
test('type-less live, malformed, duplicate and financial payloads still reject without replacing data',async t=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'billngai-tombstone-invalid-'));
  t.after(()=>fs.rm(root,{recursive:true,force:true}));
  const original=data([]);await fs.writeFile(path.join(root,'billing.json'),original);
  const h=mainHarness(root);await h.call('data:load');
  const invalid=[marker({deletedAt:null}),marker({deletedAt:'2026-02-30T00:00:00Z'}),marker({updatedAt:'invalid'}),marker({items:[]}),marker({type:'unknown'}),marker({status:'paid'}),marker({currency:{}}),marker({archivedAt:'invalid'}),{id:'live'}];
  for(const record of invalid){await assert.rejects(h.call('data:recover',data([record])),/DATA_INVALID_SCHEMA/);assert.equal(await fs.readFile(path.join(root,'billing.json'),'utf8'),original);}
  await assert.rejects(h.call('data:recover',data([marker(),marker()])),/DATA_INVALID_SCHEMA/);
});
test('native and renderer legacy-marker predicates remain identical',async()=>{
  const main=await fs.readFile(path.join(__dirname,'../main.js'),'utf8'),renderer=await fs.readFile(path.join(__dirname,'../billing.html'),'utf8');
  const predicate=s=>s.slice(s.indexOf('function isLegacyDeletionMarker(record) {'),s.indexOf('\nfunction validate',s.indexOf('function isLegacyDeletionMarker(record) {')));
  assert.equal(predicate(main),predicate(renderer));
});
