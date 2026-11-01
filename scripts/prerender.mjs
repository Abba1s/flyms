/**
 * Post-build SEO: write dist/programs/<slug>/index.html with program-specific <title>, meta
 * description, Open Graph tags and JSON-LD, plus sitemap.xml and robots.txt. The SPA then
 * hydrates as usual. If the API is unreachable, only robots.txt and a static sitemap are written.
 *
 * Env: SITE_URL (public origin, e.g. https://flyms.app), VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
 * (read from apps/web/.env.local when not set).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../apps/web/', import.meta.url));
const dist = `${root}dist/`;

function loadEnv() {
  const env = { ...process.env };
  for (const file of ['.env.local', '.env']) {
    if (!existsSync(root + file)) continue;
    for (const line of readFileSync(root + file, 'utf8').split('\n')) {
      const m = /^([A-Z_]+)=(.*)$/.exec(line.trim());
      if (m && !env[m[1]]) env[m[1]] = m[2];
    }
  }
  return env;
}

const env = loadEnv();
const SITE = (env.SITE_URL || 'http://localhost:4173').replace(/\/$/, '');
const API = env.VITE_SUPABASE_URL;
const KEY = env.VITE_SUPABASE_ANON_KEY;

const esc = (s) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );

const STATIC_ROUTES = [
  '/',
  '/explore',
  '/map',
  '/sop',
  '/calendar',
  '/costs',
  '/faq',
  '/contribute',
  '/ask',
  '/privacy',
  '/about',
];

async function fetchPrograms() {
  if (!API || !KEY) return null;
  try {
    // PostgREST returns at most 1,000 rows per request.
    const rows = [];
    for (let from = 0; ; from += 1000) {
      const res = await fetch(
        `${API}/rest/v1/v_public_program_detail?select=slug,name,university_name,city,summary,degree_type,teaching_language,official_url,field_name,intakes,tuition_fee_eur,updated_at&order=slug`,
        {
          headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Range: `${from}-${from + 999}` },
          signal: AbortSignal.timeout(30_000),
        },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const page = await res.json();
      rows.push(...page);
      if (page.length < 1000) return rows;
    }
  } catch (err) {
    console.warn(
      `[prerender] Could not load programs (${err.message}); writing static files only.`,
    );
    return null;
  }
}

function describe(p) {
  const language =
    { english: 'English-taught', german: 'German-taught', english_german: 'English/German' }[
      p.teaching_language
    ] ?? '';
  const next = (p.intakes ?? []).filter((i) => i.end).sort((a, b) => a.end.localeCompare(b.end))[0];
  const deadline = next ? ` Application deadline ${next.end} (${next.season} ${next.year}).` : '';
  const fee = p.tuition_fee_eur === 0 ? ' No tuition.' : '';
  return (
    (p.summary ||
      `${p.degree_type === 'Other' ? "Master's" : p.degree_type} ${p.name} at ${p.university_name}, ${p.city}. ${language} ${p.field_name} program.`) +
    deadline +
    fee
  );
}

function jsonLd(p, url) {
  const next = (p.intakes ?? []).filter((i) => i.end).sort((a, b) => a.end.localeCompare(b.end))[0];
  return {
    '@context': 'https://schema.org',
    '@type': 'EducationalOccupationalProgram',
    name: p.name,
    url,
    sameAs: p.official_url,
    educationalCredentialAwarded: p.degree_type === 'Other' ? "Master's degree" : p.degree_type,
    inLanguage: p.teaching_language === 'german' ? 'de' : 'en',
    provider: {
      '@type': 'CollegeOrUniversity',
      name: p.university_name,
      address: { '@type': 'PostalAddress', addressLocality: p.city, addressCountry: 'DE' },
    },
    ...(next ? { applicationDeadline: next.end } : {}),
  };
}

function pageFor(template, p) {
  const url = `${SITE}/programs/${p.slug}`;
  const title = `${p.name} · ${p.university_name} — Universal Travel and Education Consultancy`;
  const description = describe(p).slice(0, 300);
  const head = [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(description)}" />`,
    `<link rel="canonical" href="${esc(url)}" />`,
    `<meta property="og:title" content="${esc(title)}" />`,
    `<meta property="og:description" content="${esc(description)}" />`,
    `<meta property="og:url" content="${esc(url)}" />`,
    `<meta property="og:image" content="${esc(`${SITE}/og.png`)}" />`,
    `<script type="application/ld+json">${JSON.stringify(jsonLd(p, url)).replace(/</g, '\\u003c')}</script>`,
  ].join('\n    ');
  return template
    .replace(/<title>.*?<\/title>/s, '')
    .replace(/<meta name="description"[^>]*>/s, '')
    .replace(/<meta property="og:(title|description|image)"[^>]*>/gs, '')
    .replace('</head>', `    ${head}\n  </head>`);
}

const template = readFileSync(`${dist}index.html`, 'utf8');
const programs = await fetchPrograms();

if (programs) {
  for (const p of programs) {
    const dir = `${dist}programs/${p.slug}`;
    mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/index.html`, pageFor(template, p));
  }
}

const urls = [
  ...STATIC_ROUTES.map((r) => `  <url><loc>${esc(SITE + r)}</loc></url>`),
  ...(programs ?? []).map(
    (p) =>
      `  <url><loc>${esc(`${SITE}/programs/${p.slug}`)}</loc><lastmod>${String(p.updated_at).slice(0, 10)}</lastmod></url>`,
  ),
];
writeFileSync(
  `${dist}sitemap.xml`,
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`,
);
writeFileSync(
  `${dist}robots.txt`,
  `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /sop/\nDisallow: /settings\n\nSitemap: ${SITE}/sitemap.xml\n`,
);
console.log(
  `[prerender] ${programs ? programs.length : 0} program pages, sitemap with ${urls.length} URLs (site ${SITE})`,
);
