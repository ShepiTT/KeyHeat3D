import { blocks, exportBtn, layoutSel, pauseBtn, ranges, shade, themeBtn, tint, viewButtons } from './shared.js';
import { THREE_PRESETS } from './three-presets.js';

export default {
  id: 'cyber',
  name: '赛博朋克',
  desc: '霓虹切角面板，分段圆环',
  template: () => `
    <div class="cy">
      <aside class="cy-side">
        <div class="cy-logo">KEYHEAT<b>3D</b></div>
        <div class="cy-lab">// 时间范围</div>
        ${ranges('cy-v')}
        <div class="cy-lab">// 布局</div>
        ${layoutSel()}
        <div class="cy-lab">// 操作</div>
        ${viewButtons()}${exportBtn()}${pauseBtn()}${themeBtn()}
        <div class="cy-foot">LOCAL ONLY<br>只记次数，不记内容</div>
      </aside>
      <div class="cy-main">
        <section class="cy-p cy-hero">
          <div>
            <div class="cy-lab">TOTAL KEYSTROKES // <span data-s="rlabel"></span></div>
            <div class="cy-n num" data-s="total"></div><p data-s="lede"></p>
          </div>
          <div class="cy-gauge" data-s="gauge"></div>
        </section>
        <section class="cy-p"><div class="kbwrap" data-s="kb"></div></section>
        <div class="cy-row">
          <section class="cy-p">${blocks.rank()}</section>
          <section class="cy-p">${blocks.hours()}<h3 class="cy-mods" data-s="modsTitle"></h3><div data-s="mods"></div></section>
          <section class="cy-p">${blocks.mouse()}</section>
        </div>
      </div>
    </div>`,
  ramp: (accent) => ['#1a2236', shade(accent, .5), accent, tint(accent, .6)],
  fgDark: '#05070d',
  fgLight: '#ffffff',
  keyMax: 38,
  quantize: 0,
  rankN: 10,
  zeroMouse: '#0f1526',
  three: THREE_PRESETS.cyber,
};
