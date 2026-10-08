'use strict';
// Keep one reviewed renderer; omit the direct purchase modal from Apple bundles.
function appleRenderer(html) {
  const start = html.indexOf('function openDirectUpgradeModal(){');
  const end = html.indexOf('async function activateLicense(){', start);
  if (start < 0 || end < 0) throw Error('Release blocked: review the changed purchase modal before packaging.');
  const result = html.slice(0, start) + 'function openDirectUpgradeModal(){ return openMasUpgradeModal(); }\n' + html.slice(end);
  if (/https:\/\/lin\.ee\/pSl8nEH|Early Bird|ซื้อ Pro: สแกนจ่ายผ่าน PromptPay/.test(result))
    throw Error('Release blocked: external purchase content remains in Apple renderer.');
  return result;
}
module.exports = { appleRenderer };
