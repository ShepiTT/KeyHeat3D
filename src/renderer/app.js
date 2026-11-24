import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const api = window.keyheat;
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const init = await api.getInit();
const NAMES = init.names;
const nameOf = (id) => NAMES[id] || id;
const isMouse = (id) => id.startsWith('Mouse');

const state = {
  layoutId: localStorage.getItem('layout') || 'full104',
  view: localStorage.getItem('view') || '3d',
  scale: localStorage.getItem('scale') || 'log',
  range: 'today',
  rankTab: 'kb',
  paused: init.paused,
  perKey: {},
  hourOfDay: new Array(24).fill(0),
  kbTotal: 0,
  msTotal: 0,
  rank: new Map(), // id -> 名次（键盘、鼠标分别排名）
};
if (!init.layouts.some((l) => l.id === state.layoutId)) state.layoutId = 'full104';
const currentLayout = () => init.layouts.find((l) => l.id === state.layoutId);

// ======================= 色阶 =======================
const STOPS = [
  [0, '#14213d'], [0.2, '#1d4ed8'], [0.45, '#06b6d4'], [0.68, '#facc15'], [0.85, '#f97316'], [1, '#ef4444'],
].map(([t, c]) => [t, new THREE.Color(c)]);

function heatColor(t, target = new THREE.Color()) {
  t = Math.min(1, Math.max(0, t));
  for (let i = 1; i < STOPS.length; i++) {
    if (t <= STOPS[i][0]) {
      const [t0, c0] = STOPS[i - 1];
      const [t1, c1] = STOPS[i];
      return target.copy(c0).lerp(c1, (t - t0) / (t1 - t0));
    }
  }
  return target.copy(STOPS[STOPS.length - 1][1]);
}
function norm(c, max) {
  if (c <= 0 || max <= 0) return 0;
  return state.scale === 'log' ? Math.log1p(c) / Math.log1p(max) : c / max;
}
const countOf = (key) => key.ids.reduce((s, id) => s + (state.perKey[id] || 0), 0);
function fmt(c) {
  if (c < 10000) return String(c);
  if (c < 1e6) return (c / 1000).toFixed(c < 1e5 ? 1 : 0) + 'k';
  return (c / 1e6).toFixed(2) + 'M';
}

// 键盘区 + 鼠标区的整体排布（3D、2D 共用）
function arrange() {
  const keys = currentLayout().keys;
  const kbW = Math.max(...keys.map((k) => k.x + k.w));
  const kbH = Math.max(...keys.map((k) => k.y + k.h));
  const mouseX = kbW + 1.2;
  const mouseY = Math.max(0, (kbH - 2.9) / 2);
  const all = [
    ...keys.map((k) => ({ ...k, group: 'kb' })),
    ...init.mouse.map((k) => ({ ...k, x: k.x + mouseX, y: k.y + mouseY, group: 'mouse' })),
  ];
  return { all, kbW, kbH, mouseX, mouseY, totalW: mouseX + 3.5, totalH: Math.max(kbH, mouseY + 2.9) };
}

// ======================= 悬停提示 =======================
const tip = $('tooltip');
const stageEl = document.querySelector('.stage');
function showTip(key, clientX, clientY) {
  const parts = key.ids.map((id) => {
    const c = state.perKey[id] || 0;
    const total = isMouse(id) ? state.msTotal : state.kbTotal;
    const pct = total ? ((c / total) * 100).toFixed(2) + '%' : '0%';
    const r = state.rank.get(id);
    return `<div><b>${esc(nameOf(id))}</b></div>
      <div>次数：${c.toLocaleString()}</div>
      <div>占比：${pct}（${isMouse(id) ? '鼠标' : '键盘'}）</div>
      <div>排名：${r ? '第 ' + r + ' 名' : '—'}</div>`;
  });
  tip.innerHTML = parts.join('<hr style="border:0;border-top:1px solid #334155;margin:6px 0">');
  tip.hidden = false;
  const r = stageEl.getBoundingClientRect();
  let x = clientX - r.left + 14;
  let y = clientY - r.top + 14;
  if (x + tip.offsetWidth > r.width - 8) x = clientX - r.left - tip.offsetWidth - 14;
  if (y + tip.offsetHeight > r.height - 8) y = clientY - r.top - tip.offsetHeight - 14;
  tip.style.left = x + 'px';
  tip.style.top = y + 'px';
}
const hideTip = () => { tip.hidden = true; };

// ======================= 3D 发光键盘 =======================
const BASE_TOP = 0.4;
const KEY_H = 0.42;
const GAP = 0.1;

class Board3D {
  constructor(el) {
    this.el = el;
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    el.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#07090d');
    this.scene.fog = new THREE.Fog('#07090d', 45, 110);
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 300);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.maxPolarAngle = Math.PI * 0.47;
    this.controls.minDistance = 6;
    this.controls.maxDistance = 90;

    this.scene.add(new THREE.HemisphereLight(0x8fb4ff, 0x05070a, 0.5));
    const dir = new THREE.DirectionalLight(0xffffff, 1.1);
    dir.position.set(6, 14, 9);
    this.scene.add(dir);
    const rim = new THREE.DirectionalLight(0x3b82f6, 0.6);
    rim.position.set(-10, 4, -12);
    this.scene.add(rim);
    const grid = new THREE.GridHelper(160, 80, 0x0f2236, 0x0a1522);
    grid.position.y = -0.01;
    this.scene.add(grid);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    // 参数：分辨率、强度、半径、阈值
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.3, 0.35, 0.58);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.items = [];
    this.hover = null;
    this.active = true;
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();

    new ResizeObserver(() => this.resize()).observe(el);
    const cv = this.renderer.domElement;
    cv.addEventListener('pointermove', (e) => this.onMove(e));
    cv.addEventListener('pointerleave', () => { this.hover = null; hideTip(); });
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  clear() {
    this.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        if (o.material.map) o.material.map.dispose();
        o.material.dispose();
      }
    });
    this.group.clear();
    this.items = [];
    this.hover = null;
  }

  build() {
    this.clear();
    const a = arrange();
    const ox = -a.totalW / 2;
    const oz = -a.totalH / 2;
    const plateMat = new THREE.MeshStandardMaterial({ color: 0x0d1118, roughness: 0.35, metalness: 0.7 });
    const plate = (x, z, w, d) => {
      const m = new THREE.Mesh(new RoundedBoxGeometry(w, BASE_TOP, d, 3, 0.16), plateMat.clone());
      m.position.set(x, BASE_TOP / 2, z);
      this.group.add(m);
    };
    plate(ox + a.kbW / 2, oz + a.kbH / 2, a.kbW + 0.7, a.kbH + 0.7);
    plate(ox + a.mouseX + 1.75, oz + a.mouseY + 1.45, 4.2, 3.6);
    plateMat.dispose();
    for (const k of a.all) this.items.push(this.makeKey(k, ox, oz));
    this.fit(a.totalW, a.totalH);
  }

  makeKey(k, ox, oz) {
    const w = k.w - GAP;
    const d = k.h - GAP;
    const mat = new THREE.MeshStandardMaterial({
      color: 0x1a202c, roughness: 0.5, metalness: 0.15, emissive: 0x000000, emissiveIntensity: 0,
    });
    const mesh = new THREE.Mesh(new RoundedBoxGeometry(w, KEY_H, d, 2, 0.09), mat);
    const cx = ox + k.x + k.w / 2;
    const cz = oz + k.y + k.h / 2;
    mesh.position.set(cx, BASE_TOP + KEY_H / 2, cz);

    const PX = 128;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(Math.min(k.w * PX, 900));
    canvas.height = Math.round(k.h * PX);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    // 文字略调暗，避免被辉光吃掉
    const lmat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, color: 0xc8c8c8 });
    const label = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.06, d - 0.06), lmat);
    label.rotation.x = -Math.PI / 2;
    label.position.set(cx, BASE_TOP + KEY_H + 0.003, cz);
    this.group.add(mesh, label);

    const item = {
      key: k, mesh, label, canvas, tex, text: null, count: 0, t: 0,
      color: new THREE.Color(0, 0, 0), intensity: 0, targetIntensity: 0,
      height: 1, targetHeight: 1, flash: 0,
    };
    mesh.userData.item = item;
    return item;
  }

  drawLabel(it) {
    const text = it.key.label + '|' + it.count;
    if (it.text === text) return;
    it.text = text;
    const { canvas } = it;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    // 描边让计数在高亮键帽上也清晰可读。
    ctx.strokeStyle = 'rgba(0,0,0,0.9)';
    ctx.lineWidth = 5;
    ctx.lineJoin = 'round';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = '600 28px "Segoe UI", "Microsoft YaHei UI", sans-serif';
    ctx.strokeText(it.key.label, 12, 10);
    ctx.fillText(it.key.label, 12, 10);
    const s = fmt(it.count);
    let size = 40;
    const setFont = () => { ctx.font = `700 ${size}px "Segoe UI", sans-serif`; };
    setFont();
    while (ctx.measureText(s).width > W - 20 && size > 16) { size -= 2; setFont(); }
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.globalAlpha = it.count ? 1 : 0.35;
    ctx.strokeText(s, W - 10, H - 8);
    ctx.fillText(s, W - 10, H - 8);
    ctx.globalAlpha = 1;
    it.tex.needsUpdate = true;
  }

  update(maxKb, maxMs, allowFlash = false) {
    for (const it of this.items) {
      const c = countOf(it.key);
      // 新按下的键闪一下；切换时间范围/布局导致的数字变化不闪
      if (allowFlash && c > it.count && it.text !== null) it.flash = 0.9;
      it.count = c;
      it.t = norm(c, it.key.group === 'mouse' ? maxMs : maxKb);
      if (c > 0) heatColor(it.t, it.color); else it.color.setRGB(0, 0, 0);
      it.targetIntensity = c > 0 ? 0.2 + it.t * 0.95 : 0;
      it.targetHeight = 1 + it.t * 0.9;
      this.drawLabel(it);
    }
  }

  fitDistance() {
    const halfFov = THREE.MathUtils.degToRad(this.camera.fov / 2);
    const tan = Math.tan(halfFov);
    const widthDistance = (this.boardWidth + 0.7) / (2 * tan * this.camera.aspect);
    const heightDistance = (this.boardHeight + 0.7) / (2 * tan);
    // 为键帽的高度和前排键更靠近镜头留出空间。
    return 1.12 * Math.max(widthDistance, heightDistance) + this.boardHeight / 2 + 1;
  }

  fit(totalW, totalH) {
    this.boardWidth = totalW;
    this.boardHeight = totalH;
    const dist = this.fitDistance();
    this.camera.position.set(0, dist * 0.78, dist * 0.62);
    this.controls.target.set(0, 0, 0.3);
    this.controls.update();
  }

  resize() {
    const w = this.el.clientWidth;
    const h = this.el.clientHeight;
    if (!w || !h) return;
    const oldAspect = this.camera.aspect;
    const oldDistance = this.boardWidth ? this.fitDistance() : 0;
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (oldDistance && this.camera.aspect !== oldAspect) {
      const target = this.controls.target;
      this.camera.position.sub(target).multiplyScalar(this.fitDistance() / oldDistance).add(target);
      this.controls.update();
    }
  }

  onMove(e) {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = this.raycaster.intersectObjects(this.items.map((i) => i.mesh), false)[0];
    this.hover = hit ? hit.object.userData.item : null;
    if (this.hover) showTip(this.hover.key, e.clientX, e.clientY); else hideTip();
  }

  loop(time) {
    requestAnimationFrame(this.loop);
    if (!this.active) return;
    this.controls.update();
    const k = 0.12;
    for (const it of this.items) {
      const m = it.mesh.material;
      const hov = it === this.hover;
      m.emissive.lerp(it.color, k);
      // 次数为 0 的键没有发光颜色，悬停时给一点青色提示
      if (hov && it.count === 0) m.emissive.setRGB(0.05, 0.25, 0.32);
      it.intensity += (it.targetIntensity - it.intensity) * k;
      it.flash *= 0.93;
      const pulse = it.t > 0.85 ? 1 + 0.12 * Math.sin(time * 0.004) : 1;
      m.emissiveIntensity = it.intensity * pulse + it.flash + (hov ? 0.5 : 0);
      it.height += (it.targetHeight - it.height) * k;
      it.mesh.scale.y = it.height;
      it.mesh.position.y = BASE_TOP + (KEY_H * it.height) / 2;
      it.label.position.y = BASE_TOP + KEY_H * it.height + 0.003;
    }
    this.composer.render();
  }
}

// ======================= 2D 平面键盘 =======================
class Board2D {
  constructor(el) {
    this.el = el;
    this.nodes = [];
    new ResizeObserver(() => { if (state.view === '2d') { this.build(); this.update(); } }).observe($('view2d'));
  }

  build() {
    const a = arrange();
    const { clientWidth, clientHeight } = $('view2d');
    if (!clientWidth || !clientHeight) return;
    const avail = clientWidth - 32;
    const availH = clientHeight - 80;
    const U = Math.max(1, Math.min(64, avail / a.totalW, availH / a.totalH));
    this.el.innerHTML = '';
    this.el.style.setProperty('--key-unit', U + 'px');
    this.el.style.width = a.totalW * U + 'px';
    this.el.style.height = a.totalH * U + 'px';
    this.nodes = a.all.map((k) => {
      const d = document.createElement('div');
      d.className = 'k2';
      d.classList.toggle('narrow', k.w < 1);
      d.style.left = k.x * U + 2 + 'px';
      d.style.top = k.y * U + 2 + 'px';
      d.style.width = k.w * U - 4 + 'px';
      d.style.height = k.h * U - 4 + 'px';
      d.innerHTML = `<div class="l">${esc(k.label)}</div><div class="c">0</div>`;
      d.addEventListener('mousemove', (e) => showTip(k, e.clientX, e.clientY));
      d.addEventListener('mouseleave', hideTip);
      this.el.appendChild(d);
      return { key: k, el: d, c: d.querySelector('.c'), l: d.querySelector('.l') };
    });
  }

  update(maxKb = this.maxKb || 0, maxMs = this.maxMs || 0) {
    this.maxKb = maxKb;
    this.maxMs = maxMs;
    const col = new THREE.Color();
    for (const n of this.nodes) {
      const c = countOf(n.key);
      const t = norm(c, n.key.group === 'mouse' ? maxMs : maxKb);
      n.c.textContent = fmt(c);
      n.el.classList.toggle('zero', c === 0);
      if (c > 0) {
        const hex = '#' + heatColor(t, col).getHexString();
        const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
        const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        n.el.style.background = hex;
        n.el.style.boxShadow = `0 0 ${4 + t * 18}px ${hex}aa`;
        n.el.style.color = lum > 0.55 ? '#0b0f17' : '#ffffff';
      } else {
        n.el.style.background = '#141a24';
        n.el.style.boxShadow = 'none';
        n.el.style.color = '#cbd5e1';
      }
    }
  }
}

// ======================= 时间范围 =======================
function localDate(v) {
  const [y, m, d] = v.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function ymd(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function rangeMs() {
  const now = Date.now();
  const mid = new Date();
  mid.setHours(0, 0, 0, 0);
  const daysAgo = (n) => { const d = new Date(mid); d.setDate(d.getDate() - n); return d.getTime(); };
  switch (state.range) {
    case '7d': return [daysAgo(6), now, '最近7天'];
    case '30d': return [daysAgo(29), now, '最近30天'];
    case 'all': return [0, now, '全部'];
    case 'custom': {
      const f = $('fromDate').value;
      const t = $('toDate').value;
      if (!f || !t) return [mid.getTime(), now, '今天'];
      let a = localDate(f);
      let b = localDate(t);
      if (a > b) [a, b] = [b, a];
      const label = `${ymd(a)}_${ymd(b)}`;
      b.setDate(b.getDate() + 1);
      return [a.getTime(), b.getTime(), label];
    }
    default: return [mid.getTime(), now, '今天'];
  }
}

// ======================= 侧栏 =======================
function renderSide() {
  const entries = Object.entries(state.perKey).filter(([, c]) => c > 0);
  const kb = entries.filter(([id]) => !isMouse(id)).sort((a, b) => b[1] - a[1]);
  const ms = entries.filter(([id]) => isMouse(id)).sort((a, b) => b[1] - a[1]);
  state.kbTotal = kb.reduce((s, [, c]) => s + c, 0);
  state.msTotal = ms.reduce((s, [, c]) => s + c, 0);
  state.rank = new Map();
  kb.forEach(([id], i) => state.rank.set(id, i + 1));
  ms.forEach(([id], i) => state.rank.set(id, i + 1));

  $('kbTotal').textContent = state.kbTotal.toLocaleString();
  $('msTotal').textContent = state.msTotal.toLocaleString();
  // 「最常用」分两行：上面是键名，下面是次数，避免「1 · 26」这种分不清的写法
  const topEl = $('topKey');
  if (kb.length) {
    const [topId, topCount] = kb[0];
    topEl.innerHTML = `<span class="top-name">${esc(nameOf(topId))}</span><span class="top-count">${topCount.toLocaleString()} 次</span>`;
    topEl.title = `${nameOf(topId)}，${topCount.toLocaleString()} 次`;
  } else { topEl.textContent = '—'; topEl.title = ''; }

  const hmax = Math.max(1, ...state.hourOfDay);
  $('hourChart').innerHTML = state.hourOfDay
    .map((v, h) => `<div style="height:${(v / hmax) * 100}%" title="${h}:00–${h}:59 · ${v.toLocaleString()} 次"></div>`)
    .join('');

  const list = state.rankTab === 'kb' ? kb : ms;
  const total = state.rankTab === 'kb' ? state.kbTotal : state.msTotal;
  const shown = new Set(currentLayout().keys.flatMap((k) => k.ids));
  if (!list.length) {
    $('rankList').innerHTML = '<div class="empty">这个时间段还没有数据</div>';
    return;
  }
  const top = list[0][1];
  $('rankList').innerHTML = list.map(([id, c], i) => {
    const pct = total ? (c / total) * 100 : 0;
    const off = state.rankTab === 'kb' && !shown.has(id) ? ' off' : '';
    return `<div class="rank-row${off}">
      <span class="n">${i + 1}</span>
      <span class="name">${esc(nameOf(id))}</span>
      <span class="cnt">${c.toLocaleString()}</span>
      <span class="pct"><span class="bar"><i style="width:${(c / top) * 100}%"></i></span>${pct.toFixed(1)}%</span>
    </div>`;
  }).join('');
}

// ======================= 主流程 =======================
const board3d = new Board3D($('view3d'));
const board2d = new Board2D($('board2d'));

function maxes() {
  let maxKb = 0;
  let maxMs = 0;
  for (const k of arrange().all) {
    const c = countOf(k);
    if (k.group === 'mouse') maxMs = Math.max(maxMs, c); else maxKb = Math.max(maxKb, c);
  }
  return [maxKb, maxMs];
}

function renderBoards(allowFlash = false) {
  const [a, b] = maxes();
  board3d.update(a, b, allowFlash);
  if (state.view === '2d') board2d.update(a, b);
  else { board2d.maxKb = a; board2d.maxMs = b; }
}

let busy = false;
let refreshId = 0;
let flashOk = false; // 只有「同一时间范围下的定时刷新」才让新增按键闪烁
async function refresh(fromTimer = false) {
  if (busy && fromTimer) return;
  const id = ++refreshId;
  busy = true;
  try {
    const [f, t] = rangeMs();
    const s = await api.getStats(f, t);
    if (id !== refreshId) return;
    state.perKey = s.perKey;
    state.hourOfDay = s.hourOfDay;
    setPausedUI(s.paused);
    renderSide();
    renderBoards(fromTimer && flashOk);
    flashOk = true;
  } catch (e) {
    console.error('刷新失败', e);
  } finally {
    if (id === refreshId) busy = false;
  }
}
const resetFlash = () => { flashOk = false; };

function rebuildBoards() {
  hideTip();
  board3d.build();
  board2d.build();
  renderBoards();
}

function setView(v) {
  state.view = v;
  localStorage.setItem('view', v);
  $('view3d').hidden = v !== '3d';
  $('view2d').hidden = v !== '2d';
  $('hint3d').hidden = v !== '3d';
  board3d.active = v === '3d';
  hideTip();
  document.querySelectorAll('#viewGroup button').forEach((b) => b.classList.toggle('active', b.dataset.view === v));
  if (v === '2d') { board2d.build(); board2d.update(); } else board3d.resize();
}

function setPausedUI(p) {
  state.paused = p;
  $('pauseBtn').classList.toggle('paused', p);
  $('pauseText').textContent = p ? '已暂停（点击继续）' : '采集中';
}

function toast(msg) {
  const d = document.createElement('div');
  d.className = 'toast';
  d.textContent = msg;
  document.body.appendChild(d);
  setTimeout(() => d.remove(), 3000);
}

// ---------- 事件绑定 ----------
const sel = $('layoutSel');
sel.innerHTML = init.layouts.map((l) => `<option value="${l.id}">${esc(l.name)}</option>`).join('');
sel.value = state.layoutId;
sel.addEventListener('change', () => {
  state.layoutId = sel.value;
  localStorage.setItem('layout', sel.value);
  resetFlash();
  rebuildBoards();
  renderSide();
});

$('scaleSel').value = state.scale;
$('scaleSel').addEventListener('change', (e) => {
  state.scale = e.target.value;
  localStorage.setItem('scale', state.scale);
  renderBoards();
});

document.querySelectorAll('#rangeGroup button').forEach((b) => b.addEventListener('click', () => {
  state.range = b.dataset.range;
  document.querySelectorAll('#rangeGroup button').forEach((x) => x.classList.toggle('active', x === b));
  $('customBox').hidden = state.range !== 'custom';
  resetFlash();
  refresh();
}));
const today = new Date();
const weekAgo = new Date();
weekAgo.setDate(weekAgo.getDate() - 6);
$('fromDate').value = ymd(weekAgo);
$('toDate').value = ymd(today);
$('fromDate').addEventListener('change', () => { resetFlash(); refresh(); });
$('toDate').addEventListener('change', () => { resetFlash(); refresh(); });

document.querySelectorAll('#viewGroup button').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));

document.querySelectorAll('#rankTabs button').forEach((b) => b.addEventListener('click', () => {
  state.rankTab = b.dataset.tab;
  document.querySelectorAll('#rankTabs button').forEach((x) => x.classList.toggle('active', x === b));
  renderSide();
}));

$('pauseBtn').addEventListener('click', async () => setPausedUI(await api.setPaused(!state.paused)));
api.onStatus((s) => setPausedUI(s.paused));

$('exportBtn').addEventListener('click', async () => {
  const [f, t, label] = rangeMs();
  const res = await api.exportCsv(f, t, label);
  if (res && res.ok) toast(`已导出 ${res.rows} 行：${res.path}`);
});

$('dataPath').textContent = '数据文件：' + init.dataFile;
$('openData').addEventListener('click', (e) => { e.preventDefault(); api.openDataFolder(); });

// ---------- 启动 ----------
rebuildBoards();
setView(state.view);
setPausedUI(state.paused);
await refresh();
setInterval(() => refresh(true), 2000);
