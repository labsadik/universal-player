import { expect, test } from '@playwright/test';

test('loads a real MP4, reads metadata, and starts playback', async ({ page }) => {
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

  await video.evaluate(async (node) => {
    const media = node as HTMLVideoElement;
    media.muted = true;
    await media.play();
  });

  await expect.poll(
    () => video.evaluate((node) => !(node as HTMLVideoElement).paused),
    { timeout: 15_000, message: 'The MP4 should enter playback after play() resolves.' },
  ).toBe(true);
});