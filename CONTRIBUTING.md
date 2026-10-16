# Contributing to Universal Player

Thanks for helping improve Universal Player.

## Development setup

After the repository migration, clone the canonical repository and install dependencies:

~~~bash
git clone https://github.com/labsadik/universal-player.git
cd universal-player
npm install
~~~

Requirements: Node.js 20.19+ and npm. Start the local website with:

~~~bash
npm run dev
~~~

Before submitting changes, run the relevant checks:

~~~bash
npm run typecheck
npm test
npm run build
npm run pack:check
npx playwright install chromium
npm run test:e2e
~~~

## Pull requests

- Keep the core framework-neutral. Framework wrappers should be thin adapters.
- Keep provider-specific dependencies behind lazy imports.
- Add tests for source detection, public API and visible-control changes.
- Never claim a provider is verified without a reproducible test.
- Include browser, OS, source type and reproduction steps in bug reports.

## Media test files

Prefer tiny, redistributable test assets. Do not add copyrighted videos without permission. Tests may use public samples or local media fixtures.
