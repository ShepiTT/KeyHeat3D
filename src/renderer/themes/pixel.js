import { blocks, ctlL, ranges, shade, tint } from './shared.js';
import { THREE_PRESETS } from './three-presets.js';

export default {
  id: 'pixel',
  name: '像素',
  desc: '八位机边框，方块进度条',
  template: () => `
    <div class="px-hud">
      <div class="px-cell"><span>SCORE 按键</span><b class="num" data-s="total"></b></div>
      <div class="px-cell"><span>TOP 最常用</span><b data-s="topName"></b></div>
      <div class="px-cell"><span>CLICK 鼠标</span><b class="num" data-s="mouseTotal"></b></div>
      <div class="px-cell"><span>KEYS 用到</span><b class="num" data-s="keysUsed"></b></div>
    </div>
    <div class="px-bar">${ranges()}${ctlL()}<span class="px-blink">PRESS ANY KEY</span></div>
    <section class="px-frame px-kb"><div class="kbwrap" data-s="kb"></div></section>
    <div class="px-cols">
      <section class="px-frame">${blocks.rank()}</section>
      <div class="px-stack">
        <section class="px-frame">${blocks.hours()}</section>
        <section class="px-frame"><h3 data-s="modsTitle"></h3><div data-s="mods"></div></section>
        <section class="px-frame">${blocks.mouse()}</section>
      </div>
    </div>`,
  ramp: (accent) => ['#3b4a7a', shade(accent, .45), accent, tint(accent, .55)],
  fgDark: '#000000',
  fgLight: '#ffffff',
  keyMax: 38,
  quantize: 4,
  rankN: 10,
  zeroMouse: '#29366f',
  three: THREE_PRESETS.pixel,
};
