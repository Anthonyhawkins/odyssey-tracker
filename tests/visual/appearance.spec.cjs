const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const reference = require('../../docs/screenshots/capture-metadata.json');
const referenceDir = path.resolve(__dirname, '../../docs/screenshots');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');

test('compare all accepted desktop and narrow captures without replacing references', async ({ page, browser }, info) => {
  expect(browser.version(), 'Use PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH to select the reference Chromium build').toBe(reference.browser);
  const errors = [], comparisons = [], measurements = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('requestfailed', (request) => errors.push(request.url() + ': ' + request.failure()?.errorText));
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.Alpine && getComputedStyle(document.querySelector('aside')).display === 'flex');
  await page.getByRole('button', { name: 'Load example', exact: true }).click();
  await page.waitForSelector('[data-group="n18"]');
  await page.evaluate(() => { Alpine.$data(document.body).notice = ''; });
  const settle = () => page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  async function compare(name, bytes) {
    const file = name + '.png', original = fs.readFileSync(path.join(referenceDir, file));
    fs.writeFileSync(info.outputPath(file), bytes);
    const previousErrors = info.errors.length;
    expect.soft(bytes, name).toMatchSnapshot(file);
    comparisons.push({ file, withinTolerance: info.errors.length === previousErrors, identicalPNG: hash(original) === hash(bytes), referenceSHA256: hash(original), currentSHA256: hash(bytes) });
    expect(hash(fs.readFileSync(path.join(referenceDir, file)))).toBe(hash(original));
  }
  async function shot(name) { await settle(); await compare(name, await page.screenshot()); }
  async function center(selector) {
    await page.evaluate((sel) => { const a = Alpine.$data(document.body); a.setZoom(1); document.querySelector(sel).scrollIntoView({ block: 'center', inline: 'center' }); }, selector);
    await settle();
  }
  async function measure(label) {
    measurements.push(await page.evaluate((label) => {
      const a = Alpine.$data(document.body), r = a.$refs.canvas.getBoundingClientRect();
      return { label, viewport: { width: innerWidth, height: innerHeight }, overview: a.summaryExpanded, zoom: a.zoom,
        graph: { width: a.graphWidth, height: a.graphHeight }, canvas: { width: r.width, height: r.height, left: r.left, top: r.top },
        document: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight }, cards: document.querySelectorAll('[data-card]').length,
        groups: [...document.querySelectorAll('[data-group]')].map((g) => ({ id: g.dataset.group, width: g.offsetWidth, height: g.offsetHeight, scrollWidth: g.querySelector('[data-group-scroll]').scrollWidth, clientWidth: g.querySelector('[data-group-scroll]').clientWidth })) };
    }, label));
  }
  await measure('desktop-expanded'); await shot('desktop-overview-expanded');
  await page.getByRole('button', { name: 'Hide overview & metrics', exact: false }).click(); await settle();
  await measure('desktop-collapsed'); await shot('desktop-overview-collapsed');
  await page.getByRole('button', { name: 'Fit all', exact: true }).click(); await shot('desktop-full-map-fit');
  await center('[data-group="n4"]'); await shot('desktop-main-group');
  await center('[data-group="n18"]'); await shot('desktop-observability-group');
  await center('[data-position="n29"]'); await shot('desktop-nested-branch');
  await center('.merge-label'); await shot('desktop-merge-node');
  await center('[data-position="n16"]'); await shot('desktop-undefined-card');
  await center('[data-position="n19"]'); await page.locator('[data-action="edit"][data-id="n19"]').click();
  // Normalize only the unsaved log-entry draft timestamp to the original capture.
  // Existing saved card/log history and all reference PNGs are untouched.
  await page.evaluate(() => { Alpine.$data(document.body).logDraft.timestamp = '2026-10-12T13:17'; });
  await page.locator('.notes-toggle').nth(0).click(); await shot('desktop-notes-drawer');
  await page.locator('.notes-toggle').nth(1).click(); await shot('desktop-log-drawer');
  await page.getByRole('button', { name: 'Cancel', exact: true }).last().click();
  await page.evaluate(() => { const a = Alpine.$data(document.body); a.setZoom(1); a.notice = ''; }); await settle();
  const clip = await page.evaluate(() => {
    const tree = document.getElementById('questTree'), clone = tree.cloneNode(true); clone.id = 'baseline-unclipped-map';
    Object.assign(clone.style, { position: 'absolute', left: '0px', top: '0px', zIndex: '9999', margin: '0', backgroundColor: '#f5f7fb', backgroundImage: 'radial-gradient(#d9e1ed .95px,transparent .95px)', backgroundSize: '19px 19px' });
    document.body.appendChild(clone); return { x: 0, y: 0, width: tree.offsetWidth, height: tree.offsetHeight };
  });
  const cdp = await page.context().newCDPSession(page);
  const natural = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { ...clip, scale: 1 } });
  await compare('desktop-full-map-natural', Buffer.from(natural.data, 'base64'));
  await page.evaluate(() => document.getElementById('baseline-unclipped-map').remove());
  await page.setViewportSize({ width: 390, height: 844 });
  // Match the original resize debounce before reading the new measured layout.
  await page.waitForTimeout(300);
  await page.evaluate(() => { const a = Alpine.$data(document.body); a.summaryExpanded = true; a.setZoom(1); a.centerMainline(); a.$refs.canvas.scrollTop = 0; });
  await settle(); await measure('narrow-expanded'); await shot('narrow-overview-expanded');
  await page.evaluate(() => Alpine.$data(document.body).$refs.canvas.scrollIntoView({ block: 'end' })); await shot('narrow-expanded-map-scrolled');
  await page.getByRole('button', { name: 'Hide overview & metrics', exact: false }).click(); await settle();
  await measure('narrow-collapsed'); await shot('narrow-overview-collapsed');
  await center('[data-group="n18"]'); await shot('narrow-observability-group');
  await page.evaluate(() => { const a = Alpine.$data(document.body), g = document.querySelector('[data-group="n18"]'); a.$refs.canvas.scrollTop = parseFloat(g.style.top) - 40; }); await shot('narrow-group-header');
  await page.evaluate(() => { const s = document.querySelector('[data-group-scroll="n18"]'); s.scrollLeft = s.scrollWidth; }); await shot('narrow-group-scrolled');
  await page.evaluate(() => document.querySelector('[data-group-endpoint="n18"]').scrollIntoView({ block: 'center', inline: 'center' })); await shot('narrow-group-endpoint');
  await page.evaluate(() => { const a = Alpine.$data(document.body); a.openEdit('n19'); a.logDraft.timestamp = '2026-10-12T13:17'; });
  await page.locator('.notes-toggle').nth(0).click(); await shot('narrow-notes-drawer');
  await page.getByRole('button', { name: 'Close notes drawer', exact: true }).click();
  await page.locator('.notes-toggle').nth(1).click(); await shot('narrow-log-drawer');
  expect.soft(measurements).toEqual(reference.measurements); expect(errors).toEqual([]);
  const sourceSHA256 = hash(fs.readFileSync(path.resolve(__dirname, '../../index.html')));
  fs.writeFileSync(info.outputPath('visual-comparison.json'), JSON.stringify({ baseline: reference.baseline, sourceSHA256, browser: browser.version(), draftTimestamp: '2026-10-12T13:17', threshold: 0.2, maxDiffPixels: 0, comparisons, errors, measurements }, null, 2) + '\n');
});
