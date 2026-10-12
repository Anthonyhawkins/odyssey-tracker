const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:8765',
    viewport: { width: 1600, height: 1000 },
    locale: 'en-US', timezoneId: 'America/Chicago',
    trace: 'retain-on-failure', screenshot: 'only-on-failure',
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}
  },
  webServer: {
    command: 'node tests/serve.cjs',
    url: 'http://127.0.0.1:8765/health',
    reuseExistingServer: false,
    timeout: 10_000
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }]
});
