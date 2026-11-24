'use strict';
/**
 * 全局按键采集（uiohook-napi，Windows 低级键盘/鼠标钩子）。
 * - 每次物理按下只计一次：长按产生的自动连发会被去重
 * - 左右 Ctrl / Shift / Alt / Win 分别计数
 * - 只把「哪个键」交给回调，不保留任何输入内容或顺序
 */
const { uIOhook, UiohookKey } = require('uiohook-napi');
const { KNOWN_IDS, FALLBACK_CODES } = require('../shared/layouts');

// 自动连发间隔通常 < 600ms；超过这个时间又收到 keydown，视为松开事件丢失后的新一次按下
const REPEAT_WINDOW_MS = 1200;

const MOUSE_BUTTONS = { 1: 'MouseLeft', 2: 'MouseRight', 3: 'MouseMiddle', 4: 'Mouse4', 5: 'Mouse5' };

function buildCodeMap() {
  const map = new Map();
  const entries = Object.entries(UiohookKey);
  // 优先使用布局里用到的名称，避免别名抢占
  for (const [name, code] of entries) if (KNOWN_IDS.has(name) && !map.has(code)) map.set(code, name);
  for (const [name, code] of entries) if (!map.has(code)) map.set(code, name);
  const known = new Set(map.values());
  for (const [name, code] of Object.entries(FALLBACK_CODES)) {
    if (!known.has(name) && !map.has(code)) map.set(code, name);
  }
  return map;
}

class Capture {
  constructor(onPress) {
    this.onPress = onPress;
    this.paused = false;
    this.down = new Map(); // keyId -> 最近一次 keydown 的时间
    this.codeMap = buildCodeMap();
  }

  keyId(code) {
    // 关闭 NumLock 时小键盘会以 0xEE00 | 扫描码 的形式上报（UiohookKey 里叫 NumpadEnd 等），
    // 先还原成对应的小键盘数字键，否则会被记成另一个键名
    if ((code & 0xff00) === 0xee00) code &= 0x00ff;
    // Windows 将关闭 NumLock 时的数字 5 上报为 VK_CLEAR（0xE04C）
    if (code === 0xe04c) return 'Numpad5';
    const id = this.codeMap.get(code);
    return id || 'VC_0x' + code.toString(16).toUpperCase();
  }

  start() {
    uIOhook.on('keydown', (e) => {
      if (!e.keycode) return; // libuiohook 没有返回可识别的按键码
      const id = this.keyId(e.keycode);
      const now = performance.now();
      const last = this.down.get(id);
      this.down.set(id, now);
      if (this.paused || (last !== undefined && now - last < REPEAT_WINDOW_MS)) return;
      this.onPress(id);
    });
    uIOhook.on('keyup', (e) => {
      if (!e.keycode) return;
      const id = this.keyId(e.keycode);
      const wasDown = this.down.delete(id);
      // 部分 Windows 系统只上报 PrtSc 松开，其他键只在按下时计数
      if (!this.paused && !wasDown && id === 'PrintScreen') this.onPress(id);
    });
    uIOhook.on('mousedown', (e) => {
      if (this.paused) return;
      this.onPress(MOUSE_BUTTONS[e.button] || 'Mouse' + e.button);
    });
    uIOhook.start();
  }

  setPaused(p) {
    this.paused = !!p;
  }

  stop() {
    try { uIOhook.stop(); } catch (_) { /* 忽略 */ }
  }
}

module.exports = { Capture };
