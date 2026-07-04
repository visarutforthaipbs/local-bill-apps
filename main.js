const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const crypto = require('crypto');

app.setName('BillNgai');

let win;
const USER_DIR     = app.getPath('userData');
const CONFIG_PATH  = path.join(USER_DIR, 'config.json');
const DEFAULT_DATA = path.join(USER_DIR, 'billing.json');
const USER_AI_DIR  = path.join(USER_DIR, 'ai');
const SYSTEM_AI_DIR = '/Library/Application Support/BillNgai/ai';
const AI_DIRS      = [USER_AI_DIR, SYSTEM_AI_DIR];
const AI_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAWcP8m6RvZUtYRonssiCR/F4xIoQyOVFR30THux48hTk=
-----END PUBLIC KEY-----`;

// ย้ายข้อมูลครั้งเดียวจากโฟลเดอร์ชื่อเดิม (Billiong) — คัดลอกเท่านั้น ไม่ลบของเดิม
// เพื่อให้ผู้ใช้เดิมเปิดเวอร์ชันใหม่แล้วเจอข้อมูลครบ และย้อนกลับเวอร์ชันเก่าได้เสมอ
function migrateFromBilliong() {
  try {
    if (fs.existsSync(DEFAULT_DATA) || fs.existsSync(CONFIG_PATH)) return; // มีข้อมูลในโฟลเดอร์ใหม่แล้ว
    const oldDir = path.join(app.getPath('appData'), 'Billiong');
    if (!fs.existsSync(oldDir)) return;
    fs.mkdirSync(USER_DIR, { recursive: true });
    for (const f of ['billing.json', 'config.json']) {
      const src = path.join(oldDir, f);
      if (fs.existsSync(src)) fs.copyFileSync(src, path.join(USER_DIR, f));
    }
    const oldBackups = path.join(oldDir, 'backups');
    if (fs.existsSync(oldBackups)) fs.cpSync(oldBackups, path.join(USER_DIR, 'backups'), { recursive: true });
    console.log('Migrated data from Billiong →', USER_DIR);
  } catch (e) { console.error('migration from Billiong failed', e); }
}

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

/* ---------------- offline AI add-on ---------------- */
function canonicalJson(value) {
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonicalJson(value[k])).join(',') + '}';
  }
  return JSON.stringify(value);
}
async function sha256File(file) {
  const hash = crypto.createHash('sha256');
  const stream = fs.createReadStream(file);
  await new Promise((resolve, reject) => {
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', resolve);
    stream.on('error', reject);
  });
  return hash.digest('hex');
}
async function verifyAiDir(aiDir) {
  try {
    const manifestPath = path.join(aiDir, 'addon.json');
    const raw = await fsp.readFile(manifestPath, 'utf8');
    const manifest = JSON.parse(raw);
    const signature = manifest.signature;
    if (!signature) throw new Error('missing signature');

    const signed = { ...manifest };
    delete signed.signature;
    const ok = crypto.verify(
      null,
      Buffer.from(canonicalJson(signed)),
      crypto.createPublicKey(AI_PUBLIC_KEY),
      Buffer.from(signature, 'base64')
    );
    if (!ok) throw new Error('invalid signature');

    const checked = [];
    for (const f of manifest.files || []) {
      if (!f.path || !f.sha256) throw new Error('invalid file entry');
      const target = path.join(aiDir, f.path);
      const rel = path.relative(aiDir, target);
      if (rel.startsWith('..') || path.isAbsolute(rel)) throw new Error('invalid file path');
      const stat = await fsp.stat(target);
      const hash = await sha256File(target);
      if (hash !== f.sha256) throw new Error('hash mismatch: ' + f.path);
      checked.push({ path: f.path, size: stat.size, sha256: hash });
    }

    return {
      installed: true,
      valid: true,
      path: aiDir,
      addon: manifest.addon || '',
      name: manifest.name || 'BillNgai AI',
      version: manifest.version || '',
      model: manifest.model || '',
      features: manifest.features || [],
      files: checked
    };
  } catch (e) {
    return {
      installed: fs.existsSync(path.join(aiDir, 'addon.json')),
      valid: false,
      path: aiDir,
      error: e.code === 'ENOENT' ? 'not_installed' : e.message
    };
  }
}
async function aiStatus() {
  const results = [];
  for (const dir of AI_DIRS) {
    const status = await verifyAiDir(dir);
    results.push(status);
    if (status.valid) return { ...status, searchPaths: AI_DIRS };
  }
  const installedInvalid = results.find(r => r.installed);
  return { ...(installedInvalid || results[0]), searchPaths: AI_DIRS };
}
function findAiModel(status) {
  const model = (status.files || []).find(f => /\.gguf$/i.test(f.path));
  if (!model) throw new Error('AI model file not found in add-on');
  return path.join(status.path, model.path);
}
function findAiRunner(status) {
  const packagedRunner = path.join(status.path, 'runtime', 'bin', 'llama-cli');
  if (fs.existsSync(packagedRunner)) return packagedRunner;
  const devRunner = '/opt/homebrew/bin/llama-cli';
  if (!app.isPackaged && fs.existsSync(devRunner)) return devRunner;
  throw new Error('AI runtime not found in add-on');
}
function findLocalTool(candidates) {
  return candidates.find(p => fs.existsSync(p)) || null;
}
function runLocalTool(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { shell: false, windowsHide: true, ...options });
    let stdout = '';
    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`${path.basename(command)} timed out`));
    }, 60000);
    child.stdout.on('data', chunk => { stdout += chunk.toString('utf8'); });
    child.stderr.on('data', chunk => { stderr += chunk.toString('utf8'); });
    child.on('error', err => {
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', code => {
      clearTimeout(timer);
      if (code !== 0) {
        reject(new Error((stderr || stdout || `${path.basename(command)} exited with code ${code}`).slice(0, 1200)));
        return;
      }
      resolve(stdout);
    });
  });
}
function cleanTorText(text) {
  return String(text || '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ' ')  // PDF บางไฟล์ทิ้ง NUL/control chars ไว้ — ทำ spawn/prompt พัง
    .replace(/[\u200B\u200C\u200D\uFEFF]/g, '')
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
}
async function extractTorText(filePath) {
  const target = filePath ? String(filePath) : null;
  let selected = target;
  if (!selected) {
    const result = await dialog.showOpenDialog(win, {
      title: 'เลือกไฟล์ TOR',
      properties: ['openFile'],
      filters: [
        { name: 'TOR Documents', extensions: ['pdf', 'docx', 'doc', 'txt'] },
        { name: 'PDF', extensions: ['pdf'] },
        { name: 'Word', extensions: ['docx', 'doc'] },
        { name: 'Text', extensions: ['txt'] }
      ]
    });
    if (result.canceled || !result.filePaths.length) return null;
    selected = result.filePaths[0];
  }

  const stat = await fsp.stat(selected);
  if (!stat.isFile()) throw new Error('Selected TOR is not a file');
  const ext = path.extname(selected).toLowerCase();
  let text = '';

  if (ext === '.txt') {
    text = await fsp.readFile(selected, 'utf8');
  } else if (ext === '.pdf') {
    const pdftotext = findLocalTool([
      path.join(USER_AI_DIR, 'runtime', 'bin', 'pdftotext'),
      path.join(SYSTEM_AI_DIR, 'runtime', 'bin', 'pdftotext'),
      '/opt/homebrew/bin/pdftotext',
      '/usr/local/bin/pdftotext'
    ]);
    if (pdftotext) {
      text = await runLocalTool(pdftotext, ['-layout', selected, '-']);
    } else if (process.platform === 'darwin') {
      // เครื่อง mac ทุกเครื่องมี PDFKit ในระบบ — ดึงข้อความผ่าน JXA ไม่ต้องติดตั้งอะไรเพิ่ม
      const jxa = 'ObjC.import("PDFKit");function run(argv){const u=$.NSURL.fileURLWithPath(argv[0]);const d=$.PDFDocument.alloc.initWithURL(u);if(d.isNil()) throw new Error("cannot open PDF");const s=d.string;return s.isNil()?"":s.js;}';
      text = await runLocalTool('/usr/bin/osascript', ['-l', 'JavaScript', '-e', jxa, selected]);
    } else {
      throw new Error('PDF text extractor is not installed yet');
    }
  } else if (ext === '.docx' || ext === '.doc') {
    text = await runLocalTool('/usr/bin/textutil', ['-convert', 'txt', '-stdout', selected]);
  } else {
    throw new Error('รองรับเฉพาะ PDF, DOCX, DOC หรือ TXT');
  }

  const cleaned = cleanTorText(text);
  if (!cleaned) throw new Error('ไม่พบข้อความในไฟล์ TOR');
  return {
    path: selected,
    name: path.basename(selected),
    size: stat.size,
    text: cleaned,
    chars: cleaned.length
  };
}
function cleanAiOutput(text) {
  let cleaned = String(text || '').replace(/\x08/g, '');
  const assistantMarker = '<|im_start|>assistant';
  const markerIndex = cleaned.lastIndexOf(assistantMarker);
  if (markerIndex >= 0) cleaned = cleaned.slice(markerIndex + assistantMarker.length);
  return cleaned
    .split('\n')
    .filter(line => {
      const s = line.trim();
      if (!s) return false;
      if (s === '▄▄ ▄▄') return false;
      if (/^[██▀▄█ ]+$/.test(s)) return false;
      if (/^(build|model|ftype|modalities)\s*:/.test(s)) return false;
      if (/^(available commands|\/exit|\/regen|\/clear|\/read|\/glob|Exiting)/.test(s)) return false;
      if (/^\[ Prompt:/.test(s)) return false;
      if (/^Loading model/.test(s)) return false;
      if (/^>\s*</.test(s)) return false;
      if (/^>/.test(s)) return false;
      if (/^[-\\|/ ]+$/.test(s)) return false;
      return true;
    })
    .join('\n')
    .replace(/^[|\\/\- ]+/gm, '')
    .replace(/<\|im_(start|end)\|>.*$/gm, '')
    .trim();
}
// สคีมาบังคับผลลัพธ์ให้เป็น JSON เสมอ (llama-cli --json-schema แปลงเป็น GBNF grammar ให้เอง)
const TOR_JSON_SCHEMA = JSON.stringify({
  type: 'object',
  properties: {
    project:  { type: 'string' },
    client:   { type: 'string' },
    items:    { type: 'array', maxItems: 12, items: {
      type: 'object',
      properties: {
        description: { type: 'string' },
        qty:   { type: 'number' },
        unit:  { type: 'string' },
        price: { type: 'number' }
      },
      required: ['description', 'qty', 'unit', 'price']
    }},
    payment_terms: { type: 'string' },
    installments:  { type: 'array', maxItems: 12, items: {
      type: 'object',
      properties: { label: { type: 'string' }, percent: { type: 'number' } },
      required: ['label', 'percent']
    }},
    delivery:  { type: 'string' },
    questions: { type: 'array', maxItems: 8, items: { type: 'string' } }
  },
  required: ['project', 'client', 'items', 'payment_terms', 'installments', 'delivery', 'questions']
});
function buildTorPrompt(input) {
  return `<|im_start|>system
คุณคือผู้ช่วยออกเอกสารของ BillNgai ทำงานบนเครื่องเท่านั้น
อ่าน TOR หรือรายละเอียดงาน แล้วสรุปเป็น JSON ภาษาไทยสำหรับร่างใบเสนอราคา ตามฟิลด์:
- project: ชื่องานสั้น ๆ
- client: ชื่อลูกค้า/ผู้ว่าจ้าง — ห้ามใช้ชื่อหน่วยงานดำเนินการ/ผู้จัดทำ ถ้าไม่พบชัดเจนให้ใส่ "ต้องถามเพิ่ม"
- items: รายการคิดเงิน แยกเป็นงานย่อยตาม TOR พร้อม qty, unit (เช่น งาน/ชิ้น/เดือน), price เป็นตัวเลขบาท (ไม่พบราคาให้ใส่ 0)
- payment_terms: เงื่อนไขการชำระเงินตาม TOR
- installments: ถ้า TOR แบ่งจ่ายเป็นงวด ให้ใส่ label และ percent ของแต่ละงวด (รวม 100) ถ้าไม่แบ่งให้ใส่ []
- delivery: กำหนดส่งมอบ/ระยะเวลา
- questions: สิ่งที่ควรถามลูกค้าเพิ่มก่อนออกเอกสารจริง
ตอบเป็น JSON เท่านั้น<|im_end|>
<|im_start|>user
${input}<|im_end|>
<|im_start|>assistant
`;
}
// ดึงก้อน JSON จากเอาต์พุตโมเดล (grammar บังคับแล้ว แต่กันเปลือกข้อความ/แบนเนอร์ของ CLI)
function parseTorDraft(stdout) {
  const raw = String(stdout || '').replace(/\x08/g, '');
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  let parsed;
  try { parsed = JSON.parse(raw.slice(start, end + 1)); } catch (e) { return null; }
  const num = v => { const n = Number(v); return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0; };
  const str = v => String(v == null ? '' : v).trim();
  return {
    project: str(parsed.project),
    client: str(parsed.client),
    items: (Array.isArray(parsed.items) ? parsed.items : []).slice(0, 12).map(it => ({
      description: str(it.description),
      qty: num(it.qty) || 1,
      unit: str(it.unit) || 'งาน',
      price: num(it.price)
    })).filter(it => it.description),
    paymentTerms: str(parsed.payment_terms),
    installments: (Array.isArray(parsed.installments) ? parsed.installments : []).slice(0, 12).map(g => ({
      label: str(g.label), percent: num(g.percent)
    })).filter(g => g.label || g.percent),
    delivery: str(parsed.delivery),
    questions: (Array.isArray(parsed.questions) ? parsed.questions : []).slice(0, 8).map(str).filter(Boolean)
  };
}
async function runAiInference(input) {
  const text = String(input || '').trim();
  if (text.length < 8) throw new Error('Please enter TOR text first');
  if (text.length > 12000) throw new Error('TOR text is too long for this prototype');

  const status = await aiStatus();
  if (!status.valid) throw new Error('BillNgai AI Add-on is not installed or not valid');
  const modelPath = findAiModel(status);
  const runner = findAiRunner(status);
  const prompt = buildTorPrompt(cleanTorText(text));   // กัน NUL/control chars จาก PDF ไม่ว่าจะมาทางไฟล์หรือวางเอง
  // ส่ง prompt ผ่านไฟล์ชั่วคราวแทน argv — ยาวแค่ไหนก็ไม่ชน ARG_MAX และไม่พังเพราะอักขระแปลก
  const promptFile = path.join(app.getPath('temp'), 'billngai-tor-' + Date.now() + '.txt');
  await fsp.writeFile(promptFile, prompt, 'utf8');
  const args = [
    '--log-disable',
    '--device', 'none',
    '--no-op-offload',
    '--no-warmup',
    '--single-turn',                    // จบเทิร์นเดียวแล้วออก — ห้ามถอดออก ไม่งั้น CLI ค้างเป็น REPL
    '-m', modelPath,
    '-f', promptFile,
    '-c', '16384',                      // TOR ไทยยาว ๆ เกิน ctx เริ่มต้น 4096 แล้วโมเดลจะ "เงียบ" — ตั้งให้พอเสมอ
    '-n', '900',
    '--temp', '0.2',
    '--json-schema', TOR_JSON_SCHEMA,   // grammar-constrained: ผลลัพธ์เป็น JSON ตามสคีมาเสมอ
    '--no-display-prompt'
  ];

  return await new Promise((resolve, reject) => {
    const child = spawn(runner, args, { shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const cleanup = () => fsp.unlink(promptFile).catch(() => {});
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      cleanup();
      reject(new Error('AI inference timed out'));
    }, 300000);   // TOR ยาว ๆ บนเครื่อง Intel เก่าอาจใช้เวลาหลายนาที
    child.stdout.on('data', chunk => { stdout += chunk.toString('utf8'); });
    child.stderr.on('data', chunk => { stderr += chunk.toString('utf8'); });
    child.on('error', err => {
      clearTimeout(timer);
      cleanup();
      reject(err);
    });
    child.on('close', code => {
      clearTimeout(timer);
      cleanup();
      if (code !== 0) {
        reject(new Error((stderr || stdout || `AI runtime exited with code ${code}`).slice(0, 1200)));
        return;
      }
      const draft = parseTorDraft(stdout);
      const output = cleanAiOutput(stdout);
      if (!draft && !output) {
        // โมเดลไม่พ่นอะไรเลย (เช่น ctx ไม่พอ / โหลดโมเดลล้มเงียบ) — บอกตรง ๆ ดีกว่าโชว์ค่าว่าง
        reject(new Error('โมเดลไม่ตอบกลับ — ลองย่อ TOR ให้สั้นลง (เอาเฉพาะส่วนขอบเขตงานและงบประมาณ) แล้วแปลงใหม่'));
        return;
      }
      resolve({
        ok: true,
        draft,                                // โครงร่างที่พร้อมเปิดในตัวแก้ไขเอกสาร (null ถ้า parse ไม่ได้)
        text: output || stdout.trim(),        // สำรองไว้แสดงดิบ
        model: status.model,
        version: status.version
      });
    });
  });
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

ipcMain.handle('ai:status', async () => aiStatus());

ipcMain.handle('ai:infer', async (_e, input) => runAiInference(input));

ipcMain.handle('ai:importTor', async (_e, filePath) => extractTorText(filePath));

ipcMain.handle('ai:reveal', async () => {
  const status = await aiStatus();
  const dir = status.valid ? status.path : USER_AI_DIR;
  await fsp.mkdir(dir, { recursive: true });
  shell.openPath(dir);
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
    backgroundColor: '#FFF9F3',
    title: 'BillNgai',
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
  migrateFromBilliong();
  buildMenu();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
