import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react() as any],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './tests/setup.ts',
    include: ['tests/**/*.spec.ts', 'tests/**/*.spec.tsx', 'tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    exclude: ['tests/**/*.gui.spec.ts', 'tests/**/*.gui.spec.tsx', 'node_modules', 'dist', 'dist-site'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules', 'dist', 'dist-site', 'tests', '*.config.ts'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
