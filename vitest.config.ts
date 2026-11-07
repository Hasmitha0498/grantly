import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'jsdom',
    include: ['src/tests/**/*.test.{ts,tsx}'],
    exclude: ['node_modules', 'e2e/**', '**/e2e/**'],
    setupFiles: ['src/tests/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      // Only test code and type-only declarations are excluded.
      exclude: ['src/tests/**', 'src/domain/types.ts'],
      reporter: ['text', 'text-summary', 'json-summary'],
      thresholds: {
        'src/domain/**': { statements: 90, branches: 85, functions: 90, lines: 90 },
      },
    },
  },
});
