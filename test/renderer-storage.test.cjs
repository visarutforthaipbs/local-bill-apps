const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.resolve(__dirname, '../billing.html'), 'utf8');
function section(start, end) {
  const from = html.indexOf(start), to = html.indexOf(end, from);
  assert.ok(from >= 0 && to > from);
  return html.slice(from, to);
}

test('backup dates use local timezone including date rollover, old/new names and mtime fallback', () => {
  const previous = process.env.TZ;
  try {
    const context = vm.createContext({ fmtDate: date => date });
    vm.runInContext(section('function backupTimeLabel(', 'async function loadBackupHistory('), context);
    const old = { name: 'billing-2026-09-22T01-16-00.json' };
    process.env.TZ = 'Asia/Bangkok';
    assert.equal(context.backupTimeLabel(old), '2026-09-22 08:16');
    assert.equal(context.backupTimeLabel({ name: 'billing-manual-2026-09-17T03-53-00.json' }), '2026-09-17 10:53');
    assert.equal(context.backupTimeLabel({ name: 'billing-2026-09-22T20-16-00-123Z.json' }), '2026-09-23 03:16');
    assert.equal(context.backupTimeLabel({ name: 'billing-pre-replace-hash.json', mtime: '2026-09-22T01:16:00Z' }), '2026-09-22 08:16');
    process.env.TZ = 'America/Los_Angeles';
    assert.equal(context.backupTimeLabel(old), '2026-09-21 18:16');
    process.env.TZ = 'UTC';
    assert.equal(context.backupTimeLabel(old), '2026-09-22 01:16');
    assert.equal(context.backupTimeLabel({ name: 'unknown', mtime: 'invalid' }), '—');
  } finally { if(previous === undefined) delete process.env.TZ; else process.env.TZ = previous; }
});

function renderer(save, failed = false) {
  const messages = [], actions = [];
  const context = vm.createContext({ IS_ELECTRON: true, DB: { documents: [] }, loadFailed: failed,
    dirty: false, syncTimer: null, tr: s => s, toast: (s, kind) => messages.push({ s, kind }),
    clearTimeout() {}, render: () => actions.push('render'), updateFileStatus() {},
    appendJournal: () => actions.push('journal'), scheduleSync: () => actions.push('sync'),
    window: { billingAPI: { save } } });
  vm.runInContext(section('async function persist(', '/* ---------- desktop-app'), context);
  return { context, messages, actions };
}
test('failed load never sends a save and does not claim success', async () => {
  const h = renderer(async () => assert.fail('must not save'), true);
  assert.equal(await h.context.persist(false), false);
  assert.equal(h.messages.some(m => m.kind === 'ok'), false);
  assert.deepEqual(h.actions, []);
});
test('changed Drive file locks renderer and does not create journal/sync/success events', async () => {
  const h = renderer(async () => { throw new Error('DATA_CHANGED_ON_DISK'); });
  assert.equal(await h.context.persist(false), false);
  assert.equal(h.context.loadFailed, true);
  assert.equal(h.context.dirty, true);
  assert.deepEqual(h.actions, ['render']);
  assert.equal(h.messages.some(m => m.kind === 'ok'), false);
});
test('successful save triggers journal and sync only after disk confirms', async () => {
  const h = renderer(async () => true);
  assert.equal(await h.context.persist(false), true);
  assert.deepEqual(h.actions, ['journal', 'sync']);
  assert.equal(h.messages.filter(m => m.kind === 'ok').length, 1);
});
test('2.0.3 pauses automatic Pro sync even after load recovery', () => {
  const context = vm.createContext({ CLOUD_SYNC_PAUSED: true, IS_ELECTRON: true, loadFailed: true, isPro: () => true, syncInfo: { connected: true } });
  vm.runInContext(section('function isSyncEnabled()', '// ฟิลด์การเงิน'), context);
  assert.equal(context.isSyncEnabled(), false);
  context.loadFailed = false;
  assert.equal(context.isSyncEnabled(), false);
  context.CLOUD_SYNC_PAUSED = false;
  context.loadFailed = true;
  assert.equal(context.isSyncEnabled(), false);
});
