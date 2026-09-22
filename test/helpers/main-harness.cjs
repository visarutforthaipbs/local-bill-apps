const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Runs the real main-process handlers with only Electron UI/transport mocked.
// The caller must supply an isolated temp directory; never use real app data.
function mainHarness(root, source = path.resolve(__dirname, '../../main.js'), customFs = fs) {
  const handlers = new Map();
  const dialogs = { open: { canceled: true }, save: { canceled: true } };
  const app = { setName() {}, getPath: () => root, requestSingleInstanceLock: () => true,
    quit() {}, on() {}, whenReady: () => new Promise(() => {}) };
  const electron = { app, ipcMain: { handle: (key, fn) => handlers.set(key, fn), once() {} },
    dialog: { showOpenDialog: async () => dialogs.open, showSaveDialog: async () => dialogs.save },
    shell: { openPath() {}, showItemInFolder() {} }, Menu: {}, safeStorage: {} };
  const context = vm.createContext({ require: name => name === 'electron' ? electron : name === 'fs' ? customFs : require(name),
    // Deliberately do not load the project's OAuth config in tests.
    __dirname: root, process: { platform: process.platform, env: {} }, console,
    Buffer, URL, URLSearchParams, setTimeout, clearTimeout });
  vm.runInContext(fs.readFileSync(source, 'utf8'), context, { filename: source });
  return { call: (name, ...args) => handlers.get(name)(null, ...args), dialogs, context };
}
module.exports = { mainHarness };
