# Contributing to Universal Player

Thanks for helping make Universal Player useful across the web.

## Development

1. Install Node.js 20.19 or newer.
2. Run npm install.
3. Run npm run dev and open the Vite URL.
4. Choose a local MP4 from the demo and verify playback, seeking, volume, speed, and fullscreen.
5. Run npm run typecheck, npm test, and npm run build.

## Pull requests

- Keep the core framework-neutral. Framework wrappers should be thin adapters.
- Keep provider-specific dependencies behind lazy imports.
- Add tests for source detection and API changes.
- Never claim a provider is verified without a test for it.
- Include browser, OS, source type, and reproduction steps in bug reports.

## Media test files

Prefer tiny, redistributable test assets. Do not add copyrighted videos without permission. The demo uses a public Creative Commons sample hosted by MDN and also supports choosing a local file.
