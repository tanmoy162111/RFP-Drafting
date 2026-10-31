import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.db.test.ts'],
    globalSetup: ['src/db/global-setup.ts'],
    fileParallelism: false,
    testTimeout: 20000,
  },
});
