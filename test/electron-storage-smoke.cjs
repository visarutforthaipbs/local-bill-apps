// Run: node_modules/.bin/electron test/electron-storage-smoke.cjs
// Starts the real app/IPC in an isolated temporary profile, never the user's data.
const { app } = require('electron');
const fs = require('node:fs');
const fsp = fs.promises;
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'billngai-electron-smoke-'));
const userData = path.join(root, 'profile');
fs.mkdirSync(userData);
app.setPath('appData', root);
app.setPath('userData', userData);
app.setPath('sessionData', userData);
const external = path.join(root, 'Drive', 'billing.json');
fs.mkdirSync(path.dirname(external));
fs.writeFileSync(path.join(userData, 'config.json'), JSON.stringify({ externalPath: external }));
const sourceRoot = process.env.BILLNGAI_SMOKE_APP || path.resolve(__dirname, '..');
process.chdir(path.resolve(__dirname, '..'));
app.setAppPath(sourceRoot);
const timeout = setTimeout(() => { console.error('Smoke test timed out; fixture:', root); app.exit(1); }, 45000);
app.on('browser-window-created', (_event, win) => {
  win.webContents.once('did-finish-load', async () => {
    try {
      const run = async code => {
        try { return await win.webContents.executeJavaScript(code); }
        catch(error) { console.error('Renderer step:', code); throw error; }
      };
      for(let i = 0; i < 100; i++) {
        if(await run("!!DB && document.getElementById('content').textContent.includes('อ่านไฟล์ข้อมูลเดิมไม่ได้')")) break;
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      assert.equal(await run('loadFailed'), true);
      assert.equal(await run('window.billingAPI.syncStatus().then(s=>s.configured)'), true);
      assert.equal(await run('isSyncEnabled()'), false);
      assert.equal(await run("document.getElementById('modal').classList.contains('open')"), false);
      assert.equal(fs.existsSync(external), false);
      const restored = await run(`(() => {
        const d=blankDB(); d.business.businessName='Storage test'; d.meta.setupDone=true;
        d.clients=[{id:'test-client',name:'Test customer',taxId:'',address:'',deletedAt:null}];
        d.documents=Array.from({length:3},(_,i)=>({id:'test-'+i,type:'invoice',number:'TEST-'+(i+1),
          clientId:'test-client',issueDate:todayISO(),dueDate:todayISO(),status:'draft',currency:'THB',
          items:[{description:'Test service',qty:1,price:1000,unit:'job'}],vatRate:7,whtRate:3,notes:'',deletedAt:null}));
        return JSON.stringify(d);
      })()`);
      await fsp.writeFile(external, restored);
      assert.equal(await run('persist(false)'), false);
      assert.equal(await fsp.readFile(external, 'utf8'), restored);
      await new Promise(resolve => setTimeout(resolve, 700));
      await fsp.writeFile(path.join(root, 'failed-load.png'), (await win.webContents.capturePage()).toPNG());
      // Real preload/IPC recovery, followed by normal save and local backup UI.
      await run(`window.billingAPI.recoverData(${JSON.stringify(restored)})`);
      await run("(async()=>{ DB=migrate(JSON.parse(await window.billingAPI.load())); loadFailed=false; buildJournalIndex(); await persist(true); await window.billingAPI.snapshotBackup('manual'); setView('settings'); setSettingsTab('data'); })()");
      for(let i = 0; i < 100; i++) {
        if(await run("document.getElementById('backupHist')?.textContent.includes('วันที่สำรอง (เวลาเครื่อง)')")) break;
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      assert.equal(await run("document.getElementById('backupHist').textContent.includes('วันที่สำรอง (เวลาเครื่อง)')"), true);
      assert.equal(await run('loadFailed'), false);
      await run("document.getElementById('backupHist').scrollIntoView({block:'center'});");
      await new Promise(resolve => setTimeout(resolve, 700));
      await fsp.writeFile(path.join(root, 'backup-history.png'), (await win.webContents.capturePage()).toPNG());
      await run("DB.business.uiLang='en'; render();");
      await new Promise(resolve => setTimeout(resolve, 100));
      assert.equal(await run("document.getElementById('backupHist').textContent.includes('Backed up (device time)')"), true);
      // Exercise the real document editor/save path and Chromium's PDF renderer.
      await run("openDocEditor('invoice'); updItem(0,'description','Native runtime test'); updItem(0,'price',1500); saveDoc();");
      for(let i=0;i<100;i++) {
        if(JSON.parse(await fsp.readFile(external,'utf8')).documents.length===4) break;
        await new Promise(resolve=>setTimeout(resolve,50));
      }
      assert.equal(JSON.parse(await fsp.readFile(external,'utf8')).documents.length,4);
      assert.equal(await run("document.querySelector('.paper').textContent.includes('Native runtime test')"),true);
      await run('document.fonts.ready.then(()=>{applyPrintZoom(); return true;})');
      const pdf = await win.webContents.printToPDF({printBackground:true,preferCSSPageSize:true});
      assert.equal(pdf.subarray(0,5).toString(),'%PDF-');
      assert.ok(pdf.length>5000);
      await fsp.writeFile(path.join(root,'invoice.pdf'),pdf);
      await run('clearPrintZoom()');
      // Reopen the renderer, loading saved bytes through native IPC again.
      await win.loadFile('billing.html');
      for(let i=0;i<100;i++) {
        if(await run('!!DB && DB.documents.length===4 && !loadFailed')) break;
        await new Promise(resolve=>setTimeout(resolve,50));
      }
      assert.equal(await run('DB.documents.length'),4);
      assert.equal(await run('loadFailed'),false);
      // A Drive change while an editor is open must not get a success toast.
      await run("openDocEditor('invoice','test-0'); window.__messages=[]; toast=(s,k)=>window.__messages.push({s,k}); void 0;");
      const changed=JSON.parse(await fsp.readFile(external,'utf8'));
      changed.business.businessName='External update';
      const changedText=JSON.stringify(changed);
      await fsp.writeFile(external,changedText);
      await run('saveDoc()');
      assert.equal(await run('loadFailed'),true);
      assert.equal(await run("window.__messages.some(m=>m.k==='ok')"),false);
      assert.equal(await fsp.readFile(external,'utf8'),changedText);
      console.log('PASS: Electron '+process.versions.electron+' boot lock, 3-document preservation, IPC recovery, document save/reload, TH/EN backup history, PDF, and failed editor save.');
      console.log('Isolated fixture/screenshots:', root);
      clearTimeout(timeout);
      app.exit(0);
    } catch(error) { console.error(error); console.error('Isolated fixture:', root); clearTimeout(timeout); app.exit(1); }
  });
});
require(path.join(sourceRoot, 'main.js'));
