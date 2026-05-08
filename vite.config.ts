/// <reference types="vitest" />
import { defineConfig } from 'vite';
import { configDefaults } from 'vitest/config';

export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? '/id-sanitizer/' : '/',
  test: {
    environment: 'happy-dom',
    exclude: [...configDefaults.exclude, 'e2e/**'],
  },
}));
