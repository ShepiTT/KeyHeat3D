import { THEMES } from './themes/index.js';
import { ACCENTS, RANGE_LABELS, footer, luminance, mix, shade, stage, tint } from './themes/shared.js';

const api = window.keyheat;
const root = document.getElementById('app');
const init = await api.getInit();
const names = init.names;
const nameOf = (id) => names[id] || id;
const mouseNames = {
  MouseLeft: '左键', MouseRight: '右键', MouseMiddle: '中键', Mouse4: '侧键 · 后退', Mouse5: '侧键 · 前进',
};
const modifiers = [
  ['Ctrl', 'Ctrl', 'CtrlRight'], ['Shift', 'Shift', 'ShiftRight'],
  ['Alt', 'Alt', 'AltRight'], ['Win', 'Meta', 'MetaRight'],
];
const themeIds = Object.keys(THEMES);
const date = new Date();
const weekAgo = new Date(date);
weekAgo.setDate(weekAgo.getDate() - 6);

const state = {
  theme: themeIds.includes(localStorage.getItem('theme')) ? localStorage.getItem('theme') : 'apple',
  accent: ACCENTS.some(([, color]) => color === localStorage.getItem('accent')) ? localStorage.getItem('accent') : ACCENTS[0][1],
  layout: init.layouts.some(({ id }) => id === localStorage.getItem('layout')) ? localStorage.getItem('layout') : init.layouts[0].id,
  view: localStorage.getItem('view') === '2d' ? '2d' : '3d',
  scale: localStorage.getItem('scale') === 'linear' ? 'linear' : 'log',
  range: 'today',
  fromDate: ymd(weekAgo),
  toDate: ymd(date),
  showAll: false,
  paused: init.paused,
  counts: {},
  hours: new Array(24).fill(0),
  keyboard: [],
  mouse: [],
  keyboardTotal: 0,
  mouseTotal: 0,
  rank: new Map(),
};

const esc = (text) => String(text).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const number = (n) => n.toLocaleString('zh-CN');
const percent = (n, total) => total ? (n / total * 100).toFixed(1) + '%' : '0%';
const share = (n, total) => total ? n / total : 0;
const slot = (id) => root.querySelector(`[data-s="${id}"]`);
const slots = (id) => root.querySelectorAll(`[data-s="${id}"]`);
const text = (id, value) => slots(id).forEach((el) => { el.textContent = value; });
const html = (id, value) => slots(id).forEach((el) => { el.innerHTML = value; });
const theme = () => THEMES[state.theme];
const accent = () => state.theme === 'apple' && state.accent === ACCENTS[0][1] ? '#0071e3' : state.accent;
const layout = () => init.layouts.find(({ id }) => id === state.layout);
const groupTotal = (rows) => rows.reduce((total, [, value]) => total + value, 0);
const count = (id) => state.counts[id] || 0;
const keyCount = (key) => key.ids.reduce((total, id) => total + count(id), 0);

function ymd(d) {
  return [d.getFullYear(), d.getMonth() + 1, d.getDate()].map((n) => String(n).padStart(2, '0')).join('-');
}

function rangeMs() {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(0, 0, 0, 0);
  const fromDaysAgo = (days) => {
    const from = new Date(midnight);
    from.setDate(from.getDate() - days);
    return +from;
  };
  switch (state.range) {
    case '7d': return [fromDaysAgo(6), +now, '最近7天'];
    case '30d': return [fromDaysAgo(29), +now, '最近30天'];
    case 'all': return [0, +now, '全部'];
    case 'custom': {
      if (!state.fromDate || !state.toDate) break;
      const [a, b] = [state.fromDate, state.toDate].sort();
      const first = new Date(a + 'T00:00:00');
      const last = new Date(b + 'T00:00:00');
      last.setDate(last.getDate() + 1);
      return [+first, +last, `${a}_${b}`];
    }
  }
  return [+midnight, +now, '今天'];
}

function shortCount(n) {
  if (n < 10000) return number(n);
  if (n < 1e6) return (n / 1000).toFixed(n < 1e5 ? 1 : 0) + 'k';
  return (n / 1e6).toFixed(1) + 'M';
}

function normalize(value, max) {
  if (!value || !max) return 0;
  return state.scale === 'log' ? Math.log1p(value) / Math.log1p(max) : value / max;
}

function colorAt(t) {
  const stops = theme().ramp(accent());
  const steps = theme().quantize;
  const level = steps ? Math.max(1, Math.ceil(t * steps)) / steps : t;
  const position = Math.min(1, Math.max(0, level)) * (stops.length - 1);
  const lower = Math.min(Math.floor(position), stops.length - 2);
  return mix(stops[lower], stops[lower + 1], position - lower);
}

function visualFor(key, max) {
  const current = theme();
  const value = keyCount(key);
  const t = normalize(value, max);
  const cold = current.cold2d || current.three.cap.color;
  const color = value ? colorAt(t) : typeof cold === 'function' ? cold(accent()) : cold;
  const dark = luminance(color) < 0.55;
  const foreground = dark ? current.fgLight || '#ffffff' : current.fgDark || '#1d1d1f';
  return { count: value, t, color, dark, foreground: typeof foreground === 'function' ? foreground(accent()) : foreground };
}

function summarize() {
  const rows = Object.entries(state.counts).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  state.keyboard = rows.filter(([id]) => !id.startsWith('Mouse'));
  state.mouse = rows.filter(([id]) => id.startsWith('Mouse'));
  state.keyboardTotal = groupTotal(state.keyboard);
  state.mouseTotal = groupTotal(state.mouse);
  state.rank = new Map();
  for (const group of [state.keyboard, state.mouse]) {
    group.forEach(([id], index) => state.rank.set(id, index + 1));
  }
}

function hourName(hour) {
  if (hour === 0) return '午夜 12 点';
  if (hour < 6) return `凌晨 ${hour} 点`;
  if (hour < 12) return `上午 ${hour} 点`;
  if (hour === 12) return '中午 12 点';
  if (hour < 18) return `下午 ${hour - 12} 点`;
  return `晚上 ${hour - 12} 点`;
}

function rankRows() {
  const shown = new Set(layout().keys.flatMap((key) => key.ids));
  const entries = state.showAll ? state.keyboard : state.keyboard.slice(0, theme().rankN || 10);
  const top = entries[0]?.[1] || 1;
  const itemName = (id) => {
    const off = shown.has(id) ? '' : '<small class="off-layout"> · 当前布局未显示</small>';
    return `<span>${esc(nameOf(id))}${off}</span>`;
  };
  html('rank', entries.length ? entries.map(([id, n], index) => `<li><span class="n">${index + 1}</span>
    <span class="nm">${itemName(id)}<span class="bar"><i style="width:${n / top * 100}%"></i></span></span>
    <span class="cnt">${number(n)}</span><span class="pct">${percent(n, state.keyboardTotal)}</span></li>`).join('') :
    '<li class="empty">还没有数据</li>');
  html('rankTable', `<thead><tr><th>#</th><th>按键</th><th class="r">次数</th><th class="r">占比</th></tr></thead><tbody>${
    state.keyboard.map(([id, n], index) => `<tr><td>${index + 1}</td><td>${itemName(id)}</td>
      <td class="r">${number(n)}</td><td class="r">${percent(n, state.keyboardTotal)}</td></tr>`).join('')
  }${state.keyboard.length ? '' : '<tr><td colspan="4">还没有数据</td></tr>'}</tbody>`);
  const expand = root.querySelector('[data-a="rank-expand"]');
  if (expand) {
    expand.hidden = state.keyboard.length <= (theme().rankN || 10);
    expand.textContent = state.showAll ? '收起' : `显示全部 ${state.keyboard.length} 个键`;
    expand.setAttribute('aria-expanded', String(state.showAll));
  }
}

function renderHours() {
  const max = Math.max(0, ...state.hours);
  const peak = max ? state.hours.indexOf(max) : -1;
  text('hoursTitle', max ? `${hourName(peak)}最忙` : '还没有按键时段记录');
  text('hoursSub', `这个小时段共 ${number(max)} 次，占 ${Math.round(share(max, state.keyboardTotal) * 100)}%`);
  html('hours', state.hours.map((n, h) => `<i class="${h === peak ? 'peak' : ''}"
    style="height:${Math.max(2, share(n, max) * 100)}%" title="${h}:00–${h}:59 · ${number(n)} 次"></i>`).join(''));
}

function renderModifiers() {
  let left = 0;
  let total = 0;
  html('mods', modifiers.map(([name, l, r]) => {
    const a = count(l);
    const b = count(r);
    left += a;
    total += a + b;
    const labels = a || b ? `<span class="a" style="--ratio:${Math.min(86, Math.max(14, a / (a + b) * 100))}%">左 ${number(a)}</span>
      <span class="b">右 ${number(b)}</span>` : '<span class="b none">还没按过</span>';
    return `<div class="md mod"><span>${name}</span><div class="trk" title="左 ${number(a)} · 右 ${number(b)}">${labels}</div></div>`;
  }).join(''));
  text('modsTitle', total ? `左手修饰键占 ${Math.round(left / total * 100)}%` : '修饰键还没按过');
  return share(left, total);
}

function renderMouse(label) {
  const [first, max] = state.mouse[0] || ['', 0];
  const color = (id) => count(id) ? colorAt(normalize(count(id), max)) : theme().zeroMouse || '#f5f5f7';
  const ordered = Object.keys(mouseNames).map((id) => [id, count(id)]).sort((a, b) => b[1] - a[1]);
  const fill = (id) => `class="mz z" data-m="${id}" style="fill:${color(id)}"`;
  text('mouseTitle', max ? `${mouseNames[first] || nameOf(first)}占 ${Math.round(max / state.mouseTotal * 100)}%` : '鼠标还没点过');
  text('mouseSub', `${label}共点击 ${number(state.mouseTotal)} 次`);
  const diagram = state.theme === 'apple' ? `
    <defs><clipPath id="apple-mouse-outline"><rect x="14" y="4" width="80" height="150" rx="40"/></clipPath></defs>
    <rect ${fill('Mouse4')} x="7" y="80" width="10" height="20" rx="3"/>
    <rect ${fill('Mouse5')} x="7" y="103" width="10" height="16" rx="3"/>
    <rect x="14" y="4" width="80" height="150" rx="40" fill="#fafafc"/>
    <g clip-path="url(#apple-mouse-outline)">
      <rect ${fill('MouseLeft')} x="14" y="4" width="40" height="62"/>
      <rect ${fill('MouseRight')} x="54" y="4" width="40" height="62"/>
    </g>
    <path class="mo" d="M54 4V66M14 66H94"/>
    <rect ${fill('MouseMiddle')} x="49.5" y="20" width="9" height="24" rx="4.5"/>
    <rect class="mo" x="14" y="4" width="80" height="150" rx="40"/>` : `
    <rect ${fill('Mouse4')} x="4" y="80" width="10" height="20" rx="3"/>
    <rect ${fill('Mouse5')} x="4" y="103" width="10" height="16" rx="3"/>
    <path ${fill('MouseLeft')} d="M54 6 C32 6 16 22 16 46 L16 66 L54 66 Z"/>
    <path ${fill('MouseRight')} d="M54 6 C76 6 92 22 92 46 L92 66 L54 66 Z"/>
    <rect ${fill('MouseMiddle')} x="49.5" y="20" width="9" height="24" rx="4.5"/>
    <path class="mo" d="M16 66 L16 114 C16 136 32 154 54 154 C76 154 92 136 92 114 L92 66"/>`;
  html('mouse', `<div class="ms mwrap"><svg viewBox="0 0 100 160" class="msvg" aria-hidden="true">${diagram}</svg><ul class="ml mlist">
    ${ordered.map(([id, n]) => `<li><span>${mouseNames[id]}</span><span class="c">${number(n)}</span>
      <span class="p">${percent(n, state.mouseTotal)}</span></li>`).join('')}
  </ul></div>`);
}

function rings(values) {
  const radii = [52, 39, 26];
  const labels = ['字母键', '前 10 个键', '左手修饰键'];
  const colors = [accent(), tint(accent(), 0.42), shade(accent(), 0.3)];
  const circles = values.map((value, i) => {
    const radius = radii[i];
    const circumference = 2 * Math.PI * radius;
    return `<circle cx="60" cy="60" r="${radius}" stroke="${colors[i]}" stroke-opacity=".16"/>
      ${value ? `<circle cx="60" cy="60" r="${radius}" stroke="${colors[i]}"
        stroke-dasharray="${circumference * value} ${circumference}"/>` : ''}`;
  }).join('');
  return `<svg viewBox="0 0 120 120" aria-hidden="true"><g transform="rotate(-90 60 60)" fill="none" stroke-width="10" stroke-linecap="round">
    ${circles}</g></svg><div><h4>按键都花在哪</h4><ul>${values.map((value, i) =>
      `<li style="--rc:${colors[i]}"><b>${Math.round(value * 100)}%</b>${labels[i]}</li>`).join('')}</ul></div>`;
}

function gauge(value) {
  const active = Math.round(value * 48);
  const marks = Array.from({ length: 48 }, (_, i) => `<rect x="58.5" y="4" width="3" height="11" rx="1"
    transform="rotate(${i * 7.5} 60 60)" fill="${i < active ? accent() : '#1c2440'}"${i < active ? ' class="lit"' : ''}/>`).join('');
  return `<svg viewBox="0 0 120 120" role="img" aria-label="前 10 键占比 ${Math.round(value * 100)}%">
    ${marks}<text x="60" y="62" text-anchor="middle" font-family="Orbitron,sans-serif" font-weight="900" font-size="22" fill="#fff">${Math.round(value * 100)}%</text>
    <text x="60" y="80" text-anchor="middle" font-size="9" fill="#98a5cb">前 10 键占比</text></svg>`;
}

function pie() {
  if (!state.keyboardTotal) return '<p>还没有数据</p>';
  const colors = [accent(), '#008080', '#ffcc00', '#c00000', '#808000', '#c0c0c0'];
  const entries = state.keyboard.slice(0, 5);
  if (state.keyboard.length > 5) entries.push(['其他', state.keyboardTotal - groupTotal(entries)]);
  let offset = 0;
  const stops = entries.map(([, n], i) => {
    const next = offset + share(n, state.keyboardTotal) * 100;
    const stop = `${colors[i]} ${offset.toFixed(3)}% ${next.toFixed(3)}%`;
    offset = next;
    return stop;
  });
  const gradient = `conic-gradient(${stops.join(',')})`;
  const layers = Array.from({ length: 13 }, (_, i) =>
    `<div class="pd${i < 12 ? ' dk' : ''}" style="top:${12 - i}px;background:${gradient}"></div>`).join('');
  return `<div class="pie3" aria-hidden="true">${layers}</div><ul class="pl">${entries.map(([id, n], i) =>
    `<li><i style="background:${colors[i]}"></i>${esc(nameOf(id))}　${percent(n, state.keyboardTotal)}</li>`).join('')}</ul>`;
}

const sevenSegments = ['abcdef', 'bc', 'abdeg', 'abcdg', 'bcfg', 'acdfg', 'acdefg', 'abc', 'abcdefg', 'abcdfg'];
const segmentRects = {
  a: [2, 0, 8, 2], b: [9, 1.5, 2, 8], c: [9, 10.5, 2, 8], d: [2, 18, 8, 2],
  e: [0, 10.5, 2, 8], f: [0, 1.5, 2, 8], g: [2, 9, 8, 2],
};

function digitDisplay(total) {
  const digits = String(total).padStart(7, ' ');
  const rects = Array.from(digits, (digit, i) => Object.entries(segmentRects).map(([segment, [x, y, w, h]]) => {
    const lit = digit !== ' ' && sevenSegments[Number(digit)].includes(segment);
    return `<rect x="${i * 14 + x}" y="${y}" width="${w}" height="${h}" rx=".8" style="fill:var(--ink);fill-opacity:${lit ? 1 : 0.08}"/>`;
  }).join('')).join('');
  return `<svg class="seg7" viewBox="-1 -1 ${digits.length * 14} 22" role="img" aria-label="${number(total)}">
    <g transform="skewX(-6) translate(2 0)">${rects}</g></svg>`;
}

function paintSide() {
  const [id, n] = state.keyboard[0] || ['', 0];
  const total = state.keyboardTotal;
  const label = RANGE_LABELS[state.range][1];
  const topShare = share(groupTotal(state.keyboard.slice(0, 10)), total);
  const now = new Date();
  text('total', number(total));
  text('rlabel', label);
  text('mouseTotal', number(state.mouseTotal));
  text('keysUsed', number(state.keyboard.length));
  text('topName', id ? nameOf(id) : '—');
  text('topGlyph', id ? (init.layouts[0].keys.find(({ ids }) => ids.includes(id))?.label || nameOf(id)) : '—');
  text('topCount', id ? `${number(n)} 次 · ${percent(n, total)}` : '—');
  text('date', `${now.getMonth() + 1}月${now.getDate()}日 星期${'日一二三四五六'[now.getDay()]}`);
  html('lede', id ? `${label}最常用的是 <b>${esc(nameOf(id))}</b>，${number(n)} 次，占 ${percent(n, total)}。鼠标点击 <b>${number(state.mouseTotal)}</b> 次。` :
    `${label}还没有按键记录。`);
  text('rankTitle', `前 10 个键占了 ${Math.round(topShare * 100)}% 的按键`);
  text('rankSub', `${label}共用到 ${number(state.keyboard.length)} 个键`);
  rankRows();
  renderHours();
  const left = renderModifiers();
  renderMouse(label);
  if (slot('rings')) {
    const letters = groupTotal(state.keyboard.filter(([key]) => /^[A-Z]$/.test(key)));
    html('rings', rings([share(letters, total), topShare, left]));
  }
  if (slot('gauge')) html('gauge', gauge(topShare));
  if (slot('pie')) html('pie', pie());
  if (slot('seg7')) html('seg7', digitDisplay(total));
}

let board2D = [];
const textCanvas = document.createElement('canvas').getContext('2d');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let lastUnit = 0;
let hoverInfo = null;

function fitText(element) {
  if (!textCanvas || !element.isConnected) return;
  element.style.removeProperty('font-size');
  const css = getComputedStyle(element);
  const key = element.parentElement;
  const keyCss = getComputedStyle(key);
  const size = parseFloat(css.fontSize);
  const width = key.clientWidth - parseFloat(keyCss.paddingLeft) - parseFloat(keyCss.paddingRight) - 0.5;
  if (width <= 0 || !element.textContent) return;
  textCanvas.font = `${css.fontWeight} ${size}px ${css.fontFamily}`;
  const measured = textCanvas.measureText(element.textContent).width;
  if (measured > width) element.style.fontSize = `${size * width / measured}px`;
}

function sizeBoard() {
  const view = slot('view2d');
  const board = slot('board2d');
  if (!view || view.hidden || !view.clientWidth || !board2D.length) return;
  const keys = layout().keys;
  const width = Math.max(...keys.map((key) => key.x + key.w)) + 0.7;
  const height = Math.max(...keys.map((key) => key.y + key.h)) + 0.7;
  const unit = Math.min(theme().keyMax || 54, (view.clientWidth - 12) / width);
  if (unit <= 0 || unit === lastUnit) return;
  lastUnit = unit;
  board.style.setProperty('--u', unit + 'px');
  board.style.width = width * unit + 'px';
  board.style.height = height * unit + 'px';
  for (const { label, countLabel } of board2D) {
    fitText(label);
    fitText(countLabel);
  }
}

const resize = new ResizeObserver(sizeBoard);
const units = (n) => `calc(var(--u) * ${n})`;

function build2D() {
  const board = slot('board2d');
  if (!board) return;
  const fragment = document.createDocumentFragment();
  board2D = layout().keys.map((key, index) => {
    const element = document.createElement('div');
    element.className = 'key k2';
    element.dataset.keyIndex = index;
    element.dataset.keyId = key.id;
    element.style.left = units(key.x + 0.41);
    element.style.top = units(key.y + 0.41);
    element.style.width = units(key.w - 0.12);
    element.style.height = units(key.h - 0.12);
    const label = document.createElement('span');
    label.className = 'l';
    label.textContent = key.label;
    const countLabel = document.createElement('span');
    countLabel.className = 'c';
    element.append(label, countLabel);
    fragment.append(element);
    return { element, key, label, countLabel, count: 0 };
  });
  board.replaceChildren(fragment);
  lastUnit = 0;
  sizeBoard();
}

function showTip(key, x, y) {
  const stageEl = slot('stage');
  const tip = slot('tip');
  if (!stageEl || !tip) return;
  hoverInfo = { key, x, y };
  tip.innerHTML = key.ids.map((id) => {
    const value = count(id);
    const detail = value ? `${number(value)} 次 · 占 ${percent(value, state.keyboardTotal)} · 第 ${state.rank.get(id)} 名` : '还没按过';
    return `<div><b>${esc(nameOf(id))}</b><span>${detail}</span></div>`;
  }).join('');
  tip.hidden = false;
  const rect = stageEl.getBoundingClientRect();
  const left = Math.max(6, Math.min(rect.width - tip.offsetWidth - 6,
    x - rect.left + (x - rect.left + 14 + tip.offsetWidth <= rect.width ? 14 : -tip.offsetWidth - 14)));
  const top = Math.max(6, Math.min(rect.height - tip.offsetHeight - 6,
    y - rect.top + (y - rect.top + 14 + tip.offsetHeight <= rect.height ? 14 : -tip.offsetHeight - 14)));
  tip.style.left = left + 'px';
  tip.style.top = top + 'px';
}

function hideTip() {
  const tip = slot('tip');
  if (tip) tip.hidden = true;
  hoverInfo = null;
}

let board3D = null;
let threeReady = false;
let threeFailed = false;
let sceneRequest = 0;
let sceneLoading = false;

function paintBoards(animate = false) {
  const keys = layout().keys;
  const max = Math.max(0, ...keys.map(keyCount));
  const getVisual = (key) => visualFor(key, max);
  for (const item of board2D) {
    const visual = getVisual(item.key);
    const { element, countLabel } = item;
    if (state.view === '2d' && animate && visual.count > item.count && !reducedMotion.matches) {
      element.getAnimations().forEach((motion) => motion.cancel());
      element.animate([{ transform: 'scale(.93)' }, { transform: 'scale(1)' }], { duration: 130, easing: 'ease-out' });
    }
    element.classList.toggle('has', visual.count > 0);
    element.classList.toggle('zero', !visual.count);
    element.classList.toggle('dark', visual.dark);
    element.style.setProperty('--hc', visual.color);
    element.style.setProperty('--fg', visual.foreground);
    element.style.setProperty('--t', visual.t.toFixed(3));
    if (countLabel.textContent !== shortCount(visual.count)) {
      countLabel.textContent = shortCount(visual.count);
      if (state.view === '2d') fitText(countLabel);
    }
    item.count = visual.count;
  }
  if (threeReady) board3D.update(getVisual, animate && state.view === '3d' && !reducedMotion.matches);
  if (hoverInfo) showTip(hoverInfo.key, hoverInfo.x, hoverInfo.y);
}

function handleThreeError(error) {
  if (threeFailed) return;
  console.error('3D 键盘加载失败', error);
  threeFailed = true;
  threeReady = false;
  sceneLoading = false;
  sceneRequest++;
  board3D?.setActive(false);
  state.view = '2d';
  syncControls();
}

async function prepare3D() {
  if (threeFailed || state.view !== '3d' || threeReady || sceneLoading) return;
  const ticket = ++sceneRequest;
  sceneLoading = true;
  const loading = slot('loading');
  if (loading) loading.hidden = false;
  try {
    if (!board3D) {
      const { Board3D } = await import('./themes/board3d.js');
      if (ticket !== sceneRequest) return;
      board3D = new Board3D({ showTip, hideTip, onError: handleThreeError });
    }
    board3D.setActive(false);
    board3D.mount(slot('view3d'));
    await board3D.setTheme(theme(), accent());
    if (ticket !== sceneRequest) return;
    board3D.build(layout());
    threeReady = true;
    if (loading) loading.hidden = true;
    paintBoards();
    board3D.setActive(state.view === '3d');
  } catch (error) {
    if (ticket === sceneRequest) handleThreeError(error);
  } finally {
    if (ticket === sceneRequest) sceneLoading = false;
  }
}

function resetScene() {
  sceneRequest++;
  threeReady = false;
  sceneLoading = false;
  board3D?.setActive(false);
}

const optionList = init.layouts.map(({ id, name }) => `<option value="${esc(id)}">${esc(name)}</option>`).join('');

function syncControls() {
  slots('layout').forEach((select) => { select.value = state.layout; });
  slots('custom').forEach((box) => { box.hidden = state.range !== 'custom'; });
  slots('fromDate').forEach((input) => { input.value = state.fromDate; });
  slots('toDate').forEach((input) => { input.value = state.toDate; });
  for (const [field, value] of [['r', state.range], ['view', state.view], ['scale', state.scale]]) {
    root.querySelectorAll(`button[data-${field}]`).forEach((button) => {
      const selected = button.dataset[field] === value;
      button.classList.toggle('on', selected);
      button.setAttribute('aria-pressed', String(selected));
      if (field === 'view' && button.dataset.view === '3d') {
        button.disabled = threeFailed;
        button.title = threeFailed ? '此设备暂时无法显示 3D 键盘' : '';
      }
    });
  }
  slot('stage').dataset.view = state.view;
  slot('view3d').hidden = state.view !== '3d';
  slot('view2d').hidden = state.view !== '2d';
  text('hint', state.view === '3d' ? '拖动旋转，滚轮缩放' : '悬停查看次数、占比和排名');
  updatePause(state.paused);
  sizeBoard();
}

function updatePause(paused) {
  state.paused = paused;
  root.classList.toggle('paused', paused);
  text('pzt', paused ? '已暂停 · 点击继续' : '正在记录');
  text('pzt2', paused ? '已暂停' : '正在记录');
}

function applyAccent() {
  const a = accent();
  const steps = theme().quantize;
  const stops = steps ? Array.from({ length: steps }, (_, i) => {
    return `${colorAt((i + 1) / steps)} ${i / steps * 100}% ${(i + 1) / steps * 100}%`;
  }) : theme().ramp(a);
  root.style.setProperty('--ac', a);
  root.style.setProperty('--ac-d', shade(a, 0.45));
  root.style.setProperty('--cb', mix('#f1edf6', a, 0.07));
  root.style.setProperty('--scr', mix('#a9b68e', a, 0.18));
  root.style.setProperty('--ramp', `linear-gradient(90deg,${stops.join(',')})`);
  document.body.style.setProperty('--tac', a);
}

let fontRequest = 0;
function fitAfterFonts() {
  const ticket = ++fontRequest;
  document.fonts.ready.then(() => {
    if (ticket === fontRequest) {
      lastUnit = 0;
      sizeBoard();
    }
  });
}

function renderTheme(fade = true) {
  hideTip();
  resetScene();
  root.className = `th th-${state.theme}`;
  root.innerHTML = theme().template();
  const placeholder = slot('kb');
  if (placeholder && !slot('stage')) placeholder.innerHTML = stage();
  if (!slot('dataPath')) root.insertAdjacentHTML('beforeend', footer());
  slot('tip').classList.add('tip-' + state.theme);
  text('themeName', theme().name);
  slots('layout').forEach((select) => { select.innerHTML = optionList; });
  text('dataPath', init.dataFile);
  slots('dataPath').forEach((el) => { el.title = init.dataFile; });
  applyAccent();
  resize.disconnect();
  resize.observe(slot('view2d'));
  syncControls();
  build2D();
  paintSide();
  paintBoards();
  prepare3D();
  fitAfterFonts();
  if (fade && !reducedMotion.matches) root.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: 'ease-out' });
}

const menu = document.createElement('div');
menu.className = 'theme-popover';
menu.id = 'theme-popover';
menu.setAttribute('role', 'dialog');
menu.setAttribute('aria-label', '切换主题与强调色');
menu.hidden = true;
document.body.appendChild(menu);
let menuAnchor = null;

function paintMenu() {
  menu.innerHTML = `<div class="themes-grid">${themeIds.map((id) => `<button type="button" data-theme="${id}"
    aria-pressed="${id === state.theme}" title="${esc(THEMES[id].desc)}"><span class="theme-thumb thumb-${id}" aria-hidden="true">
      <i></i><b><i></i><i></i><i></i><i></i><i></i></b></span><span>${esc(THEMES[id].name)}</span></button>`).join('')}</div>
    <div class="accents" aria-label="强调色">${ACCENTS.map(([label, color]) => `<button type="button" data-accent="${color}"
      aria-label="${label}" aria-pressed="${color === state.accent}" title="${label}" style="--color:${color}"></button>`).join('')}</div>`;
}

function closeMenu(focus = false) {
  menu.hidden = true;
  if (menuAnchor) {
    menuAnchor.setAttribute('aria-expanded', 'false');
    if (focus) menuAnchor.focus();
    menuAnchor = null;
  }
}

function openMenu(button) {
  if (!menu.hidden) {
    closeMenu();
    return;
  }
  menuAnchor = button;
  button.setAttribute('aria-expanded', 'true');
  button.setAttribute('aria-controls', menu.id);
  paintMenu();
  menu.hidden = false;
  const rect = button.getBoundingClientRect();
  menu.style.left = Math.max(8, Math.min(innerWidth - menu.offsetWidth - 8, rect.right - menu.offsetWidth)) + 'px';
  menu.style.top = Math.max(8, rect.bottom + menu.offsetHeight + 8 < innerHeight ? rect.bottom + 8 : rect.top - menu.offsetHeight - 8) + 'px';
  menu.querySelector('[data-theme][aria-pressed="true"]')?.focus({ preventScroll: true });
}

menu.addEventListener('click', (event) => {
  const button = event.target.closest('button');
  if (!button) return;
  const { theme: id, accent: color } = button.dataset;
  if (id) {
    closeMenu();
    if (id !== state.theme) {
      state.theme = id;
      localStorage.setItem('theme', id);
      renderTheme();
    }
    root.querySelector('[data-a="theme"]')?.focus({ preventScroll: true });
  } else if (color) {
    state.accent = color;
    localStorage.setItem('accent', color);
    applyAccent();
    paintMenu();
    menu.querySelector('[data-accent][aria-pressed="true"]')?.focus({ preventScroll: true });
    resetScene();
    paintSide();
    paintBoards();
    prepare3D();
  }
});

document.addEventListener('pointerdown', (event) => {
  if (!menu.hidden && !menu.contains(event.target) && !menuAnchor?.contains(event.target)) closeMenu();
});
document.addEventListener('keydown', (event) => {
  if (!menu.hidden && event.key === 'Escape') closeMenu(true);
});
window.addEventListener('resize', () => closeMenu());
window.addEventListener('scroll', () => { if (!menu.hidden) closeMenu(); }, { passive: true });

function toast(message) {
  const note = document.createElement('div');
  note.className = 'toast';
  note.setAttribute('role', 'status');
  note.textContent = message;
  document.body.appendChild(note);
  setTimeout(() => note.remove(), 3000);
}

let refreshId = 0;
let pending = false;
let shouldAnimate = false;
let statusRevision = 0;

async function refresh(timer = false) {
  if (pending && timer) return;
  const id = ++refreshId;
  const pauseAtStart = statusRevision;
  pending = true;
  try {
    const [from, to] = rangeMs();
    const result = await api.getStats(from, to);
    if (id !== refreshId) return;
    state.counts = result.perKey;
    state.hours = result.hourOfDay;
    if (pauseAtStart === statusRevision) updatePause(result.paused);
    summarize();
    paintSide();
    paintBoards(timer && shouldAnimate);
    shouldAnimate = true;
  } catch (error) {
    if (id === refreshId) console.error('刷新统计失败', error);
  } finally {
    if (id === refreshId) pending = false;
  }
}

function chooseRange(range) {
  state.range = range;
  shouldAnimate = false;
  hideTip();
  syncControls();
  refresh();
}

root.addEventListener('pointermove', (event) => {
  const element = event.target.closest('[data-key-index]');
  if (element) showTip(board2D[Number(element.dataset.keyIndex)].key, event.clientX, event.clientY);
});

root.addEventListener('pointerout', (event) => {
  const element = event.target.closest('[data-key-index]');
  if (element && !element.contains(event.relatedTarget)) hideTip();
});

root.addEventListener('change', ({ target }) => {
  const field = target.dataset.s;
  if (field === 'layout') {
    state.layout = target.value;
    localStorage.setItem('layout', state.layout);
    hideTip();
    build2D();
    if (threeReady) board3D.build(layout());
    paintBoards();
    rankRows();
  } else if (field === 'fromDate' || field === 'toDate') {
    state[field] = target.value;
    chooseRange('custom');
  }
});

root.addEventListener('click', async (event) => {
  const control = event.target.closest('[data-r],button[data-view],[data-scale],[data-a]');
  if (!control || control.disabled) return;
  const { r: range, view, scale, a: action } = control.dataset;
  if (range) chooseRange(range);
  if (view) {
    state.view = view;
    localStorage.setItem('view', view);
    hideTip();
    syncControls();
    if (threeReady) board3D.setActive(view === '3d');
    if (view === '3d') prepare3D();
    else fitAfterFonts();
    paintBoards();
  }
  if (scale) {
    state.scale = scale;
    localStorage.setItem('scale', scale);
    syncControls();
    paintBoards();
    renderMouse(RANGE_LABELS[state.range][1]);
  }
  if (action === 'theme') openMenu(control);
  if (action === 'rank-expand') {
    state.showAll = !state.showAll;
    rankRows();
  }
  try {
    if (action === 'pause') {
      const next = !state.paused;
      control.disabled = true;
      statusRevision++;
      updatePause(await api.setPaused(next));
      control.disabled = false;
    }
    if (action === 'export') {
      const result = await api.exportCsv(...rangeMs());
      if (result?.ok) toast(`已导出 ${number(result.rows)} 行：${result.path}`);
    }
    if (action === 'data') {
      event.preventDefault();
      const error = await api.openDataFolder();
      if (error) toast('打开数据目录失败');
    }
  } catch (error) {
    control.disabled = false;
    console.error('操作失败', error);
    toast('操作失败，请重试');
  }
});

api.onStatus(({ paused }) => {
  statusRevision++;
  updatePause(paused);
});
renderTheme(false);
await refresh();
setInterval(() => refresh(true), 2000);
