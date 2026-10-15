# Universal Player API

## Install / local development

This package is under development and is not yet published to npm. To use the demo:

~~~bash
git clone https://github.com/WorkRCS/easy-video-player.git
cd easy-video-player
npm install
npm run dev
~~~

## Create a player

~~~ts
import { createPlayer } from '@workrcs/universal-player';
import '@workrcs/universal-player/style.css';

const player = createPlayer('#player-slot', {
  source: { src: '/videos/sample.mp4', type: 'video/mp4' },
  title: 'Sample clip',
  preload: 'metadata',
  aspectRatio: '16 / 9',
  objectFit: 'contain',
  playbackRates: [0.5, 0.75, 1, 1.25, 1.5, 2],
  autohide: true,
});

await player.ready;
await player.play();
player.seek(8);
player.setVolume(0.8);
player.setPlaybackRate(1.25);

// Unsubscribe and destroy when your view unmounts.
player.destroy();
~~~

## Framework-neutral integration

The core is DOM-based and has no React runtime dependency. In React, create the player inside useEffect; in Vue, Svelte or Angular, create it from the browser mount lifecycle and call destroy() during teardown. Avoid creating the DOM player during server-side rendering.

## Loading pasted URLs

~~~ts
import { createPlayer, normalizePastedVideoUrl, detectProvider } from '@workrcs/universal-player';

const url = normalizePastedVideoUrl(userPastedText);
const provider = detectProvider(url);
const player = createPlayer('#player', { source: { src: url, provider, title: 'Pasted video' } });
~~~

normalizePastedVideoUrl() trims the value, adds https:// if a scheme was omitted, preserves the query string and accepts only http:// and https://. It does not download, inspect or proxy the URL: it only normalizes the address.

## Playback providers

| URL or media type | Adapter |
| --- | --- |
| MP4 / WebM / browser-supported files | HTML video |
| .m3u8 / HLS MIME types | HLS.js Video.js adapter |
| .mpd / application/dash+xml | DASH Video.js adapter |
| youtube.com, youtu.be | YouTube iframe adapter |
| vimeo.com | Vimeo adapter |
| tiktok.com | TikTok adapter |
| twitch.tv | Twitch adapter |
| Wistia URLs | Wistia adapter |
| Known Player.js embeds (Mux/Gumlet/Bunny/Streamable and compatible hosts) | Player.js adapter |

When a URL's extension does not reveal its source type, supply a type or explicit provider. Provider auto-detection is heuristic; it does not make arbitrary web-page URLs playable.

## Controls

- play(), pause() — start or pause playback.
- seek(seconds) — seek to a non-negative time.
- setVolume(0..1), setMuted(boolean) — volume controls.
- setPlaybackRate(rate) — positive playback speed.
- requestFullscreen() — fullscreen if the browser permits it.
- requestPictureInPicture() — native media PiP when exposed by the current media provider.
- on(event, listener) / off(event, listener) — subscribe to events.
- destroy() — unbind listeners, stop media and remove the player DOM.

The custom right-click menu includes loop, copy-link, stats and keyboard help. Keyboard shortcuts include Space/K for play-pause, Left/Right for 5-second seek, J/L for 10-second seek, M for mute, and F for fullscreen.

## Provider limits

A browser can play only supported codecs and media types. Direct media URLs can fail because of CORS, missing byte-range support, inaccessible segments, expiring signatures or server policy. Embedded platforms may constrain playback rate, quality, captions, PiP and fullscreen. Twitch embeds can require the consuming site's domain as a parent parameter/allowlist. DRM-protected media needs the relevant CDM and licence flow. The Player.js adapter works only for embeds implementing the Player.js protocol.

## Events

Native media events are surfaced via player.on(), including loadstart, loadedmetadata, canplay, play, playing, pause, timeupdate, waiting, ended, volumechange, ratechange and error. The event's detail includes the original event, active media element, current source and media error (when available). sourcechange contains source and provider.


## Additional UI features

The custom UI includes a timestamp preview while seeking, auto-hiding controls, loop toggle, copy-source-link, playback statistics, keyboard help, an in-page mini player (I) and theater mode (T). Escape closes menus and exits the display modes. Native Picture-in-Picture uses requestPictureInPicture() where the media provider exposes it.

The playback settings menu shows a quality section only when the current HLS/DASH player store exposes two or more renditions through the Video.js quality feature. “Auto” returns quality choice to adaptive bitrate selection. MP4/WebM direct files are fixed-quality sources, so this setting is hidden for them.

The context menu and other UI remain project-owned. Icon glyphs come from the locally bundled Lucide package; no runtime icon font is downloaded.
