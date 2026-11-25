import { AXIS, exportBtn, footer, layoutSel, pauseBtn, ranges, shade, themeBtn, tint, viewButtons } from './shared.js';
import { THREE_PRESETS } from './three-presets.js';

export default {
  id: 'win9x',
  name: '千禧',
  desc: '灰色窗口、标题栏、立体饼图',
  template: () => `
    <div class="w9-win">
      <div class="w9-title">
        <span class="w9-ico" aria-hidden="true"></span>KeyHeat3D - 按键统计
      </div>
      <div class="w9-menu" role="group" aria-label="文件与视图">
        <details class="w9-file">
          <summary accesskey="f">文件(<u>F</u>)</summary>
          <div class="w9-file-panel">${exportBtn()}</div>
        </details>
        <div class="w9-views" role="group" aria-label="查看">
          <span aria-hidden="true">查看</span>${viewButtons()}
        </div>
      </div>
      <div class="w9-tool">
        ${ranges()}<span class="w9-sep"></span><label>布局 ${layoutSel()}</label>
        <span class="w9-sep"></span>${pauseBtn()}${themeBtn()}
      </div>
      <div class="w9-body">
        <fieldset class="w9-g"><legend>键盘</legend><div class="kbwrap" data-s="kb"></div></fieldset>
        <div class="w9-cols">
          <fieldset class="w9-g">
            <legend data-s="rankTitle"></legend>
            <div class="w9-lv"><table data-s="rankTable"></table></div>
          </fieldset>
          <div class="w9-right">
            <fieldset class="w9-g"><legend>前 5 个键的份额</legend><div data-s="pie"></div></fieldset>
            <fieldset class="w9-g"><legend data-s="hoursTitle"></legend><div class="hr" data-s="hours"></div>${AXIS}</fieldset>
            <fieldset class="w9-g"><legend data-s="modsTitle"></legend><div data-s="mods"></div></fieldset>
            <fieldset class="w9-g"><legend data-s="mouseTitle"></legend><div data-s="mouse"></div></fieldset>
          </div>
        </div>
      </div>
      <div class="w9-status">
        <span>键盘 <b data-s="total"></b> 次</span><span>鼠标 <b data-s="mouseTotal"></b> 次</span><span data-s="pzt2"></span>
        ${footer(true)}
      </div>
    </div>`,
  ramp: (accent) => ['#ffffff', tint(accent, .5), accent, shade(accent, .5)],
  fgDark: '#000000',
  fgLight: '#ffffff',
  keyMax: 34,
  quantize: 0,
  rankN: 10,
  zeroMouse: '#c0c0c0',
  three: THREE_PRESETS.win9x,
};
