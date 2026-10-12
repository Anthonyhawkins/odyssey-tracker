const base = require('./playwright.config.cjs');
module.exports = { ...base, testDir: './tests/local', outputDir: 'test-results-local', use: { ...base.use, baseURL: 'http://127.0.0.1:8766' },
  webServer: { command: 'node tests/local-server.cjs', url: 'http://127.0.0.1:8766/health', reuseExistingServer: false, timeout: 10_000 } };
