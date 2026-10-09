// Store builds and the iOS bundle are packaged from billing.html as-is (no per-channel
// stripping since 2.0.15), so direct-purchase copy must never return to the source.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
test('billing.html carries no direct-purchase or licence-entry copy',()=>{
 const html=read('billing.html');
 for(const needle of ['lin.ee','Early Bird','ซื้อ Pro','สแกนจ่ายผ่าน PromptPay','มีรหัส Pro แล้ว','เปิดใช้งานรหัส','ทักทาง LINE','lic_key','openDirectUpgradeModal','registerDirectPurchaseCopy'])
  assert.equal(html.includes(needle),false,'purchase copy present: '+needle);
 assert.doesNotMatch(html,/(?<![A-Za-z])activateLicense\(/);   // deactivateLicense (remove a stored key) stays
 assert.ok(html.includes('function openStoreOnlyModal('));
 assert.ok(html.includes('function openMasUpgradeModal('));
 // PromptPay QR on the freelancer's own invoices is a product feature, not purchase copy.
 assert.ok(html.includes('function promptpayPayload(')||/PromptPay/.test(html));
});
test('the key-entry IPC is gone while licence validation and removal remain',()=>{
 const main=read('main.js'),preload=read('preload.js');
 assert.equal(main.includes("'license:activate'"),false);assert.equal(preload.includes('licenseActivate'),false);
 for(const kept of ['function parseLicenseKey(',"handleIPC('license:status'","handleIPC('license:deactivate'",'cfg.licenseKey'])assert.ok(main.includes(kept),kept);
 assert.ok(preload.includes('licenseDeactivate'));
 assert.equal(fs.existsSync(path.join(__dirname,'../scripts/channel-renderer.cjs')),false);
 assert.equal(JSON.parse(read('package.json')).build.mas.files,undefined);
});
