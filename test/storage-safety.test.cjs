const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = fs.promises;
const path = require('node:path');
const os = require('node:os');
const { mainHarness } = require('./helpers/main-harness.cjs');

const data = (count = 3, note = '') => JSON.stringify({ version: 2, business: { businessName: 'Test' },
  documents: Array.from({ length: count }, (_, i) => ({ id: 'doc-' + i, note })), clients: [], recurring: [] });
async function fixture(t, source, customFs) {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'billngai-storage-test-'));
  t.after(() => fsp.rm(root, { recursive: true, force: true }));
  return { root, file: path.join(root, 'billing.json'), ...mainHarness(root, source, customFs) };
}
async function backups(root) {
  const dir = path.join(root, 'backups');
  const names = await fsp.readdir(dir).catch(() => []);
  return Promise.all(names.filter(n => n.endsWith('.json')).map(async name => ({ name, text: await fsp.readFile(path.join(dir, name), 'utf8') })));
}

test('Drive file missing at launch stays locked even when Drive brings the real file back', async t => {
  const h = await fixture(t);
  const external = path.join(h.root, 'Drive', 'billing.json');
  await fsp.mkdir(path.dirname(external));
  await fsp.writeFile(path.join(h.root, 'config.json'), JSON.stringify({ externalPath: external }));
  await assert.rejects(h.call('data:load'), /DATA_MISSING/);
  await assert.rejects(h.call('data:save', data(0)), /DATA_NOT_LOADED/);
  assert.equal(fs.existsSync(external), false);
  await fsp.writeFile(external, data());
  await assert.rejects(h.call('data:save', data(0)), /DATA_NOT_LOADED/);
  assert.equal(await fsp.readFile(external, 'utf8'), data());
  assert.equal((await backups(h.root)).length, 0);
  assert.equal(await h.call('data:load'), data());
  await h.call('data:save', data(4));
  assert.equal(JSON.parse(await fsp.readFile(external, 'utf8')).documents.length, 4);
});

for (const [label, text] of [['zero-byte', ''], ['bad JSON', '{'], ['unrelated JSON', '{}'], ['null', 'null']]) {
  test(label + ' data blocks saves and preserves the original bytes', async t => {
    const h = await fixture(t);
    await fsp.writeFile(h.file, text);
    await assert.rejects(h.call('data:load'), /DATA_INVALID/);
    await assert.rejects(h.call('data:save', data(0)), /DATA_NOT_LOADED/);
    assert.equal(await fsp.readFile(h.file, 'utf8'), text);
  });
}

test('fresh install can save, but an initialized missing store cannot silently restart empty', async t => {
  const h = await fixture(t);
  assert.equal(await h.call('data:load'), null);
  await h.call('data:save', data());
  await fsp.unlink(h.file);
  await fsp.rm(path.join(h.root, 'backups'), { recursive: true });
  const reopened = mainHarness(h.root);
  await assert.rejects(reopened.call('data:load'), /DATA_MISSING/);
});

test('legacy backups protect missing default data even before the new marker exists', async t => {
  const h = await fixture(t);
  await fsp.mkdir(path.join(h.root, 'backups'));
  await fsp.writeFile(path.join(h.root, 'backups', 'billing-2026-09-17T03-53-00.json'), data());
  await assert.rejects(h.call('data:load'), /DATA_MISSING/);
});

test('damaged config is not replaced by device ID generation or default-path fallback', async t => {
  const h = await fixture(t);
  const config = path.join(h.root, 'config.json');
  await fsp.writeFile(config, '{');
  await assert.rejects(h.call('device:id'), /DATA_CONFIG/);
  await assert.rejects(h.call('data:load'), /DATA_CONFIG/);
  await assert.rejects(h.call('data:save', data()), /DATA_NOT_LOADED/);
  assert.equal(await fsp.readFile(config, 'utf8'), '{');
  assert.equal(fs.existsSync(h.file), false);
});

test('overlapping saves finish in order, preserve previous data, and leave no temp files', async t => {
  const h = await fixture(t);
  await fsp.writeFile(h.file, data());
  await h.call('data:load');
  await Promise.all(Array.from({ length: 25 }, (_, i) => h.call('data:save', data(3, 'save-' + i))));
  assert.equal(await fsp.readFile(h.file, 'utf8'), data(3, 'save-24'));
  const list = await backups(h.root);
  assert.equal(list.length, 1);
  assert.equal(list[0].text, data());
  assert.equal((await fsp.readdir(h.root)).some(n => n.endsWith('.tmp')), false);
});

test('external edits or disappearance after loading never get overwritten', async t => {
  const h = await fixture(t);
  await fsp.writeFile(h.file, data());
  await h.call('data:load');
  await fsp.writeFile(h.file, data(4, 'other-device'));
  await assert.rejects(h.call('data:save', data(0)), /DATA_CHANGED_ON_DISK/);
  assert.equal(await fsp.readFile(h.file, 'utf8'), data(4, 'other-device'));
  await h.call('data:load');
  await fsp.unlink(h.file);
  await assert.rejects(h.call('data:save', data(0)), /DATA_CHANGED_ON_DISK/);
  assert.equal(fs.existsSync(h.file), false);
});

test('restore unlocks failed loading and preserves even invalid original data', async t => {
  const h = await fixture(t);
  await fsp.writeFile(h.file, 'broken original');
  await assert.rejects(h.call('data:load'));
  await h.call('data:recover', data());
  assert.equal(await fsp.readFile(h.file, 'utf8'), data());
  assert.ok((await backups(h.root)).some(b => b.name.includes('pre-restore') && b.text === 'broken original'));
  await h.call('data:save', data(4));
  await assert.rejects(h.call('data:recover', '{}'), /DATA_INVALID_SCHEMA/);
  assert.equal(await fsp.readFile(h.file, 'utf8'), data(4));
});

test('backup restore validates first and resumes normal saving', async t => {
  const h = await fixture(t);
  await fsp.mkdir(path.join(h.root, 'backups'));
  await fsp.writeFile(path.join(h.root, 'backups', 'billing-manual-test.json'), data());
  await assert.rejects(h.call('data:load'));
  assert.equal(await h.call('backups:restore', 'billing-manual-test.json'), data());
  await h.call('data:save', data(4));
  assert.equal(await fsp.readFile(h.file, 'utf8'), data(4));
});

test('invalid linked file does not change the active store', async t => {
  const h = await fixture(t);
  await fsp.writeFile(h.file, data());
  await h.call('data:load');
  const bad = path.join(h.root, 'other.json');
  await fsp.writeFile(bad, '{}');
  h.dialogs.open = { canceled: false, filePaths: [bad] };
  await assert.rejects(h.call('data:linkExisting'), /DATA_INVALID_SCHEMA/);
  assert.equal((await h.call('data:where')).path, h.file);
  await h.call('data:save', data(4));
});

test('explicitly moving a healthy store preserves overwritten destination data', async t => {
  const h = await fixture(t);
  await fsp.writeFile(h.file, data());
  await h.call('data:load');
  const dest = path.join(h.root, 'external.json');
  await fsp.writeFile(dest, data(9));
  h.dialogs.save = { canceled: false, filePath: dest };
  await h.call('data:createExternal', data());
  assert.equal((await h.call('data:where')).path, dest);
  assert.ok((await backups(h.root)).some(b => b.text === data(9)));
  await h.call('data:save', data(4));
  await h.call('data:useDefault', data(4));
  assert.equal(await fsp.readFile(h.file, 'utf8'), data(4));
});

test('losing all documents creates a permanent pre-replace copy before saving', async t => {
  const h = await fixture(t);
  await fsp.writeFile(h.file, data());
  await h.call('data:load');
  await h.call('data:save', data(0));
  const list = await backups(h.root);
  assert.ok(list.some(b => b.name.startsWith('billing-pre-replace-') && b.text === data()));
});

test('backup failure aborts replacement and leaves the original file intact', async t => {
  const h = await fixture(t);
  await fsp.writeFile(h.file, data());
  await h.call('data:load');
  await fsp.writeFile(path.join(h.root, 'backups'), 'not a directory');
  await assert.rejects(h.call('data:save', data(4)));
  assert.equal(await fsp.readFile(h.file, 'utf8'), data());
});

test('restart within 30 minutes does not create another automatic snapshot', async t => {
  const h = await fixture(t);
  await fsp.writeFile(h.file, data());
  await h.call('data:load');
  await h.call('data:save', data(4));
  const reopened = mainHarness(h.root);
  await reopened.call('data:load');
  await reopened.call('data:save', data(5));
  assert.equal((await backups(h.root)).length, 1);
});

test('failed atomic rename keeps original bytes and cleans the unique temp file', async t => {
  const injected = { ...fs, promises: { ...fsp, rename: async (src, dest) => {
    if (dest.endsWith('/billing.json')) throw new Error('injected rename failure');
    return fsp.rename(src, dest);
  } } };
  const h = await fixture(t, undefined, injected);
  await fsp.writeFile(h.file, data());
  await h.call('data:load');
  await assert.rejects(h.call('data:save', data(4)), /rename failure/);
  assert.equal(await fsp.readFile(h.file, 'utf8'), data());
  assert.equal((await fsp.readdir(h.root)).some(n => n.endsWith('.tmp')), false);
});

test('recovery refuses to recreate an unavailable Drive directory', async t => {
  const h = await fixture(t);
  const external = path.join(h.root, 'offline-Drive', 'billing.json');
  await fsp.writeFile(path.join(h.root, 'config.json'), JSON.stringify({ externalPath: external }));
  await assert.rejects(h.call('data:recover', data()));
  assert.equal(fs.existsSync(path.dirname(external)), false);
});
