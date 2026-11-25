import { mix } from './shared.js';

const SYSTEM = '-apple-system, "SF Pro Text", "Segoe UI Variable Text", "Segoe UI", "Microsoft YaHei UI", sans-serif';
const SERIF = '"Noto Serif SC", "Source Han Serif SC", "Songti SC", SimSun, serif';
const studio = {
  environment: true,
  main: { intensity: 1.1, position: [-7, 18, 11] },
  hemisphere: { intensity: 0.35, ground: '#e6e8ee' },
};
const studioText = { family: SYSTEM, keyWeight: 500, countWeight: 600 };

const clay = (accent) => mix('#f1edf6', accent, 0.07);
const screen = (accent) => mix('#a9b68e', accent, 0.18);
export const LCD_INK = '#1b2412';

export const THREE_PRESETS = {
  apple: {
    background: '#ffffff',
    base: { height: 0.5, radius: 0.26, segments: 6, color: '#dcdee3', metalness: 0.55, roughness: 0.3 },
    well: true,
    cap: { height: 0.34, radius: 0.1, segments: 4, color: '#fbfbfd', roughness: 0.48, envMapIntensity: 0.85 },
    lighting: { ...studio, shadow: { opacity: 0.1 } },
    text: { ...studioText, softCount: true },
    heatGlow: 0.1,
    press: { type: 'sink', depth: 0.14 },
  },
  glass: {
    background: null,
    base: { height: 0.46, radius: 0.19, segments: 4, color: '#ffffff', roughness: 0.4, opacity: 0.35 },
    cap: { height: 0.32, radius: 0.12, segments: 4, color: '#ffffff', roughness: 0.15, opacity: 0.45 },
    lighting: { environment: true, main: { intensity: 1, position: [-7, 18, 11] } },
    text: { ...studioText, family: '-apple-system, "Segoe UI Variable Display", "Segoe UI", "Microsoft YaHei UI", sans-serif' },
    press: { type: 'sink', depth: 0.12 },
  },
  widget: {
    background: '#ffffff',
    base: { height: 0.5, radius: 0.25, segments: 6, color: '#e9e9ee', metalness: 0.1, roughness: 0.6 },
    well: true,
    cap: { height: 0.3, radius: 0.14, segments: 4, color: '#f2f2f7', roughness: 0.55, envMapIntensity: 0.85 },
    lighting: { ...studio, shadow: { opacity: 0.08 } },
    text: studioText,
    heatGlow: 0.1,
    press: { type: 'sink', depth: 0.12 },
  },
  paper: {
    background: '#f3eee3',
    fov: 18,
    cap: { height: 0.18, color: '#f3eee3', kind: 'toon', outline: '#1f1b16' },
    lighting: {
      main: { intensity: 0.88, position: [-7, 18, 11] },
      hemisphere: { intensity: 0.22, ground: '#cfc7b8' },
      ambient: 0.7,
      shadow: { opacity: 0.15 },
    },
    text: { family: SERIF, keyWeight: 500, countWeight: 600, keySize: 37 },
    press: { type: 'sink', depth: 0.08 },
  },
  pixel: {
    background: '#1d2b53',
    pixelRatio: 0.75,
    base: { height: 0.42, color: '#000000', kind: 'lambert' },
    cap: { height: 0.4, color: '#29366f', kind: 'lambert' },
    lighting: { main: { intensity: 0.92, position: [-7, 18, 11] }, ambient: 0.52 },
    text: { family: '"Press Start 2P", SimSun, monospace', keyWeight: 400, countWeight: 400, keySize: 40, countSize: 37 },
    press: { type: 'step', depth: 0.15, duration: 100 },
  },
  cyber: {
    background: '#05070d',
    grid: true,
    bloom: true,
    base: { height: 0.42, radius: 0.09, segments: 2, color: '#0b0f1a', metalness: 0.8, roughness: 0.3, rim: true },
    cap: { height: 0.3, radius: 0.04, segments: 2, color: '#0f1526', metalness: 0.6, roughness: 0.35 },
    lighting: {
      main: { intensity: 0.8, position: [-7, 18, 11] },
      hemisphere: { intensity: 0.38, sky: '#b7c5ff', ground: '#35124b' },
    },
    text: {
      family: 'Rajdhani, "Microsoft YaHei UI", sans-serif', keyWeight: 700,
      countFamily: 'Orbitron, "Microsoft YaHei UI", sans-serif', countWeight: 700,
    },
    press: { type: 'glow' },
  },
  win9x: {
    background: '#c0c0c0',
    base: { height: 0.5, color: '#c0c0c0', kind: 'lambert' },
    cap: { height: 0.3, radius: 0.02, segments: 1, color: '#c0c0c0', kind: 'lambert' },
    lighting: { main: { intensity: 1.24, position: [-8, 10, -6] }, ambient: 0.48 },
    text: { family: 'Tahoma, "MS Sans Serif", SimSun, "Microsoft YaHei UI", sans-serif', keyWeight: 500, countWeight: 600 },
    press: { type: 'sink', depth: 0.1 },
  },
  clay: {
    background: clay,
    base: { height: 0.6, radius: 0.3, segments: 6, color: clay, roughness: 0.95 },
    cap: { height: 0.42, radius: 0.2, segments: 6, color: clay, roughness: 0.92 },
    lighting: {
      main: { intensity: 0.8, position: [-7, 18, 11] },
      hemisphere: { intensity: 0.6, ground: '#e6ddec' },
      ambient: 0.62,
      shadow: { opacity: 0.18, radius: 8 },
    },
    text: { family: 'Nunito, "Microsoft YaHei UI", sans-serif', keyWeight: 600, countWeight: 800 },
    press: { type: 'squash' },
  },
  lcd: {
    background: screen,
    polar: 0.34,
    polarRange: [0.05, 0.5],
    scanlines: true,
    cap: { height: 0.1, color: (accent) => mix(screen(accent), LCD_INK, 0.12), kind: 'basic' },
    text: { family: 'VT323, "Microsoft YaHei UI", monospace', keyWeight: 400, countWeight: 400, keySize: 56, countSize: 52 },
    press: { type: 'ink', duration: 150 },
  },
};
