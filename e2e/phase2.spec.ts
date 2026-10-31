import { expect, test, type Page } from '@playwright/test';
import { ADMIN_EMAIL, ADMIN_PASSWORD } from './global-setup';

test.describe.configure({ mode: 'serial' });
test.skip(({ isMobile }) => isMobile, 'Desktop flows');

const stamp = Date.now();

async function saveFirstTwo(page: Page) {
  await page.goto('/explore?status=open');
  const cards = page.getByRole('article');
  for (const i of [0, 1])
    await cards
      .nth(i)
      .getByRole('button', { name: /Save .* to My List/ })
      .click();
}

test('tracker: move a saved program across the board and tick documents', async ({ page }) => {
  await saveFirstTwo(page);
  await page.goto('/my-list');
  await page.getByRole('button', { name: 'Tracker board' }).click();
  const researching = page.getByRole('region', { name: /^Researching, 2$/ });
  await expect(researching).toBeVisible();
  const first = researching.getByRole('article').first();
  const name = (await first.getByRole('button').first().textContent())!.trim();
  await first.getByRole('combobox').selectOption('applied');
  await expect(page.getByRole('region', { name: /^Applied, 1$/ })).toContainText(name.slice(0, 20));

  await page
    .getByRole('region', { name: /^Applied, 1$/ })
    .getByRole('button')
    .first()
    .click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('CV (Europass or academic format)').check();
  await dialog.getByLabel('Notes').fill('Ask Prof. Rahman for LOR');
  await page.keyboard.press('Escape');
  await page.reload();
  await page.getByRole('button', { name: 'Tracker board' }).click();
  await expect(
    page.getByRole('region', { name: /^Applied, 1$/ }).getByText(/Docs 1\//),
  ).toBeVisible();
});

test('calendar lists upcoming deadlines and exports .ics', async ({ page }) => {
  await saveFirstTwo(page);
  await page.goto('/calendar');
  await expect(page.getByRole('radio', { name: /My List/ })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(page.locator('main ol > li').first()).toContainText(/Today|Tomorrow|In \d+ days/);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: /Add to calendar/ }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('flyms-deadlines-saved.ics');
  const text = await (
    await file.createReadStream()
  )
    .toArray()
    .then((c) => Buffer.concat(c).toString());
  expect(text).toContain('BEGIN:VCALENDAR');
  await page.getByRole('button', { name: 'Month' }).click();
  await expect(page.getByRole('button', { name: 'Next month' })).toBeVisible();
});

test('compare two programs side by side', async ({ page }) => {
  await page.goto('/explore?q=data%20science');
  const cards = page.getByRole('article');
  await cards.nth(0).getByLabel('Compare').check();
  await cards.nth(1).getByLabel('Compare').check();
  await page.getByRole('link', { name: 'Compare', exact: true }).last().click();
  await expect(page.getByRole('heading', { name: 'Compare programs' })).toBeVisible();
  await expect(page.getByRole('columnheader')).toHaveCount(3);
  await expect(page.getByRole('rowheader', { name: 'IELTS minimum' })).toBeVisible();
});

test('ask a question; submit a review; admin approves it and it is public', async ({ page }) => {
  await page.goto('/ask');
  await page.getByLabel('Your name').fill('E2E Asker');
  await page.getByLabel('Email').fill('asker@example.org');
  await page.getByLabel('Your question').fill(`Is the VPD needed for summer intake? ${stamp}`);
  await page.getByRole('button', { name: 'Send question' }).click();
  await expect(page.getByRole('heading', { name: /Your question was sent/ })).toBeVisible({
    timeout: 20_000,
  });

  await page.goto('/explore?q=tu%20berlin%20computer%20science');
  await page.getByRole('link', { name: 'M.Sc. Computer Science', exact: true }).first().click();
  await page.getByRole('button', { name: 'Write a review' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('radio', { name: '4 stars' }).click();
  await dialog.getByLabel('Display name').fill(`Reviewer ${stamp}`);
  await dialog.getByLabel(/Your experience/).fill('Great labs, heavy workload.');
  await dialog.getByRole('button', { name: 'Submit review' }).click();
  await expect(page.getByText('Your review will appear after moderation').first()).toBeVisible({
    timeout: 20_000,
  });

  await page.goto('/admin/login');
  await page.getByLabel('Email').fill(ADMIN_EMAIL);
  await page.getByLabel('Password').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('link', { name: /^Questions/ }).click();
  await expect(page.getByText(`Is the VPD needed for summer intake? ${stamp}`)).toBeVisible();
  await page.getByRole('link', { name: /^Reviews/ }).click();
  const card = page.getByRole('article').filter({ hasText: `Reviewer ${stamp}` });
  await card.getByRole('button', { name: 'Approve' }).click();
  await expect(card).toHaveCount(0); // left the pending queue
  await page.getByRole('link', { name: 'Audit log' }).click();
  await expect(page.getByText('review.set_status').first()).toBeVisible();

  await page.goto('/explore?q=tu%20berlin%20computer%20science');
  await page.getByRole('link', { name: 'M.Sc. Computer Science', exact: true }).first().click();
  await expect(page.getByText(`Reviewer ${stamp}`)).toBeVisible();
});
