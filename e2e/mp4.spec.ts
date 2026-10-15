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


test('toggles the in-page mini player and theater mode', async ({ page }) => {
  await page.goto('/');
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
