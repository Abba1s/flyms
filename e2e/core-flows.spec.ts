import { expect, test } from '@playwright/test';

// Freeze "today" so statuses match the seed data deterministically.
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-01T10:00:00+01:00'));
});

test('home → field tile → map shows only open programs in that field', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: /Computer Science.*open now/ }).click();
  await expect(page).toHaveURL(/\/map\?field=computer-science/);
  await expect(page.getByRole('radio', { name: /Applications open/ })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(page.getByText(/programs? open now at \d+ universit/)).toBeVisible();
  await expect(page.locator('.fly-pin, .fly-cluster').first()).toBeVisible();
});

test('map: selecting a university shows its programs grouped by status', async ({
  page,
  isMobile,
}) => {
  await page.goto('/map?status=all');
  if (isMobile) {
    await page.getByRole('button', { name: /^List \(\d+\)/ }).click();
  }
  const list = page.getByRole(isMobile ? 'dialog' : 'complementary');
  await list.getByRole('button', { name: /TU Berlin/ }).click();
  const panel = isMobile
    ? page.getByRole('dialog', { name: 'TU Berlin' })
    : page.getByRole('complementary', { name: /TU Berlin/ });
  await expect(panel.getByText(/Berlin · QS/)).toBeVisible();
  await expect(panel.getByRole('region').first()).toBeVisible();
  await expect(panel.getByRole('link', { name: /Apply/ }).first()).toHaveAttribute(
    'target',
    '_blank',
  );
});

test('explore: filters live in the URL and survive reload', async ({ page }) => {
  await page.goto('/explore');
  await page.getByRole('radio', { name: /Closing in 15 days/ }).click();
  await expect(page).toHaveURL(/status=closing(&|$)/);
  const count = await page.getByRole('article').count();
  expect(count).toBeGreaterThan(0);
  await page.reload();
  await expect(page.getByRole('radio', { name: /Closing in 15 days/ })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(page.getByRole('article')).toHaveCount(count);
});

test('save a program, see it in My List after reload, export CSV', async ({ page }) => {
  await page.goto('/explore?q=natural%20language');
  const card = page.getByRole('article').first();
  const name = (await card.getByRole('heading').textContent())!.trim();
  await card.getByRole('button', { name: /Save .* to My List/ }).click();
  await expect(page.getByText('Saved to My List').first()).toBeVisible();

  await page.goto('/my-list');
  await page.reload();
  await expect(page.getByRole('heading', { name })).toBeVisible();

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'CSV' }).click();
  expect((await download).suggestedFilename()).toMatch(/^flyms-my-list-.*\.csv$/);
});

test('program page shows windows, requirements and an unverified notice', async ({ page }) => {
  await page.goto('/explore?q=tu%20berlin');
  await page.getByRole('article').first().getByRole('link').first().click();
  await expect(page.getByRole('heading', { name: 'Application windows' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Requirements' })).toBeVisible();
  await expect(page.getByText('These details have not been verified yet.')).toBeVisible();
});
