export type SourceProvider = 'html5' | 'hls' | 'dash' | 'youtube';

export interface PlayerSource {
  src: string;
  type?: string;
  provider?: SourceProvider | 'auto';
  title?: string;
  poster?: string;
}

const YOUTUBE_HOST = /(^|\.)((youtube\.com)|(youtube-nocookie\.com)|(youtu\.be))$/i;

export function normalizeSource(input: string | PlayerSource): PlayerSource {
  const source = typeof input === 'string' ? { src: input } : { ...input };
  const src = source.src?.trim();

  if (!src) {
    throw new TypeError('Universal Player requires a non-empty source URL.');
  }

  return { ...source, src };
}

export function detectProvider(input: string | PlayerSource): SourceProvider {
  const source = normalizeSource(input);
  if (source.provider && source.provider !== 'auto') return source.provider;

  const raw = source.src;
  let url: URL | undefined;
  try {
    url = new URL(raw, typeof window !== 'undefined' ? window.location.href : 'https://universal-player.invalid/');
  } catch {
    // Relative and blob URLs are valid HTML5 sources even without extensions.
  }

  if (url && YOUTUBE_HOST.test(url.hostname.toLowerCase())) return 'youtube';

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
