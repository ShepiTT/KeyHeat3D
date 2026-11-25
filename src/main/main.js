'use strict';
const path = require('path');
const fs = require('fs');
const { app, BrowserWindow, Tray, Menu, ipcMain, dialog, shell, nativeImage } = require('electron');
const { Store } = require('./store');
const { Capture } = require('./capture');
const { LAYOUTS, MOUSE, NAMES } = require('../shared/layouts');

const ROOT = path.join(__dirname, '..', '..');
const ICON = path.join(ROOT, 'assets', 'icon.png');
// 开发运行时数据放在项目的 data 目录；打包后放在用户数据目录
const DATA_DIR = app.isPackaged ? path.join(app.getPath('userData'), 'data') : path.join(ROOT, 'data');

let win = null;
let tray = null;
let quitting = false;
const store = new Store();
let capture = null;
let saveTimer = null;

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => showWindow());
  app.whenReady().then(boot).catch((e) => {
    // 启动失败时给出提示，而不是静默地什么都不显示
    dialog.showErrorBox('KeyHeat3D 启动失败', (e && e.stack) || String(e));
    quitting = true;
    app.quit();
  });
}

async function boot() {
  await store.init(DATA_DIR);
  capture = new Capture((id) => store.add(id));
  try {
    capture.start();
  } catch (e) {
    dialog.showErrorBox('KeyHeat3D', '无法启动全局按键采集：' + e.message);
  }
  saveTimer = setInterval(() => safeSave(), 60 * 1000);
  createWindow();
  createTray();
}

function safeSave() {
  try { store.save(); } catch (e) { console.error('保存失败', e); }
}

function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 880,
    minWidth: 1000,
    minHeight: 640,
    backgroundColor: '#f5f5f7',
    title: 'KeyHeat3D',
    icon: ICON,
    autoHideMenuBar: true,
    show: !process.argv.includes('--hidden'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadFile(path.join(ROOT, 'src', 'renderer', 'index.html'));
  // 关闭窗口 = 最小化到托盘，采集继续
  win.on('close', (e) => {
    if (!quitting) {
      e.preventDefault();
      win.hide();
    }
  });
}

function showWindow() {
  if (!win) return createWindow();
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

function createTray() {
  let img = nativeImage.createFromPath(ICON);
  if (!img.isEmpty()) img = img.resize({ width: 16, height: 16 });
  tray = new Tray(img);
  tray.on('click', () => showWindow());
  refreshTray();
}

function refreshTray() {
  if (!tray) return;
  const paused = capture ? capture.paused : false;
  tray.setToolTip(paused ? 'KeyHeat3D（已暂停）' : 'KeyHeat3D（采集中）');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '打开主界面', click: () => showWindow() },
    { label: '暂停采集', type: 'checkbox', checked: paused, click: (item) => setPaused(item.checked) },
    { label: '立即保存', click: () => safeSave() },
    { type: 'separator' },
    { label: '完全退出', click: () => quitApp() },
  ]));
}

function setPaused(p) {
  if (!capture) return;
  capture.setPaused(p);
  refreshTray();
  if (win && !win.isDestroyed()) win.webContents.send('status', { paused: capture.paused });
}

function quitApp() {
  quitting = true;
  app.quit();
}

app.on('before-quit', () => {
  quitting = true;
  if (saveTimer) clearInterval(saveTimer);
  if (capture) capture.stop();
  safeSave();
});

// 托盘常驻：所有窗口关闭时不退出
app.on('window-all-closed', () => {});

// ---------------- IPC ----------------
ipcMain.handle('get-init', () => ({
  layouts: LAYOUTS,
  mouse: MOUSE,
  names: NAMES,
  dataFile: store.file,
  paused: capture ? capture.paused : false,
}));

ipcMain.handle('get-stats', (_e, fromMs, toMs) => ({
  ...store.stats(fromMs, toMs),
  paused: capture ? capture.paused : false,
}));

ipcMain.handle('set-paused', (_e, p) => {
  setPaused(p);
  return capture ? capture.paused : false;
});

ipcMain.handle('save-now', () => { safeSave(); return true; });

ipcMain.handle('open-data-folder', () => {
  safeSave();
  return shell.openPath(path.dirname(store.file));
});

ipcMain.handle('export-csv', async (_e, fromMs, toMs, label) => {
  const pad = (n) => String(n).padStart(2, '0');
  const d = new Date();
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
  const res = await dialog.showSaveDialog(win, {
    title: '导出 CSV',
    defaultPath: path.join(app.getPath('documents'), `KeyHeat3D-${label || 'export'}-${stamp}.csv`),
    filters: [{ name: 'CSV', extensions: ['csv'] }],
  });
  if (res.canceled || !res.filePath) return { canceled: true };
  const esc = (s) => {
    s = String(s);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const lines = ['时间（小时）,按键ID,按键名称,次数'];
  for (const [hour, key, count] of store.rows(fromMs, toMs)) {
    const t = new Date(hour * 1000);
    const ts = `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())} ${pad(t.getHours())}:00`;
    lines.push([ts, key, NAMES[key] || key, count].map(esc).join(','));
  }
  // 带 BOM，Excel 直接打开中文不乱码
  fs.writeFileSync(res.filePath, '\ufeff' + lines.join('\r\n'), 'utf8');
  return { ok: true, path: res.filePath, rows: lines.length - 1 };
});
