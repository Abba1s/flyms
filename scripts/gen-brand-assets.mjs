/**
 * Render the header emblem, full logo, favicon, PWA icons and Open Graph image from the brand
 * source apps/web/brand/LOGO_FINAL.png (emblem on top, wordmark below) with Playwright.
 * Usage: node scripts/gen-brand-assets.mjs
 */
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const web = fileURLToPath(new URL('../apps/web/', import.meta.url));
const pub = `${web}public/`;
const source = `data:image/png;base64,${readFileSync(`${web}brand/LOGO_FINAL.png`).toString('base64')}`;

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent('<html><body style="margin:0"></body></html>');

/** Crop boxes found from "ink" pixels: the emblem sits above the first blank band, the wordmark below. */
const boxes = await page.evaluate(async (src) => {
  const img = new Image();
  img.src = src;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const { data } = ctx.getImageData(0, 0, c.width, c.height);
  const ink = (x, y) => {
    const i = (y * c.width + x) * 4;
    return data[i + 3] > 40 && Math.min(data[i], data[i + 1], data[i + 2]) < 225;
  };
  const rowHasInk = (y) => {
    for (let x = 0; x < c.width; x++) if (ink(x, y)) return true;
    return false;
  };
  const bbox = (y0, y1) => {
    let minX = c.width,
      maxX = 0,
      minY = c.height,
      maxY = 0;
    for (let y = y0; y < y1; y++)
      for (let x = 0; x < c.width; x++)
        if (ink(x, y)) {
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
    return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
  };
  const all = bbox(0, c.height);
  // First run of 12+ blank rows inside the logo separates emblem from wordmark.
  let split = all.y + all.h,
    blank = 0;
  for (let y = all.y; y < all.y + all.h; y++) {
    blank = rowHasInk(y) ? 0 : blank + 1;
    if (blank === 12) {
      split = y - 11;
      break;
    }
  }
  return { all, mark: bbox(all.y, split) };
}, source);

/** Draw a crop of the source onto a canvas of the given size and return PNG bytes. */
async function render({ box, width, height, pad = 0, background = null }) {
  const b64 = await page.evaluate(
    async ({ src, box, width, height, pad, background }) => {
      const img = new Image();
      img.src = src;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = width;
      c.height = height;
      const ctx = c.getContext('2d');
      if (background) {
        ctx.fillStyle = background;
        ctx.fillRect(0, 0, width, height);
      }
      const scale = Math.min((width - pad * 2) / box.w, (height - pad * 2) / box.h);
      const w = box.w * scale,
        h = box.h * scale;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, box.x, box.y, box.w, box.h, (width - w) / 2, (height - h) / 2, w, h);
      return c.toDataURL('image/png').split(',')[1];
    },
    { src: source, box, width, height, pad, background },
  );
  return Buffer.from(b64, 'base64');
}

const { mark, all } = boxes;
const markRatio = mark.w / mark.h;
const out = {
  // Header emblem: shown at 40 px tall, rendered at 3x.
  'logo-mark.png': { box: mark, width: Math.round(120 * markRatio), height: 120 },
  'logo-full.png': { box: all, width: 480, height: Math.round((480 * all.h) / all.w) },
  'favicon-64.png': { box: mark, width: 64, height: 64, pad: 2, background: '#FFFFFF' },
  'icon-192.png': { box: mark, width: 192, height: 192, pad: 12, background: '#FFFFFF' },
  'icon-512.png': { box: mark, width: 512, height: 512, pad: 32, background: '#FFFFFF' },
  // Maskable icons keep the logo inside the 80% safe zone.
  'icon-maskable-512.png': { box: mark, width: 512, height: 512, pad: 80, background: '#FFFFFF' },
  'apple-touch-icon.png': { box: mark, width: 180, height: 180, pad: 12, background: '#FFFFFF' },
};
for (const [name, opts] of Object.entries(out)) writeFileSync(`${pub}${name}`, await render(opts));

const fullData = `data:image/png;base64,${(await render(out['logo-full.png'])).toString('base64')}`;
const og = `<html><head><style>
  body{margin:0;width:1200px;height:630px;font-family:'Plus Jakarta Sans','Inter',system-ui,sans-serif;
    background:#FFFFFF;display:flex;align-items:center;gap:56px;padding:0 72px;box-sizing:border-box}
  img{width:420px;flex:none}
  .copy{display:flex;flex-direction:column;gap:28px}
  h1{margin:0;font-size:54px;line-height:1.1;color:#111827;letter-spacing:-1px}
  h1 span{color:#4338CA}
  .pill{display:inline-flex;gap:12px;align-items:center;font-size:24px;font-weight:600;color:#15803D;
    background:rgba(21,128,61,.12);padding:10px 22px;border-radius:999px;align-self:flex-start}
  .dot{width:14px;height:14px;border-radius:50%;background:#15803D}
</style></head><body>
  <img src="${fullData}" alt=""/>
  <div class="copy">
    <h1>Master’s programs in Germany — see where admissions are <span>open today</span>.</h1>
    <div class="pill"><span class="dot"></span>Every field · Map · Deadlines · SOP writer</div>
  </div>
</body></html>`;
await page.setViewportSize({ width: 1200, height: 630 });
await page.setContent(og);
await page.screenshot({ path: `${pub}og.png` });
await browser.close();
console.log(`Wrote logo, icons and og.png to apps/web/public (emblem ${mark.w}x${mark.h})`);
