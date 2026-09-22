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

async function beforePack(context) { validateSource(context.appDir); }
async function afterPack(context) {
  const resources = ['darwin', 'mas'].includes(context.electronPlatformName)
    ? path.join(context.appOutDir, context.packager.appInfo.productFilename + '.app', 'Contents', 'Resources')
    : path.join(context.appOutDir, 'resources');
  validatePackaged(path.join(resources, 'app.asar'));
}

module.exports = { validateOAuth, validateSource, validatePackaged, beforePack, afterPack };
if (require.main === module) {
  try {
    if (process.argv[2]) validatePackaged(path.resolve(process.argv[2]));
    else validateSource(path.resolve(__dirname, '..'));
    console.log('PASS: Google OAuth release configuration is valid.');
  } catch(error) { console.error(error.message); process.exitCode = 1; }
}
