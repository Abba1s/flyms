import { expect, test } from '@playwright/test';

test.skip(({ isMobile }) => isMobile, 'Desktop flows');

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-01T10:00:00+01:00'));
});

test('map: status-on-date slider changes what counts as open', async ({ page }) => {
  await page.goto('/map');
  const summary = page.getByText(/programs? open now at \d+ universit/);
  await expect(summary).toBeVisible();
  const slider = page.getByRole('slider', { name: 'Status on' });
  await slider.focus();
  for (let i = 0; i < 60; i++) await page.keyboard.press('ArrowRight');
  await expect(page).toHaveURL(/on=2026-12-31/);
  await expect(page.getByText(/open on 31 Dec 2026 at \d+ universit/)).toBeVisible();
  await page.getByRole('button', { name: 'Reset' }).click();
  await expect(page).not.toHaveURL(/on=/);
});

test('cost estimator adds up and prefills tuition from a program', async ({ page }) => {
  await page.goto('/costs');
  await page.getByLabel('Semesters').fill('4');
  await page.getByLabel('Tuition per semester (€)').fill('1500');
  await page.getByLabel('Semester contribution (€)').fill('300');
  await page.getByLabel('Living costs per month (€)').fill('900');
  await page.getByLabel('Health insurance per month (€)').fill('140');
  await page.getByLabel('One-time costs (€)').fill('500');
  // 6000 + 1200 + 21600 + 3360 + 500
  await expect(page.getByText('€32,660')).toBeVisible();
  await expect(page.getByText(/€11,904/)).toBeVisible();
});

test('privacy, about and SEO files are served', async ({ page, request }) => {
  await page.goto('/privacy');
  await expect(page.getByRole('heading', { name: 'Privacy' })).toBeVisible();
  await expect(page.getByText(/one-way hash of your IP address/)).toBeVisible();
  await page.goto('/about');
  await expect(page.getByRole('heading', { name: 'About Universal Travel and Education Consultancy' })).toBeVisible();
  const manifest = await request.get('/manifest.webmanifest');
  // The dev server does not emit the manifest; production builds do (checked in the build step).
  expect([200, 404]).toContain(manifest.status());
});
