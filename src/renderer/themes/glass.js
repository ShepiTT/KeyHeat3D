import { blocks, ctlL, footer, ranges, shade, tint } from './shared.js';
import { THREE_PRESETS } from './three-presets.js';

export default {
  id: 'glass',
  name: '玻璃',
  desc: '磨砂卡片叠在彩色光斑上',
  template: () => `
    <div class="gl">
      <div class="gl-bg" aria-hidden="true"><i></i><i></i><i></i></div>
      <header class="gp gl-top">
        <b class="gl-brand">KeyHeat3D</b>${ranges()}<span class="sp"></span>${ctlL()}
      </header>
      <section class="gp gl-hero">
        <div class="gl-n num" data-s="total"></div>
        <div class="gl-u">次按键 · <span data-s="rlabel"></span></div>
        <p class="gl-lede" data-s="lede"></p>
      </section>
      <section class="gp gl-mouse">${blocks.mouse()}</section>
      <section class="gp gl-kb"><div class="kbwrap" data-s="kb"></div></section>
      <section class="gp gl-rank">${blocks.rank()}</section>
      <section class="gp gl-hours">${blocks.hours()}</section>
      <section class="gp gl-mods">${blocks.mods()}</section>
      ${footer()}
    </div>`,
  ramp: (accent) => [tint(accent, .72), tint(accent, .35), accent, shade(accent, .35)],
  fgDark: '#1d1d1f',
  fgLight: '#ffffff',
  keyMax: 40,
  quantize: 0,
  rankN: 10,
  zeroMouse: 'rgba(255,255,255,.12)',
  three: THREE_PRESETS.glass,
};
