// สร้างรหัส BillNgai Pro — ตรวจออฟไลน์ในแอปด้วย public key ที่ฝังไว้ (คีย์เดียวกับ AI add-on)
// Pro ขายแบบจ่ายครั้งเดียว → ค่าเริ่มต้นคือ pro-lifetime (--plan pro --months N มีไว้เผื่อกรณีพิเศษ)
// Usage:
//   node scripts/make-license.js --email user@example.com                        → Pro ตลอดชีพ
//   node scripts/make-license.js --email user@example.com --plan pro --months 12 → จำกัดเวลา (กรณีพิเศษ)
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : null;
}
function canonicalJson(value) {
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonicalJson(value[k])).join(',') + '}';
  }
  return JSON.stringify(value);
}

const email = arg('--email');
const plan = arg('--plan') || 'pro-lifetime';
const months = Number(arg('--months') || 12);
if (!email || !['pro', 'pro-lifetime'].includes(plan)) {
  console.log('Usage: node scripts/make-license.js --email <email> [--plan pro-lifetime|pro] [--months 12]');
  process.exit(1);
}

const keyPath = process.env.BILLNGAI_AI_PRIVATE_KEY || path.join(__dirname, '..', 'secrets', 'ai-signing-key.pem');
let privateKey;
try { privateKey = fs.readFileSync(keyPath, 'utf8'); }
catch (e) {
  console.error('Signing key not found. Set BILLNGAI_AI_PRIVATE_KEY or create secrets/ai-signing-key.pem (git-ignored).');
  process.exit(1);
}

const isoDate = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const until = () => { const d = new Date(); d.setMonth(d.getMonth() + months); return isoDate(d); };
const payload = {
  license: 'billngai-pro',
  email: String(email).trim().toLowerCase(),
  plan,
  issuedAt: isoDate(new Date()),
  validUntil: plan === 'pro-lifetime' ? null : until()
};
const signature = crypto.sign(null, Buffer.from(canonicalJson(payload)), crypto.createPrivateKey(privateKey)).toString('base64');
const key = Buffer.from(JSON.stringify(payload)).toString('base64') + '.' + signature;

console.log('BillNgai Pro license for ' + payload.email + ' (' + plan + (payload.validUntil ? ', valid until ' + payload.validUntil : '') + '):');
console.log('');
console.log(key);
