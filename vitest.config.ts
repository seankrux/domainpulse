import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  plugins: [react() as any],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './tests/setup.ts',
    include: ['tests/unit/**/*.test.ts', 'tests/unit/**/*.test.tsx', 'tests/unit/**/*.spec.ts', 'tests/unit/**/*.spec.tsx'],
    exclude: ['tests/**/*.{gui,devtools,comprehensive,dashboard,automated_build_verify}.spec.ts', 'node_modules', 'dist', 'dist-site'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules', 'dist', 'dist-site', 'tests', '*.config.ts'],
      // Floors sit just under current coverage so a regression fails CI without
      // being noisy. The globs guard the security-critical module that
      // everything else trusts (SSRF guard) and the shared retry client.
      thresholds: {
        statements: 56,
        branches: 46,
        functions: 56,
        lines: 56,
        'api/_utils/ssrfGuard.ts': { statements: 70, branches: 65, lines: 70 },
        'services/apiClient.ts': { statements: 85, branches: 80, lines: 85 },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
