// Generate the 6 Mac App Store screenshots (STORE-LISTING.md shot list).
// Runs the real app in fake-MAS mode with a throwaway profile + demo data
// and a filled-in sample business profile so documents look real.
// Run from the app root: npx electron .capture-shots.js
process.env.BILLNGAI_FAKE_MAS = '1';
process.env.BILLNGAI_DEV_NAME = 'BillNgai-MAS-Shot2';

const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

require(path.join(__dirname, 'main.js'));

setTimeout(() => { console.error('TIMEOUT'); app.exit(2); }, 90000);

const SETUP = `
(async () => {
  try{
    closeModal();
    const b = DB.business;
    b.businessName = 'สมชาย ครีเอทีฟ สตูดิโอ';
    b.businessNameEn = 'Somchai Creative Studio';
    b.address = '88/12 ถนนพระราม 9 แขวงห้วยขวาง\\nเขตห้วยขวาง กรุงเทพฯ 10310';
    b.taxId = '1101700200000';
    b.phone = '081-234-5678';
    b.email = 'hello@somchai.studio';
    b.promptpayId = '0812345678';
    b.bankName = 'กสิกรไทย'; b.bankAccount = '012-3-45678-9'; b.bankAccountName = 'นายสมชาย ใจดี';
    DB.meta.setupDone = true;
    if(!activeDocs().length) loadDemoData();
    DB.meta.demo = false;                       // ซ่อนแบนเนอร์ข้อมูลตัวอย่างในภาพโปรโมต
    DB.meta.lastBackupAt = new Date().toISOString();  // กันแบนเนอร์เตือนสำรองข้อมูล
    render();
    return 'ok';
  }catch(e){ return 'ERR: '+e.message; }
})()`;

const SHOTS = [
  { name: '1-dashboard',  js: `setView('dashboard'); 'ok'` },
  { name: '2-invoice-paper', js: `(()=>{ const d = activeDocs().find(x=>x.type==='invoice' && x.status!=='paid') || activeDocs()[0]; viewDoc(d.id); return 'ok'; })()` },
  { name: '3-editor', js: `(()=>{ const q = activeDocs().find(x=>x.type==='quotation'); openDocEditor(q.type, q.id); return 'ok'; })()` },
  { name: '4-wht-50tawi', js: `closeModal(); setView('wht'); 'ok'` },
  { name: '5-filing', js: `setView('filing'); 'ok'` },
  { name: '6-settings-brand', js: `setView('settings'); settingsTab='business'; render(); 'ok'` },
];

app.whenReady().then(async () => {
  try {
    let win = null;
    for (let i = 0; i < 40 && !win; i++) { win = BrowserWindow.getAllWindows()[0]; await new Promise(r => setTimeout(r, 250)); }
    if (!win) throw new Error('no window');
    if (win.webContents.isLoading()) await new Promise(r => win.webContents.once('did-finish-load', r));
    await new Promise(r => setTimeout(r, 2000));
    win.setContentSize(1440, 900);
    console.log('setup:', await win.webContents.executeJavaScript(SETUP));
    await new Promise(r => setTimeout(r, 3400));   // ให้ toast โหลดข้อมูลตัวอย่างหายก่อน
    for (const s of SHOTS) {
      const r = await win.webContents.executeJavaScript(`(async()=>{ try{ ${s.js}; return 'ok'; }catch(e){ return 'ERR: '+e.message; } })()`);
      await new Promise(r2 => setTimeout(r2, 1200));
      const img = await win.webContents.capturePage();
      const file = path.join(__dirname, 'store-assets', 'screenshot-' + s.name + '.png');
      fs.writeFileSync(file, img.toPNG());
      console.log(s.name, r, img.getSize());
    }
    app.exit(0);
  } catch (e) { console.error('failed:', e.message); app.exit(1); }
});
