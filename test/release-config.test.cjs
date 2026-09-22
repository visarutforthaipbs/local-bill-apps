const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const asar = require('@electron/asar');
const { validateOAuth, validateSource, beforePack, afterPack } = require('../scripts/validate-release-config.cjs');
const fixture = JSON.stringify({ installed: {client_id:'123-test.apps.googleusercontent.com',client_secret:'test-placeholder'} });

test('production config rejects the observed prefix corruption without leaking its contents', () => {
  assert.throws(()=>validateOAuth('hey'+fixture), error => error.message.includes('valid JSON') && !error.message.includes('test-placeholder'));
  for(const value of ['null','{}','[]',JSON.stringify({web:JSON.parse(fixture).installed}),JSON.stringify({installed:{client_id:'wrong',client_secret:'test'}})]) {
    assert.throws(()=>validateOAuth(value), /Release blocked/);
  }
  assert.equal(validateOAuth(fixture),true);
});

test('packaging rejects missing/malformed embedded configuration even when the source passes', async () => {
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'billngai-release-config-'));
  try {
    const source=path.join(root,'source');
    await fs.mkdir(path.join(source,'secrets'),{recursive:true});
    assert.throws(()=>validateSource(source), /missing or unreadable/);
    await fs.writeFile(path.join(source,'secrets/gdrive-oauth.json'),fixture);
    validateSource(source);
    await beforePack({packager:{info:{appDir:source}}});
    const resources=path.join(root,'out','BillNgai.app','Contents','Resources');
    await fs.mkdir(resources,{recursive:true});
    const context={electronPlatformName:'darwin',appOutDir:path.join(root,'out'),packager:{appInfo:{productFilename:'BillNgai'}}};
    await assert.rejects(afterPack(context), /missing or unreadable/);
    await fs.writeFile(path.join(source,'secrets/gdrive-oauth.json'),'hey'+fixture);
    await asar.createPackage(source,path.join(resources,'app.asar'));
    await assert.rejects(afterPack(context), /valid JSON/);
    await fs.writeFile(path.join(source,'secrets/gdrive-oauth.json'),fixture);
    asar.uncacheAll();
    await asar.createPackage(source,path.join(resources,'app.asar'));
    asar.uncacheAll();
    await afterPack(context);
  } finally { await fs.rm(root,{recursive:true,force:true}); }
});
