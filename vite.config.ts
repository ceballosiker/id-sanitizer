/// <reference types="vitest" />
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { configDefaults } from 'vitest/config';

const csp = [
  // Block everything by default; each directive below is an explicit allow.
  "default-src 'self'",
  // Uploaded images render via blob: URLs (FileReader / createObjectURL).
  // data: keeps the door open for small inline images (favicons-as-data, etc.).
  "img-src 'self' blob: data:",
  // No remote scripts; no inline scripts (Vite production output uses external <script src>).
  "script-src 'self'",
  // No inline styles either — CSS bundles to external files.
  "style-src 'self'",
  // The whole point: this app must never make network requests at runtime.
  "connect-src 'none'",
  // System fonts only — no Google Fonts or remote font CDNs.
  "font-src 'self'",
  // Allow the service worker script to load (registered in main.ts via vite-plugin-pwa).
  // The SW operates with no CSP restrictions on its own fetches (its CSP comes from
  // its own response headers, not the page's), which is what makes precaching work.
  "worker-src 'self'",
  // No <object>/<embed>/<applet>.
  "object-src 'none'",
  // <base href> can only point to same origin.
  "base-uri 'self'",
  // We have no <form> elements; lock down submissions just in case.
  "form-action 'none'",
  // No-effect via <meta> (header-only directive) but documents intent;
  // becomes enforceable once the service worker (#14) serves cached responses with headers.
  "frame-ancestors 'none'",
].join('; ');

const cspPlugin = (): Plugin => ({
  name: 'inject-csp',
  apply: 'build',
  transformIndexHtml(html) {
    return html.replace(
      '<meta charset="UTF-8" />',
      `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${csp}" />`,
    );
  },
});

export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? '/id-sanitizer/' : '/',
  plugins: [
    cspPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: null,
      manifest: {
        name: 'ID Sanitizer',
        short_name: 'ID Sanitizer',
        description:
          'Redact personal info from ID images. Runs entirely in your browser; nothing leaves your device.',
        theme_color: '#1a1612',
        background_color: '#f3ede1',
        display: 'standalone',
        scope: '/id-sanitizer/',
        start_url: '/id-sanitizer/',
        lang: 'en',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,webmanifest}'],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: {
    environment: 'happy-dom',
    exclude: [...configDefaults.exclude, 'e2e/**'],
  },
}));
