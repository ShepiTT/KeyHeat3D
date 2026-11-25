import { blocks, ctlL, mix, ranges } from './shared.js';
import { THREE_PRESETS } from './three-presets.js';

export default {
  id: 'paper',
  name: '纸墨',
  desc: '报纸版式，宋体，红色印章',
  template: () => `
    <header class="pp-mast">
      <div class="pp-meta">
        <span data-s="date"></span>
        <span>本期用到 <span data-s="keysUsed"></span> 个键</span>
        <span>本机统计 · 不记内容</span>
      </div>
      <h1>按键日报</h1>
      <div class="pp-seal" aria-hidden="true">键</div>
      <div class="pp-nav">${ranges()}${ctlL()}</div>
    </header>
    <section class="pp-lead">
      <div class="pp-n num" data-s="total"></div>
      <div class="pp-u">次按键，<span data-s="rlabel"></span></div>
      <p class="pp-lede" data-s="lede"></p>
    </section>
    <figure class="pp-kb">
      <div class="kbwrap" data-s="kb"></div>
      <figcaption>图一　键位热度。颜色越深，按得越多。</figcaption>
    </figure>
    <div class="pp-cols">
      <section>${blocks.rank()}</section>
      <section>${blocks.hours()}<h3 class="pp-h2" data-s="modsTitle"></h3><div data-s="mods"></div></section>
      <section>${blocks.mouse()}</section>
    </div>`,
  ramp: (accent) => ['#e8dfcc', mix('#e8dfcc', accent, .45), accent, mix(accent, '#1f1b16', .6)],
  fgDark: '#1f1b16',
  fgLight: '#f3eee3',
  keyMax: 34,
  quantize: 0,
  rankN: 10,
  zeroMouse: 'transparent',
  three: THREE_PRESETS.paper,
};
