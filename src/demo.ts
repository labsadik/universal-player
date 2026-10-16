import './demo.css';
import { createIcons, Menu, Play, Link2, ClipboardPaste, ArrowUpRight, ArrowRight, House, History, Layers, Code2, SlidersHorizontal, Sparkles, Clapperboard, ThumbsUp, Share2, Copy, RotateCcw, Flower2, Film, ChevronRight, ExternalLink, Waves, AlertCircle, Sun, Moon } from 'lucide';
import { createPlayer, type UniversalPlayerFeatures } from './index.js';
import { detectProvider, normalizePastedVideoUrl } from './source.js';

const DEFAULT_DASH_URL = 'https://files.vidstack.io/sprite-fight/dash/stream.mpd';
const SAMPLE_MP4 = 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4';
const BIG_BUCK_MP4 = 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4';

const iconSet = {
  Menu, Play, Link2, ClipboardPaste, ArrowUpRight, House, History, Layers, Code2,
  ArrowRight, SlidersHorizontal, Sparkles, Clapperboard, ThumbsUp, Share2, Copy, RotateCcw, Flower2, Film,
  ChevronRight, ExternalLink, Waves, AlertCircle, Sun, Moon,
};
createIcons({
  icons: iconSet,
  attrs: { class: 'app-icon', 'stroke-width': 1.8 },
});

const statusLine = document.querySelector<HTMLElement>('#player-status');
const statusWrap = document.querySelector<HTMLElement>('.player-status');
const statusIndicator = document.querySelector<HTMLElement>('#status-indicator');
const titleLine = document.querySelector<HTMLElement>('#source-title');
const badge = document.querySelector<HTMLElement>('#media-badge');
const providerPill = document.querySelector<HTMLElement>('#provider-pill');
const videoHeading = document.querySelector<HTMLElement>('#video-heading');
const videoSubtitle = document.querySelector<HTMLElement>('#video-subtitle');
const feedback = document.querySelector<HTMLElement>('#url-feedback');
const urlForm = document.querySelector<HTMLFormElement>('#video-loader-form');
const urlInput = document.querySelector<HTMLInputElement>('#video-url');
const sideUrlInput = document.querySelector<HTMLInputElement>('#source-url-side');
const sideLoadButton = document.querySelector<HTMLButtonElement>('#load-side-url');
const pasteButton = document.querySelector<HTMLButtonElement>('#paste-clipboard');
const likeButton = document.querySelector<HTMLButtonElement>('#like-button');
const likeCount = document.querySelector<HTMLElement>('#like-count');
const shareButton = document.querySelector<HTMLButtonElement>('#share-button');
const copyButton = document.querySelector<HTMLButtonElement>('#copy-link-button');
const restoreButton = document.querySelector<HTMLButtonElement>('#restore-sample');
const toast = document.querySelector<HTMLElement>('#toast');
const sidebar = document.querySelector<HTMLElement>('#sidebar');
const sidebarToggle = document.querySelector<HTMLButtonElement>('#sidebar-toggle');
const themeToggle = document.querySelector<HTMLButtonElement>('#theme-toggle');
const themeSelect = document.querySelector<HTMLSelectElement>('#demo-theme');
const controlsSelect = document.querySelector<HTMLSelectElement>('#demo-controls');
const accentSelect = document.querySelector<HTMLSelectElement>('#demo-accent');
const glassToggle = document.querySelector<HTMLInputElement>('#demo-glass');
const resetSettings = document.querySelector<HTMLButtonElement>('#reset-player-settings');
const customizationStatus = document.querySelector<HTMLElement>('#customization-status');

if (
  !statusLine || !statusWrap || !statusIndicator || !titleLine || !badge || !providerPill ||
  !videoHeading || !videoSubtitle || !feedback || !urlForm || !urlInput || !sideUrlInput ||
  !sideLoadButton || !pasteButton || !likeButton || !likeCount || !shareButton || !copyButton ||
  !restoreButton || !toast || !sidebar || !sidebarToggle || !themeToggle || !themeSelect || !controlsSelect ||
  !accentSelect || !glassToggle || !resetSettings || !customizationStatus
) {
  throw new Error('Universal Player demo markup is incomplete.');
}

let objectUrl: string | undefined;
let toastTimer: number | undefined;
let isLiked = false;

const player = createPlayer('#player-mount', {
  title: 'Featured demo',
  source: { src: DEFAULT_DASH_URL, type: 'application/dash+xml', title: 'Featured demo' },
  preload: 'metadata',
  aspectRatio: '16 / 9',
  objectFit: 'contain',
  playbackRates: [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2],
  autohide: true,
  hideSourceUrl: true,
  theme: 'light',
  glass: true,
  accentColor: 'rgb(54, 214, 176)',
});


function applyCustomization(): void {
  player.setTheme(themeSelect!.value as 'dark' | 'light' | 'system');
  player.setGlassEffect(glassToggle!.checked);
  player.setAccentColor(accentSelect!.value);
  player.setControlsStyle(controlsSelect!.value as 'standard' | 'compact' | 'minimal');
  const features: Partial<UniversalPlayerFeatures> = {};
  document.querySelectorAll<HTMLInputElement>('[data-demo-feature]').forEach((input) => {
    features[input.dataset.demoFeature as keyof UniversalPlayerFeatures] = input.checked;
  });
  player.setFeatures(features);
  customizationStatus!.textContent = 'Applied · ' + themeSelect!.selectedOptions[0]?.textContent +
    ' theme · ' + controlsSelect!.selectedOptions[0]?.textContent + ' controls · ' +
    (glassToggle!.checked ? 'glass enabled' : 'glass disabled');
}
themeSelect.addEventListener('change', applyCustomization);

function setWebsiteTheme(theme: 'light' | 'dark', persist = true): void {
  document.body.classList.toggle('site-theme-light', theme === 'light');
  document.body.classList.toggle('site-theme-dark', theme === 'dark');
  document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute('content', theme === 'light' ? '#f8fafc' : '#080d16');
  const nextTheme = theme === 'light' ? 'dark' : 'light';
  themeToggle!.setAttribute('aria-label', 'Switch to ' + nextTheme + ' theme');
  themeToggle!.setAttribute('title', 'Switch to ' + nextTheme + ' theme');
  themeToggle!.innerHTML = '<i data-lucide="' + (theme === 'light' ? 'moon' : 'sun') + '"></i>';
  createIcons({ icons: iconSet, attrs: { class: 'app-icon', 'stroke-width': 1.8 } });
  themeSelect!.value = theme;
  if (persist) {
    try { window.localStorage.setItem('universal-player-site-theme', theme); } catch { /* storage may be unavailable */ }
  }
  applyCustomization();
}

let initialSiteTheme: 'light' | 'dark' = 'light';
try {
  if (window.localStorage.getItem('universal-player-site-theme') === 'dark') initialSiteTheme = 'dark';
} catch { /* use the light default when storage is unavailable */ }
setWebsiteTheme(initialSiteTheme, false);
themeToggle.addEventListener('click', () => {
  setWebsiteTheme(document.body.classList.contains('site-theme-light') ? 'dark' : 'light');
});

const exampleTabs = [...document.querySelectorAll<HTMLButtonElement>('[data-code-tab]')];
const codeContent = document.querySelector<HTMLElement>('#monaco-code-content');
const copyExampleCode = document.querySelector<HTMLButtonElement>('#copy-example-code');
const codeFileLabel = document.querySelector<HTMLElement>('#code-file-label');
const codeLanguageLabel = document.querySelector<HTMLElement>('#code-language-label');
const monacoStatusLanguage = document.querySelector<HTMLElement>('#monaco-status-language');
const exampleMeta: Record<string, { file: string; language: string }> = {
  vanilla: { file: 'main.ts', language: 'TypeScript' },
  react: { file: 'VideoPlayer.tsx', language: 'TypeScript React' },
  vue: { file: 'VideoPlayer.vue', language: 'Vue / TypeScript' },
};

function selectCodeExample(name: string): void {
  const meta = exampleMeta[name];
  const template = document.querySelector<HTMLTemplateElement>('#code-template-' + name);
  if (!meta || !template || !codeContent) return;
  codeContent.innerHTML = template.innerHTML;
  codeContent.setAttribute('aria-labelledby', 'code-tab-' + name);
  exampleTabs.forEach((tab) => {
    const active = tab.dataset.codeTab === name;
    tab.classList.toggle('is-active', active);
    tab.setAttribute('aria-selected', String(active));
  });
  document.querySelectorAll<HTMLElement>('[data-tree-file]').forEach((item) => {
    item.classList.toggle('is-selected', item.dataset.treeFile === name);
  });
  if (codeFileLabel) codeFileLabel.textContent = meta.file;
  if (codeLanguageLabel) codeLanguageLabel.textContent = meta.language;
  if (monacoStatusLanguage) monacoStatusLanguage.textContent = meta.language;
}
exampleTabs.forEach((tab) => tab.addEventListener('click', () => {
  if (tab.dataset.codeTab) selectCodeExample(tab.dataset.codeTab);
}));
copyExampleCode?.addEventListener('click', async () => {
  if (!codeContent) return;
  const source = [...codeContent.querySelectorAll<HTMLElement>('.monaco-line')]
    .map((line) => line.textContent ?? '').join('\n');
  try {
    await navigator.clipboard.writeText(source);
    showToast('Example code copied to clipboard.');
  } catch {
    const textArea = document.createElement('textarea');
    textArea.value = source;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.append(textArea);
    textArea.select();
    const copied = document.execCommand('copy');
    textArea.remove();
    showToast(copied ? 'Example code copied to clipboard.' : 'Clipboard access was blocked.', copied ? 'success' : 'error');
  }
});
selectCodeExample('vanilla');

controlsSelect.addEventListener('change', applyCustomization);
accentSelect.addEventListener('change', applyCustomization);
glassToggle.addEventListener('change', applyCustomization);
document.querySelectorAll<HTMLInputElement>('[data-demo-feature]').forEach((input) => {
  input.addEventListener('change', applyCustomization);
});
resetSettings.addEventListener('click', () => {
  setWebsiteTheme('light');
  themeSelect!.value = 'light';
  controlsSelect!.value = 'standard';
  accentSelect!.value = 'rgb(54, 214, 176)';
  glassToggle!.checked = true;
  document.querySelectorAll<HTMLInputElement>('[data-demo-feature]').forEach((input) => { input.checked = true; });
  applyCustomization();
});

function setStatus(
  message: string,
  state: 'loading' | 'ready' | 'playing' | 'paused' | 'error' = 'ready',
): void {
  statusLine!.textContent = message;
  statusWrap!.setAttribute('data-state', state === 'error' ? 'error' : state);
  statusIndicator!.style.background =
    state === 'error' ? '#fb7185' : state === 'loading' ? '#60a5fa' : '#2ee6a6';
}

function showToast(message: string, state: 'success' | 'error' = 'success'): void {
  if (toastTimer) window.clearTimeout(toastTimer);
  toast!.textContent = message;
  toast!.style.borderColor = state === 'error' ? 'rgba(251,113,133,.32)' : 'rgba(46,230,166,.25)';
  toast!.style.color = state === 'error' ? '#fecdd3' : '#d6f8eb';
  toast!.hidden = false;
  toastTimer = window.setTimeout(() => { toast!.hidden = true; }, 2600);
}

function providerLabel(provider: string): string {
  const labels: Record<string, string> = {
    html5: 'HTML5 VIDEO',
    hls: 'HLS STREAM',
    dash: 'MPEG-DASH',
    youtube: 'YOUTUBE EMBED',
    vimeo: 'VIMEO EMBED',
    tiktok: 'TIKTOK EMBED',
    twitch: 'TWITCH EMBED',
    wistia: 'WISTIA EMBED',
    playerjs: 'PLAYER.JS EMBED',
  };
  return labels[provider] || provider.toUpperCase();
}

function displayName(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes('youtube') || parsed.hostname === 'youtu.be') {
      const id = parsed.searchParams.get('v');
      if (id) return 'YouTube video · ' + id;
      const segments = parsed.pathname.split('/').filter(Boolean);
      return 'YouTube video · ' + (segments.at(-1) || parsed.hostname);
    }
    const lastSegment = parsed.pathname.split('/').filter(Boolean).at(-1);
    if (!lastSegment || lastSegment.length > 48 || lastSegment.includes('.')) {
      return parsed.hostname.replace(/^www\./, '') + ' video';
    }
    return lastSegment.replace(/[-_]/g, ' ');
  } catch {
    return url;
  }
}

function setSourceInfo(title: string, src: string): void {
  const provider = detectProvider(src);
  titleLine!.textContent = title;
  badge!.textContent = provider.toUpperCase();
  providerPill!.textContent = providerLabel(provider);
  videoHeading!.textContent = title;
  // Never expose the built-in demo URL in the visible page. Show source category only.
  videoSubtitle!.textContent = provider === 'dash' ? 'Adaptive streaming · MPEG-DASH' :
    provider === 'hls' ? 'Adaptive streaming · HLS' : 'Source loaded · ' + providerLabel(provider);
}

async function loadVideo(rawUrl: string, explicitTitle?: string): Promise<void> {
  let url: string;
  try {
    url = normalizePastedVideoUrl(rawUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Please paste a valid video link.';
    feedback!.textContent = message;
    feedback!.style.color = '#fda4af';
    setStatus(message, 'error');
    return;
  }

  const provider = detectProvider(url);
  const title = explicitTitle || displayName(url);
  feedback!.style.color = '#8291a5';
  feedback!.textContent = 'Detected ' + providerLabel(provider).toLowerCase() + ' · Loading source…';
  setStatus('Loading ' + providerLabel(provider).toLowerCase() + '…', 'loading');

  try {
    await player.setSource({ src: url, title });
    setSourceInfo(title, url);
    feedback!.textContent = 'Loaded source type: ' + providerLabel(provider) + '. If playback fails, check the host’s embed permissions, URL and codec.';
    feedback!.style.color = '#8decc9';
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load this source.';
    feedback!.textContent = message;
    feedback!.style.color = '#fda4af';
    setStatus(message, 'error');
  }
}

player.on('sourcechange', (event) => {
  const detail = (event as CustomEvent<{ source: { src: string; title?: string }; provider: string }>).detail;
  const name = detail.source.title || displayName(detail.source.src);
  setSourceInfo(name, detail.source.src);
  setStatus('Source attached · waiting for media metadata', 'loading');
});
player.on('loadstart', () => setStatus('Loading video…', 'loading'));
player.on('loadedmetadata', () => {
  const duration = player.duration;
  const durationText = Number.isFinite(duration) && duration > 0 ? Math.floor(duration) + ' seconds' : 'live or unknown duration';
  setStatus('Media metadata loaded · ' + durationText, 'ready');
});
player.on('canplay', () => setStatus('Ready to play', 'ready'));
player.on('playing', () => setStatus('Playing', 'playing'));
player.on('pause', () => setStatus('Paused', 'paused'));
player.on('waiting', () => setStatus('Buffering…', 'loading'));
player.on('ended', () => setStatus('Playback complete', 'ready'));
player.on('error', (event) => {
  const detail = (event as CustomEvent<{ error?: { message?: string } | null }>).detail;
  const reason = detail?.error?.message;
  const message = reason || 'This link could not play. It may be a webpage instead of a media URL, or the host may block embedding.';
  setStatus(message, 'error');
  feedback!.textContent = message;
  feedback!.style.color = '#fda4af';
});
player.on('copied', () => showToast('Video link copied to clipboard.'));
player.on('featureerror', (event) => {
  const detail = (event as CustomEvent<{ feature?: string; error?: unknown }>).detail;
  showToast((detail?.feature || 'This feature') + ' is not available for the current provider.', 'error');
});

urlForm.addEventListener('submit', (event) => {
  event.preventDefault();
  sideUrlInput!.value = urlInput!.value.trim();
  void loadVideo(urlInput!.value);
});
sideLoadButton.addEventListener('click', () => {
  urlInput!.value = sideUrlInput!.value.trim();
  void loadVideo(sideUrlInput!.value);
});

// Pasting a URL is an explicit action: attach it to the player immediately, without
// requiring a second click on Load video. Typing remains non-destructive until submit.
function autoLoadPastedUrl(input: HTMLInputElement, peer: HTMLInputElement): void {
  input.addEventListener('paste', () => {
    window.setTimeout(() => {
      const pasted = input.value.trim();
      if (!pasted) return;
      peer.value = pasted;
      void loadVideo(pasted);
    }, 0);
  });
}
autoLoadPastedUrl(urlInput, sideUrlInput);
autoLoadPastedUrl(sideUrlInput, urlInput);
sideUrlInput.addEventListener('keydown', (event) => {
  if ((event as KeyboardEvent).key === 'Enter') {
    event.preventDefault();
    void loadVideo(sideUrlInput!.value);
  }
});
pasteButton.addEventListener('click', async () => {
  try {
    const clip = await navigator.clipboard.readText();
    if (!clip) {
      urlInput!.focus();
      showToast('Clipboard is empty.', 'error');
      return;
    }
    urlInput!.value = clip.trim();
    sideUrlInput!.value = clip.trim();
    urlInput!.focus();
    void loadVideo(clip.trim());
    showToast('Pasted link attached to the player.');
  } catch {
    urlInput!.focus();
    showToast('Clipboard permission was blocked. Paste the URL into the field.', 'error');
  }
});

likeButton.addEventListener('click', () => {
  isLiked = !isLiked;
  likeButton.setAttribute('aria-pressed', String(isLiked));
  likeCount!.textContent = isLiked ? 'Liked' : 'Like';
});

async function copyCurrentUrl(): Promise<void> {
  const url = player.currentSource?.src || '';
  if (!url) {
    showToast('No source link to copy.', 'error');
    return;
  }
  try {
    await navigator.clipboard.writeText(url);
    showToast('Video link copied to clipboard.');
  } catch {
    urlInput!.focus();
    urlInput!.select();
    showToast('Select the URL in the top field and copy it manually.', 'error');
  }
}
copyButton.addEventListener('click', () => { void copyCurrentUrl(); });
shareButton.addEventListener('click', async () => {
  const url = player.currentSource?.src || window.location.href;
  const title = videoHeading!.textContent || 'Universal Player';
  try {
    if (navigator.share) {
      await navigator.share({ title, url });
    } else {
      await navigator.clipboard.writeText(url);
      showToast('Share link copied to clipboard.');
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') return;
    showToast('Could not share. Try Copy link instead.', 'error');
  }
});

async function restoreDefaultSample(): Promise<void> {
  if (objectUrl) {
    URL.revokeObjectURL(objectUrl);
    objectUrl = undefined;
  }
  urlInput!.value = '';
  sideUrlInput!.value = '';
  await loadVideo(DEFAULT_DASH_URL, 'Featured demo');
}
restoreButton.addEventListener('click', () => { void restoreDefaultSample(); });

document.querySelectorAll<HTMLButtonElement>('[data-sample]').forEach((button) => {
  button.addEventListener('click', () => {
    const name = button.dataset.sample;
    if (name === 'big-buck') void loadVideo(BIG_BUCK_MP4, 'Big Buck Bunny · MP4 sample');
    else void loadVideo(SAMPLE_MP4, 'Flower · MP4 sample');
  });
});

sidebarToggle.addEventListener('click', () => {
  sidebar!.classList.toggle('hidden');
  sidebar!.classList.toggle('block');
});

window.addEventListener('beforeunload', () => {
  player.destroy();
  if (objectUrl) URL.revokeObjectURL(objectUrl);
});

player.ready.then(() => {
  applyCustomization();
  const current = player.currentSource;
  if (current?.src === DEFAULT_DASH_URL || !current) {
    setSourceInfo('Featured demo', DEFAULT_DASH_URL);
    setStatus('Demo source attached · waiting for media metadata', 'loading');
  } else {
    const currentTitle = current.title || displayName(current.src);
    setSourceInfo(currentTitle, current.src);
    setStatus('Custom source attached · waiting for media metadata', 'loading');
  }
}).catch((error: unknown) => {
  setStatus(error instanceof Error ? error.message : 'Player initialization failed.', 'error');
});
