import './playground.css';
import {
  createIcons, Activity, ArrowRight, ArrowUpRight, Captions, Code2, Copy, Gauge,
  House, Keyboard, Layers, Link2, Maximize, Menu, Moon, Monitor, MonitorPlay,
  MousePointer2, PanelLeftClose, PanelLeftOpen, PictureInPicture2, Play, RadioTower,
  Repeat, RotateCcw, ShieldCheck, SkipForward, SlidersHorizontal, Sparkles, Sun, Volume2,
} from 'lucide';
import { createPlayer, type UniversalPlayerFeatures, type UniversalPlayerTheme, type UniversalPlayerControlsStyle } from './index.js';
import { detectProvider, normalizePastedVideoUrl } from './source.js';

const DEFAULT_DASH_URL = 'https://files.vidstack.io/sprite-fight/dash/stream.mpd';
type FeatureKey = keyof UniversalPlayerFeatures;

const iconSet = {
  Activity, ArrowRight, ArrowUpRight, Captions, Code2, Copy, Gauge,
  House, Keyboard, Layers, Link2, Maximize, Menu, Moon, Monitor, MonitorPlay,
  MousePointer2, PanelLeftClose, PanelLeftOpen, PictureInPicture2, Play, RadioTower,
  Repeat, RotateCcw, ShieldCheck, SkipForward, SlidersHorizontal, Sparkles, Sun, Volume2,
};
createIcons({ icons: iconSet, attrs: { class: 'studio-icon', 'stroke-width': 1.8 } });

const frame = document.querySelector<HTMLElement>('#studio-frame');
const sidebarToggle = document.querySelector<HTMLButtonElement>('#studio-sidebar-toggle');
const themeToggle = document.querySelector<HTMLButtonElement>('#studio-theme-toggle');
const themeButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-studio-theme]')];
const controlsSelect = document.querySelector<HTMLSelectElement>('#studio-controls-style');
const accentSelect = document.querySelector<HTMLSelectElement>('#studio-accent');
const glassToggle = document.querySelector<HTMLInputElement>('#studio-glass-toggle');
const resetButton = document.querySelector<HTMLButtonElement>('#studio-reset');
const sourceForm = document.querySelector<HTMLFormElement>('#studio-source-form');
const sourceInput = document.querySelector<HTMLInputElement>('#studio-source-url');
const statusText = document.querySelector<HTMLElement>('#studio-status-text');
const statusDot = document.querySelector<HTMLElement>('#studio-status-dot');
const providerLabel = document.querySelector<HTMLElement>('#studio-provider-label');
const currentSourceLabel = document.querySelector<HTMLElement>('#studio-current-source');
const qualitySupport = document.querySelector<HTMLElement>('#studio-quality-support');
const enabledCount = document.querySelector<HTMLElement>('#studio-enabled-count');
const featureHint = document.querySelector<HTMLElement>('#studio-feature-hint');
const eventLog = document.querySelector<HTMLElement>('#studio-event-log');
const runtimeBadge = document.querySelector<HTMLElement>('#studio-runtime-badge');
const toast = document.querySelector<HTMLElement>('#studio-toast');

if (!frame || !sidebarToggle || !themeToggle || !controlsSelect || !accentSelect || !glassToggle ||
  !resetButton || !sourceForm || !sourceInput || !statusText || !statusDot || !providerLabel ||
  !currentSourceLabel || !qualitySupport || !enabledCount || !featureHint || !eventLog || !runtimeBadge || !toast) {
  throw new Error('Feature playground markup is incomplete.');
}

let themeValue: UniversalPlayerTheme = 'light';
let toastTimer: number | undefined;
let latestLoadRequest = 0;

const featureInputs = [...document.querySelectorAll<HTMLInputElement>('[data-studio-feature]')];
const featureStatusCopy: Record<FeatureKey, string> = {
  seek: 'Ready · timeline',
  skip: 'Ready · ±10 seconds',
  volume: 'Ready · volume controls',
  playbackSpeed: 'Ready · speed menu',
  quality: 'Source-dependent · adaptive renditions',
  captions: 'Source-dependent · caption tracks',
  pictureInPicture: 'Browser/provider-dependent',
  miniPlayer: 'Ready · mini player',
  theaterMode: 'Ready · theater mode',
  fullscreen: 'Browser-dependent · fullscreen API',
  contextMenu: 'Ready · right-click',
  loop: 'Ready · repeat playback',
  copyLink: 'Ready · copy on request',
  stats: 'Ready · playback stats',
  keyboardHelp: 'Ready · shortcut reference',
  liveIndicator: 'Live sources only',
};

const player = createPlayer('#studio-player-mount', {
  title: 'Featured demo',
  source: { src: DEFAULT_DASH_URL, type: 'application/dash+xml', title: 'Featured demo' },
  preload: 'metadata',
  aspectRatio: '16 / 9',
  objectFit: 'contain',
  playbackRates: [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2],
  autohide: true,
  theme: 'light',
  glass: true,
  accentColor: 'rgb(54, 214, 176)',
});

function showToast(message: string, isError = false): void {
  if (toastTimer) window.clearTimeout(toastTimer);
  toast!.textContent = message;
  toast!.style.borderColor = isError ? 'rgba(244,63,94,.3)' : 'rgba(16,185,129,.25)';
  toast!.style.color = isError ? '#be123c' : '#047857';
  toast!.hidden = false;
  toastTimer = window.setTimeout(() => { toast!.hidden = true; }, 2800);
}

function addLog(message: string, status: 'success' | 'info' | 'error' = 'info'): void {
  const line = document.createElement('div');
  line.className = 'studio-event-line';
  line.dataset.status = status;
  const dot = document.createElement('span');
  if (status === 'error') dot.style.background = '#f43f5e';
  else if (status === 'success') dot.style.background = '#10b981';
  else dot.style.background = '#3b82f6';
  const text = document.createElement('p');
  text.textContent = message;
  const time = document.createElement('time');
  time.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  line.append(dot, text, time);
  eventLog!.prepend(line);
  while (eventLog!.children.length > 6) eventLog!.lastElementChild?.remove();
}

function setPlayerStatus(message: string, status: 'loading' | 'ready' | 'playing' | 'error' = 'ready'): void {
  statusText!.textContent = message;
  statusDot!.className = 'studio-status-dot ' + status;
  runtimeBadge!.textContent = status === 'playing' ? 'Playing' : status === 'loading' ? 'Loading' :
    status === 'error' ? 'Needs attention' : 'Ready';
  runtimeBadge!.classList.toggle('is-error', status === 'error');
}

function providerName(provider: string): string {
  const names: Record<string, string> = {
    html5: 'HTML5 VIDEO', hls: 'HLS STREAM', dash: 'DASH STREAM',
    youtube: 'YOUTUBE EMBED', vimeo: 'VIMEO EMBED', tiktok: 'TIKTOK EMBED',
    twitch: 'TWITCH EMBED', wistia: 'WISTIA EMBED', playerjs: 'PLAYER.JS EMBED',
  };
  return names[provider] || provider.toUpperCase();
}

function effectiveTheme(theme: UniversalPlayerTheme): 'light' | 'dark' {
  if (theme !== 'system') return theme;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function setTheme(theme: UniversalPlayerTheme, persist = true): void {
  themeValue = theme;
  const pageTheme = effectiveTheme(theme);
  document.body.classList.toggle('studio-theme-light', pageTheme === 'light');
  document.body.classList.toggle('studio-theme-dark', pageTheme === 'dark');
  document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute('content',
    pageTheme === 'light' ? '#f8fafc' : '#080d16');
  themeToggle!.setAttribute('aria-label', 'Switch to ' + (pageTheme === 'light' ? 'dark' : 'light') + ' theme');
  themeToggle!.setAttribute('title', 'Switch to ' + (pageTheme === 'light' ? 'dark' : 'light') + ' theme');
  themeToggle!.innerHTML = '<i data-lucide="' + (pageTheme === 'light' ? 'moon' : 'sun') + '"></i>';
  createIcons({ icons: iconSet, attrs: { class: 'studio-icon', 'stroke-width': 1.8 } });
  themeButtons.forEach((button) => {
    const active = button.dataset.studioTheme === theme;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  player.setTheme(theme);
  if (persist) {
    try { window.localStorage.setItem('universal-player-site-theme', pageTheme); } catch { /* optional preference */ }
  }
}

function updateFeatureStatuses(): void {
  let enabled = 0;
  const media = player.media as HTMLVideoElement;
  const qualityMenu = player.container.querySelector<HTMLElement>('.up-quality-menu-group');
  const featureStateText: Record<FeatureKey, string> = { ...featureStatusCopy };
  if (player.currentProvider === 'hls' || player.currentProvider === 'dash') {
    featureStateText.quality = qualityMenu && !qualityMenu.hidden
      ? 'Available · stream renditions found' : 'Enabled · waiting for renditions';
  } else {
    featureStateText.quality = 'Enabled · needs HLS/DASH renditions';
  }
  const trackCount = media.textTracks?.length || 0;
  featureStateText.captions = trackCount > 0 ? 'Available · caption tracks detected' : 'Enabled · no caption tracks detected';
  featureStateText.pictureInPicture = typeof media.requestPictureInPicture === 'function'
    ? 'Available · browser API detected' : 'Enabled · provider/browser may block it';
  const stage = player.container.querySelector<HTMLElement>('.up-stage');
  featureStateText.fullscreen = stage && typeof stage.requestFullscreen === 'function'
    ? 'Available · browser API detected' : 'Enabled · browser may block it';
  featureStateText.liveIndicator = player.isLiveStream ? 'Available · live source detected' : 'Enabled · live sources only';

  featureInputs.forEach((input) => {
    const key = input.dataset.studioFeature as FeatureKey | undefined;
    if (!key) return;
    const active = input.checked;
    if (active) enabled += 1;
    const row = input.closest<HTMLElement>('[data-feature-row]');
    row?.classList.toggle('is-disabled', !active);
    const status = document.querySelector<HTMLElement>('[data-feature-status="' + key + '"]');
    if (status) status.textContent = active ? featureStateText[key] : 'Disabled · hidden from player';
  });
  enabledCount!.textContent = enabled + ' / ' + featureInputs.length + ' active';
}

function applyAppearance(): void {
  player.setGlassEffect(glassToggle!.checked);
  player.setAccentColor(accentSelect!.value);
  player.setControlsStyle(controlsSelect!.value as UniversalPlayerControlsStyle);
  player.setTheme(themeValue);
}

function applyFeature(key: FeatureKey, checked: boolean): void {
  player.setFeatures({ [key]: checked } as Partial<UniversalPlayerFeatures>);
  updateFeatureStatuses();
  const label = document.querySelector<HTMLElement>('[data-feature-row="' + key + '"] .studio-feature-copy strong')?.textContent || key;
  featureHint!.textContent = label + (checked ? ' enabled.' : ' disabled.') +
    ' ' + (checked ? 'The player UI has been updated.' : 'The related control is hidden or inactive.');
  addLog(label + (checked ? ' enabled' : ' disabled') + ' — applied immediately.', checked ? 'success' : 'info');
}

async function loadSource(raw: string): Promise<void> {
  const request = ++latestLoadRequest;
  let url: string;
  try {
    url = normalizePastedVideoUrl(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Paste a valid http(s) video URL.';
    setPlayerStatus(message, 'error');
    addLog(message, 'error');
    showToast(message, true);
    return;
  }

  const provider = detectProvider(url);
  setPlayerStatus('Attaching ' + providerName(provider).toLowerCase() + '…', 'loading');
  addLog('Loading a custom ' + providerName(provider).toLowerCase() + ' source…');
  try {
    await player.setSource({ src: url, title: 'Custom video · ' + providerName(provider) });
    if (request !== latestLoadRequest) return;
    currentSourceLabel!.textContent = 'Custom source · ' + providerName(provider);
    providerLabel!.textContent = providerName(provider);
    sourceInput!.value = url;
    setPlayerStatus('Source attached · ready to play', 'ready');
    featureHint!.textContent = 'Custom source attached. Test the controls; some options depend on this provider.';
    updateFeatureStatuses();
    addLog('Custom source attached. Source URLs are not shown elsewhere in the UI.', 'success');
  } catch (error) {
    if (request !== latestLoadRequest) return;
    const message = error instanceof Error ? error.message : 'Could not attach this source.';
    setPlayerStatus(message, 'error');
    addLog(message, 'error');
    showToast(message, true);
  }
}

sourceForm.addEventListener('submit', (event) => {
  event.preventDefault();
  void loadSource(sourceInput.value);
});
sourceInput.addEventListener('paste', () => {
  window.setTimeout(() => {
    const pasted = sourceInput!.value.trim();
    if (pasted) void loadSource(pasted);
  }, 0);
});

featureInputs.forEach((input) => {
  const key = input.dataset.studioFeature as FeatureKey | undefined;
  if (!key) return;
  input.addEventListener('change', () => applyFeature(key, input.checked));
});

themeButtons.forEach((button) => {
  button.addEventListener('click', () => setTheme(button.dataset.studioTheme as UniversalPlayerTheme));
});
themeToggle.addEventListener('click', () => {
  const pageTheme = effectiveTheme(themeValue);
  setTheme(pageTheme === 'light' ? 'dark' : 'light');
});
controlsSelect.addEventListener('change', () => {
  applyAppearance();
  addLog('Control density changed to ' + controlsSelect.value + '.', 'success');
});
accentSelect.addEventListener('change', () => {
  applyAppearance();
  addLog('Player accent colour updated.', 'success');
});
glassToggle.addEventListener('change', () => {
  applyAppearance();
  addLog('Glass controls ' + (glassToggle.checked ? 'enabled' : 'disabled') + '.', 'success');
});

sidebarToggle.addEventListener('click', () => {
  const mobile = window.matchMedia('(max-width: 900px)').matches;
  if (mobile) {
    frame!.classList.toggle('sidebar-open');
    sidebarToggle!.setAttribute('aria-label', frame!.classList.contains('sidebar-open') ? 'Hide sidebar' : 'Show sidebar');
  } else {
    const hidden = frame!.classList.toggle('nav-hidden');
    sidebarToggle!.setAttribute('aria-label', hidden ? 'Show sidebar' : 'Hide sidebar');
  }
  sidebarToggle!.innerHTML = '<i data-lucide="' + (sidebarToggle!.getAttribute('aria-label') === 'Hide sidebar' ? 'panel-left-close' : 'panel-left-open') + '"></i>';
  createIcons({ icons: iconSet, attrs: { class: 'studio-icon', 'stroke-width': 1.8 } });
});

resetButton.addEventListener('click', async () => {
  setTheme('light');
  controlsSelect!.value = 'standard';
  accentSelect!.value = 'rgb(54, 214, 176)';
  glassToggle!.checked = true;
  featureInputs.forEach((input) => { input.checked = true; });
  applyAppearance();
  player.setFeatures(Object.fromEntries(featureInputs.map((input) => [input.dataset.studioFeature, true])) as Partial<UniversalPlayerFeatures>);
  sourceInput!.value = '';
  currentSourceLabel!.textContent = 'Built-in demo stream';
  providerLabel!.textContent = 'DASH STREAM';
  featureHint!.textContent = 'Settings reset. The built-in demo remains loaded; its URL stays hidden.';
  updateFeatureStatuses();
  addLog('All settings reset. Restored the hidden demo source.', 'success');
  try {
    await player.setSource({ src: DEFAULT_DASH_URL, type: 'application/dash+xml', title: 'Featured demo' });
    setPlayerStatus('Demo source attached · press play to start', 'ready');
  } catch (error) {
    setPlayerStatus(error instanceof Error ? error.message : 'Unable to restore demo.', 'error');
  }
});

player.on('sourcechange', (event) => {
  const detail = (event as CustomEvent<{ source: { src: string; title?: string }; provider: string }>).detail;
  const isDefault = detail.source.src === DEFAULT_DASH_URL;
  const name = providerName(detail.provider);
  providerLabel!.textContent = name;
  currentSourceLabel!.textContent = isDefault ? 'Built-in demo stream' : 'Custom source · ' + name;
  setPlayerStatus(isDefault ? 'Demo stream attached · press play to start' : 'Custom source attached · ready to play', 'ready');
  updateFeatureStatuses();
});
player.on('loadstart', () => setPlayerStatus('Loading media…', 'loading'));
player.on('loadedmetadata', () => {
  const duration = player.duration;
  setPlayerStatus(Number.isFinite(duration) && duration > 0 ? 'Metadata loaded · ' + Math.floor(duration) + ' seconds' : 'Live or unknown duration', 'ready');
  const qualityMenu = player.container.querySelector<HTMLElement>('.up-quality-menu-group');
  qualitySupport!.textContent = qualityMenu && !qualityMenu.hidden ? 'Renditions detected' :
    player.currentProvider === 'dash' || player.currentProvider === 'hls' ? 'Waiting for stream renditions' : 'No adaptive rendition menu';
  updateFeatureStatuses();
});
player.on('playing', () => { setPlayerStatus('Playing', 'playing'); addLog('Playback started.', 'success'); });
player.on('pause', () => setPlayerStatus('Paused', 'ready'));
player.on('waiting', () => setPlayerStatus('Buffering…', 'loading'));
player.on('ended', () => { setPlayerStatus('Playback ended', 'ready'); addLog('Playback finished.', 'info'); });
player.on('error', (event) => {
  const detail = (event as CustomEvent<{ error?: { message?: string } | null }>).detail;
  const message = detail?.error?.message || 'The source could not play. Check the URL, provider permissions, CORS and browser codecs.';
  setPlayerStatus(message, 'error');
  addLog(message, 'error');
});
player.on('featureerror', (event) => {
  const detail = (event as CustomEvent<{ feature?: string; error?: unknown }>).detail;
  const message = (detail?.feature || 'Player feature') + ' is unavailable for this source or browser.';
  featureHint!.textContent = message;
  addLog(message, 'error');
  showToast(message, true);
});

let savedTheme: 'light' | 'dark' = 'light';
try {
  if (window.localStorage.getItem('universal-player-site-theme') === 'dark') savedTheme = 'dark';
} catch { /* the default is light */ }
setTheme(savedTheme, false);
applyAppearance();
player.ready.then(() => {
  setPlayerStatus('Demo source attached · press play to start', 'ready');
  updateFeatureStatuses();
  addLog('Player initialized with the built-in demo stream.', 'success');
}).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Player initialization failed.';
  setPlayerStatus(message, 'error');
  addLog(message, 'error');
});
window.addEventListener('beforeunload', () => player.destroy());
