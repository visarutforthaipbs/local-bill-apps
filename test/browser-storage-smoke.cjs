// Requires Playwright. Uses the real renderer + preload + main storage handlers;
// only Electron's UI and IPC transport are replaced. All data lives under /tmp.
const { chromium } = require('playwright');
const fs = require('node:fs');
const fsp = fs.promises;
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const assert = require('node:assert/strict');
const { mainHarness } = require('./helpers/main-harness.cjs');
const project = path.resolve(__dirname, '..');
(async () => {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'billngai-browser-smoke-'));
  const external = path.join(root, 'Drive', 'billing.json');
  await fsp.mkdir(path.dirname(external));
  await fsp.writeFile(path.join(root, 'config.json'), JSON.stringify({ externalPath: external }));
  const harness = mainHarness(root);
  const server = http.createServer(async (req, res) => {
    const file = path.resolve(project, '.' + new URL(req.url, 'http://localhost').pathname);
    if(!file.startsWith(project + path.sep)) { res.writeHead(403).end(); return; }
    try {
      res.setHeader('Content-Type', file.endsWith('.html') ? 'text/html; charset=utf-8' : file.endsWith('.svg') ? 'image/svg+xml' : 'application/octet-stream');
      res.end(await fsp.readFile(file));
    } catch { res.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, timezoneId: 'Asia/Bangkok' });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.exposeFunction('callMain', (name, ...args) => harness.call(name, ...args));
    await page.addInitScript(source => {
      const electron = { contextBridge: { exposeInMainWorld: (name, value) => { window[name] = value; } },
        ipcRenderer: { invoke: (...args) => window.callMain(...args), on() {}, send() {} }, webUtils: {} };
      new Function('require', source)(() => electron);
    }, await fsp.readFile(path.join(project, 'preload.js'), 'utf8'));
    await page.goto(`http://127.0.0.1:${server.address().port}/billing.html`);
    await page.getByText('อ่านไฟล์ข้อมูลเดิมไม่ได้', { exact: true }).waitFor();
    assert.equal(await page.evaluate(() => loadFailed), true);
    assert.equal(await page.evaluate(() => isSyncEnabled()), false);
    assert.equal(await page.evaluate(() => document.getElementById('fileStatus').textContent.includes('หยุดบันทึกและซิงก์ชั่วคราว')), true);
    assert.equal(await page.getByRole('button', { name: 'เริ่มตั้งค่า', exact: true }).count(), 0);
    const restored = await page.evaluate(() => { const d = blankDB(); d.business.businessName = 'Storage test'; d.meta.setupDone = true; return JSON.stringify(d); });
    await fsp.writeFile(external, restored);
    assert.equal(await page.evaluate(() => persist(false)), false);
    assert.equal(await fsp.readFile(external, 'utf8'), restored);
    await page.screenshot({ path: path.join(root, 'failed-load.png'), animations: 'disabled' });
    await page.evaluate(async text => {
      await window.billingAPI.recoverData(text);
      DB = migrate(JSON.parse(await window.billingAPI.load())); loadFailed = false; buildJournalIndex();
      await persist(true); await window.billingAPI.snapshotBackup('manual');
      setView('settings'); setSettingsTab('data');
    }, restored);
    await page.getByRole('columnheader', { name: 'วันที่สำรอง (เวลาเครื่อง)' }).waitFor();
    await page.screenshot({ path: path.join(root, 'backup-history.png'), animations: 'disabled' });
    await page.evaluate(() => { DB.business.uiLang = 'en'; render(); });
    await page.getByRole('columnheader', { name: 'Backed up (device time)' }).waitFor();
    assert.deepEqual(errors, []);
    console.log('PASS: actual renderer/preload and storage handlers: failed-load banner, no overwrite, recovery, normal save, TH/EN backup table.');
    console.log('Fixture/screenshots:', root);
  } finally { if(browser) await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
