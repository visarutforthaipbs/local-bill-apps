const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

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

const aiDir = path.join(process.env.HOME, 'Library/Application Support/BillNgai/ai');

function canonicalJson(value) {
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonicalJson(value[k])).join(',') + '}';
  }
  return JSON.stringify(value);
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function writeFile(rel, text) {
  const file = path.join(aiDir, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
  return file;
}

fs.mkdirSync(aiDir, { recursive: true });

const files = [
  {
    rel: 'runtime/README.txt',
    text: 'BillNgai AI dev runtime placeholder. Replace with local runtime files in production.\n'
  },
  {
    rel: 'models/qwen-tor-dev/model.stub',
    text: 'DEV ONLY: this file stands in for a local Qwen model so the offline add-on flow can be tested.\n'
  }
];

const manifestFiles = files.map(f => {
  const file = writeFile(f.rel, f.text);
  return {
    path: f.rel,
    size: fs.statSync(file).size,
    sha256: sha256(file)
  };
});

const manifest = {
  addon: 'billngai-ai-tor',
  name: 'BillNgai AI Add-on Dev',
  version: '0.1.0-dev',
  model: 'qwen-tor-dev-placeholder',
  compatibleCore: '>=1.4.0',
  features: ['tor_ai'],
  offlineOnly: true,
  files: manifestFiles
};

const signature = crypto.sign(
  null,
  Buffer.from(canonicalJson(manifest)),
  crypto.createPrivateKey(loadPrivateKey())
).toString('base64');

fs.writeFileSync(
  path.join(aiDir, 'addon.json'),
  JSON.stringify({ ...manifest, signature }, null, 2)
);

console.log('Installed dev AI add-on:');
console.log(aiDir);
