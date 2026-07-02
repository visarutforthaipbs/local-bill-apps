const { contextBridge, ipcRenderer } = require('electron');

// Single, safe bridge for the renderer (billing.html).
contextBridge.exposeInMainWorld('billingAPI', {
  isElectron: true,
  load:           ()       => ipcRenderer.invoke('data:load'),
  save:           (text)   => ipcRenderer.invoke('data:save', text),
  where:          ()       => ipcRenderer.invoke('data:where'),
  reveal:         ()       => ipcRenderer.invoke('data:reveal'),
  linkExisting:   ()       => ipcRenderer.invoke('data:linkExisting'),
  createExternal: (text)   => ipcRenderer.invoke('data:createExternal', text),
  useDefault:     (text)   => ipcRenderer.invoke('data:useDefault', text),
  exportData:     (text)   => ipcRenderer.invoke('data:export', text),
  exportPDF:      (name)   => ipcRenderer.invoke('doc:pdf', name),
  importData:     ()       => ipcRenderer.invoke('data:import'),
  revealBackups:  ()       => ipcRenderer.invoke('data:revealBackups'),
  onMenuExport:   (cb)     => ipcRenderer.on('menu:export', cb),
  onMenuImport:   (cb)     => ipcRenderer.on('menu:import', cb)
});
