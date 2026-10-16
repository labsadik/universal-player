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


test('toggles the in-page mini player and theater mode after enabling the optional features', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-demo-feature="miniPlayer"]').check();
  await page.locator('[data-demo-feature="theaterMode"]').check();
  const root = page.locator('#player-mount .up-root');
  const miniButton = page.locator('#player-mount .up-mini-player-button');
  const theaterButton = page.locator('#player-mount .up-theater-button');

  await expect(root).not.toHaveClass(/up-mini-player/);
  await miniButton.click();
  await expect(root).toHaveClass(/up-mini-player/);
  await page.keyboard.press('Escape');
  await expect(root).not.toHaveClass(/up-mini-player/);

  await theaterButton.click();
  await expect(root).toHaveClass(/up-theater/);
  await page.keyboard.press('Escape');
  await expect(root).not.toHaveClass(/up-theater/);
});


test('keeps quality selection hidden for a fixed-quality MP4', async ({ page }) => {
  await page.goto('/');
  await page.locator('#video-url').fill('https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4');
  await page.locator('#load-video').click();
  await expect(page.locator('#provider-pill')).toHaveText('HTML5 VIDEO');
  await expect(page.locator('#player-mount .up-quality-menu-group')).toBeHidden();
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
  for (const label of ['Play video','Back 10 seconds','Forward 10 seconds','Toggle captions','Playback settings','Picture in Picture','Enter fullscreen']) {
    await expect(page.locator('#player-mount .up-controls button[aria-label="' + label + '"]')).toBeVisible();
  }
  await expect(page.locator('#player-mount .up-controls .up-mini-player-button')).toBeHidden();
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
    const s = getComputedStyle(node); return { image:s.backgroundImage,filter:s.backdropFilter };
  });
  expect(controlCss.image).toBe('none');
  expect(controlCss.filter).toBe('none');
  await page.locator('#demo-theme').selectOption('system');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('body')).toHaveClass(/site-theme-dark/);
  await expect(root).toHaveAttribute('data-theme','system');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('body')).toHaveClass(/site-theme-light/);
  await page.locator('#demo-accent').selectOption('#a78bfa');
  await expect(root).toHaveCSS('--up-accent-user','#a78bfa');
});
