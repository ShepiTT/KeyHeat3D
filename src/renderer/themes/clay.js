import { blocks, ctlL, ranges, shade, tint } from './shared.js';
import { THREE_PRESETS } from './three-presets.js';

export default {
  id: 'clay',
  name: '黏土',
  desc: '圆润的立体控件，柔和阴影',
  template: () => `
    <header class="cl-top">
      <div class="cl-brand"><span class="cl-blob" aria-hidden="true"></span>KeyHeat3D</div>${ranges()}<span class="sp"></span>${ctlL()}
    </header>
    <div class="cl-hero">
      <section class="cl-card cl-big">
        <span class="cl-lab" data-s="rlabel"></span><div class="cl-n num" data-s="total"></div><p data-s="lede"></p>
      </section>
      <section class="cl-card cl-topk">
        <div class="cl-cap" data-s="topGlyph"></div>
        <div><span>最常用</span><b data-s="topName"></b><span data-s="topCount"></span></div>
      </section>
    </div>
    <section class="cl-tray"><div class="kbwrap" data-s="kb"></div></section>
    <div class="cl-row">
      <section class="cl-card">${blocks.rank()}</section>
      <section class="cl-card">${blocks.hours()}</section>
      <section class="cl-card">${blocks.mods()}</section>
      <section class="cl-card">${blocks.mouse()}</section>
    </div>`,
  ramp: (accent) => [tint(accent, .82), tint(accent, .5), accent, shade(accent, .25)],
  fgDark: '#2d2640',
  fgLight: '#ffffff',
  keyMax: 40,
  quantize: 0,
  rankN: 10,
  zeroMouse: 'transparent',
  three: THREE_PRESETS.clay,
};
