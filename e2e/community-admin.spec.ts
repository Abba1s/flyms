import { expect, test, type Page } from '@playwright/test';
import { ADMIN_EMAIL, ADMIN_PASSWORD } from './global-setup';

// These flows write to the local database; run them once (desktop) and in order.
test.describe.configure({ mode: 'serial' });
test.skip(({ isMobile }) => isMobile, 'Admin and write flows run on desktop only');

const stamp = Date.now();
const programName = `M.Sc. E2E Test Program ${stamp}`;

async function signIn(page: Page) {
  await page.goto('/admin/login');
  await page.getByLabel('Email').fill(ADMIN_EMAIL);
  await page.getByLabel('Password').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
}

test('visitor suggests a new program', async ({ page }) => {
  await page.goto('/contribute');
  await page.getByLabel('University').fill('TU Berlin');
  await page.getByLabel('Program name').fill(programName);
  await page.getByLabel('Field').selectOption('engineering');
  await page.getByLabel('Intake').selectOption('winter');
  await page.getByLabel('Applications open').fill('2026-10-01');
  await page.getByLabel('Deadline').fill('2027-05-31');
  await page.getByLabel('Official program page').fill('https://www.tu.berlin/en/');
  await page.getByLabel('Your name').fill('E2E Tester');
  await page.getByLabel('Email').fill('tester@example.org');
  await page.getByRole('button', { name: 'Send suggestion' }).click();
  await expect(page.getByRole('heading', { name: 'Thank you!' })).toBeVisible({ timeout: 20_000 });
});

test('contribute form shows inline errors', async ({ page }) => {
  await page.goto('/contribute');
  await page.getByRole('button', { name: 'Send suggestion' }).click();
  await expect(page.getByText('Enter the university')).toBeVisible();
  await expect(page.getByText('Enter a valid email address')).toBeVisible();
});

test('visitor reports wrong info on a program', async ({ page }) => {
  await page.goto('/explore?q=tu%20berlin');
  await page.getByRole('article').first().getByRole('link').first().click();
  await page.getByRole('button', { name: 'Report wrong info' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Details (optional)').fill('Deadline changed to 15 March.');
  await dialog.getByRole('button', { name: 'Send report' }).click();
  await expect(page.getByText('Thanks! An admin will check it.').first()).toBeVisible({
    timeout: 20_000,
  });
});

test('admin approves the suggestion and it goes live', async ({ page }) => {
  await signIn(page);
  await page.getByRole('link', { name: /Change requests/ }).click();
  const card = page.getByRole('article').filter({ hasText: programName });
  await card.getByRole('button', { name: 'Review' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel(/University/)).toHaveValue(/.+/); // matched "TU Berlin"
  await dialog.getByRole('button', { name: 'Approve & apply' }).click();
  await expect(page.getByText('Approved and applied').first()).toBeVisible();

  await page.goto(`/explore?q=${encodeURIComponent(`E2E Test Program ${stamp}`)}`);
  await expect(page.getByRole('heading', { name: programName })).toBeVisible();
});

test('admin resolves the report', async ({ page }) => {
  await signIn(page);
  await page.getByRole('link', { name: /^Reports/ }).click();
  const report = page
    .getByRole('article')
    .filter({ hasText: 'Deadline changed to 15 March.' })
    .first();
  await report.getByRole('button', { name: 'Resolve' }).click();
  await expect(page.getByText('Marked as resolved').first()).toBeVisible();
});

test('admin imports programs from CSV', async ({ page }) => {
  await signIn(page);
  await page.getByRole('link', { name: 'Imports' }).click();
  const csv = [
    'university_slug,field_slug,specialization_slugs,name,degree_type,teaching_language,official_url,winter_year,winter_start,winter_end',
    `tu-berlin,engineering,mechatronics,M.Sc. Imported Mechatronics ${stamp},MSc,english,https://www.tu.berlin/en/,2027/28,2026-12-01,2027-05-31`,
    'unknown-uni,engineering,,M.Sc. Broken Row,MSc,english,https://example.org/,,,',
  ].join('\n');
  await page.locator('input[type=file]').setInputFiles({
    name: 'e2e-import.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csv),
  });
  await expect(page.getByRole('heading', { name: 'Review import' })).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByText('new: 1')).toBeVisible();
  await expect(page.getByText('error: 1')).toBeVisible();
  await expect(page.getByText('Unknown university_slug "unknown-uni"')).toBeVisible();
  await page.getByRole('button', { name: 'Apply selected' }).click();
  await expect(page.getByText('Applied 1 rows').first()).toBeVisible();

  await page.goto(`/explore?q=${encodeURIComponent(`Imported Mechatronics ${stamp}`)}`);
  // Search is typo-tolerant, so programs from earlier runs may also match; check this one by name.
  await expect(
    page.getByRole('heading', { name: `M.Sc. Imported Mechatronics ${stamp}`, exact: true }),
  ).toBeVisible();

  // Re-importing the same file changes nothing.
  await page.goto('/admin/imports');
  await page.locator('input[type=file]').setInputFiles({
    name: 'e2e-import-again.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csv),
  });
  await expect(page.getByText('unchanged: 1')).toBeVisible({ timeout: 20_000 });
});

test('non-admin cannot reach the admin area', async ({ page }) => {
  await page.goto('/admin/programs');
  await expect(page).toHaveURL(/\/admin\/login/);
});
