import { describe, expect, it } from 'vitest';
import { detectProvider, formatTime, normalizeSource } from '../src/source.js';

describe('normalizeSource', () => {
  it('accepts a URL string and trims whitespace', () => {
    expect(normalizeSource('  /clip.mp4  ')).toEqual({ src: '/clip.mp4' });
  });
  it('rejects an empty source', () => {
    expect(() => normalizeSource('   ')).toThrow(/non-empty source URL/);
  });
});

describe('detectProvider', () => {
  it('detects a normal MP4 as HTML5 playback', () => {
    expect(detectProvider({ src: '/videos/sample.mp4', type: 'video/mp4' })).toBe('html5');
  });
  it('detects WebM as HTML5 playback', () => {
    expect(detectProvider('/videos/sample.webm')).toBe('html5');
  });
  it('detects HLS by extension, including query strings', () => {
    expect(detectProvider('https://media.example.test/live.m3u8?token=abc')).toBe('hls');
  });
  it('detects HLS by MIME type', () => {
    expect(detectProvider({ src: '/stream', type: 'application/vnd.apple.mpegurl' })).toBe('hls');
  });
  it('detects MPEG-DASH', () => {
    expect(detectProvider('https://media.example.test/manifest.mpd')).toBe('dash');
  });
  it('detects YouTube watch and short URLs', () => {
    expect(detectProvider('https://www.youtube.com/watch?v=aqz-KE-bpKQ')).toBe('youtube');
    expect(detectProvider('https://youtu.be/aqz-KE-bpKQ')).toBe('youtube');
  });
  it('honours an explicit provider override', () => {
    expect(detectProvider({ src: 'https://media.example.test/stream', provider: 'dash' })).toBe('dash');
  });
});

describe('formatTime', () => {
  it('formats minutes and seconds', () => {
    expect(formatTime(65.8)).toBe('1:05');
  });
  it('formats long durations with hours', () => {
    expect(formatTime(3661)).toBe('1:01:01');
  });
  it('returns a safe default for invalid values', () => {
    expect(formatTime(Number.NaN)).toBe('0:00');
    expect(formatTime(-1)).toBe('0:00');
  });
});
