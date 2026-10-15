# Universal Player

**Universal Player** is an open-source, framework-neutral video player built on Video.js 10 and Web Components. It has a branded responsive demo, a typed JavaScript API, custom styling, and optional media adapters.

Repository: https://github.com/WorkRCS/easy-video-player

## Current implementation

- MP4, WebM and other browser-supported file playback through the native HTML media element.
- Optional Video.js adapters for HLS, MPEG-DASH and YouTube, loaded only when the source needs them.
- The createPlayer() API provides source switching, play/pause, seeking, volume, playback rate, events, fullscreen, Picture-in-Picture where available, and cleanup.
- Responsive dark demo with the public MP4 sample and a local-file picker so you can test an MP4 from your computer.
- TypeScript declarations, source-detection unit tests, browser MP4 smoke test, build checks and GitHub Actions CI.
- The core does not depend on React. React, Vue, Svelte, Angular and other browser frameworks can mount it from their client-side lifecycle hooks.

This is an early development release. It is not published to npm yet. The DASH adapter is pinned to Video.js 10.1.0 and should be rechecked on version upgrades because upstream marks its configuration API as unstable. Playback still depends on browser codec support, CORS/server configuration, network access and provider restrictions.

## Run in VS Code

Requires Node.js 20.19+ and npm.

~~~bash
git clone https://github.com/WorkRCS/easy-video-player.git
cd easy-video-player
npm install
npm run dev
~~~

Open the local URL printed by Vite. The demo loads an MP4 sample automatically. To test your own video, select **Choose video** and pick an MP4 file on your computer.

## Validate the implementation

~~~bash
npm run typecheck
npm test
npm run build
npm run pack:check
~~~

For a real browser test of the MP4 sample, install Playwright Chromium once and run:

~~~bash
npx playwright install chromium
npm run test:e2e
~~~

CI runs type-checking, unit tests, the MP4 browser smoke test, production build, and package-content verification.

## API example

~~~ts
import { createPlayer } from '@workrcs/universal-player';
import '@workrcs/universal-player/style.css';

const player = createPlayer('#player', {
  source: { src: '/videos/demo.mp4', type: 'video/mp4' },
  title: 'Product demo',
  preload: 'metadata',
  aspectRatio: '16 / 9',
});

await player.ready;
await player.play();
player.seek(12);
player.setVolume(0.8);
player.setPlaybackRate(1.25);

// Call when the view is removed.
player.destroy();
~~~

See docs/API.md for framework examples and the API surface.

## License

The Universal Player project is MIT licensed. Video.js and its optional playback adapters use their own upstream licenses and retain their respective notices.
