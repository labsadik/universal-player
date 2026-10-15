# Universal Player

**Universal Player** is an open-source, framework-neutral video player built on Video.js 10. Its playback engine is Video.js; the visible player skin, controls, URL loader, context menu and demo experience are built for this project.

## What is in this build?

- **Custom, YouTube-inspired UI:** gradient seek bar, buffered progress, seek-time preview, autohide-on-idle controls, keyboard shortcuts, volume and mute, playback speed, captions where native tracks are available, fullscreen and Picture-in-Picture where supported.
- **Custom right-click menu:** play/pause, jump back/forward, loop toggle, copy source link, playback stats and shortcut help.
- **Paste-to-load URL:** use the top URL bar or the side-panel field. URLs without a scheme are treated as HTTPS; unsafe URL schemes are rejected.
- **Green + blue RGB theme:** adjustable CSS variables and Tailwind CSS v4 for the demo.
- **Lucide icons:** crisp vector icons are rendered from the lucide package; there are no remote icon-font requests.
- **Direct media:** MP4, WebM and other codecs supported by the active browser.
- **Adaptive media:** HLS (.m3u8) and MPEG-DASH (.mpd) optional adapters.
- **Video providers:** YouTube, Vimeo, TikTok, Twitch, Wistia and known Player.js-compatible embeds through provider adapters.
- **Framework-neutral core:** mount createPlayer() from vanilla JS or a browser lifecycle hook in React, Vue, Svelte, Angular or another browser framework.

This is a development version and is not published to npm yet.

## Run locally in VS Code

Requires Node.js 20.19+ and npm.

~~~bash
git clone https://github.com/WorkRCS/easy-video-player.git
cd easy-video-player
npm install
npm run dev
~~~

Open the local URL printed by Vite. The demo starts with a public MP4 sample. You can also paste a direct media or supported provider URL in the top bar, or select a local video from the player's Choose video control.

## Validate

~~~bash
npm run typecheck
npm test
npm run build
npm run pack:check
~~~

For the real-browser MP4, paste-URL and right-click tests:

~~~bash
npx playwright install chromium
npm run test:e2e
~~~

## API

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

player.on('playing', () => console.log('Playing'));

// Call when the view is removed.
player.destroy();
~~~

For React/Vue/Svelte examples and more details, see docs/API.md.

## Video-link limitations

A general webpage URL is not always a playable video URL. Direct files need a supported browser codec and a server that permits media access. HLS/DASH links need accessible manifests/segments and suitable CORS configuration. Embedded platforms may require the provider's own embed URL, allowlisted parent domain, account permission or consent. Some providers don't expose every control (quality, captions, playback rate, Picture-in-Picture) to third-party UI. DRM/private/authenticated media requires its own supported licence/session setup.

The Player.js adapter works only with embeds implementing the Player.js protocol; it is not a universal iframe decoder. No player can guarantee that every arbitrary URL can play.

## License

Universal Player is MIT licensed. Video.js and optional playback adapters retain their own upstream licences/notices.
