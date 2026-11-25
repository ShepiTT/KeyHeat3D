import { blocks, ctlL, ranges, shade, tint } from './shared.js';
import { THREE_PRESETS } from './three-presets.js';

export default {
  id: 'widget',
  name: '小组件',
  desc: '模块拼贴，活动圆环',
  template: () => `
    <header class="wd-top">
      <div><div class="wd-date" data-s="date"></div><h2>按键</h2></div>
      <div class="wd-ctl">${ranges()}${ctlL()}</div>
    </header>
    <div class="wd-grid">
      <section class="w s w-total">
        <span class="wl">键盘按键</span>
        <b class="num" data-s="total"></b>
        <span class="wf" data-s="rlabel"></span>
      </section>
      <section class="w w-rings" aria-label="键盘按键占比"><div class="rings" data-s="rings"></div></section>
      <section class="w s w-top">
        <span class="wl">最常用</span>
        <b class="w-glyph" data-s="topGlyph"></b>
        <span class="wf" data-s="topCount"></span>
      </section>
      <section class="w w-kb"><div class="kbwrap" data-s="kb"></div></section>
      <section class="w w-hours">${blocks.hours()}</section>
      <section class="w w-mods">${blocks.mods()}</section>
      <section class="w w-rank">${blocks.rank()}</section>
      <section class="w w-mouse">${blocks.mouse()}</section>
    </div>`,
  ramp: (accent) => [tint(accent, .86), tint(accent, .55), accent, shade(accent, .38)],
  fgDark: '#1d1d1f',
  fgLight: '#ffffff',
  keyMax: 40,
  quantize: 0,
  rankN: 8,
  zeroMouse: '#f2f2f7',
  three: THREE_PRESETS.widget,
};
