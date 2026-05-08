/// <reference types="vitest" />
import { defineConfig, type Plugin } from 'vite';
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
  plugins: [cspPlugin()],
  test: {
    environment: 'happy-dom',
    exclude: [...configDefaults.exclude, 'e2e/**'],
  },
}));
