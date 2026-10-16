export type SourceProvider =
  | 'html5'
  | 'hls'
  | 'dash'
  | 'youtube'
  | 'vimeo'
  | 'tiktok'
  | 'twitch'
  | 'wistia'
  | 'playerjs';

export interface PlayerSource {
  src: string;
  type?: string;
  provider?: SourceProvider | 'auto';
  title?: string;
  poster?: string;
  /** Mark a source as live before a stream exposes its seekable range. */
  live?: boolean;
}

const hostIs = (host: string, domain: string): boolean =>
  host === domain || host.endsWith('.' + domain);

export function normalizeSource(input: string | PlayerSource): PlayerSource {
  const source = typeof input === 'string' ? { src: input } : { ...input };
  const src = source.src?.trim();

  if (!src) {
    throw new TypeError('Universal Player requires a non-empty source URL.');
  }

  return { ...source, src };
}

/**
 * Normalise a URL pasted by a user. Only web URLs are accepted; javascript:, data:
 * and other schemes are deliberately rejected.
 */
export function normalizePastedVideoUrl(input: string): string {
  let value = input.trim();
  if (!value) throw new TypeError('Paste a video URL first.');

  // Common copy/paste omissions: example.com/movie.mp4 or www.youtube.com/watch?v=...
  const hasScheme = /^[a-z][a-z\d+.-]*:/i.test(value);
  if (hasScheme && !/^https?:\/\//i.test(value)) {
    throw new TypeError('Only http:// and https:// video links are accepted.');
  }
  if (!hasScheme && !value.startsWith('//')) value = 'https://' + value;
  if (value.startsWith('//')) value = 'https:' + value;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new TypeError('That does not look like a valid video URL.');
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new TypeError('Only http:// and https:// video links are accepted.');
  }
  if (!url.hostname || !url.hostname.includes('.')) {
    throw new TypeError('Please paste a complete video URL, including its domain.');
  }

  return url.href;
}

export function detectProvider(input: string | PlayerSource): SourceProvider {
  const source = normalizeSource(input);
  if (source.provider && source.provider !== 'auto') return source.provider;

  const raw = source.src;
  let url: URL | undefined;
  try {
    url = new URL(raw, typeof window !== 'undefined' ? window.location.href : 'https://universal-player.invalid/');
  } catch {
    // A relative or blob-like URL can still be a regular HTML5 source.
  }

  const host = url?.hostname.toLowerCase() || '';
  if (host && (
    hostIs(host, 'youtube.com') ||
    hostIs(host, 'youtube-nocookie.com') ||
    hostIs(host, 'youtu.be')
  )) return 'youtube';

  if (host && (hostIs(host, 'vimeo.com'))) return 'vimeo';
  if (host && hostIs(host, 'tiktok.com')) return 'tiktok';
  if (host && hostIs(host, 'twitch.tv')) return 'twitch';
  if (host && (hostIs(host, 'wistia.com') || hostIs(host, 'wi.st') || host === 'fast.wistia.net')) return 'wistia';

  // Known Player.js-compatible embed URLs. Player.js only works on embeds whose
  // player explicitly implements that protocol; it is not a generic iframe shim.
  if (
    host === 'player.mux.com' ||
    host === 'play.gumlet.io' ||
    host === 'iframe.mediadelivery.net' ||
    host === 'player.mediadelivery.net' ||
    host === 'video.bunnycdn.com' ||
    (host === 'streamable.com' && /^\/e\//.test(url?.pathname || ''))
  ) return 'playerjs';

  const type = (source.type || '').toLowerCase().split(';')[0].trim();
  const pathname = (url?.pathname || raw).toLowerCase().split(/[?#]/)[0];

  if (
    pathname.endsWith('.m3u8') ||
    type === 'application/vnd.apple.mpegurl' ||
    type === 'application/x-mpegurl' ||
    type === 'audio/mpegurl'
  ) return 'hls';

  if (pathname.endsWith('.mpd') || type === 'application/dash+xml') return 'dash';

  return 'html5';
}

export function formatTime(value: number): string {
  if (!Number.isFinite(value) || value < 0) return '0:00';

  const total = Math.floor(value);
  const seconds = String(total % 60).padStart(2, '0');
  const minutes = Math.floor(total / 60);

  if (minutes >= 60) {
    return String(Math.floor(minutes / 60)) + ':' + String(minutes % 60).padStart(2, '0') + ':' + seconds;
  }

  return String(minutes) + ':' + seconds;
}
