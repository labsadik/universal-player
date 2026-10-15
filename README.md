# Universal Player

A framework-neutral, open-source video player built on the current Video.js HTML/Web Components architecture.

> Project name: **Universal Player**  
> Repository: [WorkRCS/easy-video-player](https://github.com/WorkRCS/easy-video-player)

Universal Player aims to provide one consistent player API for vanilla JavaScript, React, Vue, Svelte, Angular, and other browser-based applications. The first milestone focuses on a reliable MP4 player, an accessible custom skin, package/build setup, and a repeatable local test workflow.

## Status

Early development. The first release is not yet published to npm. MP4 is the first integration target; HLS, DASH, and embedded providers are planned as optional adapters after the baseline test passes.

## Local development

Requires Node.js 20 or newer and npm.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. The demo includes a known public MP4 source and a local-file URL field so you can test your own video.

Build and test:

```bash
npm run typecheck
npm run build
npm test
```

## License

MIT for this project. Video.js and any optional playback adapters remain under their respective upstream licenses; see their package metadata before redistribution.
