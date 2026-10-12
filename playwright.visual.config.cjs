const base = require('./playwright.config.cjs');
module.exports = {
  ...base,
  testDir: './tests/visual',
  timeout: 90_000,
  updateSnapshots: 'none',
  snapshotPathTemplate: '{testDir}/../../docs/screenshots/{arg}{ext}',
  // Playwright's standard perceptual color threshold ignores tiny paint/
  // anti-alias differences, while allowing zero pixels above that threshold.
  expect: { ...base.expect, toMatchSnapshot: { threshold: 0.2, maxDiffPixels: 0 } }
};
