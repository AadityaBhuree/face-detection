import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', '.next'],
    testTimeout: 15000,
    css: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.{test,spec}.{ts,tsx}', 'src/**/index.ts', 'src/test/**', 'node_modules'],
    },
    deps: {
      inline: [/@jeevandata\/shared-/],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@jeevandata/shared-types': path.resolve(
        __dirname,
        '../../packages/shared-types/src/index.ts',
      ),
      '@jeevandata/shared-schemas': path.resolve(
        __dirname,
        '../../packages/shared-schemas/src/index.ts',
      ),
      '@jeevandata/shared-utils': path.resolve(
        __dirname,
        '../../packages/shared-utils/src/index.ts',
      ),
    },
  },
});
