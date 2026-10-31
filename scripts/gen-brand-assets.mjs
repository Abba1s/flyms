/**
 * Render PWA icons and the Open Graph image from apps/web/public/logo.svg with Playwright.
 * Usage: node scripts/gen-brand-assets.mjs
 */
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const pub = fileURLToPath(new URL('../apps/web/public/', import.meta.url));
const logo = readFileSync(`${pub}logo.svg`, 'utf8');
const logoData = `data:image/svg+xml;base64,${Buffer.from(logo).toString('base64')}`;

const icon = (size, padding) => `<html><body style="margin:0;background:#4338CA">
  <div style="width:${size}px;height:${size}px;display:grid;place-items:center;background:#4338CA">
    <img src="${logoData}" style="width:${size - padding * 2}px;height:${size - padding * 2}px"/></div></body></html>`;

const og = `<html><head><style>
  body{margin:0;width:1200px;height:630px;font-family:'Plus Jakarta Sans','Inter',system-ui,sans-serif;
    background:linear-gradient(135deg,#F7F8FB 0%,#EEF1F6 100%);display:flex;align-items:center}
  .wrap{padding:0 90px;display:flex;flex-direction:column;gap:28px}
  .brand{display:flex;align-items:center;gap:20px;font-size:44px;font-weight:800;color:#111827}
  h1{margin:0;font-size:68px;line-height:1.08;color:#111827;letter-spacing:-1.5px;max-width:900px}
  h1 span{color:#4338CA}
  .pill{display:inline-flex;gap:12px;align-items:center;font-size:28px;font-weight:600;color:#15803D;
    background:rgba(21,128,61,.12);padding:12px 24px;border-radius:999px;align-self:flex-start}
  .dot{width:16px;height:16px;border-radius:50%;background:#15803D}
</style></head><body><div class="wrap">
  <div class="brand"><img src="${logoData}" width="72" height="72"/>FlyMS</div>
  <h1>Master’s programs in Germany — see where admissions are <span>open today</span>.</h1>
  <div class="pill"><span class="dot"></span>Every field · Map · Deadlines · SOP writer</div>
</div></body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage();
const shots = [
  ['icon-192.png', 192, icon(192, 0)],
  ['icon-512.png', 512, icon(512, 0)],
  // Maskable icons keep the logo inside the 80% safe zone.
  ['icon-maskable-512.png', 512, icon(512, 64)],
  ['apple-touch-icon.png', 180, icon(180, 0)],
];
for (const [name, size, html] of shots) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(html);
  await page.screenshot({ path: `${pub}${name}`, omitBackground: false });
}
await page.setViewportSize({ width: 1200, height: 630 });
await page.setContent(og);
await page.screenshot({ path: `${pub}og.png` });
await browser.close();
console.log('Wrote icons and og.png to apps/web/public');
