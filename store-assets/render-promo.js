// Render store-assets/iap-promo.html → 1024×1024 PNG (Apple IAP promotional image).
// Run: npx electron store-assets/render-promo.js
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    show: false, useContentSize: true, width: 1024, height: 1024,
    webPreferences: { offscreen: true }
  });
  await win.loadFile(path.join(__dirname, 'iap-promo.html'));
  await new Promise(r => setTimeout(r, 1800));   // ให้ฟอนต์/รูปโหลดครบก่อนถ่าย
  const img = await win.webContents.capturePage({ x: 0, y: 0, width: 1024, height: 1024 });
  const out = img.getSize().width === 1024 ? img : img.resize({ width: 1024, height: 1024 });
  const file = path.join(__dirname, 'iap-pro-1024.png');
  fs.writeFileSync(file, out.toPNG());
  console.log('written', file, out.getSize());
  app.quit();
});
