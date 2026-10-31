import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

/** Large, rarely used chunks are cached on first use instead of at install time. */
const LAZY_CHUNKS = [
  '**/exceljs*',
  '**/jspdf*',
  '**/html2canvas*',
  '**/purify*',
  '**/index.es*',
  '**/docx*',
];

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon-64.png', 'apple-touch-icon.png', 'logo-mark.png'],
      manifest: {
        name: 'Universal Travel and Education Consultancy',
        short_name: 'UTEC',
        description:
          'Find master’s programs in Germany in any field, see where admissions are open now, and draft your Statement of Purpose.',
        theme_color: '#4338CA',
        background_color: '#F7F8FB',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        shortcuts: [
          {
            name: 'Open now (map)',
            url: '/map',
            icons: [{ src: '/icon-192.png', sizes: '192x192' }],
          },
          { name: 'My List', url: '/my-list', icons: [{ src: '/icon-192.png', sizes: '192x192' }] },
          { name: 'SOP writer', url: '/sop', icons: [{ src: '/icon-192.png', sizes: '192x192' }] },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        globIgnores: [
          ...LAZY_CHUNKS,
          'og.png',
          'logo-full.png',
          '**/*cyrillic*',
          '**/*greek*',
          '**/*vietnamese*',
        ],
        navigateFallback: '/index.html',
        // Admin pages and prerendered program pages are always fetched from the network.
        navigateFallbackDenylist: [/^\/admin/],
        runtimeCaching: [
          {
            urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith('/assets/'),
            handler: 'CacheFirst',
            options: { cacheName: 'lazy-assets', expiration: { maxEntries: 40 } },
          },
          {
            urlPattern: ({ url }) =>
              url.hostname.endsWith('tile.openstreetmap.org') ||
              url.pathname.match(/\/\d+\/\d+\/\d+(@2x)?\.png$/) !== null,
            handler: 'CacheFirst',
            options: {
              cacheName: 'map-tiles',
              expiration: { maxEntries: 600, maxAgeSeconds: 30 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
});
