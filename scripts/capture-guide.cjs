// Capture the real local application using temporary data and the built-in example.
const { chromium } = require('@playwright/test');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createHash } = require('node:crypto');

(async () => {
  const root = path.resolve(__dirname, '..');
  const data = fs.mkdtempSync(path.join(os.tmpdir(), 'odysseus-guide-'));
  const output = path.join(root, 'docs/guide-images');
  fs.mkdirSync(output, { recursive: true });
  const child = spawn(path.join(root, 'dist/odysseus-tracker' + (process.platform === 'win32' ? '.exe' : '')), ['--data-dir', data, '--listen', '127.0.0.1:0'], { cwd: root });
  let browser;
  const issues = [], captures = [];
  try {
    const url = await new Promise((resolve, reject) => {
      let stdout = '', stderr = '';
      const timer = setTimeout(() => reject(Error('Local server startup timed out: ' + stderr)), 10000);
      child.once('error', error => { clearTimeout(timer); reject(error); });
      child.once('exit', code => { clearTimeout(timer); reject(Error('Local server exited ' + code + ': ' + stderr)); });
      child.stderr.on('data', chunk => { stderr += chunk; });
      child.stdout.on('data', chunk => { stdout += chunk; const match = stdout.match(/Open (http:\/\/[^ ]+)/); if (match) { clearTimeout(timer); resolve(match[1]); } });
    });
    browser = await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {});
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'en-US', timezoneId: 'America/Chicago' });
    const page = await context.newPage();
    page.on('pageerror', error => issues.push(error.message));
    page.on('requestfailed', request => issues.push(request.url() + ': ' + request.failure()?.errorText));
    await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : (issues.push('External request: ' + route.request().url()), route.abort()));
    const settle = async () => {
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await page.waitForTimeout(180); // Finish the app's short paint transitions.
    };
    async function shot(name, description, selector) {
      await page.evaluate(() => { Alpine.$data(document.body).notice = ''; });
      await page.mouse.move(2, 2); await settle();
      const file = name + '.png';
      if (selector) await page.locator(selector).screenshot({ path: path.join(output, file) });
      else await page.screenshot({ path: path.join(output, file) });
      captures.push({ file, description, sha256: createHash('sha256').update(fs.readFileSync(path.join(output, file))).digest('hex') });
      process.stdout.write('Captured ' + file + '\n');
    }
    async function center(selector) {
      await page.evaluate(selector => { const app = Alpine.$data(document.body); app.setZoom(1); document.querySelector(selector).scrollIntoView({ block: 'center', inline: 'center' }); }, selector);
      await settle();
    }
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.Alpine && getComputedStyle(document.querySelector('.quest-map-panel')).borderRadius === '16px');
    await shot('welcome', 'First-run welcome and getting-started guide');
    await page.getByRole('button', { name: 'Get started', exact: true }).click();
    await page.locator('#taskTitle').fill('Launch enterprise developer portal');
    await shot('new-project', 'New project editor before creation');
    await page.getByRole('button', { name: 'Cancel', exact: true }).last().click();
    await page.getByRole('button', { name: 'Load example', exact: true }).click();
    await page.waitForSelector('[data-group="n18"]');
    await page.waitForFunction(() => Alpine.$data(document.body).saveState === 'Saved to file');
    await shot('overview', 'Built-in project overview, metrics, and quest-map controls');
    await page.getByRole('button', { name: 'Hide overview & metrics', exact: false }).click();
    await page.evaluate(() => { const a = Alpine.$data(document.body); a.setZoom(0.5); a.centerMainline(); });
    await shot('quest-map', 'Main questline and branching work at 50% zoom');
    await center('[data-group="n18"]');
    await shot('parallel-group', 'Parallel objectives on the observability side questline');
    await center('[data-position="n19"]');
    await page.locator('[data-action="edit"][data-id="n19"]').click();
    await page.locator('.card-detail-panel').evaluate(element => { element.scrollTop = 0; });
    await shot('card-details', 'Card editor with title, status, questline color, and work category');
    await page.locator('.notes-toggle').nth(0).click();
    await shot('notes', 'Plain-text notes alongside card details');
    await page.locator('.notes-toggle').nth(1).click();
    await shot('log', 'Timestamped progress log alongside card details');
    await page.getByRole('button', { name: 'Cancel', exact: true }).last().click();
    await page.getByRole('button', { name: 'Contact bank', exact: true }).click();
    await shot('contacts', 'Shared project contact bank');
    await page.getByRole('button', { name: 'Close contact bank', exact: true }).click();
    await page.getByRole('button', { name: 'Tag bank', exact: true }).click();
    await shot('tags', 'Shared colored tag bank');
    await page.getByRole('button', { name: 'Close tag bank', exact: true }).click();
    await page.getByRole('button', { name: 'Insights & metrics', exact: false }).click();
    await shot('insights', 'Project insights and progress metrics');
    await page.locator('[x-show="showInsights"]').getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByRole('button', { name: 'Projects', exact: true }).click();
    // Mask only the random temporary data-folder label; it is not a product feature.
    await page.locator('[x-text="dataFolder"]').evaluate(element => { element.textContent = 'Application data folder / projects'; });
    await shot('projects', 'Local project library and file actions');
    await page.getByRole('button', { name: 'Close projects', exact: true }).click();
    await page.getByLabel('Background', { exact: true }).selectOption('backdrop');
    await page.evaluate(() => new Promise((resolve, reject) => { const image = new Image(); image.onload = resolve; image.onerror = reject; image.src = 'map.png'; }));
    await page.evaluate(() => { const a = Alpine.$data(document.body); a.setZoom(0.5); a.centerMainline(); });
    await shot('backdrop', 'Optional embedded map backdrop');
    if (issues.length) throw Error(issues.join('\n'));
    fs.writeFileSync(path.join(output, 'capture-metadata.json'), JSON.stringify({ browser: browser.version(), viewport: { width: 1440, height: 1000 }, source: 'Local Go application; built-in example only', captures }, null, 2) + '\n');
  } finally {
    if (browser) await browser.close();
    if (child.exitCode === null && child.pid) await new Promise(resolve => { child.once('exit', resolve); child.kill('SIGTERM'); });
    fs.rmSync(data, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
