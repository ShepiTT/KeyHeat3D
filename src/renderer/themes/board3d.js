import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { LCD_INK, THREE_PRESETS } from './three-presets.js';

const FRAME_MS = 1000 / 60;
const LABEL_PIXELS = 180;
const CAP_GAP = 0.12;
const LABEL_INSET = 0.24;
const HOVER_LIFT = 0.035;
const MAX_HEAT_LIFT = 0.72;
const ZERO_GLOW = new THREE.Color(0, 0, 0);
const INK = new THREE.Color(LCD_INK);

const resolveColor = (value, accent) => typeof value === 'function' ? value(accent) : value;
const roundedBox = (w, h, d, preset) => preset.radius
  ? new RoundedBoxGeometry(w, h, d, preset.segments, preset.radius)
  : new THREE.BoxGeometry(w, h, d);

function boxMaterial(preset, color, gradientMap) {
  const { roughness = 0.5, metalness = 0, envMapIntensity = 1, opacity, kind } = preset;
  if (opacity !== undefined) {
    return new THREE.MeshPhysicalMaterial({
      color, roughness, clearcoat: 1, clearcoatRoughness: 0.1,
      opacity, transparent: true, depthWrite: false,
    });
  }
  if (kind === 'toon') return new THREE.MeshToonMaterial({ color, gradientMap });
  if (kind === 'lambert') return new THREE.MeshLambertMaterial({ color, flatShading: true });
  if (kind === 'basic') return new THREE.MeshBasicMaterial({ color });
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, envMapIntensity });
}

function paintableTop(material, coldColor, coldTop) {
  if (material.isMeshBasicMaterial) return null;
  const color = { value: new THREE.Color(coldTop ?? coldColor) };
  const coverage = { value: coldTop ? 1 : 0 };
  material.onBeforeCompile = (shader) => {
    shader.uniforms.keyTopColor = color;
    shader.uniforms.keyTopCoverage = coverage;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vKeyTop;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvKeyTop = normal.y;');
    // 顶面直接显示色阶，倒角和侧壁仍由主题光照、材质和阴影塑形。
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying float vKeyTop;
        uniform vec3 keyTopColor;
        uniform float keyTopCoverage;`)
      .replace('#include <opaque_fragment>', `
        float topFace = smoothstep(0.92, 0.995, vKeyTop) * keyTopCoverage;
        outgoingLight = mix(outgoingLight, keyTopColor, topFace);
        diffuseColor.a = mix(diffuseColor.a, 1.0, topFace);
        #include <opaque_fragment>`);
  };
  return { color, coverage };
}

function clearGroup(group) {
  const resources = new Set();
  group.traverse(({ geometry, material, shadow }) => {
    if (geometry) resources.add(geometry);
    if (material) {
      resources.add(material);
      if (material.map) resources.add(material.map);
      if (material.gradientMap) resources.add(material.gradientMap);
    }
    if (shadow) resources.add(shadow);
  });
  for (const resource of resources) resource.dispose();
  group.clear();
}

function flatPlane(material) {
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), material);
  plane.rotation.x = -Math.PI / 2;
  return plane;
}

function fitFont(context, value, family, weight, maxSize, maxWidth) {
  let size = maxSize;
  context.font = `${weight} ${size}px ${family}`;
  while (size > 10 && context.measureText(value).width > maxWidth) {
    size--;
    context.font = `${weight} ${size}px ${family}`;
  }
}

function countLabel(count) {
  if (count < 10000) return String(count);
  if (count < 1000000) return `${(count / 1000).toFixed(1)}k`;
  return `${(count / 1000000).toFixed(1)}M`;
}

export class Board3D {
  constructor({ showTip, hideTip, onError }) {
    this.showTip = showTip;
    this.hideTip = hideTip;
    this.onError = onError;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor(0x000000, 0);
    this.canvas = this.renderer.domElement;
    this.canvas.className = 'board3d-canvas';
    this.canvas.setAttribute('role', 'img');
    this.canvas.setAttribute('aria-label', '3D 键盘热力图');
    Object.assign(this.canvas.style, { display: 'block', width: '100%', height: '100%' });

    this.scene = new THREE.Scene();
    this.world = new THREE.Group();
    this.board = new THREE.Group();
    this.scene.add(this.world, this.board);
    this.camera = new THREE.PerspectiveCamera(26, 1, 0.1, 300);
    this.controls = new OrbitControls(this.camera, this.canvas);
    Object.assign(this.controls, {
      enableDamping: true, enablePan: false, minAzimuthAngle: -0.9, maxAzimuthAngle: 0.9,
    });
    this.controls.addEventListener('start', () => this.clearHover());

    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.items = [];
    this.caps = [];
    this.themeRequest = 0;
    this.fontLoads = new Map();
    this.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    this.observer = new ResizeObserver(() => this.resize());
    this.canvas.addEventListener('pointermove', (event) => this.onMove(event));
    this.canvas.addEventListener('pointerleave', () => this.clearHover());
    this.canvas.addEventListener('webglcontextlost', () => this.fail(new Error('WebGL 上下文已丢失')));
    this.loop = this.loop.bind(this);
  }

  mount(container) {
    if (container !== this.container) {
      this.observer.disconnect();
      this.container = container;
      container.append(this.canvas);
      this.observer.observe(container);
      this.clearHover();
    }
    this.resize();
  }

  async setTheme(theme, accent) {
    const request = ++this.themeRequest;
    if (theme === this.theme && accent === this.accent) return;
    const config = theme.three ?? THREE_PRESETS[theme.id];
    const { family, keyWeight, countWeight, countFamily = family } = config.text;
    const fonts = [`${keyWeight} 16px ${family}`, `${countWeight} 16px ${countFamily}`];
    await Promise.all(fonts.map((font) => {
      if (!this.fontLoads.has(font)) this.fontLoads.set(font, document.fonts.load(font, 'Backspace0123456789←↑→↓键'));
      return this.fontLoads.get(font);
    }));
    if (request !== this.themeRequest) return;

    this.releaseTheme();
    this.theme = theme;
    this.config = config;
    this.accent = accent;
    this.coldColor = resolveColor(config.cap.color, accent);
    this.coldTop = config.cap.coldTop ? new THREE.Color(config.cap.coldTop) : null;
    this.scene.background = config.background === null ? null : new THREE.Color(resolveColor(config.background, accent));
    this.camera.fov = config.fov ?? 26;
    const [minPolarAngle, maxPolarAngle] = config.polarRange ?? [0.12, 1.12];
    Object.assign(this.controls, { minPolarAngle, maxPolarAngle });
    this.canvas.style.imageRendering = config.pixelRatio ? 'pixelated' : '';
    this.renderer.setPixelRatio(this.pixelRatio());
    this.setLighting(config.lighting ?? {});
    if (config.bloom) {
      const { strength, radius, threshold } = config.bloom;
      this.composer = new EffectComposer(this.renderer);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(256, 256), strength, radius, threshold));
      this.composer.addPass(new OutputPass());
    }
    this.resize(true);
  }

  releaseTheme() {
    this.clearBoard();
    clearGroup(this.world);
    if (this.composer) {
      for (const pass of this.composer.passes) pass.dispose();
      this.composer.dispose();
      this.composer = null;
    }
    this.scene.environment = null;
    this.environmentTarget?.dispose();
    this.environmentTarget = null;
  }

  setLighting({ environment, main, hemisphere, ambient, shadow }) {
    this.renderer.shadowMap.enabled = Boolean(shadow);
    this.renderer.shadowMap.type = shadow?.radius ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
    if (environment) {
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      const room = new RoomEnvironment();
      try {
        this.environmentTarget = pmrem.fromScene(room, 0.04);
        this.scene.environment = this.environmentTarget.texture;
      } finally {
        room.dispose();
        pmrem.dispose();
      }
    }
    if (main) {
      const sun = new THREE.DirectionalLight(0xffffff, main.intensity);
      sun.position.set(...main.position);
      if (shadow) {
        sun.castShadow = true;
        Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 10, bottom: -10, near: 1, far: 60 });
        sun.shadow.mapSize.set(2048, 2048);
        sun.shadow.bias = -0.0006;
        if (shadow.radius) sun.shadow.radius = shadow.radius;
        const ground = flatPlane(new THREE.ShadowMaterial({ opacity: shadow.opacity, depthWrite: false }));
        ground.receiveShadow = true;
        this.world.add(ground);
      }
      this.world.add(sun);
    }
    if (hemisphere) {
      this.world.add(new THREE.HemisphereLight(hemisphere.sky ?? 0xffffff, hemisphere.ground, hemisphere.intensity));
    }
    if (ambient) this.world.add(new THREE.AmbientLight(0xffffff, ambient));
    if (this.config.grid) {
      const grid = new THREE.GridHelper(120, 120, this.accent, this.accent);
      Object.assign(grid.material, { transparent: true, opacity: 0.15, depthWrite: false });
      grid.position.y = -0.01;
      this.world.add(grid);
    }
    if (this.config.scanlines) {
      this.world.add(flatPlane(new THREE.MeshBasicMaterial({ color: this.scene.background })));
    }
  }

  clearBoard() {
    this.clearHover();
    clearGroup(this.board);
    this.renderer.renderLists.dispose();
    this.items = [];
    this.caps = [];
    this.width = 0;
    this.stylesUntil = 0;
  }

  addBase(width, depth) {
    const { base, well, lighting } = this.config;
    if (!base) return;
    const w = width + 0.9;
    const d = depth + 0.9;
    const shell = new THREE.Mesh(roundedBox(w, base.height, d, base), boxMaterial(base, resolveColor(base.color, this.accent)));
    shell.position.y = base.height / 2;
    shell.castShadow = shell.receiveShadow = Boolean(lighting?.shadow);
    this.board.add(shell);
    if (well) {
      const slot = new THREE.Mesh(
        new RoundedBoxGeometry(width + 0.22, 0.03, depth + 0.22, 2, 0.012),
        new THREE.MeshStandardMaterial({ color: '#c9ccd3', metalness: 0.4, roughness: 0.45 }),
      );
      slot.position.y = base.height;
      slot.receiveShadow = true;
      this.board.add(slot);
    }
    if (base.rim) {
      const rim = new THREE.Color(this.accent).lerp(new THREE.Color(0xffffff), 0.2);
      const lightness = 0.2126 * rim.r + 0.7152 * rim.g + 0.0722 * rim.b;
      const material = new THREE.MeshStandardMaterial({
        color: this.accent, emissive: rim, emissiveIntensity: 1.8 / lightness,
      });
      for (const direction of [-1, 1]) {
        const horizontal = new THREE.Mesh(new THREE.BoxGeometry(w - 0.15, 0.028, 0.034), material);
        horizontal.position.set(0, base.height + 0.002, direction * (d / 2 - 0.09));
        const vertical = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.028, d - 0.15), material);
        vertical.position.set(direction * (w / 2 - 0.09), base.height + 0.002, 0);
        this.board.add(horizontal, vertical);
      }
    }
  }

  build(layout) {
    this.clearBoard();
    const keys = layout.keys;
    this.width = Math.max(...keys.map((key) => key.x + key.w));
    this.depth = Math.max(...keys.map((key) => key.y + key.h));
    this.addBase(this.width, this.depth);
    const cap = this.config.cap;
    const geometries = new Map();
    const outline = cap.outline && new THREE.LineBasicMaterial({ color: cap.outline });
    let gradient;
    if (cap.kind === 'toon') {
      gradient = new THREE.DataTexture(new Uint8Array([70, 164, 255]), 3, 1, THREE.RedFormat);
      gradient.minFilter = gradient.magFilter = THREE.NearestFilter;
      gradient.needsUpdate = true;
    }
    for (const key of keys) {
      const size = `${key.w}x${key.h}`;
      if (!geometries.has(size)) {
        const geometry = roundedBox(key.w - CAP_GAP, cap.height, key.h - CAP_GAP, cap);
        geometries.set(size, {
          geometry,
          edge: outline && new THREE.EdgesGeometry(geometry),
          label: new THREE.PlaneGeometry(key.w - LABEL_INSET, key.h - LABEL_INSET),
        });
      }
      const shape = geometries.get(size);
      const material = boxMaterial(cap, this.coldColor, gradient);
      const face = paintableTop(material, this.coldColor, this.coldTop);
      const mesh = new THREE.Mesh(shape.geometry, material);
      const top = (this.config.base?.height ?? 0) + 0.01;
      mesh.position.set(key.x + key.w / 2 - this.width / 2, top + cap.height / 2, key.y + key.h / 2 - this.depth / 2);
      mesh.castShadow = mesh.receiveShadow = Boolean(this.config.lighting?.shadow);
      mesh.renderOrder = 1;
      if (outline) {
        // 键帽与轮廓共边，让填充略向后偏移，避免墨线产生虚点。
        Object.assign(material, { polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
        const edges = new THREE.LineSegments(shape.edge, outline);
        edges.renderOrder = 2;
        mesh.add(edges);
      }

      const canvas = document.createElement('canvas');
      canvas.width = Math.min(1024, Math.round((key.w - LABEL_INSET) * LABEL_PIXELS));
      canvas.height = Math.round((key.h - LABEL_INSET) * LABEL_PIXELS);
      const context = canvas.getContext('2d');
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      if (this.config.pixelRatio) {
        texture.minFilter = texture.magFilter = THREE.NearestFilter;
        texture.generateMipmaps = false;
        context.imageSmoothingEnabled = false;
      } else {
        texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
      }
      const label = new THREE.Mesh(shape.label, new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }));
      label.rotation.x = -Math.PI / 2;
      label.position.y = cap.height / 2 + 0.003;
      label.renderOrder = mesh.renderOrder;
      mesh.add(label);
      this.board.add(mesh);
      const item = {
        key, mesh, material, face, canvas, context, texture, top,
        count: 0, t: 0, pressedAt: null, signature: null,
        color: new THREE.Color(this.coldColor), glow: new THREE.Color(), glowIntensity: 0,
        height: cap.height, targetHeight: cap.height,
        opacity: cap.opacity,
      };
      mesh.userData.item = item;
      this.items.push(item);
      this.caps.push(mesh);
    }
    this.resize(true);
  }

  drawLabel(item, dark, foreground) {
    const signature = `${item.key.label}|${item.count}|${dark}|${foreground}`;
    if (signature === item.signature) return false;
    item.signature = signature;
    const { context, canvas } = item;
    const { width, height } = canvas;
    const { family, keyWeight, countFamily = family, countWeight, keySize = 42, countSize = 36, softCount } = this.config.text;
    const margin = LABEL_PIXELS * 0.06;
    const available = width - margin * 2;
    context.clearRect(0, 0, width, height);
    context.textAlign = 'left';
    context.textBaseline = 'top';
    context.fillStyle = foreground;
    fitFont(context, item.key.label, family, keyWeight, keySize, available);
    context.fillText(item.key.label, margin, margin, available);

    if (item.count) {
      const number = countLabel(item.count);
      context.textAlign = 'right';
      context.textBaseline = 'bottom';
      if (softCount) context.fillStyle = dark ? 'rgba(255,255,255,0.85)' : '#6e6e73';
      else if (!this.config.bloom) context.globalAlpha = 0.85;
      fitFont(context, number, countFamily, countWeight, countSize, available);
      context.fillText(number, width - margin, height - LABEL_PIXELS * 0.05, available);
      context.globalAlpha = 1;
    }
    item.texture.needsUpdate = true;
    return true;
  }

  update(getVisual, animate = false) {
    if (!this.config) return;
    const { bloom, cap, heatGlow } = this.config;
    const now = performance.now();
    const motion = animate && this.active && !this.reducedMotion.matches;
    let changed = false;
    for (const item of this.items) {
      const { count, t, color, foreground, dark } = getVisual(item.key);
      if (motion && item.signature !== null && count > item.count) item.pressedAt = now;
      if (!motion) item.pressedAt = null;
      if (count !== item.count || t !== item.t || (count > 0 && color !== item.heatColor)) changed = true;
      item.count = count;
      item.t = t;
      item.heatColor = color;
      item.color.set(count ? color : this.coldColor);
      item.targetHeight = cap.height + (count ? t * MAX_HEAT_LIFT : 0);
      if (count && (heatGlow || bloom)) item.glow.set(color).multiplyScalar(bloom ? 1 : heatGlow * t);
      else item.glow.copy(ZERO_GLOW);
      item.glowIntensity = count ? 0.27 + 0.45 * t : 0;
      if (cap.opacity !== undefined) item.opacity = cap.opacity + t * (0.9 - cap.opacity);
      changed = this.drawLabel(item, dark, foreground) || changed;
      if (!motion) this.applyVisual(item, 1);
    }
    if (motion && changed) this.stylesUntil = now + 600;
    if (!motion) this.stylesUntil = 0;
    this.dirty ||= changed || !motion;
  }

  applyVisual(item, blend) {
    const { material, face } = item;
    if (!this.config.bloom) material.color.lerp(item.color, blend);
    material.emissive?.lerp(item.glow, blend);
    if (item.opacity !== undefined) material.opacity += (item.opacity - material.opacity) * blend;
    if (face) {
      const hasCount = item.count > 0;
      const topColor = hasCount ? item.color : this.coldTop ?? item.color;
      face.color.value.lerp(topColor, blend);
      const coverage = hasCount || this.coldTop ? 1 : 0;
      face.coverage.value += (coverage - face.coverage.value) * blend;
    }
    item.height += (item.targetHeight - item.height) * blend;
  }

  pixelRatio() {
    return this.config?.pixelRatio ?? Math.min(window.devicePixelRatio, 2);
  }

  fit() {
    const halfVertical = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const halfHorizontal = halfVertical * this.camera.aspect;
    const polar = this.config.polar ?? 0.55;
    const cos = Math.cos(polar);
    const sin = Math.sin(polar);
    const { base, cap, press } = this.config;
    const width = this.width + (base ? 0.9 : 0);
    const depth = this.depth + (base ? 0.9 : 0);
    const height = (base?.height ?? 0) + (cap.height + MAX_HEAT_LIFT) * (press.type === 'squash' ? 1.05 : 1) + 0.045;
    const target = this.controls.target.set(0, 0.35, 0.25);

    // 前沿比中心离镜头更近。用边界的透视投影保证底座也留有画布边距。
    const inset = 0.96;
    const horizontal = width / (2 * halfHorizontal * inset);
    let distance = 1.06 * Math.max((this.width + 1.6) / (2 * halfHorizontal), (this.depth + 3) / (2 * halfVertical));
    for (const y of [-target.y, height - target.y]) {
      for (const z of [-depth / 2 - target.z, depth / 2 - target.z]) {
        const near = y * cos + z * sin;
        const vertical = Math.abs(y * sin - z * cos) / (halfVertical * inset);
        distance = Math.max(distance, near + Math.max(horizontal, vertical));
      }
    }

    // 不把前一次拖动留下的阻尼带进重算后的取景位置。
    this.controls.enableDamping = false;
    this.controls.update();
    this.controls.enableDamping = true;
    this.controls.minDistance = distance * 0.5;
    this.controls.maxDistance = distance * 1.5;
    this.camera.position.set(0, distance * cos, distance * sin).add(target);
    this.controls.update();
  }

  resize(force = false) {
    this.needsFit ||= force;
    const w = this.container?.clientWidth;
    const h = this.container?.clientHeight;
    if (!w || !h) return;
    const ratio = this.pixelRatio();
    const ratioChanged = ratio !== this.renderer.getPixelRatio();
    if (!this.needsFit && w === this.viewWidth && h === this.viewHeight && !ratioChanged) return;
    this.needsFit = false;
    this.viewWidth = w;
    this.viewHeight = h;
    if (ratioChanged) {
      this.renderer.setPixelRatio(ratio);
      this.composer?.setPixelRatio(ratio);
    }
    this.renderer.setSize(w, h, false);
    this.composer?.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.width) this.fit();
    this.dirty = true;
  }

  onMove(event) {
    if (!this.active || event.buttons) return this.clearHover();
    const bounds = this.canvas.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    this.pointer.set(
      (event.clientX - bounds.left) / bounds.width * 2 - 1,
      1 - (event.clientY - bounds.top) / bounds.height * 2,
    );
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = this.raycaster.intersectObjects(this.caps, false)[0];
    const hover = hit?.object.userData.item;
    if (hover !== this.hover) this.dirty = true;
    this.hover = hover;
    if (hover) this.showTip(hover.key, event.clientX, event.clientY);
    else this.hideTip();
  }

  clearHover() {
    if (this.hover) {
      this.hover = null;
      this.dirty = true;
      this.hideTip();
    }
  }

  setActive(active) {
    if (this.active === active) return;
    this.active = active;
    if (active) {
      this.resize();
      this.dirty = true;
      this.lastFrame = 0;
      this.frame = requestAnimationFrame(this.loop);
    } else {
      cancelAnimationFrame(this.frame);
      this.clearHover();
    }
  }

  changePose(item, time) {
    const press = this.config.press;
    let scale = 1;
    let sink = 0;
    let glow = 0;
    let ink = false;
    if (item.pressedAt !== null) {
      const elapsed = Math.max(0, time - item.pressedAt);
      if (press.type === 'sink') sink = press.depth * Math.pow(0.8, elapsed / FRAME_MS);
      if (press.type === 'step' && elapsed < press.duration) sink = press.depth;
      if (press.type === 'glow') glow = 0.28 * Math.pow(0.82, elapsed / FRAME_MS);
      if (press.type === 'ink') ink = elapsed < press.duration;
      if (press.type === 'squash') {
        if (elapsed < 115) scale = 1.05 - 0.35 * Math.pow(1 - elapsed / 115, 3);
        else if (elapsed < 260) scale = 1 + 0.05 * Math.pow(1 - (elapsed - 115) / 145, 2);
      }
      if (sink < 0.0005 && glow < 0.005 && !ink && scale === 1) {
        item.pressedAt = null;
        sink = glow = 0;
      }
    }
    const height = item.height * scale;
    item.mesh.scale.y = height / this.config.cap.height;
    item.mesh.position.y = item.top + height / 2 - sink + (this.hover === item ? HOVER_LIFT : 0);
    if (this.config.bloom) item.material.emissiveIntensity = Math.min(1, item.glowIntensity + glow);
    if (press.type === 'ink') item.material.color.copy(ink ? INK : item.color);
  }

  loop(time) {
    if (!this.active) return;
    this.frame = requestAnimationFrame(this.loop);
    const moved = this.controls.update();
    const styleChanged = this.stylesUntil > 0;
    const pressed = this.items.some((item) => item.pressedAt !== null);
    if (this.config && (this.dirty || moved || styleChanged || pressed) && this.viewWidth && this.viewHeight) {
      const frames = this.lastFrame ? THREE.MathUtils.clamp((time - this.lastFrame) / FRAME_MS, 1, 4) : 1;
      const blend = time < this.stylesUntil ? 1 - Math.pow(0.84, frames) : 1;
      if (blend === 1) this.stylesUntil = 0;
      for (const item of this.items) {
        if (styleChanged) this.applyVisual(item, blend);
        this.changePose(item, time);
      }
      this.dirty = false;
      try {
        if (this.composer) this.composer.render();
        else this.renderer.render(this.scene, this.camera);
      } catch (error) {
        this.fail(error);
      }
    }
    this.lastFrame = time;
  }

  fail(error) {
    this.setActive(false);
    if (this.onError) this.onError(error);
    else console.error(error);
  }
}

export default Board3D;
