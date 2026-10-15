import './demo.css';
import { createPlayer } from './index.js';
import { detectProvider } from './source.js';

const SAMPLE_MP4 = 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4';

const statusLine = document.querySelector<HTMLElement>('#player-status');
const statusWrap = document.querySelector<HTMLElement>('.player-status');
const statusIndicator = document.querySelector<HTMLElement>('#status-indicator');
const titleLine = document.querySelector<HTMLElement>('#source-title');
const badge = document.querySelector<HTMLElement>('#media-badge');
const fileInput = document.querySelector<HTMLInputElement>('#local-video');
const sampleButton = document.querySelector<HTMLButtonElement>('#sample-button');

if (!statusLine || !statusWrap || !statusIndicator || !titleLine || !badge || !fileInput || !sampleButton) {
  throw new Error('Universal Player demo markup is incomplete.');
}

let objectUrl: string | undefined;
const player = createPlayer('#player-mount', {
  title: 'Universal Player demo',
  source: { src: SAMPLE_MP4, type: 'video/mp4', title: 'Flower · MP4 sample' },
  preload: 'metadata',
  aspectRatio: '16 / 9',
  objectFit: 'contain',
});

function setStatus(message: string, state: 'loading' | 'ready' | 'playing' | 'paused' | 'error' = 'ready'): void {
  statusLine!.textContent = message;
  statusWrap!.setAttribute('data-state', state === 'error' ? 'error' : state);
  statusIndicator!.style.background = state === 'error' ? '#ff7c83' : state === 'loading' ? '#a69bff' : '#6ed7b0';
}

function setSourceInfo(title: string, src: string): void {
  titleLine!.textContent = title;
  badge!.textContent = detectProvider(src).toUpperCase();
}

player.on('sourcechange', (event) => {
  const detail = (event as CustomEvent<{ source: { src: string; title?: string }; provider: string }>).detail;
  setSourceInfo(detail.source.title || detail.source.src.split('/').pop() || 'Video', detail.source.src);
  setStatus('Source selected · waiting for media metadata', 'loading');
});
player.on('loadstart', () => setStatus('Loading video…', 'loading'));
player.on('loadedmetadata', () => {
  const duration = player.duration;
  setStatus('Media metadata loaded · ' + (Number.isFinite(duration) && duration > 0 ? Math.floor(duration) + ' seconds' : 'live or unknown duration'), 'ready');
});
player.on('canplay', () => setStatus('Ready to play', 'ready'));
player.on('playing', () => setStatus('Playing', 'playing'));
player.on('pause', () => setStatus('Paused', 'paused'));
player.on('waiting', () => setStatus('Buffering…', 'loading'));
player.on('ended', () => setStatus('Playback complete', 'ready'));
player.on('error', (event) => {
  const detail = (event as CustomEvent<{ error?: { message?: string } | null }>).detail;
  const reason = detail?.error?.message;
  setStatus(reason ? 'Playback error · ' + reason : 'Could not play this source. Check the URL, codec and CORS settings.', 'error');
});

fileInput.addEventListener('change', async () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = URL.createObjectURL(file);
  try {
    setStatus('Loading local video…', 'loading');
    await player.setSource({ src: objectUrl, type: file.type || 'video/mp4', provider: 'html5', title: file.name });
  } catch (error) {
    setStatus(error instanceof Error ? error.message : 'Unable to load this video.', 'error');
  }
});

sampleButton.addEventListener('click', async () => {
  if (objectUrl) {
    URL.revokeObjectURL(objectUrl);
    objectUrl = undefined;
  }
  fileInput.value = '';
  try {
    await player.setSource({ src: SAMPLE_MP4, type: 'video/mp4', title: 'Flower · MP4 sample' });
  } catch (error) {
    setStatus(error instanceof Error ? error.message : 'Unable to load the sample MP4.', 'error');
  }
});

window.addEventListener('beforeunload', () => {
  player.destroy();
  if (objectUrl) URL.revokeObjectURL(objectUrl);
});

player.ready.then(() => setStatus('MP4 source attached · waiting for media metadata', 'loading')).catch((error: unknown) => {
  setStatus(error instanceof Error ? error.message : 'Player initialization failed.', 'error');
});
