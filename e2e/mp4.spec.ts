import { expect, test } from '@playwright/test';

test('renders Universal Player controls without the Video.js packaged skin', async ({ page }) => {
  await page.goto('/');

  const stage = page.locator('#player-mount media-container.up-stage');
  await expect(stage).toBeAttached();
  await expect(page.locator('#player-mount video-skin')).toHaveCount(0);
  await expect(page.locator('#player-mount [data-universal-controls]')).toBeVisible();
  await expect(page.locator('#player-mount button[aria-label="Play video"]').first()).toBeVisible();
  await expect(page.locator('#player-mount input[aria-label="Seek video"]')).toBeVisible();
  await expect(page.locator('#player-mount button[aria-label="Playback settings"]')).toBeVisible();
});

test('loads a real MP4, reads metadata, and starts playback from the custom UI', async ({ page }) => {
  await page.goto('/');
  // The landing page starts with a hidden DASH demo; explicitly load the MP4 for this test.
  await page.locator('#video-url').fill('https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4');
  await page.locator('#load-video').click();

  const video = page.locator('#player-mount video').first();
  await expect(video).toBeAttached();

  await expect.poll(
    () => video.evaluate((node) => {
      const media = node as HTMLVideoElement;
      return media.readyState >= HTMLMediaElement.HAVE_METADATA &&
        Number.isFinite(media.duration) &&
        media.duration > 0;
    }),
    { timeout: 60_000, message: 'The MP4 should load metadata and a finite duration.' },
  ).toBe(true);

  const src = await video.evaluate((node) => (node as HTMLVideoElement).currentSrc);
  expect(src).toContain('flower.mp4');

  await page.locator('#player-mount .up-center-play').click();
  await expect.poll(
    () => video.evaluate((node) => !(node as HTMLVideoElement).paused),
    { timeout: 15_000, message: 'The custom play button should start playback.' },
  ).toBe(true);

  await expect(page.locator('#player-mount .up-center-play')).toBeHidden();
  await expect(page.locator('#player-mount .up-controls button[aria-label="Pause video"]')).toBeVisible();
});

test('loads a pasted direct MP4 URL from the top URL bar', async ({ page }) => {
  await page.goto('/');
  const urlBox = page.locator('#video-url');
  await urlBox.fill('https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4');
  await urlBox.press('Enter');
  await expect(page.locator('#provider-pill')).toHaveText('HTML5 VIDEO');
  await expect.poll(() => page.locator('#player-mount video').first().evaluate((node) => {
    const media = node as HTMLVideoElement;
    return media.readyState >= HTMLMediaElement.HAVE_METADATA && media.duration > 0;
  }), { timeout: 60000 }).toBe(true);
});

test('opens Universal Player context menu on right click', async ({ page }) => {
  await page.goto('/');
  const stage = page.locator('#player-mount media-container.up-stage');
  await expect(stage).toBeAttached();
  await stage.click({ button: 'right', position: { x: 160, y: 100 } });
  const contextMenu = page.locator('#player-mount .up-context-menu');
  await expect(contextMenu).toBeVisible();
  await expect(contextMenu).toContainText('Copy video link');
  await expect(contextMenu).toContainText('Playback stats');
  await contextMenu.getByRole('menuitem', { name: 'Playback stats' }).click();
  const stats = page.locator('#player-mount [aria-label="Playback statistics"]');
  await expect(stats).toBeVisible();
  await expect(stats).toContainText('Source type');
});


test('omits Picture in Picture and Mini Player while retaining optional theater mode', async ({ page }) => {
  await page.goto('/');
  const root = page.locator('#player-mount .up-root');
  await expect(page.locator('[data-demo-feature="pictureInPicture"]')).toHaveCount(0);
  await expect(page.locator('[data-demo-feature="miniPlayer"]')).toHaveCount(0);
  await expect(page.locator('#player-mount .up-controls button[aria-label="Picture in Picture"]')).toHaveCount(0);
  await expect(page.locator('#player-mount .up-controls .up-mini-player-button')).toHaveCount(0);

  await page.locator('[data-demo-feature="theaterMode"]').check();
  const theaterButton = page.locator('#player-mount .up-theater-button');
  await theaterButton.click();
  await expect(root).toHaveClass(/up-theater/);
  await page.keyboard.press('Escape');
  await expect(root).not.toHaveClass(/up-theater/);
});


test('keeps the preloaded DASH demo URL out of the visible UI', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#video-url')).toHaveValue('');
  await expect(page.locator('#source-url-side')).toHaveValue('');
  await expect(page.locator('#source-title')).toHaveText('Featured video');
  await expect(page.locator('#player-mount .up-stage[data-provider="dash"]')).toBeAttached();
  await expect(page.locator('#player-section')).not.toContainText('stream.mpd');
  await expect(page.locator('#video-subtitle')).not.toContainText('vidstack.io');
  await page.locator('#player-mount .up-stage').click({ button: 'right', position: { x: 160, y: 100 } });
  await page.locator('#player-mount .up-context-menu').getByRole('menuitem', { name: 'Playback stats' }).click();
  const stats = page.locator('#player-mount [aria-label="Playback statistics"]');
  await expect(stats).toContainText('Hidden by player configuration');
  await expect(stats).not.toContainText('stream.mpd');
});


test('the Flower sample button works in a single click and does not fill the URL field', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-sample="flower"]').click();
  await expect(page.locator('#provider-pill')).toHaveText('HTML5 VIDEO');
  await expect(page.locator('#video-url')).toHaveValue('');
  await expect.poll(() => page.locator('#player-mount video').first().evaluate((node) => {
    const media = node as HTMLVideoElement;
    return media.currentSrc.includes('flower.mp4') && media.readyState >= HTMLMediaElement.HAVE_METADATA;
  }), { timeout: 60000 }).toBe(true);
});


test('playground sidebar starts hidden on mobile and toggles with the correct indication', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/playground.html');
  const toggle = page.locator('#studio-sidebar-toggle');
  const frame = page.locator('#studio-frame');
  const headerGeometry = await page.evaluate(() => {
    const rect = (selector: string) => {
      const el = document.querySelector<HTMLElement>(selector)!;
      const box = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return {
        left: box.left, right: box.right, top: box.top, bottom: box.bottom,
        width: box.width, height: box.height, display: style.display,
        position: style.position, zIndex: style.zIndex, flex: style.flex,
        widthStyle: style.width,
      };
    };
    const header = rect('.studio-header');
    const left = rect('.studio-header-left');
    const actions = rect('.studio-header-actions');
    const toggle = rect('#studio-sidebar-toggle');
    const theme = rect('#studio-theme-toggle');
    return { viewportWidth: innerWidth, header, left, actions, toggle, theme,
      gridTemplateColumns: getComputedStyle(document.querySelector('.studio-header')!).gridTemplateColumns };
  });
  expect(headerGeometry.toggle.right, JSON.stringify(headerGeometry)).toBeLessThanOrEqual(headerGeometry.theme.left);
  await expect(toggle).toHaveAttribute('aria-label', 'Show sidebar');
  await toggle.click();
  await expect(frame).toHaveClass(/sidebar-open/);
  await expect(toggle).toHaveAttribute('aria-label', 'Hide sidebar');
  await expect(page.locator('#studio-sidebar')).toBeVisible();
  await toggle.click();
  await expect(frame).not.toHaveClass(/sidebar-open/);
  await expect(toggle).toHaveAttribute('aria-label', 'Show sidebar');
});
test('pasting a URL into the playground attaches the source without a second load click', async ({ page }) => {
  await page.goto('/playground.html');
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  const url = 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4';
  await page.evaluate(async (source) => navigator.clipboard.writeText(source), url);
  const input = page.locator('#studio-source-url');
  await input.focus();
  await page.keyboard.press('Control+V');
  await expect(page.locator('#studio-provider-label')).toHaveText('HTML5 VIDEO', { timeout: 15000 });
  await expect.poll(() => page.locator('#studio-player-mount video').first().evaluate((node) => {
    const media = node as HTMLVideoElement;
    return media.currentSrc.includes('flower.mp4') && media.readyState >= HTMLMediaElement.HAVE_METADATA;
  }), { timeout: 60000 }).toBe(true);
  await expect(page.locator('#studio-source-url')).toHaveValue(url);
});

test('feature playground toggles a feature on the first click and collapses the sidebar', async ({ page }) => {
  await page.setViewportSize({ width: 1360, height: 900 });
  await page.goto('/playground.html');
  await expect(page.locator('#studio-player-mount .up-stage[data-provider="dash"]')).toBeAttached();
  const seekToggle = page.locator('[data-studio-feature="seek"]');
  const seekTimeline = page.locator('#studio-player-mount .up-timeline-row');
  await expect(seekToggle).toBeChecked();
  await page.locator('[data-feature-row="seek"]').click();
  await expect(seekToggle).not.toBeChecked();
  await expect(page.locator('[data-feature-status="seek"]')).toContainText('Disabled');
  await expect(seekTimeline).toBeHidden();
  await page.locator('[data-feature-row="seek"]').click();
  await expect(seekToggle).toBeChecked();
  await expect(seekTimeline).toBeVisible();

  await page.locator('#studio-sidebar-toggle').click();
  await expect(page.locator('#studio-frame')).toHaveClass(/nav-hidden/);
  await expect(page.locator('#studio-sidebar-toggle')).toHaveAttribute('aria-label', 'Show sidebar');
  await page.locator('#studio-sidebar-toggle').click();
  await expect(page.locator('#studio-frame')).not.toHaveClass(/nav-hidden/);
});


test('setup editor serves copyable Svelte, Python and Java integration snippets', async ({ page }) => {
  await page.goto('/');
  const editor = page.locator('#monaco-code-content');
  await page.locator('[data-code-tab="svelte"]').click();
  await expect(editor).toContainText('onMount');
  await page.locator('[data-code-tab="python"]').click();
  await expect(editor).toContainText('StaticFiles');
  await page.locator('[data-code-tab="java"]').click();
  await expect(editor).toContainText('universal-player.js');
  await expect(page.locator('#code-file-label')).toHaveText('player.html');
});

test('uses core default controls without overflow at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto('/');
  const root = page.locator('#player-mount .up-root');
  const stage = page.locator('#player-mount .up-stage');
  await expect(stage).toBeVisible();
  await expect(root).toHaveAttribute('data-controls-style', 'minimal');
  await expect(root).not.toHaveClass(/up-glassy/);
  for (const label of ['Play video','Toggle captions','Playback settings','Enter fullscreen']) {
    await expect(page.locator('#player-mount .up-controls button[aria-label="' + label + '"]')).toBeVisible();
  }
  await expect(page.locator('#player-mount .up-controls button[aria-label="Back 10 seconds"]')).toBeVisible();
  await expect(page.locator('#player-mount .up-controls button[aria-label="Forward 10 seconds"]')).toBeVisible();
  await expect(page.locator('#player-mount .up-controls .up-mini-player-button')).toHaveCount(0);
  await expect(page.locator('#player-mount .up-controls button[aria-label="Picture in Picture"]')).toHaveCount(0);
  await expect(page.locator('#player-mount .up-controls .up-theater-button')).toBeHidden();
  const geometry = await page.evaluate(() => {
    const stage = document.querySelector<HTMLElement>('#player-mount .up-stage')!.getBoundingClientRect();
    const buttons = [...document.querySelectorAll<HTMLElement>('#player-mount .up-controls .up-icon-button')]
      .filter((button) => getComputedStyle(button).display !== 'none' && !button.hidden)
      .map((button) => ({ label: button.getAttribute('aria-label'), left: button.getBoundingClientRect().left, right: button.getBoundingClientRect().right }));
    return { stageLeft: stage.left, stageRight: stage.right, buttons };
  });
  for (const button of geometry.buttons) {
    expect(button.left, JSON.stringify({button,geometry})).toBeGreaterThanOrEqual(geometry.stageLeft - 1);
    expect(button.right, JSON.stringify({button,geometry})).toBeLessThanOrEqual(geometry.stageRight + 1);
  }
  const controlCss = await page.locator('#player-mount .up-controls').evaluate((node) => {
    const s = getComputedStyle(node); return { image:s.backgroundImage,filter:s.backdropFilter,background:s.backgroundColor };
  });
  expect(controlCss.image).toBe('none');
  expect(controlCss.filter).toBe('none');
  expect(controlCss.background).toBe('rgba(0, 0, 0, 0)');
  await page.locator('#demo-theme').selectOption('system');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('body')).toHaveClass(/site-theme-dark/);
  await expect(root).toHaveAttribute('data-theme','system');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('body')).toHaveClass(/site-theme-light/);
  await expect(page.locator('#player-mount .up-controls button[aria-label="Play video"]')).toHaveCSS('color', 'rgb(23, 32, 51)');
  await page.locator('#demo-glass').check();
  await expect(root).toHaveClass(/up-glassy/);
  await expect.poll(() => page.locator('#player-mount .up-controls').evaluate((node) => getComputedStyle(node).backdropFilter)).toContain('blur');
  await page.locator('#demo-glass').uncheck();
  await expect(root).not.toHaveClass(/up-glassy/);
  await page.locator('#demo-accent').selectOption('#a78bfa');
  await expect(root).toHaveCSS('--up-accent-user','#a78bfa');
});

test('playground defaults to minimal transparent controls, adapts icon ink to theme, and stays responsive', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/playground.html');

  const root = page.locator('#studio-player-mount .up-root');
  const controls = page.locator('#studio-player-mount .up-controls');
  const play = page.locator('#studio-player-mount .up-controls button[aria-label="Play video"]');

  await expect(page.locator('#studio-controls-style')).toHaveValue('minimal');
  await expect(page.locator('#studio-glass-toggle')).not.toBeChecked();
  await expect(root).toHaveAttribute('data-controls-style', 'minimal');
  await expect(root).not.toHaveClass(/up-glassy/);
  await expect(page.locator('[data-studio-feature="pictureInPicture"]')).toHaveCount(0);
  await expect(page.locator('[data-studio-feature="miniPlayer"]')).toHaveCount(0);
  await expect(controls.locator('button[aria-label="Picture in Picture"]')).toHaveCount(0);
  await expect(controls.locator('.up-mini-player-button')).toHaveCount(0);
  await expect(play).toHaveCSS('color', 'rgb(23, 32, 51)');

  const transparentStyle = await controls.evaluate((node) => {
    const css = getComputedStyle(node);
    return { background: css.backgroundColor, backdrop: css.backdropFilter, image: css.backgroundImage };
  });
  expect(transparentStyle.background).toBe('rgba(0, 0, 0, 0)');
  expect(transparentStyle.backdrop).toBe('none');
  expect(transparentStyle.image).toBe('none');

  await page.locator('#studio-glass-toggle').check();
  await expect(root).toHaveClass(/up-glassy/);
  await expect.poll(() => controls.evaluate((node) => getComputedStyle(node).backdropFilter)).toContain('blur');

  await page.locator('[data-studio-theme="system"]').click();
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(play).toHaveCSS('color', 'rgb(248, 250, 252)');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(play).toHaveCSS('color', 'rgb(23, 32, 51)');

  const bounds = await page.evaluate(() => {
    const box = document.querySelector<HTMLElement>('#studio-player-mount .up-stage')!.getBoundingClientRect();
    const visibleButtons = [...document.querySelectorAll<HTMLElement>('#studio-player-mount .up-controls .up-icon-button')]
      .filter((button) => getComputedStyle(button).display !== 'none' && !button.hidden);
    return { left: box.left, right: box.right, buttons: visibleButtons.map((button) => ({
      label: button.getAttribute('aria-label'), left: button.getBoundingClientRect().left, right: button.getBoundingClientRect().right,
    })) };
  });
  for (const button of bounds.buttons) {
    expect(button.left, JSON.stringify({button,bounds})).toBeGreaterThanOrEqual(bounds.left - 1);
    expect(button.right, JSON.stringify({button,bounds})).toBeLessThanOrEqual(bounds.right + 1);
  }
});
 
test('settings gear conditionally shows Speed and actual source Quality sections', async ({ page }) => {
  await page.goto('/');
  const speedToggle = page.locator('[data-demo-feature="playbackSpeed"]');
  const qualityToggle = page.locator('[data-demo-feature="quality"]');
  const gear = page.locator('#player-mount .up-settings-wrap > button[aria-label="Playback settings"]');
  const menu = page.locator('#player-mount .up-speed-menu');
  const speedSection = menu.locator('.up-speed-section');
  const qualitySection = menu.locator('.up-quality-menu-group');

  await expect(gear.locator('svg')).toHaveCount(1);
  await expect(gear).toBeVisible();

  await gear.click();
  await expect(menu).toBeVisible();
  await expect(speedSection).toBeHidden(); // Speed is off by default.
  await expect(speedSection.locator('.up-menu-title')).toHaveText('Speed');
  await expect(qualitySection.locator('.up-menu-title')).toHaveText('Quality');

  await page.keyboard.press('Escape');
  await speedToggle.check();
  await gear.click();
  await expect(speedSection).toBeVisible();
  await expect(speedSection.locator('[data-rate]')).toHaveCount(8);

  await page.keyboard.press('Escape');
  await qualityToggle.uncheck();
  await gear.click();
  await expect(speedSection).toBeVisible();
  await expect(qualitySection).toBeHidden();

  await page.keyboard.press('Escape');
  await speedToggle.uncheck();
  await expect(gear).toBeVisible();
  await gear.click();
  await expect(menu.locator('.up-settings-empty')).toBeVisible();
  await expect(menu.locator('.up-settings-empty')).toContainText('Enable Speed or Quality');
});

test('never invents quality labels for fixed-quality MP4 sources', async ({ page }) => {
  await page.goto('/');
  await page.locator('#video-url').fill('https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4');
  await page.locator('#load-video').click();
  await expect(page.locator('#provider-pill')).toHaveText('HTML5 VIDEO');
  await page.locator('#player-mount .up-settings-wrap > button[aria-label="Playback settings"]').click();

  const qualitySection = page.locator('#player-mount .up-quality-menu-group');
  await expect(qualitySection).toBeVisible();
  await expect(qualitySection.locator('.up-menu-title')).toHaveText('Quality');
  await expect(qualitySection.locator('[data-quality-id]')).toHaveCount(0);
  await expect(qualitySection.locator('.up-quality-unavailable')).toContainText('not exposed by this source');
  await expect(page.locator('#player-mount .up-quality-option')).toHaveCount(0);
});


test('homepage generated setup code follows theme, density, glass and feature selections', async ({ page }) => {
  await page.goto('/');
  const code = page.locator('#demo-generated-code');
  await expect(page.locator('.live-config-install')).toContainText('npm install github:labsadik/universal-player');
  await expect(code).toContainText('theme: "system"');
  await expect(code).toContainText('controlsStyle: "minimal"');
  await expect(code).toContainText('glass: false');

  await page.locator('#demo-theme').selectOption('light');
  await page.locator('#demo-controls').selectOption('compact');
  await page.locator('#demo-glass').check();
  await page.locator('[data-demo-feature="playbackSpeed"]').check();
  await expect(code).toContainText('theme: "light"');
  await expect(code).toContainText('controlsStyle: "compact"');
  await expect(code).toContainText('glass: true');
  await expect(code).toContainText('playbackSpeed: true');
});

test('feature Playground shows install guidance and live generated code', async ({ page }) => {
  await page.goto('/playground.html');
  const code = page.locator('#studio-generated-code');
  await expect(page.locator('#studio-install-command')).toHaveText('npm install github:labsadik/universal-player');
  await expect(code).toContainText('controlsStyle: "minimal"');
  await expect(code).toContainText('glass: false');

  await page.locator('[data-studio-theme="light"]').click();
  await page.locator('#studio-controls-style').selectOption('standard');
  await page.locator('#studio-glass-toggle').check();
  await page.locator('[data-studio-feature="playbackSpeed"]').check();
  await expect(code).toContainText('theme: "light"');
  await expect(code).toContainText('controlsStyle: "standard"');
  await expect(code).toContainText('glass: true');
  await expect(code).toContainText('playbackSpeed: true');
  await expect(code).toContainText('npm install github:labsadik/universal-player');
});
