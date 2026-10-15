import '@videojs/html/video/player';
import '@videojs/html/video/skin';
import './style.css';

import { detectProvider, normalizeSource } from './source.js';
import type { PlayerSource, SourceProvider } from './source.js';

export type { PlayerSource, SourceProvider } from './source.js';
export { detectProvider, formatTime, normalizeSource } from './source.js';

export interface UniversalPlayerOptions {
  source?: string | PlayerSource;
  poster?: string;
  title?: string;
  autoplay?: boolean;
  muted?: boolean;
  loop?: boolean;
  preload?: 'none' | 'metadata' | 'auto';
  aspectRatio?: string;
  objectFit?: 'contain' | 'cover' | 'fill';
}

interface MediaElementLike extends HTMLElement {
  src: string;
  currentTime: number;
  duration: number;
  paused: boolean;
  volume: number;
  muted: boolean;
  playbackRate: number;
  preload: string;
  poster: string;
  play(): Promise<void>;
  pause(): void;
  load?: () => void;
  error?: MediaError | null;
  requestPictureInPicture?: () => Promise<PictureInPictureWindow>;
}

type PlayerListener = EventListener;

const MEDIA_EVENTS = [
  'abort', 'canplay', 'canplaythrough', 'durationchange', 'emptied', 'ended',
  'error', 'loadeddata', 'loadedmetadata', 'loadstart', 'pause', 'play',
  'playing', 'progress', 'ratechange', 'seeked', 'seeking', 'stalled',
  'suspend', 'timeupdate', 'volumechange', 'waiting',
] as const;

const ADAPTERS: Record<Exclude<SourceProvider, 'html5'>, () => Promise<unknown>> = {
  hls: () => import('@videojs/html/media/hlsjs-video'),
  dash: () => import('@videojs/html/media/dash-video'),
  youtube: () => import('@videojs/html/media/youtube-video'),
};

/**
 * Framework-neutral wrapper around Video.js custom elements.
 * Create it from a browser lifecycle hook (React useEffect, Vue onMounted, etc.).
 */
export class UniversalPlayer {
  readonly ready: Promise<void>;
  readonly container: HTMLDivElement;
  readonly element: HTMLElement;
  private readonly skin: HTMLElement;
  private readonly events = new EventTarget();
  private mediaElement: MediaElementLike;
  private provider: SourceProvider = 'html5';
  private source: PlayerSource | undefined;
  private mediaCleanup: Array<() => void> = [];
  private destroyed = false;

  constructor(target: HTMLElement, private readonly options: UniversalPlayerOptions = {}) {
    if (!(target instanceof HTMLElement)) {
      throw new TypeError('createPlayer target must be an HTMLElement.');
    }

    this.container = document.createElement('div');
    this.container.className = 'up-root';
    this.container.setAttribute('data-universal-player', '');

    this.element = document.createElement('video-player');
    this.element.className = 'up-video-player';
    this.element.setAttribute('aria-label', options.title || 'Universal Player');

    this.skin = document.createElement('video-skin');
    this.skin.className = 'up-video-skin';
    this.skin.style.display = 'block';
    this.skin.style.width = '100%';
    this.skin.style.aspectRatio = options.aspectRatio || '16 / 9';
    this.skin.style.setProperty('--media-object-fit', options.objectFit || 'contain');
    this.skin.style.setProperty('--media-video-border-radius', '0px');

    this.element.append(this.skin);
    this.container.append(this.element);
    target.append(this.container);

    this.mediaElement = this.createMediaElement('html5');
    this.skin.append(this.mediaElement);
    this.bindMediaEvents(this.mediaElement);

    this.ready = options.source ? this.setSource(options.source) : Promise.resolve();
  }

  get media(): HTMLElement {
    return this.mediaElement;
  }

  get currentSource(): PlayerSource | undefined {
    return this.source ? { ...this.source } : undefined;
  }

  get currentProvider(): SourceProvider {
    return this.provider;
  }

  get currentTime(): number {
    return this.mediaElement.currentTime || 0;
  }

  get duration(): number {
    return this.mediaElement.duration || 0;
  }

  get paused(): boolean {
    return this.mediaElement.paused;
  }

  async setSource(input: string | PlayerSource): Promise<void> {
    this.assertAlive();
    const source = normalizeSource(input);
    const provider = detectProvider(source);

    if (provider !== 'html5') {
      await ADAPTERS[provider]();
      this.assertAlive();
    }

    if (provider !== this.provider) {
      this.unbindMediaEvents();
      this.teardownMedia(this.mediaElement);
      this.mediaElement = this.createMediaElement(provider);
      this.skin.replaceChildren(this.mediaElement);
      this.provider = provider;
      this.bindMediaEvents(this.mediaElement);
    }

    this.source = source;
    const poster = source.poster || this.options.poster;
    if (poster) this.mediaElement.setAttribute('poster', poster);
    else this.mediaElement.removeAttribute('poster');
    this.mediaElement.setAttribute('src', source.src);

    if (provider === 'html5') this.mediaElement.load?.();

    this.emit('sourcechange', { source: { ...source }, provider });
  }

  play(): Promise<void> {
    this.assertAlive();
    return this.mediaElement.play();
  }

  pause(): void {
    this.assertAlive();
    this.mediaElement.pause();
  }

  seek(seconds: number): void {
    this.assertAlive();
    if (!Number.isFinite(seconds) || seconds < 0) {
      throw new RangeError('seek() requires a finite, non-negative time in seconds.');
    }
    const duration = this.duration;
    this.mediaElement.currentTime = Number.isFinite(duration) && duration > 0
      ? Math.min(seconds, duration)
      : seconds;
  }

  setVolume(volume: number): void {
    this.assertAlive();
    if (!Number.isFinite(volume) || volume < 0 || volume > 1) {
      throw new RangeError('setVolume() expects a number between 0 and 1.');
    }
    this.mediaElement.volume = volume;
  }

  setMuted(muted: boolean): void {
    this.assertAlive();
    this.mediaElement.muted = Boolean(muted);
  }

  setPlaybackRate(rate: number): void {
    this.assertAlive();
    if (!Number.isFinite(rate) || rate <= 0) {
      throw new RangeError('setPlaybackRate() expects a positive number.');
    }
    this.mediaElement.playbackRate = rate;
  }

  on(type: string, listener: PlayerListener): () => void {
    this.assertAlive();
    this.events.addEventListener(type, listener);
    return () => this.events.removeEventListener(type, listener);
  }

  off(type: string, listener: PlayerListener): void {
    this.events.removeEventListener(type, listener);
  }

  async requestFullscreen(): Promise<void> {
    this.assertAlive();
    if (this.container.requestFullscreen) {
      await this.container.requestFullscreen();
      return;
    }
    throw new Error('Fullscreen is not supported by this browser.');
  }

  async requestPictureInPicture(): Promise<PictureInPictureWindow> {
    this.assertAlive();
    const request = this.mediaElement.requestPictureInPicture;
    if (typeof request !== 'function') {
      throw new Error('Picture-in-Picture is not available for this media provider.');
    }
    return request.call(this.mediaElement);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.unbindMediaEvents();
    this.teardownMedia(this.mediaElement);
    this.destroyed = true;
    this.container.remove();
    this.emit('destroy', undefined);
  }

  private createMediaElement(provider: SourceProvider): MediaElementLike {
    const tags: Record<SourceProvider, string> = {
      html5: 'video',
      hls: 'hlsjs-video',
      dash: 'dash-video',
      youtube: 'youtube-video',
    };

    const media = document.createElement(tags[provider]) as MediaElementLike;
    media.classList.add('up-media');
    media.setAttribute('playsinline', '');
    media.setAttribute('preload', this.options.preload || 'metadata');

    if (this.options.autoplay) media.setAttribute('autoplay', '');
    if (this.options.muted) media.setAttribute('muted', '');
    if (this.options.loop) media.setAttribute('loop', '');
    if (this.options.poster) media.setAttribute('poster', this.options.poster);
    if (this.options.title) media.setAttribute('title', this.options.title);
    return media;
  }

  private bindMediaEvents(media: MediaElementLike): void {
    for (const type of MEDIA_EVENTS) {
      const listener: EventListener = (originalEvent) => {
        this.emit(type, {
          originalEvent,
          media,
          source: this.currentSource,
          error: media.error || null,
        });
      };
      media.addEventListener(type, listener);
      this.mediaCleanup.push(() => media.removeEventListener(type, listener));
    }
  }

  private unbindMediaEvents(): void {
    for (const cleanup of this.mediaCleanup.splice(0)) cleanup();
  }

  private teardownMedia(media: MediaElementLike): void {
    try {
      media.pause();
    } catch {
      // Adapters may not have finished initialising.
    }
    media.removeAttribute('src');
    if (typeof media.load === 'function' && media.tagName.toLowerCase() === 'video') {
      try {
        media.load();
      } catch {
        // Best-effort cleanup during unmount.
      }
    }
  }

  private emit(type: string, detail: unknown): void {
    this.events.dispatchEvent(new CustomEvent(type, { detail }));
  }

  private assertAlive(): void {
    if (this.destroyed) throw new Error('This Universal Player instance has been destroyed.');
  }
}

export function createPlayer(
  target: HTMLElement | string,
  options: UniversalPlayerOptions = {},
): UniversalPlayer {
  const element = typeof target === 'string' ? document.querySelector(target) : target;
  if (!(element instanceof HTMLElement)) {
    throw new TypeError('createPlayer could not find a valid HTMLElement target.');
  }
  return new UniversalPlayer(element, options);
}
