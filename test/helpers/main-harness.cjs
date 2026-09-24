const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Runs the real main-process handlers with only Electron UI/transport mocked.
// The caller must supply an isolated temp directory; never use real app data.
function mainHarness(root, source = path.resolve(__dirname, '../../main.js'), customFs = fs) {
  const handlers = new Map();
  const events = new Map(), listeners = new Map(), sent = [], messages = [];
  let quits = 0;
  const dialogs = { open: { canceled: true }, save: { canceled: true } };
  const app = { setName() {}, getPath: () => root, requestSingleInstanceLock: () => true,
    quit() { quits++; }, on: (key, fn) => events.set(key, fn), whenReady: () => new Promise(() => {}) };
  const electron = { app, ipcMain: { handle: (key, fn) => handlers.set(key, fn),
      on: (key, fn) => listeners.set(key, fn), once: (key, fn) => listeners.set(key, fn),
      removeListener: (key, fn) => { if (listeners.get(key) === fn) listeners.delete(key); } },
    dialog: { showOpenDialog: async () => dialogs.open, showSaveDialog: async () => dialogs.save,
      showMessageBox: async (_win, options) => { messages.push(options); return { response: 0 }; } },
    shell: { openPath() {}, showItemInFolder() {} }, Menu: {}, safeStorage: {} };
  const context = vm.createContext({ require: name => name === 'electron' ? electron : name === 'fs' ? customFs : require(name),
    // Deliberately do not load the project's OAuth config in tests.
    __dirname: root, process: { platform: process.platform, env: {} }, console,
    Buffer, URL, URLSearchParams, setTimeout, clearTimeout });
  vm.runInContext(fs.readFileSync(source, 'utf8'), context, { filename: source });
  const mainFrame = { url: require('node:url').pathToFileURL(path.join(root, 'billing.html')).href };
  const webContents = { mainFrame, send: (...args) => sent.push(args) };
  const event = { sender: webContents, senderFrame: mainFrame };
  let closed = false;
  context.testWindow = { isDestroyed: () => closed, webContents, close: () => { closed = true; } };
  vm.runInContext('win = testWindow', context);
  return { call: (name, ...args) => handlers.get(name)(event, ...args),
    callAs: (event, name, ...args) => handlers.get(name)(event, ...args),
    emit: (name, ...args) => {
      if (name === 'app:quitFlushDone' && args[0] && args[0].requestId === undefined)
        args[0] = { requestId: sent.filter(item => item[0] === 'app:quitFlush').at(-1)?.[1].requestId, ...args[0] };
      return listeners.get(name)?.(event, ...args);
    },
    quit: () => events.get('before-quit')({ preventDefault() {} }),
    closeWindow: () => context.requestSafeClose({ preventDefault() {} }, 'window'),
    get quits() { return quits; }, sent, messages, dialogs, context };
}
module.exports = { mainHarness };
