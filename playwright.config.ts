import { defineConfig } from '@playwright/test';
import { E2E_PORT, E2E_URL } from './e2e/env';

export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  use: { baseURL: `http://127.0.0.1:${E2E_PORT}` },
  webServer: {
    command: `pnpm exec tsx e2e/prepare-db.ts && pnpm exec next build && pnpm exec next start -p ${E2E_PORT}`,
    url: `http://127.0.0.1:${E2E_PORT}`,
    timeout: 240_000,
    reuseExistingServer: false,
    env: { DATABASE_URL: E2E_URL },
  },
});
