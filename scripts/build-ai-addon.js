const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const DEFAULT_KEY_PATHS = [
  process.env.BILLNGAI_AI_PRIVATE_KEY,
  path.join(__dirname, '..', 'secrets', 'ai-dev-signing-key.pem')
].filter(Boolean);
function loadPrivateKey() {
  for (const p of DEFAULT_KEY_PATHS) {
    try { return fs.readFileSync(p, 'utf8'); } catch (e) { /* try next */ }
  }
  console.error('Signing key not found. Set BILLNGAI_AI_PRIVATE_KEY or create secrets/ai-dev-signing-key.pem (git-ignored).');
  process.exit(1);
}

function usage() {
  console.log(`Usage:
  node scripts/build-ai-addon.js --source <folder> [options]

Options:
  --out <folder>          Output folder. Default: dist/ai-addons
  --version <version>     Add-on version. Default: 0.1.0
  --model <name>          Model label. Default: qwen-tor-local
  --name <name>           Display name. Default: BillNgai AI Add-on
  --pkg                   Also build a macOS .pkg installer
  --install               Also install into ~/Library/Application Support/BillNgai/ai

The source folder must already contain the real offline runtime/model files.
No network calls are made by this script.`);
}

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : null;
}

function has(name) {
  return process.argv.includes(name);
}

function canonicalJson(value) {
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonicalJson(value[k])).join(',') + '}';
  }
  return JSON.stringify(value);
}

function walk(dir, base = dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.name === '.DS_Store') return [];
    if (entry.isDirectory()) return walk(full, base);
    if (!entry.isFile()) return [];
    return [path.relative(base, full).split(path.sep).join('/')];
  });
}

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const name of fs.readdirSync(src)) {
      if (name === '.DS_Store') continue;
      copyRecursive(path.join(src, name), path.join(dest, name));
    }
    return;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

const source = arg('--source');
if (!source || has('--help') || has('-h')) {
  usage();
  process.exit(source ? 0 : 1);
}

const sourceDir = path.resolve(source);
if (!fs.existsSync(sourceDir) || !fs.statSync(sourceDir).isDirectory()) {
  throw new Error(`Source folder not found: ${sourceDir}`);
}

const version = arg('--version') || '0.1.0';
const model = arg('--model') || 'qwen-tor-local';
const name = arg('--name') || 'BillNgai AI Add-on';
const outRoot = path.resolve(arg('--out') || 'dist/ai-addons');
const safeModel = model.replace(/[^a-z0-9._-]+/gi, '-');
const packageName = `BillNgai-AI-AddOn-${safeModel}-${version}`;
const packageDir = path.join(outRoot, packageName);
const payloadDir = path.join(packageDir, 'ai');

fs.rmSync(packageDir, { recursive: true, force: true });
fs.mkdirSync(payloadDir, { recursive: true });
copyRecursive(sourceDir, payloadDir);

const files = walk(payloadDir)
  .filter(rel => rel !== 'addon.json')
  .sort()
  .map(rel => {
    const file = path.join(payloadDir, rel);
    return {
      path: rel,
      size: fs.statSync(file).size,
      sha256: sha256(file)
    };
  });

if (!files.length) throw new Error('Source folder has no packageable files');

const manifest = {
  addon: 'billngai-ai-tor',
  name,
  version,
  model,
  compatibleCore: '>=1.4.0',
  features: ['tor_ai'],
  offlineOnly: true,
  files
};

const privateKey = loadPrivateKey();
const signature = crypto.sign(
  null,
  Buffer.from(canonicalJson(manifest)),
  crypto.createPrivateKey(privateKey)
).toString('base64');

fs.writeFileSync(path.join(payloadDir, 'addon.json'), JSON.stringify({ ...manifest, signature }, null, 2));

const installScript = `#!/bin/sh
set -eu
DEST="$HOME/Library/Application Support/BillNgai/ai"
mkdir -p "$DEST"
cp -R "$(dirname "$0")/ai/." "$DEST/"
echo "Installed BillNgai AI Add-on to: $DEST"
`;
fs.writeFileSync(path.join(packageDir, 'install.sh'), installScript, { mode: 0o755 });
fs.writeFileSync(path.join(packageDir, 'README.txt'), [
  'BillNgai AI Add-on',
  '',
  'Offline install:',
  '1. Close BillNgai.',
  '2. Run ./install.sh from this folder.',
  '3. Open BillNgai and go to TOR → Invoice.',
  '',
  'This add-on does not require BillNgai to connect to the internet.',
  ''
].join('\n'));

if (has('--install')) {
  const dest = path.join(process.env.HOME, 'Library/Application Support/BillNgai/ai');
  fs.rmSync(dest, { recursive: true, force: true });
  copyRecursive(payloadDir, dest);
  console.log(`Installed add-on into ${dest}`);
}

if (has('--pkg')) {
  const pkgPath = path.join(outRoot, `${packageName}.pkg`);
  fs.rmSync(pkgPath, { force: true });
  const result = spawnSync('pkgbuild', [
    '--root', payloadDir,
    '--install-location', '/Library/Application Support/BillNgai/ai',
    '--identifier', 'com.visarut.billngai.ai',
    '--version', version,
    pkgPath
  ], { stdio: 'inherit' });
  if (result.status !== 0) {
    throw new Error('pkgbuild failed. Make sure Xcode Command Line Tools are installed.');
  }
  console.log(`Built macOS installer: ${pkgPath}`);
}

console.log(`Built add-on package: ${packageDir}`);
console.log(`Files signed: ${files.length}`);
