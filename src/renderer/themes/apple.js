import { blocks, ctlL, footer, ranges, shade, stage, tint } from './shared.js';
import { THREE_PRESETS } from './three-presets.js';

export default {
  id: 'apple',
  name: '苹果风',
  desc: '浅灰底、白卡片、柔和的银色键盘',
  template: () => `
    <main class="apple-page">
      <header class="apple-top">
        <div class="apple-brand">KeyHeat3D</div>
        ${ranges()}
        <div class="apple-tools">${ctlL()}</div>
      </header>
      <section class="apple-hero">
        <h1><span class="num" data-s="total"></span><small>次按键</small></h1>
        <p class="lede" data-s="lede"></p>
      </section>
      ${stage()}
      <div class="apple-grid">
        <article class="apple-card apple-rank">${blocks.rank()}</article>
        <article class="apple-card apple-hours">${blocks.hours()}</article>
        <article class="apple-card apple-mods">${blocks.mods()}</article>
        <article class="apple-card apple-mouse">${blocks.mouse()}</article>
      </div>
      ${footer()}
    </main>`,
  ramp: (accent) => accent === '#0071e3' ?
    ['#eef4fd', '#c9ddf8', '#93bdf3', '#4f95ec', '#0b6fe0', '#0050b8'] :
    [tint(accent, .93), tint(accent, .78), tint(accent, .55), tint(accent, .25), accent, shade(accent, .28)],
  fgDark: '#1d1d1f',
  fgLight: '#ffffff',
  keyMax: 54,
  quantize: 0,
  rankN: 10,
  cold2d: '#ffffff',
  zeroMouse: '#f5f5f7',
  three: THREE_PRESETS.apple,
};
