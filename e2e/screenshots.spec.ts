import { test } from '@playwright/test';
// Manual visual check — run with: pnpm exec playwright test e2e/screenshots.spec.ts
const OUT = process.env.SHOTS_DIR ?? 'test-results/shots';
const pages = [
  ['home', '/'],
  ['explore', '/explore'],
  ['map', '/map'],
  ['map-berlin', '/map?status=all'],
  ['program', '/explore?q=tu%20berlin%20computer'],
] as const;
for (const theme of ['light', 'dark'] as const) {
  for (const [name, url] of pages) {
    test(`${name} ${theme}`, async ({ page }, info) => {
      await page.clock.setFixedTime(new Date('2026-11-01T10:00:00+01:00'));
      await page.addInitScript((t) => localStorage.setItem('flyms-theme', t), theme);
      await page.goto(url);
      // Leaflet fades tiles in using Date.now(), which the frozen clock stops.
      await page.addStyleTag({ content: '.leaflet-tile { opacity: 1 !important; }' });
      if (name === 'program')
        await page.getByRole('article').first().getByRole('link').first().click();
      if (name === 'map-berlin') {
        if (info.project.name === 'mobile')
          await page.getByRole('button', { name: /^List/ }).click();
        await page
          .getByRole('button', { name: /TU Berlin/ })
          .first()
          .click();
      }
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `${OUT}/${info.project.name}-${name}-${theme}.png` });
    });
  }
}
