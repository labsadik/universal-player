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
  await expect(page.locator('#player-mount button[aria-label="Pause video"]').first()).toBeVisible();
});