# Universal Player API

## Install

~~~bash
npm install @workrcs/universal-player
~~~

The package is not published to npm yet. During development, clone this repository and use the local demo, or install from a local package tarball after building.

## Vanilla JavaScript

~~~ts
import { createPlayer } from '@workrcs/universal-player';
import '@workrcs/universal-player/style.css';

const player = createPlayer('#video-slot', {
  source: { src: '/media/demo.mp4', type: 'video/mp4' },
  title: 'Product demo',
  preload: 'metadata',
  aspectRatio: '16 / 9',
});

await player.ready;
await player.play();

player.seek(10);
player.setVolume(0.75);
player.setPlaybackRate(1.25);

// Call during page cleanup.
player.destroy();
~~~

## React

Mount the player inside a client lifecycle hook so browser custom elements are not created during server rendering.

~~~tsx
import { useEffect, useRef } from 'react';
import { createPlayer } from '@workrcs/universal-player';
import '@workrcs/universal-player/style.css';

export function UniversalPlayerView({ src }: { src: string }) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mountRef.current) return;
    const player = createPlayer(mountRef.current, { source: src, title: 'Video' });
    return () => player.destroy();
  }, [src]);

  return <div ref={mountRef} />;
}
~~~

## Vue / Svelte / Angular

Call createPlayer() from the framework's browser mount lifecycle and call destroy() during teardown. The core API is DOM-based; it does not require React.

## Sources

- MP4 / WebM: HTML5 media element.
- HLS (.m3u8): Video.js HLS.js media adapter.
- DASH (.mpd): Video.js DASH media adapter. This adapter is still marked unstable upstream; its exact version is pinned.
- YouTube: Video.js YouTube IFrame adapter.

Pass provider explicitly when a URL does not reveal its media type:

~~~ts
await player.setSource({
  src: 'https://cdn.example.test/live',
  type: 'application/dash+xml',
  provider: 'dash',
});
~~~

Playback still depends on browser codec support, the remote server's CORS/range headers, embed policies, network access, and any DRM licence rules. YouTube's IFrame API also has provider-specific limitations.

## API

- createPlayer(target, options) — mount in an HTMLElement or selector.
- player.ready — initial source/adapter setup promise.
- player.setSource(source) — load a URL or typed source object.
- player.play() / player.pause() — playback.
- player.seek(seconds) — seek to a non-negative second value.
- player.setVolume(0..1) / player.setMuted(boolean).
- player.setPlaybackRate(rate) — positive playback rate.
- player.on(event, listener) — listen for media events; returns an unsubscribe function.
- player.off(event, listener) — remove a listener.
- player.requestFullscreen() / player.requestPictureInPicture().
- player.destroy() — release listeners, media and DOM.

### Events

Events are exposed on the wrapper through player.on(). Native media events include loadedmetadata, canplay, play, playing, pause, timeupdate, waiting, ended, volumechange, ratechange, and error. The event's detail includes originalEvent, media, and the current source for native events. The sourcechange event includes source and provider.
