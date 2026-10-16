import '@videojs/html/video/player';
import '@videojs/html/ui/container';
import './style.css';

import { createElement, Play, Pause, Rewind, FastForward, Volume2, VolumeX, Settings2, Maximize, Minimize, PictureInPicture2, MonitorPlay, Captions, Copy, Info, Repeat, Gauge, Keyboard, Link as LinkIcon, CircleHelp, X } from 'lucide';
import { selectQuality } from '@videojs/html';
import { detectProvider, formatTime, normalizeSource } from './source.js';
import type { PlayerSource, SourceProvider } from './source.js';

export type { PlayerSource, SourceProvider } from './source.js';
export { detectProvider, formatTime, normalizePastedVideoUrl, normalizeSource } from './source.js';

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
  autohide?: boolean;
}

interface MediaElementLike extends HTMLElement {
  src: string;
  currentTime: number;
  duration: number;
  paused: boolean;
  ended?: boolean;
  loop: boolean;
  currentSrc?: string;
  readyState?: number;
  networkState?: number;
  videoWidth?: number;
  videoHeight?: number;
  volume: number;
  muted: boolean;
  playbackRate: number;
  preload: string;
  poster: string;
  buffered?: TimeRanges;
  seekable: TimeRanges;
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
  vimeo: () => import('@videojs/html/media/vimeo-video'),
  tiktok: () => import('@videojs/html/media/tiktok-video'),
  twitch: () => import('@videojs/html/media/twitch-video'),
  wistia: () => import('@videojs/html/media/wistia-video'),
  playerjs: () => import('@videojs/html/media/playerjs-video'),
};

const ICONS = {
  play: Play,
  pause: Pause,
  back: Rewind,
  forward: FastForward,
  volume: Volume2,
  muted: VolumeX,
  settings: Settings2,
  fullscreen: Maximize,
  exitFullscreen: Minimize,
  pip: PictureInPicture2,
  mini: PictureInPicture2,
  theater: MonitorPlay,
  captions: Captions,
  copy: Copy,
  info: Info,
  loop: Repeat,
  speed: Gauge,
  keyboard: Keyboard,
  link: LinkIcon,
  help: CircleHelp,
  close: X,
};

function makeIcon(name: string): SVGSVGElement {
  const icon = ICONS[name as keyof typeof ICONS] || Settings2;
  return createElement(icon, {
    class: 'up-lucide',
    'aria-hidden': 'true',
    strokeWidth: 1.8,
  }) as SVGSVGElement;
}

function makeButton(label: string, icon: string, className = 'up-icon-button'): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.setAttribute('aria-label', label);
  button.title = label;
  button.replaceChildren(makeIcon(icon));
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
  private qualityMenuGroup!: HTMLDivElement;
  private qualityMenuTitle!: HTMLDivElement;
  private qualitySignature = '';
  private selectedQualityId = 'auto';
  private qualityStoreCleanup: (() => void) | undefined;
  private settingsButton!: HTMLButtonElement;
  private pipButton!: HTMLButtonElement;
  private miniPlayerButton!: HTMLButtonElement;
  private theaterButton!: HTMLButtonElement;
  private fullscreenButton!: HTMLButtonElement;
  private trackButton!: HTMLButtonElement;
  private titleLabel!: HTMLSpanElement;
  private spinner!: HTMLDivElement;
  private contextMenu!: HTMLDivElement;
  private statsPanel!: HTMLDivElement;
  private helpPanel!: HTMLDivElement;
  private loopMenuItem!: HTMLButtonElement;
  private seekTooltip!: HTMLDivElement;
  private seekTooltipLabel!: HTMLSpanElement;
  private idleTimer: ReturnType<typeof setTimeout> | undefined;

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
    this.stage.dataset.provider = 'html5';
    this.stage.tabIndex = 0;

    this.mediaElement = this.createMediaElement('html5');
    this.stage.append(this.mediaElement);
    this.buildControls();

    this.element.append(this.stage);
    this.container.append(this.element);
    target.append(this.container);

    this.bindMediaEvents(this.mediaElement);
    this.bindKeyboard();
    this.connectQualityStore();
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
    this.selectedQualityId = 'auto';
    this.qualitySignature = '';
    const poster = source.poster || this.options.poster;
    if (poster) this.mediaElement.setAttribute('poster', poster);
    else this.mediaElement.removeAttribute('poster');
    this.mediaElement.setAttribute('src', source.src);

    if (provider === 'html5') this.mediaElement.load?.();
    this.refreshQualityMenu();

    this.titleLabel.textContent = source.title || this.options.title || source.src.split('/').pop() || 'Universal Player';
    this.stage.setAttribute('aria-label', (source.title || this.options.title || 'Universal Player') + ' video');
    this.stage.dataset.provider = provider;
    this.stage.classList.toggle('up-portrait', provider === 'tiktok');
    this.stage.style.aspectRatio = provider === 'tiktok' ? '9 / 16' : (this.options.aspectRatio || '16 / 9');
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

  toggleMiniPlayer(): boolean {
    this.assertAlive();
    const next = !this.container.classList.contains('up-mini-player');
    this.container.classList.toggle('up-mini-player', next);
    if (next) this.container.classList.remove('up-theater');
    this.syncLayoutButtons();
    this.emit('miniplayerchange', { active: next });
    return next;
  }

  toggleTheaterMode(): boolean {
    this.assertAlive();
    const next = !this.container.classList.contains('up-theater');
    this.container.classList.toggle('up-theater', next);
    if (next) this.container.classList.remove('up-mini-player');
    this.syncLayoutButtons();
    this.emit('theaterchange', { active: next });
    return next;
  }

  private syncLayoutButtons(): void {
    if (!this.miniPlayerButton || !this.theaterButton) return;
    const mini = this.container.classList.contains('up-mini-player');
    const theater = this.container.classList.contains('up-theater');
    this.miniPlayerButton.replaceChildren(makeIcon('mini'));
    this.miniPlayerButton.setAttribute('aria-label', mini ? 'Exit mini player' : 'Enter mini player');
    this.miniPlayerButton.title = mini ? 'Exit mini player (I)' : 'Mini player (I)';
    this.miniPlayerButton.classList.toggle('is-active', mini);
    this.theaterButton.replaceChildren(makeIcon('theater'));
    this.theaterButton.setAttribute('aria-label', theater ? 'Exit theater mode' : 'Enter theater mode');
    this.theaterButton.title = theater ? 'Exit theater mode (T)' : 'Theater mode (T)';
    this.theaterButton.classList.toggle('is-active', theater);
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
    this.qualityStoreCleanup?.();
    this.qualityStoreCleanup = undefined;
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.container.classList.remove('up-mini-player', 'up-theater');
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
      vimeo: 'vimeo-video',
      tiktok: 'tiktok-video',
      twitch: 'twitch-video',
      wistia: 'wistia-video',
      playerjs: 'playerjs-video',
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
    this.qualityMenuGroup = document.createElement('div');
    this.qualityMenuGroup.className = 'up-quality-menu-group';
    this.qualityMenuGroup.hidden = true;
    this.qualityMenuTitle = document.createElement('div');
    this.qualityMenuTitle.className = 'up-menu-title';
    this.qualityMenuTitle.textContent = 'Video quality';
    this.qualityMenuGroup.append(this.qualityMenuTitle);
    this.speedMenu.append(this.qualityMenuGroup);

    settingsWrap.append(this.settingsButton, this.speedMenu);

    this.trackButton = makeButton('Toggle captions', 'captions');
    this.trackButton.classList.add('up-track-button');
    this.listen(this.trackButton, 'click', () => this.toggleCaptions());
    this.pipButton = makeButton('Picture in Picture', 'pip');
    this.listen(this.pipButton, 'click', () => {
      this.requestPictureInPicture().catch((error: unknown) => this.emit('featureerror', { feature: 'picture-in-picture', error }));
    });
    this.miniPlayerButton = makeButton('Enter mini player', 'mini');
    this.miniPlayerButton.classList.add('up-mini-player-button');
    this.listen(this.miniPlayerButton, 'click', () => this.toggleMiniPlayer());
    this.theaterButton = makeButton('Enter theater mode', 'theater');
    this.theaterButton.classList.add('up-theater-button');
    this.listen(this.theaterButton, 'click', () => this.toggleTheaterMode());

    this.fullscreenButton = makeButton('Enter fullscreen', 'fullscreen');
    this.listen(this.fullscreenButton, 'click', () => {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch((error: unknown) => this.emit('featureerror', { feature: 'fullscreen', error }));
      } else {
        this.requestFullscreen().catch((error: unknown) => this.emit('featureerror', { feature: 'fullscreen', error }));
      }
    });

    left.append(this.playButton, backButton, forwardButton, time);
    right.append(volumeGroup, this.trackButton, settingsWrap, this.pipButton, this.miniPlayerButton, this.theaterButton, this.fullscreenButton);
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

    this.seekTooltip = document.createElement('div');
    this.seekTooltip.className = 'up-seek-tooltip';
    this.seekTooltip.hidden = true;
    this.seekTooltipLabel = document.createElement('span');
    this.seekTooltip.append(this.seekTooltipLabel);

    this.contextMenu = document.createElement('div');
    this.contextMenu.className = 'up-context-menu';
    this.contextMenu.setAttribute('role', 'menu');
    this.contextMenu.setAttribute('aria-label', 'Universal Player menu');
    this.contextMenu.hidden = true;
    this.contextMenu.append(
      this.createContextItem('Play / pause', 'play', () => this.togglePlayback()),
      this.createContextItem('Back 10 seconds', 'back', () => this.seek(Math.max(0, this.currentTime - 10))),
      this.createContextItem('Forward 10 seconds', 'forward', () => this.seek(this.currentTime + 10)),
    );
    const menuDivider = document.createElement('div');
    menuDivider.className = 'up-context-divider';
    this.contextMenu.append(menuDivider);
    this.loopMenuItem = this.createContextItem('Loop: Off', 'loop', () => {
      this.mediaElement.loop = !this.mediaElement.loop;
      this.loopMenuItem.querySelector('.up-context-label')!.textContent = 'Loop: ' + (this.mediaElement.loop ? 'On' : 'Off');
      this.emit('loopchange', { loop: this.mediaElement.loop });
    });
    this.contextMenu.append(
      this.loopMenuItem,
      this.createContextItem('Copy video link', 'copy', () => { void this.copySourceLink(); }),
      this.createContextItem('Mini player', 'mini', () => this.toggleMiniPlayer()),
      this.createContextItem('Theater mode', 'theater', () => this.toggleTheaterMode()),
      this.createContextItem('Playback stats', 'info', () => {
        this.refreshStats();
        this.statsPanel.hidden = !this.statsPanel.hidden;
        this.contextMenu.hidden = true;
      }),
      this.createContextItem('Keyboard shortcuts', 'keyboard', () => {
        this.helpPanel.hidden = !this.helpPanel.hidden;
        this.contextMenu.hidden = true;
      }),
    );

    this.statsPanel = document.createElement('div');
    this.statsPanel.className = 'up-stats-panel';
    this.statsPanel.hidden = true;
    this.statsPanel.setAttribute('role', 'status');
    this.statsPanel.setAttribute('aria-label', 'Playback statistics');

    this.helpPanel = document.createElement('div');
    this.helpPanel.className = 'up-stats-panel up-help-panel';
    this.helpPanel.hidden = true;
    this.helpPanel.innerHTML = '<div class="up-stats-heading">Keyboard shortcuts</div><div class="up-stats-line"><span>Play / pause</span><kbd>Space</kbd> <kbd>K</kbd></div><div class="up-stats-line"><span>Seek backward / forward</span><kbd>←</kbd> <kbd>→</kbd></div><div class="up-stats-line"><span>Skip 10 seconds</span><kbd>J</kbd> <kbd>L</kbd></div><div class="up-stats-line"><span>Mute / unmute</span><kbd>M</kbd></div><div class="up-stats-line"><span>Fullscreen</span><kbd>F</kbd></div><div class="up-stats-line"><span>Theater mode</span><kbd>T</kbd></div><div class="up-stats-line"><span>Mini player</span><kbd>I</kbd></div><div class="up-stats-line"><span>Close menu / mode</span><kbd>Esc</kbd></div>';

    this.stage.append(top, this.spinner, clickSurface, this.centerPlay, this.controlsRoot, this.seekTooltip, this.contextMenu, this.statsPanel, this.helpPanel);
    this.listen(document, 'fullscreenchange', () => this.syncUI());

    this.listen(this.stage, 'pointermove', (event) => {
      this.stage.classList.add('up-interacting');
      this.queueHideControls();
      const pointer = event as PointerEvent;
      if (pointer.pointerType === 'mouse' && pointer.target === this.seekInput) this.updateSeekTooltip(pointer.clientX);
    });
    this.listen(this.stage, 'pointerenter', () => {
      this.stage.classList.add('up-interacting');
      if (this.idleTimer) clearTimeout(this.idleTimer);
    });
    this.listen(this.stage, 'pointerleave', () => {
      this.seekTooltip.hidden = true;
      this.queueHideControls(true);
    });
    this.listen(this.stage, 'contextmenu', (event) => {
      event.preventDefault();
      const pointer = event as MouseEvent;
      const rect = this.stage.getBoundingClientRect();
      const menuWidth = 224;
      const menuHeight = 360;
      const left = Math.max(8, Math.min(pointer.clientX - rect.left, rect.width - menuWidth - 8));
      const top = Math.max(8, Math.min(pointer.clientY - rect.top, rect.height - menuHeight - 8));
      this.contextMenu.style.left = left + 'px';
      this.contextMenu.style.top = top + 'px';
      this.contextMenu.hidden = false;
      this.statsPanel.hidden = true;
      this.helpPanel.hidden = true;
    });
    this.listen(document, 'pointerdown', (event) => {
      const target = event.target as Node | null;
      if (!target || (!this.contextMenu.contains(target) && !this.statsPanel.contains(target) && !this.helpPanel.contains(target))) {
        this.contextMenu.hidden = true;
        if (target && !this.statsPanel.contains(target)) this.statsPanel.hidden = true;
        if (target && !this.helpPanel.contains(target)) this.helpPanel.hidden = true;
      }
    });
    this.listen(document, 'keydown', (event) => {
      if ((event as KeyboardEvent).key === 'Escape') {
        this.contextMenu.hidden = true;
        this.statsPanel.hidden = true;
        this.helpPanel.hidden = true;
        this.speedMenu.hidden = true;
        this.container.classList.remove('up-mini-player', 'up-theater');
        this.syncLayoutButtons();
      }
    });
    this.listen(this.seekInput, 'pointermove', (event) => this.updateSeekTooltip((event as PointerEvent).clientX));
    this.listen(this.seekInput, 'pointerleave', () => { this.seekTooltip.hidden = true; });
    this.listen(this.trackButton, 'keydown', (event) => {
      if ((event as KeyboardEvent).key === 'Escape') this.speedMenu.hidden = true;
    });

    this.updateOptionalControls();
  }

  private connectQualityStore(): void {
    const host = this.element as HTMLElement & {
      store?: {
        state: unknown;
        subscribe?: (listener: () => void) => (() => void) | void;
      };
    };
    const store = host.store;
    if (store && typeof store.subscribe === 'function') {
      const unsubscribe = store.subscribe(() => this.refreshQualityMenu());
      if (typeof unsubscribe === 'function') this.qualityStoreCleanup = unsubscribe;
    }
    this.refreshQualityMenu();
  }

  private refreshQualityMenu(): void {
    if (!this.qualityMenuGroup || !this.qualityMenuTitle) return;
    if (this.provider !== 'hls' && this.provider !== 'dash') {
      this.qualityMenuGroup.hidden = true;
      return;
    }

    const host = this.element as HTMLElement & { store?: { state: unknown } };
    const store = host.store;
    if (!store) {
      this.qualityMenuGroup.hidden = true;
      return;
    }

    let quality: ReturnType<typeof selectQuality>;
    try {
      quality = selectQuality(store.state as Parameters<typeof selectQuality>[0]);
    } catch {
      quality = undefined;
    }

    const renditions = quality?.videoRenditionList || [];
    if (renditions.length < 2) {
      this.qualityMenuGroup.hidden = true;
      return;
    }

    this.qualityMenuGroup.hidden = false;
    const signature = renditions
      .map((item) => [item.id, item.width || '', item.height || '', item.bitrate || ''].join(':'))
      .join('|');

    if (signature !== this.qualitySignature) {
      this.qualitySignature = signature;
      this.qualityMenuGroup.replaceChildren(this.qualityMenuTitle);

      const addQualityOption = (id: string, label: string) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'up-speed-option up-quality-option';
        button.dataset.qualityId = id;
        button.textContent = label;
        button.setAttribute('role', 'menuitemradio');
        this.listen(button, 'click', () => {
          const currentHost = this.element as HTMLElement & { store?: { state: unknown } };
          if (!currentHost.store) return;
          const currentQuality = selectQuality(currentHost.store.state as Parameters<typeof selectQuality>[0]);
          currentQuality?.selectVideoRendition(id);
          this.selectedQualityId = id;
          this.refreshQualityMenu();
        });
        this.qualityMenuGroup.append(button);
      };

      addQualityOption('auto', 'Auto · Recommended');
      [...renditions]
        .sort((a, b) => (b.height || 0) - (a.height || 0))
        .forEach((rendition) => {
          const label = rendition.height
            ? rendition.height + 'p'
            : (rendition.width ? rendition.width + 'w' : 'Rendition');
          addQualityOption(rendition.id, label);
        });
    }

    this.qualityMenuGroup.querySelectorAll<HTMLButtonElement>('[data-quality-id]').forEach((button) => {
      const selected = button.dataset.qualityId === this.selectedQualityId;
      button.setAttribute('aria-checked', selected ? 'true' : 'false');
      button.classList.toggle('is-selected', selected);
    });
  }

  private createContextItem(label: string, icon: string, action: () => void): HTMLButtonElement {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'up-context-item';
    item.setAttribute('role', 'menuitem');
    const iconSlot = document.createElement('span');
    iconSlot.className = 'up-context-icon';
    iconSlot.append(makeIcon(icon));
    const text = document.createElement('span');
    text.className = 'up-context-label';
    text.textContent = label;
    item.append(iconSlot, text);
    this.listen(item, 'click', () => {
      action();
      if (!this.statsPanel || this.statsPanel.hidden) this.contextMenu.hidden = true;
    });
    return item;
  }

  private async copySourceLink(): Promise<void> {
    const text = this.currentSource?.src || this.mediaElement.currentSrc || this.mediaElement.getAttribute('src') || '';
    if (!text) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        throw new Error('Clipboard API unavailable');
      }
      this.emit('copied', { text });
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.append(textarea);
      textarea.select();
      const succeeded = document.execCommand('copy');
      textarea.remove();
      this.emit(succeeded ? 'copied' : 'featureerror', succeeded ? { text } : { feature: 'clipboard', error: new Error('Clipboard permission was not granted.') });
    }
  }

  private refreshStats(): void {
    const media = this.mediaElement;
    const current = formatTime(this.currentTime);
    const duration = formatTime(this.duration);
    const width = Number(media.videoWidth) || 0;
    const height = Number(media.videoHeight) || 0;
    let bufferedText = 'n/a';
    try {
      const ranges = media.buffered;
      if (ranges && ranges.length) bufferedText = formatTime(ranges.end(ranges.length - 1));
    } catch {
      bufferedText = 'n/a';
    }
    this.statsPanel.innerHTML = '';
    const title = document.createElement('div');
    title.className = 'up-stats-heading';
    title.textContent = 'Playback stats';
    this.statsPanel.append(title);
    const rows: Array<[string, string]> = [
      ['Source type', this.provider.toUpperCase()],
      ['Resolution', width && height ? width + ' × ' + height : 'Provided by embed / not reported'],
      ['Current time', current + ' / ' + (Number.isFinite(this.duration) ? duration : 'LIVE')],
      ['Playback rate', (this.mediaElement.playbackRate || 1) + '×'],
      ['Buffered to', bufferedText],
      ['Ready state', String(media.readyState ?? 'n/a')],
      ['Link', (this.currentSource?.src || '').slice(0, 120) || 'No source'],
    ];
    for (const [label, value] of rows) {
      const row = document.createElement('div');
      row.className = 'up-stats-line';
      const key = document.createElement('span');
      key.textContent = label;
      const val = document.createElement('strong');
      val.textContent = value;
      row.append(key, val);
      this.statsPanel.append(row);
    }
  }

  private updateSeekTooltip(clientX: number): void {
    const duration = this.duration;
    if (!Number.isFinite(duration) || duration <= 0) {
      this.seekTooltip.hidden = true;
      return;
    }
    const rect = this.seekInput.getBoundingClientRect();
    if (!rect.width) return;
    const fraction = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    this.seekTooltipLabel.textContent = formatTime(fraction * duration);
    this.seekTooltip.style.left = (fraction * 100) + '%';
    this.seekTooltip.hidden = false;
  }

  private queueHideControls(force = false): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    if (force) {
      this.idleTimer = setTimeout(() => {
        if (!this.mediaElement.paused && !this.contextMenu?.contains(document.activeElement)) {
          this.stage.classList.remove('up-interacting');
          this.seekTooltip && (this.seekTooltip.hidden = true);
        }
      }, 450);
      return;
    }
    if (this.options.autohide === false) return;
    this.idleTimer = setTimeout(() => {
      if (!this.mediaElement.paused && !this.contextMenu?.contains(document.activeElement)) {
        this.stage.classList.remove('up-interacting');
      }
    }, 2200);
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
        case 'j':
          keyboard.preventDefault();
          this.seek(Math.max(0, this.currentTime - 10));
          break;
        case 'l':
          keyboard.preventDefault();
          this.seek(this.currentTime + 10);
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
        case 't':
          keyboard.preventDefault();
          this.toggleTheaterMode();
          break;
        case 'i':
          keyboard.preventDefault();
          this.toggleMiniPlayer();
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
    this.playButton.replaceChildren(makeIcon(this.mediaElement.paused ? 'play' : 'pause'));
    this.playButton.setAttribute('aria-label', this.mediaElement.paused ? 'Play video' : 'Pause video');
    this.playButton.title = this.mediaElement.paused ? 'Play' : 'Pause';
    this.centerPlay.replaceChildren(makeIcon(this.mediaElement.paused ? 'play' : 'pause'));
    this.centerPlay.setAttribute('aria-label', this.mediaElement.paused ? 'Play video' : 'Pause video');
    this.centerPlay.hidden = !this.mediaElement.paused;
    this.muteButton.replaceChildren(makeIcon(this.mediaElement.muted || this.mediaElement.volume === 0 ? 'muted' : 'volume'));
    this.muteButton.setAttribute('aria-label', this.mediaElement.muted ? 'Unmute' : 'Mute');
    this.volumeInput.value = this.mediaElement.muted ? '0' : String(this.mediaElement.volume);
    this.volumeInput.style.setProperty('--up-volume', (this.mediaElement.muted ? 0 : this.mediaElement.volume * 100) + '%');
    this.speedMenu.querySelectorAll<HTMLButtonElement>('[data-rate]').forEach((button) => {
      const selected = Number(button.dataset.rate) === this.mediaElement.playbackRate;
      button.setAttribute('aria-checked', selected ? 'true' : 'false');
      button.classList.toggle('is-selected', selected);
    });
    const fullscreen = document.fullscreenElement === this.stage;
    this.fullscreenButton.replaceChildren(makeIcon(fullscreen ? 'exitFullscreen' : 'fullscreen'));
    this.fullscreenButton.setAttribute('aria-label', fullscreen ? 'Exit fullscreen' : 'Enter fullscreen');
    this.fullscreenButton.title = fullscreen ? 'Exit fullscreen' : 'Fullscreen';
    this.syncLayoutButtons();
    this.refreshQualityMenu();
    this.trackButton.classList.toggle('is-active', this.hasShowingCaptions());
    this.loopMenuItem?.querySelector('.up-context-label') && (this.loopMenuItem.querySelector('.up-context-label')!.textContent = 'Loop: ' + (this.mediaElement.loop ? 'On' : 'Off'));
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
          if (type === 'playing') { this.stage.classList.remove('is-buffering'); this.stage.classList.add('is-playing'); this.queueHideControls(); }
          if (type === 'pause' || type === 'ended' || type === 'error') { this.stage.classList.remove('is-buffering', 'is-playing'); this.stage.classList.add('up-interacting'); }
          if (type === 'canplay' || type === 'canplaythrough') this.stage.classList.remove('is-buffering');
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
