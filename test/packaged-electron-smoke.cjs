// Run with Playwright in NODE_PATH and the signed app executable as argv[2].
// --user-data-dir was verified against Electron 43.7.3 before using this test.
const { _electron: electron } = require('playwright');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');

(async () => {
  assert.ok(process.argv[2], 'Pass the packaged executable path');
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'billngai-packaged-smoke-'));
  const profile = path.join(root, 'profile');
  const external = path.join(root, 'Drive', 'billing.json');
  await fs.mkdir(profile);
  await fs.mkdir(path.dirname(external));
  // An existing isolated config also prevents legacy-data migration.
  await fs.writeFile(path.join(profile, 'config.json'), JSON.stringify({externalPath: external}));
  let instance;
  try {
    instance = await electron.launch({ executablePath: path.resolve(process.argv[2]),
      args: ['--user-data-dir=' + profile], timeout: 30000 });
    assert.equal(await instance.evaluate(({app}) => app.getPath('userData')), await fs.realpath(profile));
    assert.equal(await instance.evaluate(({app}) => app.getVersion()), '2.0.2');
    const page = await instance.firstWindow();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.getByText('อ่านไฟล์ข้อมูลเดิมไม่ได้', {exact:true}).waitFor();
    assert.equal(await page.evaluate(() => loadFailed), true);
    assert.equal(await page.evaluate(async () => (await window.billingAPI.syncStatus()).configured), true);
    const restored = await page.evaluate(() => {
      const d = blankDB(); d.meta.setupDone = true; d.business.businessName = 'Packaged app test';
      d.clients=[{id:'packaged-client',name:'Test customer',taxId:'',address:'',deletedAt:null}];
      d.documents=[{id:'packaged-doc',type:'invoice',number:'PACKAGED-1',clientId:'packaged-client',
        issueDate:todayISO(),dueDate:todayISO(),status:'draft',currency:'THB',
        items:[{description:'Packaged app service',qty:1,price:1000,unit:'job'}],vatRate:7,whtRate:3,notes:'',deletedAt:null}];
      return JSON.stringify(d);
    });
    await fs.writeFile(external, restored);
    assert.equal(await page.evaluate(() => persist(false)), false);
    assert.equal(await fs.readFile(external,'utf8'), restored);
    await page.evaluate(async text => {
      await window.billingAPI.recoverData(text);
      DB=migrate(JSON.parse(await window.billingAPI.load())); loadFailed=false; buildJournalIndex();
      if(!await persist(true)) throw new Error('Recovery save failed');
      viewDoc('packaged-doc');
    }, restored);
    await page.getByText('Packaged app service',{exact:true}).waitFor();
    await page.screenshot({path:path.join(root,'packaged-invoice.png')});
    assert.equal(JSON.parse(await fs.readFile(external,'utf8')).documents.length,1);
    await page.reload();
    await page.getByText('PACKAGED-1',{exact:true}).waitFor();
    assert.equal(await page.evaluate(() => DB.documents.length),1);
    assert.equal(await page.evaluate(() => loadFailed),false);
    assert.deepEqual(errors,[]);
    console.log('PASS: packaged BillNgai 2.0.2 executable, isolated startup lock, no overwrite, native recovery, invoice, save and reload.');
    console.log('Fixture/screenshot:',root);
  } finally { if(instance) await instance.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });
