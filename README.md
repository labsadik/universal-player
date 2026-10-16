# Universal Player

**Universal Player** is a framework-neutral browser video player built on Video.js, with a project-owned, responsive control UI.

## Install

After the repository has been migrated to **[Labsadik/universal-player](https://github.com/Labsadik/universal-player)**, install the package directly from GitHub:

~~~bash
npm install github:Labsadik/universal-player
~~~

The repository package is named `@labsadik/universal-player`; use that name in imports. The `prepare` script builds the library bundle, stylesheet, declarations, and provider chunks during installation. This guide uses the GitHub install command; it does not assume an npm registry release exists.

Requirements: Node.js **20.19 or newer** and npm.

## Quick start

Add a mount element to your page:

~~~html
<div id="video-player"></div>
~~~

Import the package CSS once and create the player after the element exists:

~~~ts
import { createPlayer } from '@labsadik/universal-player';
import '@labsadik/universal-player/style.css';

const player = createPlayer('#video-player', {
  source: '/media/video.mp4',
  title: 'Product demo',
  theme: 'system',             // 'light' | 'dark' | 'system'
  controlsStyle: 'minimal',    // 'minimal' | 'standard' | 'compact'
  glass: false,
  accentColor: 'rgb(54, 214, 176)',
});

await player.ready;
await player.play();
player.seek(12);
player.setVolume(0.8);
player.setPlaybackRate(1.25);

// Call when your view/component is removed.
player.destroy();
~~~

The default control layout keeps play/pause, ±10-second skip, timeline, captions, settings and fullscreen. Picture-in-Picture and Mini Player are not provided in the built-in UI. Playback speed is opt-in; quality choices are based only on renditions exposed by an adaptive stream.

## Run the repository locally

~~~bash
git clone https://github.com/Labsadik/universal-player.git
cd universal-player
npm install
npm run dev
~~~

Open the local Vite URL. The landing page has a video preview and customization controls; **Feature Playground** is available at `/playground.html`. The live code sample on each page follows the currently selected theme, control density, glass effect, accent and feature switches.

## Validate

~~~bash
npm run typecheck
npm test
npm run build
npm run pack:check
npx playwright install chromium
npm run test:e2e
~~~

`npm run build` builds the distributable library and both website pages. Library output is under `dist/`; website output is under `dist/site/`.

## Framework integration

The player uses the browser DOM, so instantiate it from the client-side lifecycle in React, Vue, Svelte, Angular or another framework. See [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md) for framework and server examples. For API details, see [docs/API.md](docs/API.md).

## Supported media and quality behavior

- Direct MP4/WebM: uses browser-supported codecs.
- HLS (.m3u8) and MPEG-DASH (.mpd): adaptive adapters may expose several video renditions.
- Providers: YouTube, Vimeo, TikTok, Twitch, Wistia and compatible Player.js embeds.
- The Quality section uses source-exposed rendition metadata only. If a source exposes no selectable quality levels, the UI explains that instead of inventing resolution options.
- Playback, captions, quality and embedding remain subject to browser codec support, CORS, host permissions and provider policies. A general webpage URL is not necessarily a playable media URL; DRM/authenticated content needs its supported licence/session flow.

## License

MIT. Video.js and its optional playback adapters retain their upstream licences and notices.
