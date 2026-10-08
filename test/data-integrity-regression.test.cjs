const {test}=require('node:test'),assert=require('node:assert/strict');
const {rendererHarness}=require('./helpers/renderer-harness.cjs');
test('pure repeatable migration keeps old tombstones, unknown fields and confirmation snapshots',()=>{
 const {run}=rendererHarness();run(`source={...DB,version:2,counters:{'invoice-2569':7},future:{keep:true}};source.clients.push({id:'deleted',name:'Old',deletedAt:'2020-01-01T00:00:00.000Z'});original=JSON.stringify(source);a=migrate(source);b=migrate(source);c=migrate(a)`);
 assert.equal(run('JSON.stringify(source)===original'),true);assert.equal(run('BillingData.canonical(a)===BillingData.canonical(b)'),true);assert.equal(run('BillingData.canonical(a)===BillingData.canonical(c)'),true);assert.equal(run('a.clients.length'),2);assert.equal(run('a.version'),3);assert.equal(run("a.counters['invoice-2026']"),7);
});
test('confirmation survives field and record order, but financial edits require review',async()=>{
 const {run}=rendererHarness();assert.equal(await run("saveLegacyAnswers([answer()],true,'Synthetic confirmed')"),true);
 run(`DB.documents=DB.documents.reverse().map(d=>Object.fromEntries(Object.entries(d).reverse()));DB.reviewEvents=DB.reviewEvents.map(d=>Object.fromEntries(Object.entries(d).reverse()));`);
 assert.equal(run('taxYearAgg(2026).agg.net'),1000);run(`DB.documents.find(d=>d.id==='r').items[0].price=1200`);assert.equal(run('taxYearAgg(2026).agg.net'),0);
});
test('concurrent answers converge to pending in both arrival orders, and an explicit replacement resolves all heads',async()=>{
 const {run}=rendererHarness();await run("saveLegacyAnswers([answer()],true,'Device A confirmed')");
 run(`a=DB.reviewEvents[0];b={...JSON.parse(JSON.stringify(a)),id:'device-b',decision:'not_income',note:'Device B excluded',supersedes:[]};delete b.representativeId;DB.reviewEvents=[a,b]`);
 assert.equal(run('taxYearAgg(2026).agg.net'),0);assert.equal(run("paymentReview().legacyGroups[0].resolution.status"),'conflict');
 run('DB.reviewEvents.reverse()');assert.equal(run('taxYearAgg(2026).agg.net'),0);
 const ids=run('paymentReview().legacyGroups[0].resolution.heads');assert.equal(await run("saveLegacyAnswers([answer()],true,'Owner reviewed both answers')"),true);
 assert.deepEqual(JSON.parse(JSON.stringify(run('DB.reviewEvents.at(-1).supersedes'))),JSON.parse(JSON.stringify(ids)));assert.equal(run('taxYearAgg(2026).agg.net'),1000);
 run('DB.reviewEvents.reverse()');assert.equal(run('taxYearAgg(2026).agg.net'),1000);
});
test('an answer arriving while a backup runs prevents silently superseding it',async()=>{
 let run;({run}=rendererHarness(async()=>{run(`DB.reviewEvents.push({id:'incoming',type:'legacy_group_review',documentId:'i',groupKey:'legacy-parent:i',decision:'not_income',sourceRecords:JSON.parse(JSON.stringify(DB.documents)),ownerConfirmed:true,note:'Other device',recordedAt:'2026-10-03T12:00:00.000Z',supersedes:[]})`);return true;}));
 assert.equal(await run("saveLegacyAnswers([answer()],true,'Synthetic')"),false);assert.equal(run('DB.reviewEvents.length'),1);
});
test('upgrade preview exposes income lost to concurrent answers before activation, without changing evidence',async()=>{
 const {run}=rendererHarness();await run(`saveLegacyAnswers([answer('same_payment')],true,'Synthetic first answer')`);
 run(`const first=DB.reviewEvents[0];DB.reviewEvents.push({...first,id:'other_device',decision:'not_income',representativeId:undefined,supersedes:[]});`);
 const original=run('JSON.stringify(DB)');const preview=run('dataUpgradePreview(DB)');
 assert.equal(preview.before.received.THB,undefined); // Old last answer excluded this group.
 assert.equal(preview.after.pending.THB,1000);assert.equal(preview.after.conflicted.THB,1000);assert.equal(preview.affected.length,1);assert.equal(run('JSON.stringify(DB)'),original);
 run('DB.reviewEvents.reverse()');const reversed=run('dataUpgradePreview(DB)');assert.equal(reversed.before.received.THB,1000);assert.equal(reversed.after.pending.THB,1000);
});
test('upgrade activation requires a successful backup and prevents ordinary persistence first',async()=>{
 const {run}=rendererHarness();run(`localStorage.setItem=()=>{throw Error('SYNTHETIC_BACKUP_FAILURE');}`);
 run('adoptDatabase(DB)');assert.ok(run('pendingDataUpgrade'));assert.equal(await run('persistNow(true)'),false);
 assert.equal(await run('approveDataUpgrade()'),false);assert.ok(run('pendingDataUpgrade'));assert.equal(run('DB.meta.reviewSemanticsVersion'),undefined);
});

test('migration and archive display flags do not invalidate confirmed financial facts',async()=>{
 const {run}=rendererHarness();await run("saveLegacyAnswers([answer()],true,'Synthetic confirmed')");run("DB=migrate(DB);DB.documents.forEach(d=>d.archivedAt='2026-10-04T00:00:00.000Z')");assert.equal(run('taxYearAgg(2026).agg.net'),1000);
});

test('upgrade preview lists ordinary payment matches recovered from key-order differences',()=>{
 const {run}=rendererHarness();run(`DB.reviewEvents=[{id:'pair',type:'payment_match',documentId:'i',representativeId:'r',sourceRecords:JSON.parse(JSON.stringify(DB.documents)),samePaymentConfirmed:true,note:'Synthetic pair',recordedAt:'2026-10-04T00:00:00.000Z'}];DB.documents=DB.documents.map(d=>Object.fromEntries(Object.entries(d).reverse()));`);
 const p=run('dataUpgradePreview(DB)');assert.equal(p.before.received.THB,undefined);assert.equal(p.after.received.THB,1000);assert.equal(p.affected.length,1);assert.equal(p.affected[0].documents.length,2);
});

test('new profiles already use the current review rules; imported legacy profiles still require review',()=>{
 const {run}=rendererHarness();assert.equal(run('blankDB().meta.reviewSemanticsVersion'),3);run('fresh=blankDB();fresh.documents=DB.documents;adoptDatabase(fresh)');assert.equal(run('pendingDataUpgrade'),null);run('delete fresh.meta.reviewSemanticsVersion;adoptDatabase(fresh)');assert.ok(run('pendingDataUpgrade'));
});
