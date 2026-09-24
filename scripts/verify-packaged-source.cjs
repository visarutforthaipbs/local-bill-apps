// Usage: node scripts/verify-packaged-source.cjs app.asar git-dir commit
// Compares every packaged tracked file with a reviewed Git commit. OAuth stays
// private and is validated by the existing release-config gate, never printed.
const fs = require('node:fs');
const crypto = require('node:crypto');
const {execFileSync} = require('node:child_process');
const assert = require('node:assert/strict');
const asar = require('@electron/asar');
const [archive, gitDir, commit] = process.argv.slice(2);
assert.ok(archive && gitDir && /^[a-f0-9]{40}$/.test(commit || ''), 'Provide archive, git-dir, full commit');
const git = (...args) => execFileSync('git', ['--git-dir=' + gitDir, ...args]);
assert.equal(git('rev-parse', commit).toString().trim(), commit);
const sourcePackage = JSON.parse(git('show', commit + ':package.json'));
const packagedPackage = JSON.parse(asar.extractFile(archive, 'package.json'));
for (const key of ['name', 'version', 'main', 'description', 'author', 'license']) {
  assert.deepEqual(packagedPackage[key], sourcePackage[key], 'package.' + key);
}
let checked = 0;
for (const item of asar.listPackage(archive)) {
  const name = item.replace(/^\//, '');
  if (asar.statFile(archive, name).files) continue;
  if (name === 'package.json' || name === 'secrets/gdrive-oauth.json') continue;
  const actual = asar.extractFile(archive, name);
  const expected = git('show', commit + ':' + name);
  assert.ok(actual.equals(expected), 'Packaged source mismatch: ' + name);
  checked++;
}
require('./validate-release-config.cjs').validatePackaged(archive);
console.log('PASS:', checked, 'packaged files match', commit, '; package identity and OAuth valid.');
console.log('app.asar SHA256:', crypto.createHash('sha256').update(fs.readFileSync(archive)).digest('hex'));
