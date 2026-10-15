import '@videojs/html/video/player';
import '@videojs/html/video/ui';
import './style.css';

import { detectProvider, formatTime, normalizeSource } from './source.js';
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
  controls?: boolean;
  preload?: 'none' | 'metadata' | 'auto';
  aspectRatio?: string;
  objectFit?: 'contain' | 'cover' | 'fill';
  playbackRates?: number[];
}

interface MediaElementLike extends HTMLElement {
  src: string;
  currentTime: number;
  duration: number;
  paused: boolean;
  ended?: boolean;
  volume: number;
  muted: boolean;
  playbackRate: number;
  preload: string;
  poster: string;
  buffered?: TimeRanges;
  textTracks?: TextTrackList;
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

const ICONS: Record<string, string> = {
  play: '<path d="M8 5.5v13l10-6.5-10-6.5Z" fill="currentColor" stroke="none"/>',
  pause: '<path d="M7 5h4v14H7zM15 5h4v14h-4z" fill="currentColor" stroke="none"/>',
  back: '<path d="M4 7v5h5M4.5 12a7.5 7.5 0 1 1 1.8 5.8M12 8v4l3 2" />',
  forward: '<path d="M20 7v5h-5M19.5 12a7.5 7.5 0 1 0-1.8 5.8M12 8v4l3 2" />',
  volume: '<path d="M4 10v4h4l5 4V6l-5 4H4Z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>',
  muted: '<path d="M4 10v4h4l5 4V6l-5 4H4Z"/><path d="m17 9 5 6m0-6-5 6"/>',
  settings: '<path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z"/><path d="m19.4 13.5 1.1.9-1.5 2.6-1.4-.5a7.7 7.7 0 0 1-1.5.9l-.2 1.5h-3l-.3-1.5a7.7 7.7 0 0 1-1.5-.9l-1.4.5-1.5-2.6 1.1-.9a7.8 7.8 0 0 1 0-1.8l-1.1-.9 1.5-2.6 1.4.5a7.7 7.7 0 0 1 1.5-.9l.3-1.5h3l.2 1.5a7.7 7.7 0 0 1 1.5.9l1.4-.5 1.5 2.6-1.1.9a7.8 7.8 0 0 1 0 1.8Z" transform="translate(-1 -1)"/>',
  fullscreen: '<path d="M8 4H4v4M16 4h4v4M20 16v4h-4M4 16v4h4"/>',
  exitFullscreen: '<path d="M4 8h4V4M16 4v4h4M20 16h-4v4M8 20v-4H4"/>',
  pip: '<rect x="3.5" y="5" width="17" height="14" rx="2"/><rect x="12.5" y="11" width="6" height="5" rx="1" fill="currentColor" stroke="none"/>',
  captions: '<path d="M4 6.5h16v11H4z"/><path d="M7 10h3m-3 3h2m4-3h3m-3 3h2"/>',
};

function makeIcon(name: string): string {
  return '<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || ICONS.settings) + '</svg>';
}

function makeButton(label: string, icon: string, className = 'up-icon-button'): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.setAttribute('aria-label', label);
  button.title = label;
  button.innerHTML = makeIcon(icon);
  return button;
}

/**
 * Framework-neutral player with a fully project-owned UI.
 * Video.js provides the player/media component architecture; no packaged Video.js skin is used.
 */
export class UniversalPlayer {
  readonly ready: Promise<void>;
  readonly container: HTMLDivElement;
  readonly element: HTMLElement;
  private readonly stage: HTMLElement;
  private readonly events = new EventTarget();
  private mediaElement: MediaElementLike;
  private provider: SourceProvider = 'html5';
  private source: PlayerSource | undefined;
  private mediaCleanup: Array<() => void> = [];
  private uiCleanup: Array<() => void> = [];
  private destroyed = false;
  private readonly rates: number[];
  private controlsRoot!: HTMLDivElement;
  private centerPlay!: HTMLButtonElement;
  private playButton!: HTMLButtonElement;
  private seekInput!: HTMLInputElement;
  private currentLabel!: HTMLSpanElement;
  private durationLabel!: HTMLSpanElement;
  private volumeInput!: HTMLInputElement;
  private muteButton!: HTMLButtonElement;
  private speedButton!: HTMLButtonElement;
  private speedMenu!: HTMLDivElement;
  private settingsButton!: HTMLButtonElement;
  private pipButton!: HTMLButtonElement;
  private fullscreenButton!: HTMLButtonElement;
  private trackButton!: HTMLButtonElement;
  private titleLabel!: HTMLSpanElement;
  private spinner!: HTMLDivElement;

  constructor(target: HTMLElement, private readonly options: UniversalPlayerOptions = {}) {
    if (!(target instanceof HTMLElement)) {
      throw new TypeError('createPlayer target must be an HTMLElement.');
    }

    this.rates = [...new Set((options.playbackRates || [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]).filter((rate) => Number.isFinite(rate) && rate > 0))];
    if (!this.rates.includes(1)) this.rates.push(1);
    this.rates.sort((a, b) => a - b);

    this.container = document.createElement('div');
    this.container.className = 'up-root';
    this.container.setAttribute('data-universal-player', '');

    this.element = document.createElement('video-player');
    this.element.className = 'up-video-player';
    this.element.setAttribute('aria-label', options.title || 'Universal Player');

    // The media-container is Video.js infrastructure, not its packaged skin.
    // Every visible control below is authored and styled by Universal Player.
    this.stage = document.createElement('media-container');
    this.stage.className = 'up-stage';
    this.stage.setAttribute('role', 'group');
    this.stage.setAttribute('aria-label', options.title || 'Universal Player video');
    this.stage.style.aspectRatio = options.aspectRatio || '16 / 9';
    this.stage.style.setProperty('--up-media-object-fit', options.objectFit || 'contain');
    this.stage.tabIndex = 0;

    this.mediaElement = this.createMediaElement('html5');
    this.stage.append(this.mediaElement);
    this.buildControls();

    this.element.append(this.stage);
    this.container.append(this.element);
    target.append(this.container);

    this.bindMediaEvents(this.mediaElement);
    this.bindKeyboard();
    this.syncUI();

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
      const previousMedia = this.mediaElement;
      this.unbindMediaEvents();
      this.teardownMedia(previousMedia);
      this.mediaElement = this.createMediaElement(provider);
      this.stage.replaceChild(this.mediaElement, previousMedia);
      this.provider = provider;
      this.bindMediaEvents(this.mediaElement);
    }

    this.source = source;
    const poster = source.poster || this.options.poster;
    if (poster) this.mediaElement.setAttribute('poster', poster);
    else this.mediaElement.removeAttribute('poster');
    this.mediaElement.setAttribute('src', source.src);

    if (provider === 'html5') this.mediaElement.load?.();

    this.titleLabel.textContent = source.title || this.options.title || source.src.split('/').pop() || 'Universal Player';
    this.stage.setAttribute('aria-label', (source.title || this.options.title || 'Universal Player') + ' video');
    this.emit('sourcechange', { source: { ...source }, provider });
    this.syncUI();
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
    this.mediaElement.currentTime = Number.isFinite(duration) && duration > 0 ? Math.min(seconds, duration) : seconds;
  }

  setVolume(volume: number): void {
    this.assertAlive();
    if (!Number.isFinite(volume) || volume < 0 || volume > 1) {
      throw new RangeError('setVolume() expects a number between 0 and 1.');
    }
    this.mediaElement.volume = volume;
    this.mediaElement.muted = volume === 0;
    this.syncUI();
  }

  setMuted(muted: boolean): void {
    this.assertAlive();
    this.mediaElement.muted = Boolean(muted);
    this.syncUI();
  }

  setPlaybackRate(rate: number): void {
    this.assertAlive();
    if (!Number.isFinite(rate) || rate <= 0) {
      throw new RangeError('setPlaybackRate() expects a positive number.');
    }
    this.mediaElement.playbackRate = rate;
    this.syncUI();
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
    if (this.stage.requestFullscreen) {
      await this.stage.requestFullscreen();
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
    for (const cleanup of this.uiCleanup.splice(0)) cleanup();
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
    media.removeAttribute('controls');

    if (this.options.autoplay) media.setAttribute('autoplay', '');
    if (this.options.muted) media.setAttribute('muted', '');
    if (this.options.loop) media.setAttribute('loop', '');
    if (this.options.poster) media.setAttribute('poster', this.options.poster);
    if (this.options.title) media.setAttribute('title', this.options.title);
    return media;
  }

  private buildControls(): void {
    const top = document.createElement('div');
    top.className = 'up-topbar';
    this.titleLabel = document.createElement('span');
    this.titleLabel.className = 'up-video-title';
    this.titleLabel.textContent = this.options.title || 'Universal Player';
    const liveLabel = document.createElement('span');
    liveLabel.className = 'up-brand-label';
    liveLabel.innerHTML = '<span></span> UNIVERSAL PLAYER';
    top.append(this.titleLabel, liveLabel);

    this.spinner = document.createElement('div');
    this.spinner.className = 'up-buffering';
    this.spinner.setAttribute('aria-label', 'Buffering');

    this.centerPlay = makeButton('Play video', 'play', 'up-center-play');
    this.listen(this.centerPlay, 'click', () => this.togglePlayback());

    this.controlsRoot = document.createElement('div');
    this.controlsRoot.className = 'up-controls';
    this.controlsRoot.setAttribute('data-universal-controls', '');

    const timeline = document.createElement('div');
    timeline.className = 'up-timeline-row';
    this.seekInput = document.createElement('input');
    this.seekInput.className = 'up-seek';
    this.seekInput.type = 'range';
    this.seekInput.min = '0';
    this.seekInput.max = '1000';
    this.seekInput.step = '1';
    this.seekInput.value = '0';
    this.seekInput.setAttribute('aria-label', 'Seek video');
    this.listen(this.seekInput, 'input', () => {
      const duration = this.duration;
      if (Number.isFinite(duration) && duration > 0) {
        this.mediaElement.currentTime = duration * (Number(this.seekInput.value) / 1000);
      }
      this.syncUI();
    });
    timeline.append(this.seekInput);

    const controlRow = document.createElement('div');
    controlRow.className = 'up-control-row';
    const left = document.createElement('div');
    left.className = 'up-control-group';
    const right = document.createElement('div');
    right.className = 'up-control-group up-control-group-right';

    this.playButton = makeButton('Play video', 'play');
    this.listen(this.playButton, 'click', () => this.togglePlayback());

    const backButton = makeButton('Back 10 seconds', 'back');
    this.listen(backButton, 'click', () => this.seek(Math.max(0, this.currentTime - 10)));
    const forwardButton = makeButton('Forward 10 seconds', 'forward');
    this.listen(forwardButton, 'click', () => {
      const end = this.duration;
      this.seek(Number.isFinite(end) && end > 0 ? Math.min(end, this.currentTime + 10) : this.currentTime + 10);
    });

    this.currentLabel = document.createElement('span');
    this.currentLabel.className = 'up-time-current';
    this.currentLabel.textContent = '0:00';
    const slash = document.createElement('span');
    slash.className = 'up-time-separator';
    slash.textContent = '/';
    this.durationLabel = document.createElement('span');
    this.durationLabel.className = 'up-time-duration';
    this.durationLabel.textContent = '0:00';
    const time = document.createElement('span');
    time.className = 'up-time';
    time.append(this.currentLabel, slash, this.durationLabel);

    this.muteButton = makeButton('Mute', 'volume');
    this.listen(this.muteButton, 'click', () => this.setMuted(!this.mediaElement.muted));
    this.volumeInput = document.createElement('input');
    this.volumeInput.className = 'up-volume';
    this.volumeInput.type = 'range';
    this.volumeInput.min = '0';
    this.volumeInput.max = '1';
    this.volumeInput.step = '0.05';
    this.volumeInput.value = String(this.mediaElement.volume);
    this.volumeInput.setAttribute('aria-label', 'Volume');
    this.listen(this.volumeInput, 'input', () => this.setVolume(Number(this.volumeInput.value)));

    const volumeGroup = document.createElement('div');
    volumeGroup.className = 'up-volume-group';
    volumeGroup.append(this.muteButton, this.volumeInput);

    const settingsWrap = document.createElement('div');
    settingsWrap.className = 'up-settings-wrap';
    this.settingsButton = makeButton('Playback settings', 'settings');
    this.settingsButton.setAttribute('aria-haspopup', 'menu');
    this.settingsButton.setAttribute('aria-expanded', 'false');
    this.speedMenu = document.createElement('div');
    this.speedMenu.className = 'up-speed-menu';
    this.speedMenu.setAttribute('role', 'menu');
    this.speedMenu.setAttribute('aria-label', 'Playback speed');
    this.speedMenu.hidden = true;
    const speedTitle = document.createElement('div');
    speedTitle.className = 'up-menu-title';
    speedTitle.textContent = 'Playback speed';
    this.speedMenu.append(speedTitle);
    for (const rate of this.rates) {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'up-speed-option';
      item.setAttribute('role', 'menuitemradio');
      item.setAttribute('aria-checked', rate === 1 ? 'true' : 'false');
      item.dataset.rate = String(rate);
      item.textContent = String(rate) + '×' + (rate === 1 ? ' · Normal' : '');
      this.listen(item, 'click', () => {
        this.setPlaybackRate(rate);
        this.speedMenu.hidden = true;
        this.settingsButton.setAttribute('aria-expanded', 'false');
      });
      this.speedMenu.append(item);
    }
    this.listen(this.settingsButton, 'click', () => {
      this.speedMenu.hidden = !this.speedMenu.hidden;
      this.settingsButton.setAttribute('aria-expanded', this.speedMenu.hidden ? 'false' : 'true');
    });
    settingsWrap.append(this.settingsButton, this.speedMenu);

    this.trackButton = makeButton('Toggle captions', 'captions');
    this.trackButton.classList.add('up-track-button');
    this.listen(this.trackButton, 'click', () => this.toggleCaptions());
    this.pipButton = makeButton('Picture in Picture', 'pip');
    this.listen(this.pipButton, 'click', () => {
      this.requestPictureInPicture().catch((error: unknown) => this.emit('featureerror', { feature: 'picture-in-picture', error }));
    });
    this.fullscreenButton = makeButton('Enter fullscreen', 'fullscreen');
    this.listen(this.fullscreenButton, 'click', () => {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch((error: unknown) => this.emit('featureerror', { feature: 'fullscreen', error }));
      } else {
        this.requestFullscreen().catch((error: unknown) => this.emit('featureerror', { feature: 'fullscreen', error }));
      }
    });

    left.append(this.playButton, backButton, forwardButton, time);
    right.append(volumeGroup, this.trackButton, settingsWrap, this.pipButton, this.fullscreenButton);
    controlRow.append(left, right);
    this.controlsRoot.append(timeline, controlRow);

    const clickSurface = document.createElement('button');
    clickSurface.type = 'button';
    clickSurface.className = 'up-media-click-surface';
    clickSurface.setAttribute('aria-label', 'Play or pause video');
    clickSurface.tabIndex = -1;
    this.listen(clickSurface, 'click', (event) => {
      event.preventDefault();
      this.togglePlayback();
    });

    this.stage.append(top, this.spinner, clickSurface, this.centerPlay, this.controlsRoot);
    this.listen(document, 'fullscreenchange', () => this.syncUI());

    this.listen(this.stage, 'pointermove', () => this.stage.classList.add('up-interacting'));
    this.listen(this.stage, 'pointerleave', () => this.stage.classList.remove('up-interacting'));
    this.listen(this.trackButton, 'keydown', (event) => {
      if ((event as KeyboardEvent).key === 'Escape') this.speedMenu.hidden = true;
    });

    this.updateOptionalControls();
  }

  private bindKeyboard(): void {
    this.listen(this.stage, 'keydown', (event) => {
      const keyboard = event as KeyboardEvent;
      const target = keyboard.target as HTMLElement | null;
      if (target && target !== this.stage && target !== this.mediaElement) return;
      if (keyboard.altKey || keyboard.ctrlKey || keyboard.metaKey) return;
      switch (keyboard.key.toLowerCase()) {
        case ' ':
        case 'k':
          keyboard.preventDefault();
          this.togglePlayback();
          break;
        case 'arrowleft':
          keyboard.preventDefault();
          this.seek(Math.max(0, this.currentTime - 5));
          break;
        case 'arrowright':
          keyboard.preventDefault();
          this.seek(this.currentTime + 5);
          break;
        case 'm':
          keyboard.preventDefault();
          this.setMuted(!this.mediaElement.muted);
          break;
        case 'f':
          keyboard.preventDefault();
          if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
          else this.requestFullscreen().catch(() => undefined);
          break;
      }
    });
  }

  private togglePlayback(): void {
    if (this.mediaElement.paused) {
      this.play().catch((error: unknown) => this.emit('featureerror', { feature: 'playback', error }));
    } else {
      this.pause();
    }
  }

  private toggleCaptions(): void {
    const tracks = this.mediaElement.textTracks;
    if (!tracks || tracks.length === 0) return;
    let showing = false;
    for (let index = 0; index < tracks.length; index += 1) {
      const track = tracks[index];
      if (track.kind === 'captions' || track.kind === 'subtitles') {
        showing = showing || track.mode === 'showing';
        track.mode = 'disabled';
      }
    }
    if (!showing) {
      for (let index = 0; index < tracks.length; index += 1) {
        const track = tracks[index];
        if (track.kind === 'captions' || track.kind === 'subtitles') {
          track.mode = 'showing';
          break;
        }
      }
    }
    this.syncUI();
  }

  private updateOptionalControls(): void {
    this.trackButton.disabled = !this.mediaElement.textTracks || this.mediaElement.textTracks.length === 0;
    this.pipButton.disabled = typeof this.mediaElement.requestPictureInPicture !== 'function';
  }

  private syncUI(): void {
    if (!this.controlsRoot || !this.mediaElement) return;
    const current = this.currentTime;
    const duration = this.duration;
    const validDuration = Number.isFinite(duration) && duration > 0;
    const played = validDuration ? Math.max(0, Math.min(100, current / duration * 100)) : 0;
    let buffered = played;
    try {
      const ranges = this.mediaElement.buffered;
      if (validDuration && ranges && ranges.length > 0) buffered = Math.max(played, Math.min(100, ranges.end(ranges.length - 1) / duration * 100));
    } catch {
      buffered = played;
    }

    this.seekInput.value = String(Math.round(played * 10));
    this.seekInput.style.setProperty('--up-played', played + '%');
    this.seekInput.style.setProperty('--up-buffered', buffered + '%');
    this.currentLabel.textContent = formatTime(current);
    this.durationLabel.textContent = validDuration ? formatTime(duration) : 'LIVE';
    this.playButton.innerHTML = makeIcon(this.mediaElement.paused ? 'play' : 'pause');
    this.playButton.setAttribute('aria-label', this.mediaElement.paused ? 'Play video' : 'Pause video');
    this.playButton.title = this.mediaElement.paused ? 'Play' : 'Pause';
    this.centerPlay.innerHTML = makeIcon(this.mediaElement.paused ? 'play' : 'pause');
    this.centerPlay.setAttribute('aria-label', this.mediaElement.paused ? 'Play video' : 'Pause video');
    this.centerPlay.hidden = !this.mediaElement.paused;
    this.muteButton.innerHTML = makeIcon(this.mediaElement.muted || this.mediaElement.volume === 0 ? 'muted' : 'volume');
    this.muteButton.setAttribute('aria-label', this.mediaElement.muted ? 'Unmute' : 'Mute');
    this.volumeInput.value = this.mediaElement.muted ? '0' : String(this.mediaElement.volume);
    this.volumeInput.style.setProperty('--up-volume', (this.mediaElement.muted ? 0 : this.mediaElement.volume * 100) + '%');
    this.speedMenu.querySelectorAll<HTMLButtonElement>('[data-rate]').forEach((button) => {
      const selected = Number(button.dataset.rate) === this.mediaElement.playbackRate;
      button.setAttribute('aria-checked', selected ? 'true' : 'false');
      button.classList.toggle('is-selected', selected);
    });
    const fullscreen = document.fullscreenElement === this.stage;
    this.fullscreenButton.innerHTML = makeIcon(fullscreen ? 'exitFullscreen' : 'fullscreen');
    this.fullscreenButton.setAttribute('aria-label', fullscreen ? 'Exit fullscreen' : 'Enter fullscreen');
    this.fullscreenButton.title = fullscreen ? 'Exit fullscreen' : 'Fullscreen';
    this.trackButton.classList.toggle('is-active', this.hasShowingCaptions());
    this.spinner.hidden = !this.stage.classList.contains('is-buffering');
    this.updateOptionalControls();
  }

  private hasShowingCaptions(): boolean {
    const tracks = this.mediaElement.textTracks;
    if (!tracks) return false;
    for (let index = 0; index < tracks.length; index += 1) {
      if ((tracks[index].kind === 'captions' || tracks[index].kind === 'subtitles') && tracks[index].mode === 'showing') return true;
    }
    return false;
  }

  private bindMediaEvents(media: MediaElementLike): void {
    for (const type of MEDIA_EVENTS) {
      const listener: EventListener = (originalEvent) => {
        if (media === this.mediaElement) {
          if (type === 'waiting' || type === 'stalled') this.stage.classList.add('is-buffering');
          if (type === 'playing' || type === 'canplay' || type === 'canplaythrough' || type === 'error' || type === 'ended') this.stage.classList.remove('is-buffering');
          this.syncUI();
        }
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

  private listen(target: EventTarget, type: string, listener: EventListener): void {
    target.addEventListener(type, listener);
    this.uiCleanup.push(() => target.removeEventListener(type, listener));
  }

  private unbindMediaEvents(): void {
    for (const cleanup of this.mediaCleanup.splice(0)) cleanup();
  }

  private teardownMedia(media: MediaElementLike): void {
    try {
      media.pause();
    } catch {
      // Third-party media adapters may not have finished initialising.
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

export function createPlayer(target: HTMLElement | string, options: UniversalPlayerOptions = {}): UniversalPlayer {
  const element = typeof target === 'string' ? document.querySelector(target) : target;
  if (!(element instanceof HTMLElement)) {
    throw new TypeError('createPlayer could not find a valid HTMLElement target.');
  }
  return new UniversalPlayer(element, options);
}
