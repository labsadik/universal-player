# Universal Player API

## Install and local development

After the repository has been migrated to [labsadik/universal-player](https://github.com/labsadik/universal-player), install it directly from GitHub:

~~~bash
npm install github:labsadik/universal-player
~~~

To run the website locally:

~~~bash
git clone https://github.com/labsadik/universal-player.git
cd universal-player
npm install
npm run dev
~~~

The `prepare` script builds the library during a GitHub dependency install. See [INTEGRATIONS.md](INTEGRATIONS.md) for framework and backend examples.

## Create a player

~~~html
<div id="player-slot"></div>
~~~

~~~ts
import { createPlayer } from '@labsadik/universal-player';
import '@labsadik/universal-player/style.css';

const player = createPlayer('#player-slot', {
  source: '/videos/sample.mp4',
  title: 'Sample clip',
  theme: 'system',
  controlsStyle: 'minimal',
  glass: false,
  accentColor: 'rgb(54, 214, 176)',
});

await player.ready;
await player.play();
player.seek(8);
player.setVolume(0.8);
player.setPlaybackRate(1.25);

// Unsubscribe your own listeners and destroy on unmount.
player.destroy();
~~~

## Framework-neutral integration

The core is DOM-based and has no React runtime dependency. In React, instantiate inside `useEffect`; in Vue, Svelte or Angular, create it in the browser mount lifecycle and call `destroy()` during teardown. Do not create a player during server-side rendering.

## Source URLs and providers

~~~ts
import { createPlayer, normalizePastedVideoUrl, detectProvider } from '@labsadik/universal-player';

const url = normalizePastedVideoUrl(userPastedText);
const provider = detectProvider(url);
const player = createPlayer('#player', { source: { src: url, provider, title: 'Pasted video' } });
~~~

`normalizePastedVideoUrl()` trims the value, adds `https://` when no scheme is present, preserves the query string and accepts only HTTP(S) URLs. It does not download, inspect or proxy the address.

| Source | Adapter |
| --- | --- |
| MP4, WebM and browser-supported files | HTML video |
| HLS (.m3u8) | HLS.js / Video.js adapter |
| MPEG-DASH (.mpd) | DASH / Video.js adapter |
| YouTube, Vimeo, TikTok, Twitch and Wistia | Provider adapter |
| Known Player.js-compatible embeds | Player.js adapter |

A regular webpage is not always a playable media URL. Source playback depends on codecs, CORS, host permissions and the underlying provider.

## Controls and settings

- `play()`, `pause()` — playback.
- `seek(seconds)` — seek to a non-negative timestamp.
- `setVolume(0..1)`, `setMuted(boolean)` — audio controls.
- `setPlaybackRate(rate)` — set a positive playback rate.
- `requestFullscreen()` — fullscreen when permitted by the browser.
- `on(event, listener)` / `off(event, listener)` — subscribe to player events.
- `destroy()` — stop media, unbind listeners and remove the player DOM.

~~~ts
player.setTheme('system'); // 'light' | 'dark' | 'system'
player.setGlassEffect(false);
player.setAccentColor('#3b82f6');
player.setControlsStyle('minimal'); // 'standard' | 'compact' | 'minimal'
player.setFeatures({ playbackSpeed: true, quality: true, stats: false });
~~~

The default control layout shows play/pause, back/forward 10 seconds, timeline, captions, settings and fullscreen. The UI intentionally has no Picture-in-Picture or Mini Player control. Speed and Quality settings appear according to the selected features. Actual Quality options are derived from renditions exposed by the current adaptive HLS/DASH source; fixed-quality or unsupported sources display an availability message instead of invented resolutions.

Use `hideSourceUrl: true` to hide the source URL in playback statistics.

## Events and deployment

Native media events are surfaced through `player.on()`, including `loadstart`, `loadedmetadata`, `canplay`, `playing`, `pause`, `timeupdate`, `waiting`, `ended`, `volumechange`, `ratechange` and `error`. The event detail includes the original event, active media element, current source and media error.

Run `npm run build` to generate the distributable package and both static website pages. Library output is under `dist/`; website output is under `dist/site/`.
