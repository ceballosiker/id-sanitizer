import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:4173/id-sanitizer/',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          // Skip the GPU and the software-rasterizer fallback. Both are
          // required: in nested-virt environments (Docker/WSL2) Chromium
          // falls through to the software rasterizer, which deadlocks on
          // shared-memory primitives across the env boundaries — hangs
          // page.screenshot() and canvas paints. Benign on real CI runners.
          args: ['--disable-gpu', '--disable-software-rasterizer'],
        },
      },
    },
  ],
  webServer: {
    command: 'npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
  },
});
