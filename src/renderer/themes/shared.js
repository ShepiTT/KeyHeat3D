export const RANGE_LABELS = {
  today: ['今天', '今天'],
  '7d': ['7 天', '最近 7 天'],
  '30d': ['30 天', '最近 30 天'],
  all: ['全部', '全部时间'],
  custom: ['自定义', '所选日期内'],
};

export const ACCENTS = [
  ['蓝', '#0a84ff'], ['紫', '#8e5cf7'], ['粉', '#ff4f8b'], ['红', '#e5383b'],
  ['橙', '#ff8a00'], ['黄', '#f2b705'], ['绿', '#22a95b'], ['石墨', '#5b6270'],
];

function channels(color) {
  return [1, 3, 5].map((offset) => Number.parseInt(color.slice(offset, offset + 2), 16));
}

export function mix(from, to, t) {
  const end = channels(to);
  const result = channels(from).map((value, i) => Math.round(value + (end[i] - value) * t));
  return `#${result.map((value) => value.toString(16).padStart(2, '0')).join('')}`;
}

export const tint = (color, t) => mix(color, '#ffffff', t);
export const shade = (color, t) => mix(color, '#000000', t);

export function luminance(color) {
  const [r, g, b] = channels(color);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

export function ranges(extraClass = '') {
  return `<div class="range-controls"><nav class="rg seg ${extraClass}" aria-label="时间范围">${
    Object.entries(RANGE_LABELS).map(([id, [label]]) => `<button type="button" data-r="${id}">${label}</button>`).join('')
  }</nav><span class="custom" data-s="custom" hidden>
    <input type="date" data-s="fromDate" aria-label="起始日期"><span aria-hidden="true">–</span>
    <input type="date" data-s="toDate" aria-label="结束日期">
  </span></div>`;
}

export const layoutSel = () => '<select data-s="layout" aria-label="键盘布局"></select>';
export const viewButtons = () => `<div class="view-buttons seg" aria-label="键盘视图">
  <button type="button" data-view="3d">3D</button><button type="button" data-view="2d">2D</button>
</div>`;
export const exportBtn = () => '<button type="button" class="ex" data-a="export">导出 CSV</button>';
export const pauseBtn = () => '<button type="button" class="pz" data-a="pause"><i aria-hidden="true"></i><span data-s="pzt"></span></button>';
export const themeBtn = () => `<button type="button" class="theme-button" data-a="theme" aria-haspopup="dialog" aria-expanded="false">
  <i class="accent-dot" aria-hidden="true"></i><span data-s="themeName"></span>
</button>`;
export const ctlL = () => layoutSel() + viewButtons() + exportBtn() + pauseBtn() + themeBtn();

export const AXIS = '<div class="axis" aria-hidden="true"><span>0 点</span><span>6</span><span>12</span><span>18</span><span>23</span></div>';

export const blocks = {
  rank: () => `<h3 data-s="rankTitle"></h3><p class="sub" data-s="rankSub"></p><ol class="rk" data-s="rank"></ol>
    <button type="button" class="rank-expand" data-a="rank-expand" aria-expanded="false" hidden></button>`,
  hours: () => `<h3 data-s="hoursTitle"></h3><p class="sub" data-s="hoursSub"></p><div class="hr" data-s="hours"></div>${AXIS}`,
  mods: () => '<h3 data-s="modsTitle"></h3><p class="sub">左右两侧分开统计</p><div data-s="mods"></div>',
  mouse: () => '<h3 data-s="mouseTitle"></h3><p class="sub" data-s="mouseSub"></p><div data-s="mouse"></div>',
};

export function stage() {
  return `<section class="stage" data-s="stage" aria-label="键盘热力图">
    <div class="board-view" data-s="view3d"><div class="loading" data-s="loading">正在加载 3D 键盘…</div></div>
    <div class="board-view board-view-2d" data-s="view2d" hidden><div class="board" data-s="board2d"></div></div>
    <footer class="stage-foot sfoot"><div class="stage-tools"><span class="heat-legend">少<i class="ramp"></i>多</span>
      <div class="scale-buttons seg" aria-label="色阶"><button type="button" data-scale="log">对数</button>
      <button type="button" data-scale="linear">线性</button></div></div><span class="stage-hint" data-s="hint"></span></footer>
    <div class="tip" data-s="tip" hidden></div>
  </section>`;
}

export function footer(compact = false) {
  const path = '<span class="data-path" data-s="dataPath"></span> <a href="#" data-a="data">打开数据目录</a>';
  return compact ? `<span class="data-footer compact">${path}</span>` : `<footer class="data-footer">
    <span>只在本机统计每个键按了多少次，不记录输入内容和按键顺序。</span><span>${path}</span>
  </footer>`;
}
