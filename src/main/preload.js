'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('keyheat', {
  getInit: () => ipcRenderer.invoke('get-init'),
  getStats: (fromMs, toMs) => ipcRenderer.invoke('get-stats', fromMs, toMs),
  setPaused: (p) => ipcRenderer.invoke('set-paused', p),
  saveNow: () => ipcRenderer.invoke('save-now'),
  openDataFolder: () => ipcRenderer.invoke('open-data-folder'),
  exportCsv: (fromMs, toMs, label) => ipcRenderer.invoke('export-csv', fromMs, toMs, label),
  onStatus: (cb) => ipcRenderer.on('status', (_e, s) => cb(s)),
});
