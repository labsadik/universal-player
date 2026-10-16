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

**Publishing status:** the npm registry release is a separate step and is not claimed to be published. Before then, install directly from GitHub with `npm install github:WorkRCS/easy-video-player`; the package's `prepare` script builds its distributable files during installation. After a public registry release, switch to `npm install @labsadik/universal-player`.

## Run locally in VS Code

Requires Node.js 20.19+ and npm.

~~~bash
git clone https://github.com/WorkRCS/easy-video-player.git
cd easy-video-player
npm install
npm run dev
~~~

Open the local URL printed by Vite. The landing page starts with a preloaded DASH demo stream; the media URL is deliberately not shown in the page's URL fields or player details. Paste a direct media or supported provider URL to replace it, or use the sample list to test another source.

The landing page links to a dedicated **Feature Playground** at `/playground.html`. It keeps a compact preview on the left and a live feature inspector on the right, with theme, glass, accent, control-density, sidebar and per-feature switches.

Run `npm run build` to build both the npm player library and the static site. The library files are emitted under `dist/`; the website pages are emitted under `dist/site/`. Vercel is configured to serve `dist/site`.

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
import { createPlayer } from '@labsadik/universal-player';
import '@labsadik/universal-player/style.css';

const player = createPlayer('#player', {
  source: { src: '/videos/demo.mp4', type: 'video/mp4' },
  title: 'Product demo',
  preload: 'metadata',
  aspectRatio: '16 / 9',
  theme: 'system', // 'dark' | 'light' | 'system'
  glass: true,
  accentColor: 'rgb(54, 214, 176)',
  controlsStyle: 'standard', // 'standard' | 'compact' | 'minimal'
});

await player.ready;
await player.play();
player.seek(12);
player.setVolume(0.8);
player.setPlaybackRate(1.25);
player.setTheme('dark');
player.setGlassEffect(true);
player.setAccentColor('rgb(54, 214, 176)');
player.setControlsStyle('compact');
player.setFeatures({ stats: false, miniPlayer: false });

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


## YouTube-inspired player interactions

- Controls fade out during idle playback and return on hover or keyboard focus.
- Seek bar shows playback/buffer progress and previews the timestamp while scrubbing.
- Right-click opens Universal Player's own menu with loop, copy-link, playback stats, keyboard help, mini player, and theater mode.
- Keyboard shortcuts: Space/K play-pause, Left/Right seek 5 seconds, J/L seek 10 seconds, M mute, F fullscreen, T theater mode, I mini player, and Escape close the menu/exit a display mode.
- Mini player floats inside the page, while theater mode expands the player into an immersive fixed layout. Native browser Picture-in-Picture remains a separate feature.
- Adaptive HLS/DASH streams can show a quality selector when the Video.js quality feature exposes multiple renditions. Direct MP4 files have a fixed quality and intentionally do not show a quality menu.
- The UI is styled with Tailwind CSS v4 and CSS, and icons use the locally bundled Lucide package.

The goal is a familiar video-player experience, not an exact copy of YouTube branding. Provider-specific embeds may limit quality, captions, playback rate, picture-in-picture or fullscreen.


## npm install and plug-and-play usage

**Install the current package now, before the npm registry release:**

~~~bash
npm install github:WorkRCS/easy-video-player
~~~

The package's `prepare` script builds JavaScript, CSS, declarations and provider chunks during GitHub installation. After a public npm registry release, use:

~~~bash
npm install @labsadik/universal-player
~~~

Create a mount element, import the CSS once, and create the player:

~~~html
<div id="player"></div>
~~~

~~~ts
import { createPlayer } from '@labsadik/universal-player';
import '@labsadik/universal-player/style.css';

const player = createPlayer('#player', {
  source: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
  theme: 'system',
  glass: true,
  accentColor: 'rgb(54, 214, 176)',
  controlsStyle: 'standard',
});

// Optional runtime customization
player.setTheme('light');
player.setGlassEffect(false);
player.setControlsStyle('compact');
player.setFeatures({ stats: false, miniPlayer: false });

// On route/component unmount:
player.destroy();
~~~

For a local checkout, clone `https://github.com/WorkRCS/easy-video-player.git`, then run `npm install`. For framework-specific instructions, including Python/Java servers serving the browser bundle, see [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md).

## Themes and features

- `theme`: `dark`, `light`, or `system`
- `glass`: frosted glass treatment for control surfaces
- `hideSourceUrl`: hide the media URL in the playback-stats panel while keeping explicit copy-link behaviour available
- `accentColor`: any valid CSS color, including RGB/HSL/hex
- `controlsStyle`: `standard`, `compact`, or `minimal`
- `features`: opt in/out of `seek`, `skip`, `volume`, `playbackSpeed`, `quality`, `captions`, `pictureInPicture`, `miniPlayer`, `theaterMode`, `fullscreen`, `contextMenu`, `loop`, `copyLink`, `stats`, `keyboardHelp`, and `liveIndicator`
- Live sources may use `{ src, live: true }`. The Go Live button seeks to the last available seekable range when the provider exposes it.

## Framework integration

Universal Player is framework-neutral, so you can use it inside React, Vue, Svelte, Angular or plain TypeScript. Create it after the mount element exists, and always call `destroy()` when that component is removed. Example React integration:

~~~tsx
import { useEffect, useRef } from 'react';
import { createPlayer } from '@labsadik/universal-player';
import '@labsadik/universal-player/style.css';

export function VideoPlayer({ src }: { src: string }) {
  const mount = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!mount.current) return;
    const player = createPlayer(mount.current, { source: src, theme: 'system' });
    return () => player.destroy();
  }, [src]);
  return <div ref={mount} />;
}
~~~

## Quality, live streams and limitations

HLS/DASH quality choices come from the renditions exposed by the stream's adaptive playback adapter. A regular MP4 URL is normally a single rendition, so the player cannot invent 1080p/4K options that the source does not contain. Live-edge seeking works only when the underlying provider exposes seekable ranges. Third-party providers can restrict captions, quality, PiP, seeking, or embedding. DRM, login-gated content, CORS, unsupported codecs, and provider policies still apply.
