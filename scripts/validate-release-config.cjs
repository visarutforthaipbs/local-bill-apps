const fs = require('node:fs');
const path = require('node:path');

function validateOAuth(text) {
  let json;
  try { json = JSON.parse(text); }
  catch { throw new Error('Release blocked: gdrive-oauth.json must be valid JSON.'); }
  const client = json && json.installed;
  if (!client || typeof client !== 'object' || Array.isArray(client) ||
      typeof client.client_id !== 'string' || !/^[\w-]+\.apps\.googleusercontent\.com$/.test(client.client_id) ||
      typeof client.client_secret !== 'string' || !client.client_secret.trim()) {
    throw new Error('Release blocked: gdrive-oauth.json must contain a Desktop app client ID and client secret.');
  }
  return true;
}

function validateSource(appDir) {
  let text;
  try { text = fs.readFileSync(path.join(appDir, 'secrets/gdrive-oauth.json'), 'utf8'); }
  catch { throw new Error('Release blocked: secrets/gdrive-oauth.json is missing or unreadable.'); }
  validateOAuth(text);
}

function validatePackaged(archive) {
  let text;
  try { text = require('@electron/asar').extractFile(archive, 'secrets/gdrive-oauth.json').toString('utf8'); }
  catch { throw new Error('Release blocked: packaged Google OAuth configuration is missing or unreadable.'); }
  validateOAuth(text);
}

async function beforePack(context) {
  const appDir = context.packager.info.appDir;
  validateSource(appDir);
  // Builder normalizes the root whitelist into a filter object. A separate
  // negative-only MAS matcher would include every other source/build file.
  const matcher = context.packager.config?.files?.find(entry =>
    entry.filter?.some(pattern => pattern === 'billing.html' || pattern === '!billing.html'));
  if (matcher) matcher.filter = matcher.filter.map(pattern =>
    pattern === 'billing.html' || pattern === '!billing.html'
      ? (context.electronPlatformName === 'mas' ? '!billing.html' : 'billing.html') : pattern);
  if (context.electronPlatformName === 'mas') {
    if (!matcher) throw Error('Release blocked: review the normalized renderer file selection.');
    const renderer = require('./channel-renderer.cjs').appleRenderer(fs.readFileSync(path.join(appDir, 'billing.html'), 'utf8'));
    fs.mkdirSync(path.join(appDir, 'build/mas-renderer'), {recursive:true});
    fs.writeFileSync(path.join(appDir, 'build/mas-renderer/billing.html'), renderer);
  }
}
async function afterPack(context) {
  const resources = ['darwin', 'mas'].includes(context.electronPlatformName)
    ? path.join(context.appOutDir, context.packager.appInfo.productFilename + '.app', 'Contents', 'Resources')
    : path.join(context.appOutDir, 'resources');
  validatePackaged(path.join(resources, 'app.asar'));
  if (context.electronPlatformName === 'mas') {
    const renderer = require('@electron/asar').extractFile(path.join(resources, 'app.asar'), 'billing.html').toString('utf8');
    if (require('./channel-renderer.cjs').appleRenderer(renderer) !== renderer)
      throw Error('Release blocked: MAS renderer contains the direct purchase modal.');
  }
}

module.exports = { validateOAuth, validateSource, validatePackaged, beforePack, afterPack };
if (require.main === module) {
  try {
    if (process.argv[2]) validatePackaged(path.resolve(process.argv[2]));
    else validateSource(path.resolve(__dirname, '..'));
    console.log('PASS: Google OAuth release configuration is valid.');
  } catch(error) { console.error(error.message); process.exitCode = 1; }
}
