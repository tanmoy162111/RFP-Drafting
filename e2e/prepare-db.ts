import globalSetup from './global-setup';

// Playwright starts webServer before globalSetup, so the e2e database must exist before the app is probed.
globalSetup().then(
  () => process.exit(0),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
