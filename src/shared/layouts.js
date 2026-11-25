'use strict';
/**
 * 键盘布局定义（主进程和渲染进程共用，由主进程通过 IPC 下发给界面）。
 * 键 id 使用 uiohook-napi 中 UiohookKey 的名称，左右修饰键各自独立：
 *   Ctrl / CtrlRight、Shift / ShiftRight、Alt / AltRight、Meta / MetaRight
 * 单位：1u = 一个标准键宽。
 */

function K(id, label, w = 1, extra = {}) {
  return { id, label, w, h: 1, ...extra };
}
const G = (w) => ({ gap: w });

const letters = (s) => s.split('').map((c) => K(c, c));
const digits = '1234567890'.split('').map((c) => K(c, c));

// ---------- 主键区的通用行 ----------
const ROW_NUM = (first) => [first, ...digits, K('Minus', '-'), K('Equal', '='), K('Backspace', 'Backspace', 2)];
const ROW_TAB = [K('Tab', 'Tab', 1.5), ...letters('QWERTYUIOP'), K('BracketLeft', '['), K('BracketRight', ']'), K('Backslash', '\\', 1.5)];
const ROW_CAPS = [K('CapsLock', 'Caps', 1.75), ...letters('ASDFGHJKL'), K('Semicolon', ';'), K('Quote', "'"), K('Enter', 'Enter', 2.25)];
const ROW_SHIFT = (rightW) => [K('Shift', 'Shift', 2.25), ...letters('ZXCVBNM'), K('Comma', ','), K('Period', '.'), K('Slash', '/'), K('ShiftRight', 'Shift', rightW)];
const ROW_BOTTOM_FULL = [
  K('Ctrl', 'Ctrl', 1.25), K('Meta', 'Win', 1.25), K('Alt', 'Alt', 1.25), K('Space', 'Space', 6.25),
  K('AltRight', 'Alt', 1.25), K('MetaRight', 'Win', 1.25), K('ContextMenu', 'Menu', 1.25), K('CtrlRight', 'Ctrl', 1.25),
];
const F = (a, b) => { const r = []; for (let i = a; i <= b; i++) r.push(K('F' + i, 'F' + i)); return r; };

const ESC_TILDE = K('Escape', 'Esc `', 1, { ids: ['Escape', 'Backquote'] });

function place(list, x, y, out) {
  let cx = x;
  for (const k of list) {
    if (k.gap !== undefined) { cx += k.gap; continue; }
    out.push({ ...k, ids: k.ids || [k.id], x: cx, y });
    cx += k.w;
  }
  return cx;
}

// ---------- 104 键全尺寸 ----------
function full(withNumpad) {
  const out = [];
  place([K('Escape', 'Esc'), G(1), ...F(1, 4), G(0.5), ...F(5, 8), G(0.5), ...F(9, 12)], 0, 0, out);
  place([K('PrintScreen', 'PrtSc'), K('ScrollLock', 'ScrLk'), K('Pause', 'Pause')], 15.25, 0, out);
  const y = 1.25;
  place(ROW_NUM(K('Backquote', '`')), 0, y, out);
  place(ROW_TAB, 0, y + 1, out);
  place(ROW_CAPS, 0, y + 2, out);
  place(ROW_SHIFT(2.75), 0, y + 3, out);
  place(ROW_BOTTOM_FULL, 0, y + 4, out);
  place([K('Insert', 'Ins'), K('Home', 'Home'), K('PageUp', 'PgUp')], 15.25, y, out);
  place([K('Delete', 'Del'), K('End', 'End'), K('PageDown', 'PgDn')], 15.25, y + 1, out);
  place([K('ArrowUp', '↑')], 16.25, y + 3, out);
  place([K('ArrowLeft', '←'), K('ArrowDown', '↓'), K('ArrowRight', '→')], 15.25, y + 4, out);
  if (withNumpad) {
    const nx = 18.5;
    place([K('NumLock', 'Num'), K('NumpadDivide', '/'), K('NumpadMultiply', '*'), K('NumpadSubtract', '-')], nx, y, out);
    place([K('Numpad7', '7'), K('Numpad8', '8'), K('Numpad9', '9'), K('NumpadAdd', '+', 1, { h: 2 })], nx, y + 1, out);
    place([K('Numpad4', '4'), K('Numpad5', '5'), K('Numpad6', '6')], nx, y + 2, out);
    place([K('Numpad1', '1'), K('Numpad2', '2'), K('Numpad3', '3'), K('NumpadEnter', 'Enter', 1, { h: 2 })], nx, y + 3, out);
    place([K('Numpad0', '0', 2), K('NumpadDecimal', '.')], nx, y + 4, out);
  }
  return out;
}

// ---------- 75%（84 键） ----------
function p75() {
  const out = [];
  place([K('Escape', 'Esc'), ...F(1, 12), K('PrintScreen', 'PrtSc'), K('Insert', 'Ins'), K('Delete', 'Del')], 0, 0, out);
  const y = 1.25;
  place([...ROW_NUM(K('Backquote', '`')), K('Home', 'Home')], 0, y, out);
  place([...ROW_TAB, K('PageUp', 'PgUp')], 0, y + 1, out);
  place([...ROW_CAPS, K('PageDown', 'PgDn')], 0, y + 2, out);
  place([...ROW_SHIFT(1.75), K('ArrowUp', '↑'), K('End', 'End')], 0, y + 3, out);
  place([
    K('Ctrl', 'Ctrl', 1.25), K('Meta', 'Win', 1.25), K('Alt', 'Alt', 1.25), K('Space', 'Space', 6.25),
    K('AltRight', 'Alt'), K('ContextMenu', 'Menu'), K('CtrlRight', 'Ctrl'),
    K('ArrowLeft', '←'), K('ArrowDown', '↓'), K('ArrowRight', '→'),
  ], 0, y + 4, out);
  return out;
}

// ---------- 65%（68 键） ----------
function p65() {
  const out = [];
  place([...ROW_NUM(ESC_TILDE), K('Delete', 'Del')], 0, 0, out);
  place([...ROW_TAB, K('PageUp', 'PgUp')], 0, 1, out);
  place([...ROW_CAPS, K('PageDown', 'PgDn')], 0, 2, out);
  place([...ROW_SHIFT(1.75), K('ArrowUp', '↑'), K('End', 'End')], 0, 3, out);
  place([
    K('Ctrl', 'Ctrl', 1.25), K('Meta', 'Win', 1.25), K('Alt', 'Alt', 1.25), K('Space', 'Space', 6.25),
    K('AltRight', 'Alt'), K('ContextMenu', 'Menu'), K('CtrlRight', 'Ctrl'),
    K('ArrowLeft', '←'), K('ArrowDown', '↓'), K('ArrowRight', '→'),
  ], 0, 4, out);
  return out;
}

// ---------- 60%（61 键） ----------
function p60() {
  const out = [];
  place(ROW_NUM(ESC_TILDE), 0, 0, out);
  place(ROW_TAB, 0, 1, out);
  place(ROW_CAPS, 0, 2, out);
  place(ROW_SHIFT(2.75), 0, 3, out);
  place(ROW_BOTTOM_FULL, 0, 4, out);
  return out;
}

// ---------- 鼠标 ----------
const MOUSE = [
  { id: 'MouseLeft', label: '左键', x: 0, y: 0, w: 1.35, h: 1.8 },
  { id: 'MouseMiddle', label: '中', x: 1.4, y: 0.2, w: 0.7, h: 1.1 },
  { id: 'MouseRight', label: '右键', x: 2.15, y: 0, w: 1.35, h: 1.8 },
  { id: 'Mouse4', label: '后退', x: 0, y: 2.0, w: 1.7, h: 0.9 },
  { id: 'Mouse5', label: '前进', x: 1.8, y: 2.0, w: 1.7, h: 0.9 },
].map((k) => ({ ...k, ids: [k.id] }));

const LAYOUTS = [
  { id: 'full104', name: '104 键（全尺寸）', keys: full(true) },
  { id: 'tkl87', name: '87 键（TKL）', keys: full(false) },
  { id: 'p75', name: '75%（84 键）', keys: p75() },
  { id: 'p65', name: '65%（68 键）', keys: p65() },
  { id: 'p60', name: '60%（61 键）', keys: p60() },
];

// ---------- 排名列表等处显示的完整名称 ----------
const NAMES = {
  Escape: 'Esc', Backquote: '`', Minus: '-', Equal: '=', Backspace: 'Backspace', Tab: 'Tab',
  BracketLeft: '[', BracketRight: ']', Backslash: '\\', CapsLock: 'Caps Lock', Semicolon: ';', Quote: "'",
  Enter: 'Enter', Comma: ',', Period: '.', Slash: '/', Space: '空格',
  Shift: '左 Shift', ShiftRight: '右 Shift', Ctrl: '左 Ctrl', CtrlRight: '右 Ctrl',
  Alt: '左 Alt', AltRight: '右 Alt', Meta: '左 Win', MetaRight: '右 Win', ContextMenu: '菜单键',
  PrintScreen: 'PrtSc', ScrollLock: 'Scroll Lock', Pause: 'Pause', Insert: 'Insert', Home: 'Home',
  PageUp: 'PgUp', Delete: 'Delete', End: 'End', PageDown: 'PgDn',
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
  NumLock: 'Num Lock', NumpadDivide: '小键盘 /', NumpadMultiply: '小键盘 *', NumpadSubtract: '小键盘 -',
  NumpadAdd: '小键盘 +', NumpadEnter: '小键盘 Enter', NumpadDecimal: '小键盘 .',
  MouseLeft: '鼠标左键', MouseRight: '鼠标右键', MouseMiddle: '鼠标中键',
  Mouse4: '鼠标侧键（后退）', Mouse5: '鼠标侧键（前进）',
  Sleep: '睡眠键', KanaMode: '假名键', KanjiMode: '汉字键', Process: '输入法处理键',
  IntlYen: '日文键盘 ¥ 键', IntlBackslash: 'ISO 键盘附加键',
  BrowserBack: '浏览器后退', BrowserForward: '浏览器前进', BrowserRefresh: '浏览器刷新',
  BrowserStop: '浏览器停止', BrowserSearch: '浏览器搜索', BrowserFavorites: '浏览器收藏夹', BrowserHome: '浏览器主页',
  AudioVolumeMute: '静音', AudioVolumeDown: '降低音量', AudioVolumeUp: '提高音量',
  MediaTrackNext: '下一曲', MediaTrackPrevious: '上一曲', MediaStop: '停止播放', MediaPlayPause: '播放/暂停',
  LaunchMediaPlayer: '媒体播放器键', LaunchApp1: '应用程序键 1', LaunchApp2: '应用程序键 2', LaunchMusicPlayer: '音乐播放器键',
};
for (let i = 0; i <= 9; i++) NAMES['Numpad' + i] = '小键盘 ' + i;

const KNOWN_IDS = new Set();
for (const l of LAYOUTS) for (const k of l.keys) for (const id of k.ids) KNOWN_IDS.add(id);
for (const k of MOUSE) KNOWN_IDS.add(k.id);

/**
 * libuiohook 的扫描码，只在 uiohook-napi 的 UiohookKey 里找不到对应名称时作为兜底。
 */
const FALLBACK_CODES = {
  Pause: 0x0e45, ContextMenu: 0x0e5d, PrintScreen: 0x0e37, ScrollLock: 0x0046, NumLock: 0x0045,
  NumpadEnter: 0x0e1c, NumpadDivide: 0x0e35, NumpadMultiply: 0x0037, NumpadSubtract: 0x004a,
  NumpadAdd: 0x004e, NumpadDecimal: 0x0053,
  Numpad0: 0x0052, Numpad1: 0x004f, Numpad2: 0x0050, Numpad3: 0x0051, Numpad4: 0x004b,
  Numpad5: 0x004c, Numpad6: 0x004d, Numpad7: 0x0047, Numpad8: 0x0048, Numpad9: 0x0049,
  MetaRight: 0x0e5c, CtrlRight: 0x0e1d, AltRight: 0x0e38, ShiftRight: 0x0036,
  // Windows 版 libuiohook 可以上报这些键，但 uiohook-napi 没有导出对应常量。
  Sleep: 0xe05f, KanaMode: 0x0070, KanjiMode: 0x0079, Process: 0xe064,
  IntlYen: 0x007d, IntlBackslash: 0x0e46,
  BrowserBack: 0xe06a, BrowserForward: 0xe069, BrowserRefresh: 0xe067, BrowserStop: 0xe068,
  BrowserSearch: 0xe065, BrowserFavorites: 0xe066, BrowserHome: 0xe032,
  AudioVolumeMute: 0xe020, AudioVolumeDown: 0xe02e, AudioVolumeUp: 0xe030,
  MediaTrackNext: 0xe019, MediaTrackPrevious: 0xe010, MediaStop: 0xe024, MediaPlayPause: 0xe022,
  LaunchMediaPlayer: 0xe06d, LaunchApp1: 0xe06c, LaunchApp2: 0xe021, LaunchMusicPlayer: 0xe03c,
};

module.exports = { LAYOUTS, MOUSE, NAMES, KNOWN_IDS, FALLBACK_CODES };
