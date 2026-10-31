import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const ROUTES = [
  '/',
  '/explore',
  '/map',
  '/programs/tu-berlin-computer-science-msc',
  '/universities/tu-berlin',
  '/my-list',
  '/calendar',
  '/compare',
  '/costs',
  '/sop',
  '/sop/new',
  '/contribute',
  '/ask',
  '/faq',
  '/settings',
  '/privacy',
  '/about',
  '/admin/login',
];

test.skip(({ isMobile }) => isMobile, 'Scanned once, on desktop');

for (const theme of ['light', 'dark'] as const) {
  for (const route of ROUTES) {
    test(`a11y ${theme} ${route}`, async ({ page }) => {
      await page.addInitScript((t) => localStorage.setItem('flyms-theme', t), theme);
      await page.goto(route);
      await page.waitForLoadState('load');
      await page.waitForTimeout(800);
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        // Map tiles are third-party imagery; Leaflet's own controls are covered below.
        .exclude('.leaflet-tile-pane')
        .analyze();
      const serious = results.violations.filter(
        (v) => v.impact === 'serious' || v.impact === 'critical',
      );
      const summary = serious.map(
        (v) =>
          `${v.id} (${v.impact}): ${v.help}\n    ${v.nodes
            .slice(0, 3)
            .map((n) => n.target.join(' '))
            .join('\n    ')}`,
      );
      expect(summary, summary.join('\n')).toEqual([]);
    });
  }
}
