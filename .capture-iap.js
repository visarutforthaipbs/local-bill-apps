// Temp runner (must live at the app root so loadFile('billing.html') resolves).
// Run: npx electron .capture-iap.js — captures the MAS upgrade modal for IAP review.
process.env.BILLNGAI_FAKE_MAS = '1';
process.env.BILLNGAI_DEV_NAME = 'BillNgai-MAS-Shot';

const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

require(path.join(__dirname, 'main.js'));

setTimeout(() => { console.error('TIMEOUT — giving up'); app.exit(2); }, 30000);

app.whenReady().then(async () => {
  try {
    let win = null;
    for (let i = 0; i < 40 && !win; i++) { win = BrowserWindow.getAllWindows()[0]; await new Promise(r => setTimeout(r, 250)); }
    if (!win) throw new Error('no window appeared');
    if (win.webContents.isLoading()) await new Promise(r => win.webContents.once('did-finish-load', r));
    await new Promise(r => setTimeout(r, 2000));   // ให้ boot() เสร็จ (async)
    win.setContentSize(1440, 900);
    const result = await win.webContents.executeJavaScript(`
      (async () => {
        try{
          closeModal();
          if(!activeDocs().length) loadDemoData();
          setView('settings'); settingsTab='workspace'; render();
          openUpgradeModal();
          return 'ok';
        }catch(e){ return 'ERR: '+e.message; }
      })()
    `);
    console.log('page script:', result);
    await new Promise(r => setTimeout(r, 3400));
    const img = await win.webContents.capturePage();
    const file = path.join(__dirname, 'store-assets', 'iap-review-screenshot.png');
    fs.writeFileSync(file, img.toPNG());
    console.log('written', file, img.getSize());
    app.exit(0);
  } catch (e) { console.error('capture failed:', e.message); app.exit(1); }
});
