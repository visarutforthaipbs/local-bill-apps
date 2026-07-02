const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;

app.setName('Billiong');

let win;
const USER_DIR     = app.getPath('userData');
const CONFIG_PATH  = path.join(USER_DIR, 'config.json');
const DEFAULT_DATA = path.join(USER_DIR, 'billing.json');

/* ---------------- storage helpers ---------------- */
// config.json remembers an optional external file (e.g. one in Drive/Dropbox).
// When externalPath is null, data lives in the app folder (DEFAULT_DATA).
async function readConfig() {
  try { return JSON.parse(await fsp.readFile(CONFIG_PATH, 'utf8')); }
  catch (e) { return { externalPath: null }; }
}
async function writeConfig(cfg) {
  try { await fsp.mkdir(USER_DIR, { recursive: true });
        await fsp.writeFile(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf8'); }
  catch (e) { console.error('config write failed', e); }
}
async function activePath() {
  const cfg = await readConfig();
  return cfg.externalPath || DEFAULT_DATA;
}
async function atomicWrite(file, text) {
  await fsp.mkdir(path.dirname(file), { recursive: true });
  const tmp = file + '.tmp';
  await fsp.writeFile(tmp, text, 'utf8');
  await fsp.rename(tmp, file);
}

// Rolling local snapshots so a bad edit / disk loss never wipes history.
// Writes at most one snapshot per SNAP_INTERVAL and keeps the newest SNAP_KEEP.
const BACKUP_DIR    = path.join(USER_DIR, 'backups');
const SNAP_INTERVAL = 30 * 60 * 1000; // 30 min
const SNAP_KEEP     = 14;
let lastSnap = 0;
async function maybeSnapshot(text) {
  try {
    if (Date.now() - lastSnap < SNAP_INTERVAL) return;
    await fsp.mkdir(BACKUP_DIR, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    await fsp.writeFile(path.join(BACKUP_DIR, 'billing-' + stamp + '.json'), text, 'utf8');
    lastSnap = Date.now();
    const files = (await fsp.readdir(BACKUP_DIR))
      .filter(f => /^billing-.*\.json$/.test(f)).sort();
    for (const f of files.slice(0, Math.max(0, files.length - SNAP_KEEP))) {
      await fsp.unlink(path.join(BACKUP_DIR, f)).catch(() => {});
    }
  } catch (e) { console.warn('snapshot skipped', e.message); }
}

/* ---------------- IPC: data ---------------- */
ipcMain.handle('data:load', async () => {
  const file = await activePath();
  try { return await fsp.readFile(file, 'utf8'); }
  catch (e) { if (e.code === 'ENOENT') return null; throw e; }
});

ipcMain.handle('data:save', async (_e, text) => {
  await atomicWrite(await activePath(), text);
  maybeSnapshot(text);   // throttled rolling backup (fire-and-forget)
  return true;
});

ipcMain.handle('data:revealBackups', async () => {
  await fsp.mkdir(BACKUP_DIR, { recursive: true });
  shell.openPath(BACKUP_DIR);
});

ipcMain.handle('data:where', async () => {
  const cfg = await readConfig();
  return { mode: cfg.externalPath ? 'external' : 'app', path: cfg.externalPath || DEFAULT_DATA };
});

ipcMain.handle('data:reveal', async () => { shell.showItemInFolder(await activePath()); });

// Pick an existing billing.json -> make it the active store, return its contents.
ipcMain.handle('data:linkExisting', async () => {
  const r = await dialog.showOpenDialog(win, {
    title: 'เปิดไฟล์ billing.json', properties: ['openFile'],
    filters: [{ name: 'Billing Data (.json)', extensions: ['json'] }]
  });
  if (r.canceled || !r.filePaths.length) return null;
  const file = r.filePaths[0];
  const text = await fsp.readFile(file, 'utf8');
  const cfg = await readConfig(); cfg.externalPath = file; await writeConfig(cfg);
  return { text, path: file };
});

// Create a new external file at a chosen location, seed it with current data, make active.
ipcMain.handle('data:createExternal', async (_e, text) => {
  const r = await dialog.showSaveDialog(win, {
    title: 'เก็บเป็นไฟล์ (เช่นใน Drive/Dropbox)',
    defaultPath: path.join(app.getPath('documents'), 'billing.json'),
    filters: [{ name: 'Billing Data (.json)', extensions: ['json'] }]
  });
  if (r.canceled || !r.filePath) return null;
  await atomicWrite(r.filePath, text);
  const cfg = await readConfig(); cfg.externalPath = r.filePath; await writeConfig(cfg);
  return { path: r.filePath };
});

// Switch back to the in-app folder; write current data there.
ipcMain.handle('data:useDefault', async (_e, text) => {
  const cfg = await readConfig(); cfg.externalPath = null; await writeConfig(cfg);
  if (typeof text === 'string') await atomicWrite(DEFAULT_DATA, text);
  return { path: DEFAULT_DATA };
});

// Export a backup copy (does NOT change the active store).
ipcMain.handle('data:export', async (_e, text) => {
  const r = await dialog.showSaveDialog(win, {
    title: 'สำรองข้อมูล',
    defaultPath: path.join(app.getPath('documents'), 'billing-backup-' + new Date().toISOString().slice(0, 10) + '.json'),
    filters: [{ name: 'JSON', extensions: ['json'] }]
  });
  if (r.canceled || !r.filePath) return false;
  await fsp.writeFile(r.filePath, text, 'utf8');
  return r.filePath;
});

// Save the currently shown document as a PDF (uses the same @media print CSS).
ipcMain.handle('doc:pdf', async (_e, suggestedName) => {
  const r = await dialog.showSaveDialog(win, {
    title: 'บันทึกเป็น PDF',
    defaultPath: path.join(app.getPath('documents'), suggestedName || 'document.pdf'),
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  });
  if (r.canceled || !r.filePath) return null;
  const data = await win.webContents.printToPDF({ printBackground: true, preferCSSPageSize: true });
  await fsp.writeFile(r.filePath, data);
  shell.showItemInFolder(r.filePath);
  return r.filePath;
});

// Import: pick a file, return its text (renderer merges + saves to the active store).
ipcMain.handle('data:import', async () => {
  const r = await dialog.showOpenDialog(win, {
    title: 'นำเข้าข้อมูล', properties: ['openFile'],
    filters: [{ name: 'JSON', extensions: ['json'] }]
  });
  if (r.canceled || !r.filePaths.length) return null;
  return await fsp.readFile(r.filePaths[0], 'utf8');
});

/* ---------------- window + menu ---------------- */
function createWindow() {
  win = new BrowserWindow({
    width: 1280, height: 860, minWidth: 940, minHeight: 600,
    backgroundColor: '#ece7dc',
    title: 'Billiong',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false
    }
  });
  win.loadFile('billing.html');
  // External links open in the system browser, not inside the app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
}

function buildMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: 'ไฟล์',
      submenu: [
        { label: 'สำรองข้อมูล (Export)…', accelerator: 'CmdOrCtrl+E', click: () => win && win.webContents.send('menu:export') },
        { label: 'นำเข้าข้อมูล (Import)…', accelerator: 'CmdOrCtrl+I', click: () => win && win.webContents.send('menu:import') },
        { label: 'เปิดที่เก็บไฟล์ข้อมูล', click: async () => shell.showItemInFolder(await activePath()) },
        { label: 'เปิดโฟลเดอร์สำรองอัตโนมัติ', click: async () => { await fsp.mkdir(BACKUP_DIR, { recursive: true }); shell.openPath(BACKUP_DIR); } },
        { type: 'separator' },
        { label: 'พิมพ์ / Print…', accelerator: 'CmdOrCtrl+P', click: () => win && win.webContents.print() },
        ...(isMac ? [] : [{ role: 'quit' }])
      ]
    },
    { role: 'editMenu' },   // Cmd+C/V/X/A — required for inputs on macOS
    { role: 'viewMenu' },
    { role: 'windowMenu' }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(() => {
  buildMenu();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
