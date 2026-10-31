import { expect, test } from '@playwright/test';

// Runs against SOP_MOCK=1 (no API key locally): the draft is a labelled template, not AI text.
test.describe.configure({ mode: 'serial' });
test.skip(({ isMobile }) => isMobile, 'SOP flow runs on desktop');

test('write an SOP from a program page: wizard → draft → rewrite → export', async ({ page }) => {
  await page.goto('/explore?q=tu%20berlin%20computer%20science');
  await page.getByRole('link', { name: 'M.Sc. Computer Science', exact: true }).first().click();
  await page.getByRole('link', { name: 'Write SOP' }).click();

  // Prefilled from the program: lands on "About you".
  await expect(page.getByRole('heading', { name: 'About you' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('This answer is needed for a good draft.').first()).toBeVisible();
  await expect(page.locator('[aria-invalid="true"]').first()).toBeFocused();

  const answers: Record<string, string> = {
    'Your bachelor’s degree and university': 'B.Sc. CSE, BUET, 2024',
    'Your grades': '3.62 / 4.00',
    'Final-year project or thesis': 'Bangla speech recognition with wav2vec',
    '1–3 projects or experiences': 'Built a ride-sharing backend serving 10k users',
    'Technical skills': 'Python, PyTorch, SQL',
    'Why this specialization?': 'My thesis showed me how much data quality matters',
    'Why Germany?': 'Strong AI research and no tuition',
    'Goal right after the master’s': 'ML engineer at a German startup',
    'Long-term goal (5–10 years)': 'Lead an AI team in Dhaka',
  };
  for (const [label, value] of Object.entries(answers)) {
    await page.getByRole('textbox', { name: label, exact: true }).fill(value);
  }
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Review' })).toBeVisible();
  await page.getByRole('radio', { name: /Short/ }).click();
  await page.getByRole('button', { name: 'Generate draft' }).click();

  // Streamed draft lands in the editor, section by section.
  const opening = page.getByRole('textbox', { name: 'Opening' });
  await expect(opening).toHaveValue(/MOCK DRAFT/, { timeout: 20_000 });
  await expect(page.getByRole('textbox', { name: 'Closing' })).toHaveValue(
    /\[add a concrete example/,
    {
      timeout: 20_000,
    },
  );
  await expect(page.getByRole('tab', { name: /Hints \(\d+\)/ })).toBeVisible();
  await expect(page.getByText(/placeholders? to fill/)).toBeVisible();

  // Edit by hand, then rewrite one section.
  await opening.fill('In 2022 my thesis on Bangla speech recognition changed my plans.');
  const goals = page.getByRole('group', { name: 'Rewrite Career goals' });
  await goals.getByRole('button', { name: 'Shorter' }).click();
  await expect(page.getByRole('textbox', { name: 'Career goals' })).toHaveValue(/MOCK DRAFT/, {
    timeout: 20_000,
  });
  await expect(opening).toHaveValue(/Bangla speech recognition changed my plans/);
  await page.getByRole('tab', { name: /Versions/ }).click();
  await expect(page.getByText(/Before “Shorter” on Career goals/)).toBeVisible();

  // Export warns about placeholders, then downloads.
  await page.getByRole('button', { name: 'Word (.docx)' }).click();
  await expect(page.getByRole('dialog', { name: 'Placeholders left' })).toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export anyway' }).click();
  expect((await download).suggestedFilename()).toMatch(/^sop-.*\.docx$/);

  // Draft survives a reload and is listed on the SOP home.
  await page.goto('/sop');
  await expect(page.getByText(/M\.Sc\. Computer Science — TU Berlin/)).toBeVisible();
});
