const { app, BrowserWindow, ipcMain, dialog, shell, Menu, safeStorage } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const crypto = require('crypto');
const http = require('http');
const { pathToFileURL } = require('url');

app.setName('BillNgai');
const primaryInstance = app.requestSingleInstanceLock();
if (!primaryInstance) app.quit();

let win;
function trustedRenderer(event) {
  return !!(win && !win.isDestroyed() && event && event.sender === win.webContents &&
    event.senderFrame === win.webContents.mainFrame &&
    event.senderFrame.url === pathToFileURL(path.join(__dirname, 'billing.html')).href);
}
function handleIPC(channel, handler) {
  ipcMain.handle(channel, (event, ...args) => {
    if (!trustedRenderer(event)) throw new Error('IPC_UNTRUSTED_SENDER');
    return handler(event, ...args);
  });
}
const USER_DIR     = app.getPath('userData');
const CONFIG_PATH  = path.join(USER_DIR, 'config.json');
const DEFAULT_DATA = path.join(USER_DIR, 'billing.json');
const USER_AI_DIR  = path.join(USER_DIR, 'ai');
const SYSTEM_AI_DIR = process.platform === 'win32'
  ? path.join(process.env.ProgramData || 'C:\\ProgramData', 'BillNgai', 'ai')
  : '/Library/Application Support/BillNgai/ai';
const AI_DIRS      = [USER_AI_DIR, SYSTEM_AI_DIR];
const AI_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAAwXFS9Dak1ag+iOqxPcFJlYKHqqCxeOFzXwpzR3SlJI=
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
  try {
    const cfg = JSON.parse(await fsp.readFile(CONFIG_PATH, 'utf8'));
    if (!cfg || typeof cfg !== 'object' || Array.isArray(cfg) ||
        (cfg.externalPath != null && (typeof cfg.externalPath !== 'string' || !path.isAbsolute(cfg.externalPath)))) {
      throw new Error('DATA_CONFIG_INVALID');
    }
    return cfg;
  } catch (e) {
    if (e.code === 'ENOENT') return { externalPath: null };
    throw new Error('DATA_CONFIG_UNREADABLE', { cause: e });
  }
}
async function writeConfig(cfg) {
  await atomicWrite(CONFIG_PATH, JSON.stringify(cfg, null, 2));
}
async function activePath() {
  const cfg = await readConfig();
  return cfg.externalPath || DEFAULT_DATA;
}
async function atomicWrite(file, text) {
  await fsp.mkdir(path.dirname(file), { recursive: true });
  const tmp = file + '.' + crypto.randomBytes(8).toString('hex') + '.tmp';
  try {
    const handle = await fsp.open(tmp, 'wx');
    try { await handle.writeFile(text, 'utf8'); await handle.sync(); }
    finally { await handle.close(); }
    await fsp.rename(tmp, file);
  } finally { await fsp.unlink(tmp).catch(() => {}); }
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
  const runnerName = process.platform === 'win32' ? 'llama-cli.exe' : 'llama-cli';
  const packagedRunner = path.join(status.path, 'runtime', 'bin', runnerName);
  if (fs.existsSync(packagedRunner)) return packagedRunner;
  const devRunner = process.platform === 'win32'
    ? path.join(process.env.LOCALAPPDATA || '', 'Programs', 'llama.cpp', 'llama-cli.exe')
    : '/opt/homebrew/bin/llama-cli';
  if (!app.isPackaged && devRunner && fs.existsSync(devRunner)) return devRunner;
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
      path.join(USER_AI_DIR, 'runtime', 'bin', process.platform === 'win32' ? 'pdftotext.exe' : 'pdftotext'),
      path.join(SYSTEM_AI_DIR, 'runtime', 'bin', process.platform === 'win32' ? 'pdftotext.exe' : 'pdftotext'),
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
    if (process.platform === 'darwin') {
      text = await runLocalTool('/usr/bin/textutil', ['-convert', 'txt', '-stdout', selected]);
    } else {
      throw new Error('DOC/DOCX import is not available on Windows yet. Please export the TOR as PDF or TXT.');
    }
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
// system prompt แบบข้อความล้วน — llama-cli จะห่อด้วย chat template ของโมเดลเองผ่าน -sysf
// (สลับโมเดล GGUF ได้โดยไม่ต้องแก้โค้ด ไม่ว่าจะเป็น ChatML/Llama/Gemma template)
const TOR_SYSTEM_PROMPT = `คุณคือผู้ช่วยออกเอกสารของ BillNgai ทำงานบนเครื่องเท่านั้น
อ่าน TOR หรือรายละเอียดงาน แล้วสรุปเป็น JSON ภาษาไทยสำหรับร่างใบเสนอราคา ตามฟิลด์:
- project: ชื่องานสั้น ๆ
- client: ชื่อลูกค้า/ผู้ว่าจ้าง — ห้ามใช้ชื่อหน่วยงานดำเนินการ/ผู้จัดทำ ถ้าไม่พบชัดเจนให้ใส่ "ต้องถามเพิ่ม"
- items: รายการคิดเงิน แยกครบทุกรายการย่อยตาม TOR อย่ารวบหลายรายการเป็นข้อเดียว
  แต่ละรายการมี qty, unit (เช่น งาน/ชิ้น/เดือน), price = ราคาต่อหน่วย (ไม่ใช่ยอดรวมของรายการ; ไม่พบราคาให้ใส่ 0)
- payment_terms: เงื่อนไขการชำระเงินตาม TOR
- installments: ถ้า TOR แบ่งจ่ายเป็นงวด ให้ใส่ label และ percent ของแต่ละงวด (รวม 100) ถ้าไม่แบ่งให้ใส่ []
- delivery: กำหนดส่งมอบ/ระยะเวลา
- questions: สิ่งที่ควรถามลูกค้าเพิ่มก่อนออกเอกสารจริง
ตอบเป็น JSON เท่านั้น`;
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
  // ส่งผ่านไฟล์ชั่วคราวแทน argv — ยาวแค่ไหนก็ไม่ชน ARG_MAX และไม่พังเพราะอักขระแปลก
  const stamp = Date.now();
  const sysFile = path.join(app.getPath('temp'), 'billngai-sys-' + stamp + '.txt');
  const promptFile = path.join(app.getPath('temp'), 'billngai-tor-' + stamp + '.txt');
  await fsp.writeFile(sysFile, TOR_SYSTEM_PROMPT, 'utf8');
  await fsp.writeFile(promptFile, cleanTorText(text), 'utf8');   // กัน NUL/control chars จาก PDF ไม่ว่าจะมาทางไฟล์หรือวางเอง
  const args = [
    '--log-disable',
    '--device', 'none',
    '--no-op-offload',
    '--no-warmup',
    '--single-turn',                    // จบเทิร์นเดียวแล้วออก — ห้ามถอดออก ไม่งั้น CLI ค้างเป็น REPL
    '-m', modelPath,
    '-sysf', sysFile,
    '-f', promptFile,
    '-c', '16384',                      // TOR ไทยยาว ๆ เกิน ctx เริ่มต้น 4096 แล้วโมเดลจะ "เงียบ" — ตั้งให้พอเสมอ
    '-n', '900',
    '--temp', '0.2',
    '--json-schema', TOR_JSON_SCHEMA,   // grammar-constrained: ผลลัพธ์เป็น JSON ตามสคีมาเสมอ
    '--no-display-prompt'
  ];

  return await new Promise((resolve, reject) => {
    // detached: true = คนละ session ไม่มี controlling terminal — สำคัญมาก:
    // ถ้ารันแอปจาก Terminal llama-cli จะเปิด /dev/tty แล้วพิมพ์คำตอบลงจอแทน stdout (แอปได้ 0 bytes)
    const child = spawn(runner, args, { shell: false, windowsHide: true, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    const cleanup = () => { fsp.unlink(promptFile).catch(() => {}); fsp.unlink(sysFile).catch(() => {}); };
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
        reject(new Error(`โมเดลไม่ตอบกลับ (fix-299b8df · ได้รับ ${stdout.length} bytes) — ลองย่อ TOR ให้สั้นลงแล้วแปลงใหม่`));
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
const SNAP_KEEP     = 30;
let lastSnap = null;
async function maybeSnapshot(text) {
    // Keep the interval across app restarts; restarting must not rapidly rotate old backups out.
    if (lastSnap === null) {
      await fsp.mkdir(BACKUP_DIR, { recursive: true });
      const names = (await fsp.readdir(BACKUP_DIR)).filter(isAutomaticBackup);
      const times = await Promise.all(names.map(async name => (await fsp.stat(path.join(BACKUP_DIR, name))).mtimeMs));
      lastSnap = Math.min(Date.now(), Math.max(0, ...times));
    }
    if (Date.now() - lastSnap < SNAP_INTERVAL) return;
    await fsp.mkdir(BACKUP_DIR, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    await atomicWrite(path.join(BACKUP_DIR, 'billing-' + stamp + '.json'), text);
    lastSnap = Date.now();
    // ลบวนเฉพาะสแนปช็อตอัตโนมัติ — ไฟล์มีป้ายกำกับ (pre-v2 / pre-restore / manual) เก็บไว้เสมอ
    const files = (await fsp.readdir(BACKUP_DIR))
      .filter(isAutomaticBackup).sort();
    for (const f of files.slice(0, Math.max(0, files.length - SNAP_KEEP))) {
      await fsp.unlink(path.join(BACKUP_DIR, f)).catch(() => {});
    }
}
function isAutomaticBackup(name) { return /^billing-\d{4}-\d{2}-\d{2}T[\d-]+Z?\.json$/.test(name); }
async function snapshotText(text, label) {
  // Content hash avoids overwriting another backup or duplicating the same recovery copy.
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const safe = String(label || 'manual').replace(/[^a-z0-9_-]/gi, '') || 'manual';
  const hash = crypto.createHash('sha256').update(text).digest('hex');
  const name = safe === 'pre-replace' ? 'billing-pre-replace-' + hash + '.json'
    : 'billing-' + safe + '-' + stamp + '-' + crypto.randomBytes(4).toString('hex') + '.json';
  await atomicWrite(path.join(BACKUP_DIR, name), text);
  return name;
}
// สำรองแบบระบุเหตุผล (pre-v2 / pre-restore / manual) — ไฟล์กลุ่มนี้ไม่ถูกลบวนตาม SNAP_KEEP
async function labeledSnapshot(label) {
  const src = await activePath();
  let text;
  try { text = await fsp.readFile(src, 'utf8'); }
  catch (e) { if (e.code === 'ENOENT') return null; throw e; }
  return snapshotText(text, label);
}

/* ---------------- IPC: data ---------------- */
// All reads/replacements/saves share a queue. A renderer may save only to the exact
// store it successfully loaded; a missing Drive file is never treated as first launch.
let dataQueue = Promise.resolve();
let dataSession = null;
let lastSaveError = null;
const DATA_MARKER = path.join(USER_DIR, '.data-initialized');
function withDataLock(action) {
  const result = dataQueue.then(action);
  dataQueue = result.catch(() => {});
  return result;
}
function validateData(text) {
  if (typeof text !== 'string' || Buffer.byteLength(text, 'utf8') > 64 * 1024 * 1024) throw new Error('DATA_INVALID_SIZE');
  let data;
  try { data = JSON.parse(text); } catch (e) { throw new Error('DATA_INVALID_JSON'); }
  if (!data || typeof data !== 'object' || Array.isArray(data) ||
      !data.business || typeof data.business !== 'object' || Array.isArray(data.business) ||
      !Array.isArray(data.documents) || !Array.isArray(data.clients) ||
      (data.recurring != null && !Array.isArray(data.recurring))) throw new Error('DATA_INVALID_SCHEMA');
  const object = value => value && typeof value === 'object' && !Array.isArray(value);
  const invalid = () => { throw new Error('DATA_INVALID_SCHEMA'); };
  const strings = (record, keys) => keys.forEach(key => {
    if (record[key] != null && typeof record[key] !== 'string') invalid();
  });
  const party = record => {
    if (!object(record)) invalid();
    strings(record, ['id','name','businessName','businessNameEn','address','addressEn','taxId','phone','email','contactPerson','notes','docLang','lang','uiLang','yearMode','updatedAt','deletedAt','createdAt']);
    if ('name' in record && typeof record.name !== 'string') invalid();
  };
  const document = record => {
    if (!object(record)) invalid();
    strings(record, ['id','type','number','status','clientId','parentId','paymentId','issueDate','dueDate','paidDate','currency','project','notes','docLang','incomeCategory','updatedAt','deletedAt','createdAt','voidedAt','voidReason','whtCertNo','whtCertDate']);
    for (const key of ['vatRate','whtRate','fxRate']) {
      if (record[key] != null && !((typeof record[key] === 'number' || typeof record[key] === 'string') && Number.isFinite(Number(record[key])))) invalid();
    }
    if (record.items !== undefined) {
      if (!Array.isArray(record.items)) invalid();
      record.items.forEach(item => {
        if (!object(item)) invalid();
        strings(item, ['description','unit']);
        for (const key of ['qty','price']) if (item[key] != null &&
          !((typeof item[key] === 'number' || typeof item[key] === 'string') && Number.isFinite(Number(item[key])))) invalid();
      });
    }
    if (record.milestone != null && !object(record.milestone)) invalid();
  };
  party(data.business);
  if (data.business.numberFormats != null && !object(data.business.numberFormats)) invalid();
  if (data.business.numberFormats) strings(data.business.numberFormats, ['quotation','invoice','receipt','tax_invoice']);
  for (const key of ['meta','counters']) if (data[key] !== undefined && !object(data[key])) invalid();
  for (const key of ['clients','documents','recurring','reviewEvents']) {
    if (data[key] === undefined) continue;
    if (!Array.isArray(data[key])) invalid();
    const ids = new Set();
    for (const record of data[key]) {
      if (!object(record) || typeof record.id !== 'string' || !record.id || ids.has(record.id)) invalid();
      ids.add(record.id);
      if (key === 'documents' && !['quotation','invoice','receipt','tax_invoice'].includes(record.type)) invalid();
    }
  }
  data.clients.forEach(party);
  for (const record of [...data.documents, ...(data.recurring || [])]) {
    document(record);
    const snapshot = record.issuedSnapshot;
    // Missing historical particulars stay missing; validate structure, never invent them.
    if (snapshot != null) {
      if (!object(snapshot)) invalid();
      if (snapshot.document != null) document(snapshot.document);
      if (snapshot.business != null) party(snapshot.business);
      if (snapshot.buyer != null) party(snapshot.buyer);
      if (snapshot.amounts != null) {
        if (!object(snapshot.amounts)) invalid();
        strings(snapshot.amounts, ['currency']);
        for (const key of ['subtotal','vatRate','whtRate','vatAmount','whtAmount','grandTotal','netPayable'])
          if (snapshot.amounts[key] != null && (typeof snapshot.amounts[key] !== 'number' || !Number.isFinite(snapshot.amounts[key]))) invalid();
      }
    }
  }
  for (const event of data.reviewEvents || []) {
    strings(event, ['documentId','type','recordedAt','note','paymentId','paidDate','currency','vatStatus']);
    if (!event.documentId || !event.type || !event.recordedAt) invalid();
    if (event.evidence !== undefined) {
      if (!Array.isArray(event.evidence)) invalid();
      for (const evidence of event.evidence) {
        if (!object(evidence) || typeof evidence.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(evidence.sha256)) invalid();
        strings(evidence, ['fileName','mime','attachedAt']);
        if (evidence.size != null && (!Number.isInteger(evidence.size) || evidence.size < 1 || evidence.size > 20 * 1024 * 1024)) invalid();
      }
    }
    for (const key of ['issuer','buyer']) if (event[key] !== undefined) party(event[key]);
    if (event.sourceRecordAtReview !== undefined) document(event.sourceRecordAtReview);
    if (event.type === 'legacy_payment') {
      if (!event.paymentId || !event.paidDate || !event.currency || !object(event.issuer) || !object(event.buyer) ||
          typeof event.fullPaymentConfirmed !== 'boolean' || typeof event.historicalVatConfirmed !== 'boolean' ||
          !['gross','wht','net'].every(key => typeof event[key] === 'number' && Number.isFinite(event[key]))) invalid();
    }
  }
  return data;
}
async function preserveBefore204(file, text) {
  const sourceHash = crypto.createHash('sha256').update(file).digest('hex');
  const marker = path.join(USER_DIR, '.pre-2.0.4-' + sourceHash);
  const existing = await readDataFile(marker);
  if (existing) {
    if (!/^billing-pre-2\.0\.4-[a-f0-9]{64}-[a-f0-9]{64}\.json$/.test(existing)) throw new Error('DATA_PRESERVATION_INVALID');
    const original = await fsp.readFile(path.join(BACKUP_DIR, existing), 'utf8');
    if (crypto.createHash('sha256').update(original).digest('hex') !== existing.slice(-69, -5)) throw new Error('DATA_PRESERVATION_INVALID');
    return;
  }
  const hash = crypto.createHash('sha256').update(text).digest('hex');
  const name = 'billing-pre-2.0.4-' + sourceHash + '-' + hash + '.json';
  await atomicWrite(path.join(BACKUP_DIR, name), text);
  if (await fsp.readFile(path.join(BACKUP_DIR, name), 'utf8') !== text) throw new Error('DATA_PRESERVATION_INVALID');
  await atomicWrite(marker, name);
}
async function readDataFile(file) {
  try { return await fsp.readFile(file, 'utf8'); }
  catch (e) { if (e.code === 'ENOENT') return null; throw e; }
}
async function hasDataHistory() {
  if (await readDataFile(DATA_MARKER) !== null) return true;
  for (const dir of [BACKUP_DIR, path.join(USER_DIR, 'journal')]) {
    try { if ((await fsp.readdir(dir)).some(name => /\.(json|ndjson)$/.test(name))) return true; }
    catch (e) { if (e.code !== 'ENOENT') throw e; }
  }
  return false;
}
async function markDataInitialized() {
  if (await readDataFile(DATA_MARKER) === null) await atomicWrite(DATA_MARKER, '1');
}
async function loadData() {
  dataSession = null;
  const cfg = await readConfig();
  const file = cfg.externalPath || DEFAULT_DATA;
  const text = await readDataFile(file);
  if (text === null) {
    if (cfg.externalPath || await hasDataHistory()) throw new Error('DATA_MISSING');
  } else {
    validateData(text);
    await preserveBefore204(file, text);
    await markDataInitialized();
  }
  dataSession = { file, text };
  return text;
}
async function currentSession() {
  if (!dataSession) throw new Error('DATA_NOT_LOADED');
  const file = await activePath();
  if (file !== dataSession.file || await readDataFile(file) !== dataSession.text) {
    dataSession = null;
    throw new Error('DATA_CHANGED_ON_DISK');
  }
  return dataSession;
}
async function saveData(text) {
  const next = validateData(text);
  const session = await currentSession();
  if (session.text !== null) {
    await preserveBefore204(session.file, session.text);
    const prev = validateData(session.text);
    if (['documents', 'clients', 'recurring'].some(key => (prev[key] || []).length > (next[key] || []).length)) {
      await snapshotText(session.text, 'pre-replace');
    }
    // A due rolling snapshot preserves old contents BEFORE replacement.
    await maybeSnapshot(session.text);
  } else { await maybeSnapshot(text); }
  await markDataInitialized();
  await currentSession(); // Recheck after backup I/O, before replacing a Drive-managed file.
  await atomicWrite(session.file, text);
  session.text = text;
  return true;
}
async function recoverData(text) {
  validateData(text); // Validate selected recovery data before touching the current file.
  const cfg = await readConfig();
  const file = cfg.externalPath || DEFAULT_DATA;
  // Recovery must not recreate an absent Drive mount as an ordinary local directory.
  if (cfg.externalPath && !(await fsp.stat(path.dirname(file))).isDirectory()) throw new Error('DATA_MISSING');
  const previous = await readDataFile(file);
  if (previous !== null) await snapshotText(previous, 'pre-restore');
  await markDataInitialized();
  await atomicWrite(file, text);
  dataSession = { file, text };
  return true;
}
handleIPC('data:load', () => withDataLock(loadData));
handleIPC('data:save', (_e, text) => withDataLock(async () => {
  try { const result = await saveData(text); lastSaveError = null; return result; }
  catch (error) { lastSaveError = error; throw error; }
}));
// Explicit import/cloud restore only; ordinary autosaves cannot clear a failed-load lock.
handleIPC('data:recover', (_e, text) => withDataLock(async () => {
  const result = await recoverData(text); lastSaveError = null; return result;
}));


handleIPC('data:revealBackups', async () => {
  await fsp.mkdir(BACKUP_DIR, { recursive: true });
  shell.openPath(BACKUP_DIR);
});

/* ---------------- IPC: schema v2 — device id, change journal, backups ---------------- */
// device id อยู่ใน config.json (ประจำเครื่อง ไม่ปนไปกับข้อมูลที่จะ sync)
handleIPC('device:id', () => withDataLock(async () => {
  const cfg = await readConfig();
  if (!cfg.deviceId) { cfg.deviceId = crypto.randomBytes(4).toString('hex'); await writeConfig(cfg); }
  return cfg.deviceId;
}));

// change journal: NDJSON แยกไฟล์รายเดือน — ฐานของ Google Drive sync (Pro) ในเฟสถัดไป
const JOURNAL_DIR = path.join(USER_DIR, 'journal');
handleIPC('journal:append', async (_e, lines) => {
  if (!lines || typeof lines !== 'string') return false;
  const d = new Date(); // เดือนตามเวลาท้องถิ่น (ไทย UTC+7) — ห้ามใช้ toISOString()
  const month = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  await fsp.mkdir(JOURNAL_DIR, { recursive: true });
  await fsp.appendFile(path.join(JOURNAL_DIR, 'journal-' + month + '.ndjson'),
    lines.endsWith('\n') ? lines : lines + '\n', 'utf8');
  return true;
});

handleIPC('backups:list', async () => {
  try {
    await fsp.mkdir(BACKUP_DIR, { recursive: true });
    const names = (await fsp.readdir(BACKUP_DIR)).filter(f => /^billing-.*\.json$/.test(f));
    const out = [];
    for (const name of names) {
      const file = path.join(BACKUP_DIR, name);
      const stat = await fsp.stat(file);
      let docCount = null;
      try {
        const j = JSON.parse(await fsp.readFile(file, 'utf8'));
        if (Array.isArray(j.documents)) docCount = j.documents.length;
      } catch (e) { /* นับไม่ได้ก็ยังแสดงไฟล์ให้เห็น */ }
      out.push({ name, size: stat.size, mtime: stat.mtime.toISOString(), docCount });
    }
    return out.sort((a, b) => b.mtime.localeCompare(a.mtime)).slice(0, 60);
  } catch (e) { return []; }
});

handleIPC('backups:snapshot', (_e, label) => withDataLock(() => labeledSnapshot(label)));

handleIPC('backups:restore', (_e, name) => withDataLock(async () => {
  if (!/^billing-[A-Za-z0-9._-]+\.json$/.test(String(name || ''))) throw new Error('invalid backup name');
  const text = await fsp.readFile(path.join(BACKUP_DIR, name), 'utf8');
  await recoverData(text);
  lastSaveError = null;
  return text;
}));

/* Evidence is selected explicitly, retained byte-for-byte, and never injected
   into the renderer. A hash identifies bytes, not authenticity or legal validity. */
const EVIDENCE_DIR = path.join(USER_DIR, 'evidence');
const EVIDENCE_LIMIT = 20 * 1024 * 1024;
function evidencePath(hash) {
  if (typeof hash !== 'string' || !/^[a-f0-9]{64}$/.test(hash)) throw new Error('EVIDENCE_INVALID_HASH');
  return path.join(EVIDENCE_DIR, hash + '.bin');
}
function evidenceMime(bytes) {
  if (bytes.subarray(0, 5).toString('ascii') === '%PDF-') return 'application/pdf';
  if (bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return 'image/png';
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg';
  throw new Error('EVIDENCE_UNSUPPORTED_TYPE');
}
async function readEvidenceBytes(file, limit = EVIDENCE_LIMIT) {
  const handle = await fsp.open(file, 'r');
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size < 1 || stat.size > limit) throw new Error('EVIDENCE_INVALID_SIZE');
    const bytes = Buffer.alloc(stat.size + 1);
    let length = 0;
    while (length < bytes.length) {
      const result = await handle.read(bytes, length, bytes.length - length, null);
      if (!result.bytesRead) break;
      length += result.bytesRead;
    }
    if (length !== stat.size) throw new Error('EVIDENCE_CHANGED_DURING_READ');
    return bytes.subarray(0, length);
  } finally { await handle.close(); }
}
async function verifiedEvidence(hash) {
  const bytes = await readEvidenceBytes(evidencePath(hash));
  if (crypto.createHash('sha256').update(bytes).digest('hex') !== hash) throw new Error('EVIDENCE_HASH_MISMATCH');
  return { bytes, mime: evidenceMime(bytes) };
}
async function storeEvidence(hash, bytes) {
  await fsp.mkdir(EVIDENCE_DIR, { recursive: true });
  let handle;
  try {
    handle = await fsp.open(evidencePath(hash), 'wx', 0o600);
    await handle.writeFile(bytes); await handle.sync();
  } catch (error) { if (error.code !== 'EEXIST') throw error; }
  finally { if (handle) await handle.close(); }
  await verifiedEvidence(hash);
}
async function protectedEvidenceExport(file) {
  const destination = path.join(await fsp.realpath(path.dirname(file)), path.basename(file));
  const relative = path.relative(await fsp.realpath(USER_DIR), destination);
  if (relative === '' || (!relative.startsWith('..' + path.sep) && !path.isAbsolute(relative))) throw new Error('EVIDENCE_PROTECTED_DESTINATION');
  const store = await activePath();
  const storePath = path.join(await fsp.realpath(path.dirname(store)), path.basename(store));
  if (destination === storePath) throw new Error('EVIDENCE_PROTECTED_DESTINATION');
}
handleIPC('evidence:attach', async () => {
  const selected = await dialog.showOpenDialog(win, {
    title: 'เลือกไฟล์ต้นฉบับ / Attach original evidence', properties: ['openFile'],
    filters: [{ name: 'PDF / PNG / JPEG (20 MB)', extensions: ['pdf','png','jpg','jpeg'] }]
  });
  if (selected.canceled || !selected.filePaths.length) return null;
  const file = selected.filePaths[0], bytes = await readEvidenceBytes(file);
  const mime = evidenceMime(bytes), sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
  await storeEvidence(sha256, bytes);
  return { schemaVersion: 1, sha256, fileName: path.basename(file), mime, size: bytes.length, attachedAt: new Date().toISOString() };
});
handleIPC('evidence:info', async (_event, hash) => {
  evidencePath(hash);
  try {
    const { bytes, mime } = await verifiedEvidence(hash);
    return { sha256: hash, size: bytes.length, mime, available: true };
  } catch (error) {
    if (error.code === 'ENOENT') return { sha256: hash, available: false };
    throw error;
  }
});
handleIPC('evidence:export', async (_event, hash) => {
  const { bytes, mime } = await verifiedEvidence(hash);
  const extension = mime === 'application/pdf' ? 'pdf' : mime === 'image/png' ? 'png' : 'jpg';
  const selected = await dialog.showSaveDialog(win, {
    title: 'ส่งออกไฟล์ต้นฉบับ / Export original evidence',
    defaultPath: path.join(app.getPath('documents'), 'evidence-' + hash + '.' + extension),
    filters: [{ name: 'Original evidence', extensions: [extension] }]
  });
  if (selected.canceled || !selected.filePath) return null;
  // Never permit a save dialog to overwrite the app's immutable evidence store.
  await protectedEvidenceExport(selected.filePath);
  await atomicWrite(selected.filePath, bytes);
  const output = await fsp.readFile(selected.filePath);
  if (!output.equals(bytes)) throw new Error('EVIDENCE_EXPORT_VERIFY_FAILED');
  return { sha256: hash, size: bytes.length, exported: true };
});
const EVIDENCE_BUNDLE_LIMIT = 64 * 1024 * 1024;
handleIPC('evidence:exportBundle', async (_event, hashes) => {
  if (!Array.isArray(hashes) || hashes.length > 1000 || hashes.some(hash => typeof hash !== 'string')) throw new Error('EVIDENCE_INVALID_MANIFEST');
  const files = []; let total = 0;
  for (const hash of new Set(hashes)) {
    const { bytes, mime } = await verifiedEvidence(hash);
    total += bytes.length;
    if (total > 40 * 1024 * 1024) throw new Error('EVIDENCE_BUNDLE_TOO_LARGE');
    files.push({ sha256: hash, mime, size: bytes.length, base64: bytes.toString('base64') });
  }
  const selected = await dialog.showSaveDialog(win, {
    title: 'สำรองไฟล์หลักฐาน / Back up evidence files',
    defaultPath: path.join(app.getPath('documents'), 'BillNgai-evidence-bundle.json'),
    filters: [{ name: 'Evidence bundle JSON', extensions: ['json'] }]
  });
  if (selected.canceled || !selected.filePath) return null;
  await protectedEvidenceExport(selected.filePath);
  const text = JSON.stringify({ schemaVersion: 1, purpose: 'billngai-evidence-bundle', createdAt: new Date().toISOString(), files });
  await atomicWrite(selected.filePath, text);
  if (await fsp.readFile(selected.filePath, 'utf8') !== text) throw new Error('EVIDENCE_EXPORT_VERIFY_FAILED');
  return { exported: true, count: files.length };
});
handleIPC('evidence:importBundle', async () => {
  const selected = await dialog.showOpenDialog(win, {
    title: 'กู้คืนไฟล์หลักฐาน / Restore evidence files', properties: ['openFile'],
    filters: [{ name: 'Evidence bundle JSON', extensions: ['json'] }]
  });
  if (selected.canceled || !selected.filePaths.length) return null;
  const bundle = JSON.parse((await readEvidenceBytes(selected.filePaths[0], EVIDENCE_BUNDLE_LIMIT)).toString('utf8'));
  if (!bundle || bundle.schemaVersion !== 1 || bundle.purpose !== 'billngai-evidence-bundle' || !Array.isArray(bundle.files) || bundle.files.length > 1000) throw new Error('EVIDENCE_INVALID_MANIFEST');
  const files = [], seen = new Set(); let total = 0;
  // Verify every entry and every existing destination BEFORE creating any copy.
  for (const file of bundle.files) {
    if (!file || typeof file.base64 !== 'string') throw new Error('EVIDENCE_INVALID_MANIFEST');
    evidencePath(file.sha256);
    if (seen.has(file.sha256)) throw new Error('EVIDENCE_INVALID_MANIFEST');
    seen.add(file.sha256);
    if (file.base64.length > Math.ceil(EVIDENCE_LIMIT / 3) * 4) throw new Error('EVIDENCE_INVALID_SIZE');
    const bytes = Buffer.from(file.base64, 'base64'); total += bytes.length;
    if (!bytes.length || bytes.length > EVIDENCE_LIMIT || total > 40 * 1024 * 1024) throw new Error('EVIDENCE_INVALID_SIZE');
    if (bytes.toString('base64') !== file.base64 || file.size !== bytes.length || evidenceMime(bytes) !== file.mime || crypto.createHash('sha256').update(bytes).digest('hex') !== file.sha256) throw new Error('EVIDENCE_HASH_MISMATCH');
    try { await verifiedEvidence(file.sha256); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    files.push({ sha256: file.sha256, mime: file.mime, size: file.size, bytes });
  }
  for (const file of files) await storeEvidence(file.sha256, file.bytes);
  return { imported: true, files: files.map(({ sha256, mime, size }) => ({ sha256, mime, size })) };
});

/* ---------------- BillNgai Pro — license (Phase E) ----------------
   รหัส Pro = base64(payload).base64(signature) เซ็น Ed25519 ด้วยคีย์เดียวกับ AI add-on
   ตรวจออฟไลน์ทั้งหมด — ไม่มีเซิร์ฟเวอร์ ไม่ส่งอะไรออกจากเครื่อง (สร้างรหัสด้วย scripts/make-license.js) */
function parseLicenseKey(key) {
  try {
    const [p, s] = String(key || '').trim().split('.');
    const payload = JSON.parse(Buffer.from(p, 'base64').toString('utf8'));
    if (payload.license !== 'billngai-pro') return null;
    const ok = crypto.verify(
      null,
      Buffer.from(canonicalJson(payload)),
      crypto.createPublicKey(AI_PUBLIC_KEY),
      Buffer.from(s, 'base64')
    );
    return ok ? payload : null;
  } catch (e) { return null; }
}
function licenseStatusOf(cfg) {
  const payload = parseLicenseKey(cfg.licenseKey);
  if (!payload) return { valid: false };
  const today = new Date();
  const todayStr = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
  const expired = !!(payload.validUntil && payload.validUntil < todayStr);
  return { valid: !expired, expired, email: payload.email || '', plan: payload.plan || 'pro', validUntil: payload.validUntil || null };
}
handleIPC('license:status', async () => licenseStatusOf(await readConfig()));
handleIPC('license:activate', (_e, key) => withDataLock(async () => {
  if (!parseLicenseKey(key)) throw new Error('invalid license key');
  const cfg = await readConfig();
  cfg.licenseKey = String(key).trim();
  await writeConfig(cfg);
  return licenseStatusOf(cfg);
}));
handleIPC('license:deactivate', () => withDataLock(async () => {
  const cfg = await readConfig();
  delete cfg.licenseKey;
  await writeConfig(cfg);
  return { valid: false };
}));

/* ---------------- Google Drive Workspace Sync (Pro, Phase D) ----------------
   main = transport เท่านั้น (OAuth, อัปโหลด/ดาวน์โหลด) — ตรรกะ merge อยู่ฝั่ง renderer ที่ถือ DB
   ข้อมูล sync ทั้งหมดอยู่ใน Drive ของผู้ใช้เอง (scope drive.file = เห็นเฉพาะไฟล์ที่แอปสร้าง) */
// client id/secret ของ OAuth แบบ "Desktop app" ไม่ถือเป็นความลับ (นโยบาย Google สำหรับ installed apps)
// ลำดับการโหลด: env (override) → secrets/gdrive-oauth.json (ไฟล์ที่ดาวน์โหลดจาก Google Cloud Console
// ทั้งไฟล์ — git-ignored แต่ถูกแพ็กเข้า DMG ผ่าน build.files เพื่อให้เครื่องลูกค้าใช้ sync ได้)
function loadGoogleOAuthClient() {
  if (process.env.BILLNGAI_GDRIVE_CLIENT_ID) {
    return { id: process.env.BILLNGAI_GDRIVE_CLIENT_ID, secret: process.env.BILLNGAI_GDRIVE_CLIENT_SECRET || '' };
  }
  try {
    const j = JSON.parse(fs.readFileSync(path.join(__dirname, 'secrets', 'gdrive-oauth.json'), 'utf8'));
    const c = j.installed || j.web || j;
    return { id: c.client_id || '', secret: c.client_secret || '' };
  } catch (e) { return { id: '', secret: '' }; }
}
const GOOGLE_OAUTH = loadGoogleOAuthClient();
const GOOGLE_CLIENT_ID = GOOGLE_OAUTH.id;
const GOOGLE_CLIENT_SECRET = GOOGLE_OAUTH.secret;
const GDRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const SYNC_STATE_PATH = path.join(USER_DIR, 'sync.json');
const TOKENS_PATH = path.join(USER_DIR, 'sync-tokens.bin');

async function readSyncState() { try { return JSON.parse(await fsp.readFile(SYNC_STATE_PATH, 'utf8')); } catch (e) { return {}; } }
async function writeSyncState(st) { await fsp.writeFile(SYNC_STATE_PATH, JSON.stringify(st, null, 2), 'utf8'); }

// token เก็บผ่าน safeStorage (Keychain) — ไม่อยู่ใน billing.json และไม่ sync
async function saveTokens(tokens) {
  const raw = JSON.stringify(tokens);
  const buf = safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(raw) : Buffer.from(raw, 'utf8');
  await fsp.writeFile(TOKENS_PATH, buf);
}
async function loadTokens() {
  try {
    const buf = await fsp.readFile(TOKENS_PATH);
    const raw = safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(buf) : buf.toString('utf8');
    return JSON.parse(raw);
  } catch (e) { return null; }
}
async function clearTokens() { await fsp.unlink(TOKENS_PATH).catch(() => {}); }

function b64url(buf) { return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
async function tokenRequest(params) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params)
  });
  const j = await res.json();
  if (!res.ok) throw new Error(j.error_description || j.error || 'token request failed');
  return j;
}
// PKCE + loopback: เปิดเบราว์เซอร์ระบบให้ล็อกอิน แล้วรับ code กลับทาง 127.0.0.1 พอร์ตสุ่ม
async function oauthConnect() {
  if (!GOOGLE_CLIENT_ID) throw new Error('Google OAuth client is not configured in this build');
  const verifier = b64url(crypto.randomBytes(32));
  const challenge = b64url(crypto.createHash('sha256').update(verifier).digest());
  const state = b64url(crypto.randomBytes(16));
  let redirectUri = '';
  const code = await new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      let u; try { u = new URL(req.url, 'http://127.0.0.1'); } catch (e) { res.end(); return; }
      if (u.pathname !== '/callback') { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<body style="font-family:sans-serif;text-align:center;padding-top:80px">เชื่อมต่อสำเร็จ — กลับไปที่แอป BillNgai ได้เลย<br>Connected — you can return to BillNgai now.</body>');
      clearTimeout(timer); server.close();
      if (u.searchParams.get('state') !== state) reject(new Error('OAuth state mismatch'));
      else if (u.searchParams.get('code')) resolve(u.searchParams.get('code'));
      else reject(new Error(u.searchParams.get('error') || 'sign-in was cancelled'));
    });
    const timer = setTimeout(() => { server.close(); reject(new Error('sign-in timed out')); }, 5 * 60 * 1000);
    server.listen(0, '127.0.0.1', () => {
      redirectUri = 'http://127.0.0.1:' + server.address().port + '/callback';
      shell.openExternal('https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID, redirect_uri: redirectUri, response_type: 'code',
        scope: GDRIVE_SCOPE + ' email', access_type: 'offline', prompt: 'consent',
        code_challenge: challenge, code_challenge_method: 'S256', state
      }));
    });
  });
  const j = await tokenRequest({
    grant_type: 'authorization_code', code, client_id: GOOGLE_CLIENT_ID,
    ...(GOOGLE_CLIENT_SECRET ? { client_secret: GOOGLE_CLIENT_SECRET } : {}),
    redirect_uri: redirectUri, code_verifier: verifier
  });
  let email = '';
  try { email = JSON.parse(Buffer.from(j.id_token.split('.')[1], 'base64').toString('utf8')).email || ''; } catch (e) {}
  await saveTokens({ access_token: j.access_token, refresh_token: j.refresh_token, expiry: Date.now() + (j.expires_in || 3600) * 1000, email });
}
async function refreshTokens() {
  const t = await loadTokens();
  if (!t || !t.refresh_token) throw new Error('not connected to Google Drive');
  const j = await tokenRequest({
    grant_type: 'refresh_token', refresh_token: t.refresh_token, client_id: GOOGLE_CLIENT_ID,
    ...(GOOGLE_CLIENT_SECRET ? { client_secret: GOOGLE_CLIENT_SECRET } : {})
  });
  const nt = { ...t, access_token: j.access_token, expiry: Date.now() + (j.expires_in || 3600) * 1000 };
  await saveTokens(nt);
  return nt;
}
async function accessToken() {
  let t = await loadTokens();
  if (!t) throw new Error('not connected to Google Drive');
  if (!t.access_token || Date.now() > (t.expiry || 0) - 60000) t = await refreshTokens();
  return t.access_token;
}

/* ---- Drive REST helpers ---- */
async function driveFetch(url, opts = {}, retry = true) {
  const token = await accessToken();
  const res = await fetch(url, { ...opts, headers: { ...(opts.headers || {}), Authorization: 'Bearer ' + token } });
  if (res.status === 401 && retry) { await refreshTokens(); return driveFetch(url, opts, false); }
  if (!res.ok) throw new Error('Drive API ' + res.status + ': ' + (await res.text()).slice(0, 300));
  return res;
}
async function driveList(q) {
  const url = 'https://www.googleapis.com/drive/v3/files?' + new URLSearchParams({
    q, fields: 'files(id,name,size,modifiedTime,createdTime)', pageSize: '1000', spaces: 'drive'
  });
  return ((await (await driveFetch(url)).json()).files) || [];
}
async function driveFindOne(name, parentId) {
  const files = await driveList(`name='${name.replace(/'/g, "\\'")}' and '${parentId}' in parents and trashed=false`);
  return files[0] || null;
}
async function findOrCreateFolder(name, parentId) {
  const q = `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false` + (parentId ? ` and '${parentId}' in parents` : '');
  const found = await driveList(q);
  // Drive อนุญาตโฟลเดอร์ชื่อซ้ำ — สองเครื่องอาจสร้าง 'BillNgai' คนละใบตอนเชื่อมต่อไล่เลี่ยกัน
  // เลือก "ใบที่เก่าที่สุด" เสมอ → ทุกเครื่องบรรจบที่โฟลเดอร์เดียวกันแบบ deterministic
  if (found.length) {
    return found.sort((a, b) => String(a.createdTime || '').localeCompare(String(b.createdTime || '')))[0].id;
  }
  const res = await driveFetch('https://www.googleapis.com/drive/v3/files?fields=id', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', ...(parentId ? { parents: [parentId] } : {}) })
  });
  return (await res.json()).id;
}
async function driveUpload(name, parentId, content, fileId) {
  const boundary = 'billngai' + crypto.randomBytes(8).toString('hex');
  const meta = fileId ? {} : { name, parents: [parentId] };
  const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n--${boundary}\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n${content}\r\n--${boundary}--`;
  const url = 'https://www.googleapis.com/upload/drive/v3/files' + (fileId ? '/' + fileId : '') + '?uploadType=multipart&fields=id';
  const res = await driveFetch(url, { method: fileId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'multipart/related; boundary=' + boundary }, body });
  return (await res.json()).id;
}
async function driveDownloadText(fileId) {
  return await (await driveFetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`)).text();
}

/* ---- workspace (โฟลเดอร์ BillNgai ใน Drive ของผู้ใช้) ---- */
async function ensureWorkspace() {
  const st = await readSyncState();
  st.folders = st.folders || {};
  if (!st.folders.root) {
    st.folders.root = await findOrCreateFolder('BillNgai', null);
    st.folders.snapshots = await findOrCreateFolder('snapshots', st.folders.root);
    st.folders.events = await findOrCreateFolder('events', st.folders.root);
  }
  if (!st.folders.eventsDevice) {
    const cfg = await readConfig();
    st.folders.eventsDevice = await findOrCreateFolder(cfg.deviceId || 'device', st.folders.events);
  }
  await writeSyncState(st);
  return st;
}
// ทะเบียนเครื่องใน workspace.json — ของเสริม พังได้โดยไม่กระทบการ sync ข้อมูลจริง
async function beatDevice(st, name) {
  try {
    const cfg = await readConfig();
    let wsFile = st.workspaceFileId ? { id: st.workspaceFileId } : await driveFindOne('workspace.json', st.folders.root);
    let meta = {};
    if (wsFile) { try { meta = JSON.parse(await driveDownloadText(wsFile.id)); } catch (e) {} }
    meta.app = 'BillNgai'; meta.schema = 2;
    meta.devices = meta.devices || {};
    const d = meta.devices[cfg.deviceId] || { firstSeen: new Date().toISOString() };
    if (name) d.name = name;
    d.platform = process.platform;
    d.lastSeen = new Date().toISOString();
    meta.devices[cfg.deviceId] = d;
    st.workspaceFileId = await driveUpload('workspace.json', st.folders.root, JSON.stringify(meta, null, 2), wsFile && wsFile.id);
    st.devices = Object.entries(meta.devices).map(([id, v]) => ({ id, ...v }));
    st.lastBeatAt = Date.now();
  } catch (e) { console.warn('device registry skipped', e.message); }
}

async function syncStatusInfo() {
  const st = await readSyncState();
  const tokens = await loadTokens();
  const cfg = await readConfig();
  return {
    configured: !!GOOGLE_CLIENT_ID,
    connected: !!(tokens && tokens.refresh_token),
    email: (tokens && tokens.email) || '',
    lastSyncAt: st.lastSyncAt || null,
    deviceId: cfg.deviceId || '',
    devices: st.devices || []
  };
}

handleIPC('sync:status', async () => syncStatusInfo());
// Safety-release boundary: renderer controls are not sufficient IPC protection.
// Do not resume until persisted conflict history and offline numbering are verified.
function requireCloudSyncEnabled() { throw new Error('CLOUD_SYNC_PAUSED_2_0_3'); }
handleIPC('sync:connect', async (_e, deviceName) => {
  requireCloudSyncEnabled();
  await oauthConnect();
  const st = await ensureWorkspace();
  await beatDevice(st, String(deviceName || '').slice(0, 60));
  await writeSyncState(st);
  return syncStatusInfo();
});
handleIPC('sync:disconnect', async () => {
  await clearTokens();
  await fsp.unlink(SYNC_STATE_PATH).catch(() => {});   // cursor/โฟลเดอร์เก่าอาจเป็นของอีกบัญชี — เริ่มใหม่
  return syncStatusInfo();
});

// push: อัปโหลด journal รายเดือนของเครื่องนี้ (เฉพาะเดือนล่าสุด 2 ไฟล์ — ไฟล์เก่ากว่านั้นนิ่งแล้ว)
handleIPC('sync:push', async () => {
  requireCloudSyncEnabled();
  const st = await ensureWorkspace();
  st.uploads = st.uploads || {}; st.remoteFiles = st.remoteFiles || {};
  let uploaded = 0;   // นับไฟล์ที่ส่งขึ้นจริง — ให้ UI บอกได้ว่า sync รอบนี้ทำอะไรไปบ้าง
  const names = (await fsp.readdir(JOURNAL_DIR).catch(() => [])).filter(f => /\.ndjson$/.test(f)).sort().slice(-2);
  for (const name of names) {
    const text = await fsp.readFile(path.join(JOURNAL_DIR, name), 'utf8');
    const bytes = Buffer.byteLength(text, 'utf8');
    if ((st.uploads[name] || 0) === bytes) continue;   // ไม่มี event ใหม่
    let fileId = st.remoteFiles[name];
    if (!fileId) { const found = await driveFindOne(name, st.folders.eventsDevice); fileId = found && found.id; }
    st.remoteFiles[name] = await driveUpload(name, st.folders.eventsDevice, text, fileId);
    st.uploads[name] = bytes;
    uploaded++;
  }
  if (!st.lastBeatAt || Date.now() - st.lastBeatAt > 20 * 3600 * 1000) await beatDevice(st);
  st.lastSyncAt = new Date().toISOString();
  await writeSyncState(st);
  return { uploaded };
});

// pull: อ่าน event ใหม่จากเครื่องอื่น (cursor = จำนวนไบต์ที่อ่านแล้วต่อไฟล์ — ไฟล์เป็น append-only)
handleIPC('sync:pull', async () => {
  requireCloudSyncEnabled();
  const st = await ensureWorkspace();
  const cfg = await readConfig();
  st.cursors = st.cursors || {};
  const newCursors = {};
  const events = [];
  const devFolders = await driveList(`'${st.folders.events}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`);
  for (const df of devFolders) {
    if (df.name === cfg.deviceId) continue;
    const files = await driveList(`'${df.id}' in parents and trashed=false`);
    for (const f of files.sort((a, b) => a.name.localeCompare(b.name))) {
      const done = st.cursors[f.id] || 0;
      if (Number(f.size || 0) <= done) continue;
      const buf = Buffer.from(await driveDownloadText(f.id), 'utf8');
      for (const line of buf.slice(done).toString('utf8').split('\n')) {
        const s = line.trim(); if (!s) continue;
        try { events.push(JSON.parse(s)); } catch (e) { /* บรรทัดเสีย — ข้าม */ }
      }
      newCursors[f.id] = buf.length;
    }
  }
  const wantSnapshot = !st.lastSnapshotAt || (Date.now() - new Date(st.lastSnapshotAt).getTime()) > 7 * 86400000;
  return { events, lastPullAt: st.lastPullAt || '', cursors: newCursors, wantSnapshot };
});
// commit หลัง renderer merge+บันทึกสำเร็จเท่านั้น — pull ล้มเหลวแล้ว event ไม่หาย
handleIPC('sync:commitPull', async (_e, cursors) => {
  requireCloudSyncEnabled();
  const st = await readSyncState();
  st.cursors = { ...(st.cursors || {}), ...(cursors || {}) };
  st.lastPullAt = new Date().toISOString();
  st.lastSyncAt = st.lastPullAt;
  await writeSyncState(st);
  return true;
});

handleIPC('sync:snapshot', async (_e, text) => {
  requireCloudSyncEnabled();
  // กันชั้นที่สอง (นอกจาก renderer): สแนปช็อตว่างห้ามขึ้น Drive ไม่ว่ามาจาก build ไหน
  try {
    const j = JSON.parse(text);
    if (!(j.documents || []).length && !(j.clients || []).length) return false;
  } catch (e) { return false; }
  const st = await ensureWorkspace();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  await driveUpload('snapshot-' + stamp + '.json', st.folders.snapshots, text);
  const snaps = (await driveList(`'${st.folders.snapshots}' in parents and trashed=false`)).sort((a, b) => b.name.localeCompare(a.name));
  for (const s of snaps.slice(10)) {
    await driveFetch('https://www.googleapis.com/drive/v3/files/' + s.id, { method: 'DELETE' }).catch(() => {});
  }
  st.lastSnapshotAt = new Date().toISOString();
  await writeSyncState(st);
  return true;
});

// เครื่องใหม่: สแนปช็อตล่าสุด + event ทั้งหมด (renderer เอาไป migrate + replay)
handleIPC('sync:restore', async () => {
  requireCloudSyncEnabled();
  const st = await ensureWorkspace();
  const snaps = (await driveList(`'${st.folders.snapshots}' in parents and trashed=false`)).sort((a, b) => b.name.localeCompare(a.name));
  if (!snaps.length) return null;
  // เลือกสแนปช็อตที่ "ข้อมูลเยอะที่สุด" (เอกสาร+ลูกค้า) — เวลาอย่างเดียวไว้ใจไม่ได้:
  // เครื่องทดสอบ/เครื่องใหม่อาจอัปโหลดสแนปช็อตจิ๋วทีหลัง แล้วบังสแนปช็อตจริง (เจอมาแล้ว)
  let snapshot = null, best = -1;
  for (const s of snaps) {   // ใหม่ → เก่า: คะแนนเท่ากันให้ตัวใหม่ชนะ
    const text = await driveDownloadText(s.id);
    try {
      const j = JSON.parse(text);
      const score = (j.documents || []).length + (j.clients || []).length;
      if (score > best) { best = score; snapshot = text; }
    } catch (e) { /* สแนปช็อตเสีย — ข้ามไปตัวถัดไป */ }
  }
  if (!snapshot) return null;
  const events = [];
  const devFolders = await driveList(`'${st.folders.events}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`);
  for (const df of devFolders) {
    const files = await driveList(`'${df.id}' in parents and trashed=false`);
    for (const f of files.sort((a, b) => a.name.localeCompare(b.name))) {
      for (const line of (await driveDownloadText(f.id)).split('\n')) {
        const s = line.trim(); if (!s) continue;
        try { events.push(JSON.parse(s)); } catch (e) {}
      }
    }
  }
  return { snapshot, events };
});

handleIPC('ai:status', async () => aiStatus());

handleIPC('ai:infer', async (_e, input) => runAiInference(input));

handleIPC('ai:importTor', async (_e, filePath) => extractTorText(filePath));

handleIPC('ai:reveal', async () => {
  const status = await aiStatus();
  const dir = status.valid ? status.path : USER_AI_DIR;
  await fsp.mkdir(dir, { recursive: true });
  shell.openPath(dir);
});

handleIPC('data:where', async () => {
  const cfg = await readConfig();
  return { mode: cfg.externalPath ? 'external' : 'app', path: cfg.externalPath || DEFAULT_DATA };
});

handleIPC('data:reveal', async () => { shell.showItemInFolder(await activePath()); });

// Pick an existing billing.json -> make it the active store, return its contents.
handleIPC('data:linkExisting', async () => {
  const r = await dialog.showOpenDialog(win, {
    title: 'เปิดไฟล์ billing.json', properties: ['openFile'],
    filters: [{ name: 'Billing Data (.json)', extensions: ['json'] }]
  });
  if (r.canceled || !r.filePaths.length) return null;
  const file = r.filePaths[0];
  return withDataLock(async () => {
    const text = await fsp.readFile(file, 'utf8');
    validateData(text); // Never switch the store to an empty/unrelated JSON file.
    await preserveBefore204(file, text);
    const cfg = await readConfig(); cfg.externalPath = file; await writeConfig(cfg);
    await markDataInitialized();
    dataSession = { file, text };
    return { text, path: file };
  });
});

// Create a new external file at a chosen location, seed it with current data, make active.
handleIPC('data:createExternal', async (_e, text) => {
  const r = await dialog.showSaveDialog(win, {
    title: 'เก็บเป็นไฟล์ (เช่นใน Drive/Dropbox)',
    defaultPath: path.join(app.getPath('documents'), 'billing.json'),
    filters: [{ name: 'Billing Data (.json)', extensions: ['json'] }]
  });
  if (r.canceled || !r.filePath) return null;
  return withDataLock(() => moveDataStore(r.filePath, text));
});

// Switch back to the in-app folder; write current data there.
async function moveDataStore(file, text) {
  validateData(text);
  await currentSession();
  const previous = await readDataFile(file);
  if (previous !== null) await snapshotText(previous, 'pre-replace');
  await markDataInitialized();
  await atomicWrite(file, text);
  const cfg = await readConfig(); cfg.externalPath = file === DEFAULT_DATA ? null : file;
  await writeConfig(cfg);
  dataSession = { file, text };
  return { path: file };
}
handleIPC('data:useDefault', (_e, text) => withDataLock(() => moveDataStore(DEFAULT_DATA, text)));

// Export a backup copy (does NOT change the active store).
handleIPC('data:export', async (_e, text) => {
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
handleIPC('doc:pdf', async (_e, suggestedName) => {
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
handleIPC('data:import', async () => {
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
  win.webContents.on('will-navigate', event => event.preventDefault());
  win.webContents.on('will-attach-webview', event => event.preventDefault());
  win.on('close', event => requestSafeClose(event, 'window'));
}

function buildMenu() {
  const isMac = process.platform === 'darwin';
  // บน macOS แอปอยู่ต่อหลังปิดหน้าต่าง — win กลายเป็น object ที่ destroyed แล้ว (ยัง truthy)
  const liveWin = () => (win && !win.isDestroyed()) ? win : null;
  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: 'ไฟล์',
      submenu: [
        { label: 'สำรองข้อมูล (Export)…', accelerator: 'CmdOrCtrl+E', click: () => { const w = liveWin(); if (w) w.webContents.send('menu:export'); } },
        { label: 'นำเข้าข้อมูล (Import)…', accelerator: 'CmdOrCtrl+I', click: () => { const w = liveWin(); if (w) w.webContents.send('menu:import'); } },
        { label: 'เปิดที่เก็บไฟล์ข้อมูล', click: async () => shell.showItemInFolder(await activePath()) },
        { label: 'เปิดโฟลเดอร์สำรองอัตโนมัติ', click: async () => { await fsp.mkdir(BACKUP_DIR, { recursive: true }); shell.openPath(BACKUP_DIR); } },
        { type: 'separator' },
        { label: 'พิมพ์ / Print…', accelerator: 'CmdOrCtrl+P', click: () => { const w = liveWin(); if (w) w.webContents.print(); } },
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
  if (!primaryInstance) return;
  migrateFromBilliong();
  buildMenu();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('second-instance', () => {
  if (!win || win.isDestroyed()) createWindow();
  else { if (win.isMinimized()) win.restore(); win.focus(); }
});

// Quit must drain renderer transactions AND the native disk queue. A timeout
// cancels quitting instead of silently discarding an unfinished local write.
let quitFlushDone = false;
let quitInProgress = false;
let closingMode = null;
const allowedWindowCloses = new WeakSet();
async function requestSafeClose(e, mode) {
  if (quitFlushDone || (mode === 'window' && allowedWindowCloses.has(win))) return;
  e.preventDefault();
  if (mode === 'quit') closingMode = 'quit';
  if (quitInProgress) return;
  closingMode = mode;
  quitInProgress = true;
  const closingWindow = win;
  const requestId = crypto.randomBytes(12).toString('hex');
  let timer, listener;
  try {
    if (win && !win.isDestroyed()) {
      const rendererReady = new Promise((resolve, reject) => {
        listener = (event, result) => {
          if (!trustedRenderer(event)) return;
          if (!result || result.requestId !== requestId) return;
          if (result.ok !== true) reject(new Error('LOCAL_CHANGES_UNSAVED'));
          else resolve();
        };
        ipcMain.on('app:quitFlushDone', listener);
      });
      const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('LOCAL_SAVE_PENDING')), 15000); });
      win.webContents.send('app:quitFlush', { requestId, reason: mode });
      await Promise.race([rendererReady, timeout]);
    }
    // Include requests queued during the renderer drain, not just a stale queue reference.
    let pending;
    do { pending = dataQueue; await pending; } while (pending !== dataQueue);
    if (lastSaveError) throw lastSaveError;
    if (closingMode === 'quit') {
      quitFlushDone = true;
      app.quit();
    } else if (closingWindow && !closingWindow.isDestroyed()) {
      allowedWindowCloses.add(closingWindow);
      closingWindow.close();
    }
  } catch (error) {
    if (closingWindow && !closingWindow.isDestroyed()) closingWindow.webContents.send('app:quitCancelled', { requestId });
    if (dialog.showMessageBox) await dialog.showMessageBox(win && !win.isDestroyed() ? win : undefined, {
      type: 'warning', title: 'BillNgai',
      message: 'ยังปิดแอปไม่ได้ — ข้อมูลยังบันทึกไม่สำเร็จ / Changes are not safely saved yet.',
      detail: 'โปรดตรวจสถานะการบันทึกแล้วลองอีกครั้ง / Check the save status and retry. No unfinished write was discarded.',
      buttons: ['กลับไปตรวจสอบ / Keep open']
    });
  } finally {
    clearTimeout(timer);
    if (listener) ipcMain.removeListener('app:quitFlushDone', listener);
    quitInProgress = false;
    closingMode = null;
  }
}
app.on('before-quit', event => requestSafeClose(event, 'quit'));

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
