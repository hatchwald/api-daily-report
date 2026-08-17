import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      thresholds: { branches: 75, functions: 80, lines: 80, statements: 80 },
    },
    environment: 'node',
    include: ['apps/**/*.test.ts'],
  },
});
