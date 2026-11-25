import { blocks, ctlL, mix, ranges } from './shared.js';
import { THREE_PRESETS } from './three-presets.js';

const INK = '#1b2412';
const screenColor = (accent) => mix('#a9b68e', accent, .18);

export default {
  id: 'lcd',
  name: '液晶',
  desc: '数码管数字，刻度屏',
  template: () => `
    <div class="lc-dev">
      <header class="lc-head">
        <span class="lc-brand">KEYHEAT·3D</span><span>KH-104 按键计数器</span>
        <span class="sp"></span><span data-s="pzt2"></span><span class="lc-led" aria-hidden="true"></span>
      </header>
      <div class="lc-panel" role="group" aria-label="统计与视图控制">${ranges()}${ctlL()}</div>
      <div class="lc-screen">
        <div class="lc-top">
          <div class="lc-count">
            <div class="lc-lab" data-s="rlabel"></div><div data-s="seg7"></div><div class="lc-lab">次按键</div>
          </div>
          <div class="lc-side">
            <div><span class="lc-lab">最常用</span><b data-s="topName"></b><i data-s="topCount"></i></div>
            <div><span class="lc-lab">鼠标</span><b class="num" data-s="mouseTotal"></b><i>次</i></div>
            <div><span class="lc-lab">用到</span><b class="num" data-s="keysUsed"></b><i>个键</i></div>
          </div>
        </div>
        <div class="lc-scale">
          <div class="lc-lab lc-scale-label" data-s="hoursTitle"></div>
          <div class="hr" data-s="hours"></div>
          <div class="lc-ticks" aria-hidden="true"><span>0</span><span>6</span><span>12</span><span>18</span><span>23</span></div>
        </div>
        <div class="kbwrap" data-s="kb"></div>
      </div>
      <div class="lc-lower">
        <section class="lc-scr2">${blocks.rank()}</section>
        <section class="lc-scr2">
          <h3 data-s="modsTitle"></h3><div data-s="mods"></div>
          <h3 class="lc-mouse-heading" data-s="mouseTitle"></h3><div data-s="mouse"></div>
        </section>
      </div>
    </div>`,
  ramp: (accent) => {
    const screen = screenColor(accent);
    return [mix(screen, INK, .16), mix(screen, INK, .42), mix(screen, INK, .7), INK];
  },
  fgDark: INK,
  fgLight: screenColor,
  keyMax: 34,
  quantize: 4,
  rankN: 8,
  zeroMouse: 'transparent',
  three: THREE_PRESETS.lcd,
};
