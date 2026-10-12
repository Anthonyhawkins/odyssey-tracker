const { test, expect } = require('@playwright/test');
const fixture = require('../fixtures/baseline-v1.json');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

test.beforeEach(async ({ page }) => {
  const external = [], errors = [];
  await page.route('**/*', (route) => {
    if (new URL(route.request().url()).hostname !== '127.0.0.1') { external.push(route.request().url()); return route.abort(); }
    return route.continue();
  });
  page.on('pageerror', (error) => errors.push(error.message)); page.external = external; page.errors = errors;
});
test.afterEach(async ({ page }) => { expect(page.external).toEqual([]); expect(page.errors).toEqual([]); });

async function saved(page) { await expect(page.locator('[x-text="saveState"]')).toHaveText('Saved to file'); }
async function create(page, title) {
  await page.locator('#taskTitle').fill(title);
  await page.getByRole('button', { name: 'Create questline', exact: true }).click(); await saved(page);
}

test('offline first-run welcome, separate files, editing, reload, last selection and deletion', async ({ page }) => {
  await page.goto('/'); await expect(page.getByRole('heading', { name: 'Welcome to Odysseus Tracker' })).toBeVisible();
  await page.getByRole('button', { name: 'Get started', exact: true }).click(); await create(page, 'First offline project');
  expect(await page.evaluate(() => localStorage.getItem('sidequests-v1'))).toBeNull();
  await page.locator('[data-action="edit"][data-id="n1"]').click();
  await page.locator('.notes-toggle').nth(0).click(); await page.locator('#cardNotes').fill('Retain local notes\n<plain text>');
  await page.getByRole('button', { name: 'Close notes drawer', exact: true }).click();
  await page.getByRole('button', { name: 'Save changes', exact: true }).click(); await saved(page);
  await page.reload(); await expect(page.getByRole('heading', { name: 'Welcome to Odysseus Tracker' })).toBeHidden();
  expect(await page.evaluate(() => Alpine.$data(document.body).nodes.n1.notes)).toContain('Retain local notes');
  await page.getByRole('button', { name: 'Start new quest', exact: false }).click(); await create(page, 'Second project');
  await page.getByRole('button', { name: 'Projects', exact: true }).click();
  const library = page.getByRole('dialog', { name: 'Local projects' });
  await expect(library).toContainText('first-offline-project.json'); await expect(library).toContainText('second-project.json');
  await library.locator('div.border-t').filter({ hasText: 'First offline project' }).getByRole('button', { name: 'Open', exact: true }).click();
  await page.reload(); await expect(page.locator('#quest-overview-title')).toHaveText('First offline project');
  expect(await page.evaluate(() => Alpine.$data(document.body).nodes.n1.notes)).toContain('Retain local notes');
  await page.getByRole('button', { name: 'Projects', exact: true }).click();
  page.once('dialog', (dialog) => dialog.accept());
  await library.locator('div.border-t').filter({ hasText: 'Second project' }).getByRole('button', { name: 'Delete file', exact: true }).click();
  await expect(library).not.toContainText('second-project.json');
});

test('saved snapshot API is preserved and stale revisions retain live edits with a visible error', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => { const a = Alpine.$data(document.body); if (a.welcome) { await a.api('welcome', { method: 'POST' }); a.welcome = false; } });
  const token = await page.evaluate(() => odysseyBootstrap.token);
  const create = await page.request.post('/api/projects', { headers: { 'X-Odysseus-Token': token }, data: fixture });
  expect(create.status()).toBe(201); const entry = await create.json();
  await page.getByRole('button', { name: 'Projects', exact: true }).click();
  const library = page.getByRole('dialog', { name: 'Local projects' });
  await library.locator('div.border-t').filter({ hasText: entry.file }).getByRole('button', { name: 'Open', exact: true }).click();
  await expect(library).toBeHidden(); await expect(page.locator('[data-card]')).toHaveCount(26);
  const before = await page.evaluate(() => JSON.parse(Alpine.$data(document.body).snapshot()));
  for (const id of Object.keys(fixture.nodes)) {
    for (const [field, value] of Object.entries(fixture.nodes[id])) expect(before.nodes[id][field]).toEqual(value);
  }
  const external = { ...fixture, seq: 100 };
  const update = await page.request.put('/api/projects/' + entry.file, { headers: { 'X-Odysseus-Token': token, 'If-Match': entry.revision }, data: external });
  expect(update.status()).toBe(200);
  await page.locator('[data-action="edit"][data-id="n19"]').click(); await page.locator('#taskTitle').fill('In-memory conflict edit');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await expect(page.locator('[x-show="localMode && diskError"]')).toContainText('changed on disk');
  expect(await page.evaluate(() => Alpine.$data(document.body).nodes.n19.title)).toBe('In-memory conflict edit');
  const downloadPending = page.waitForEvent('download'); await page.locator('[x-show="localMode && diskError"]').getByRole('button', { name: 'Export JSON', exact: true }).click();
  const stream = await (await downloadPending).createReadStream(), chunks = []; for await (const chunk of stream) chunks.push(chunk);
  expect(JSON.parse(Buffer.concat(chunks).toString()).nodes.n19.title).toBe('In-memory conflict edit');
  const read = await page.request.get('/api/projects/' + entry.file, { headers: { 'X-Odysseus-Token': token } });
  expect((await read.json()).document.nodes.n19.title).toBe(fixture.nodes.n19.title);
});

test('failed file creation keeps editing usable and retry saves the latest in-memory content', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => { const a = Alpine.$data(document.body); if (a.welcome) { await a.api('welcome', { method: 'POST' }); a.welcome = false; } });
  await page.route('**/api/projects', (route) => route.request().method() === 'POST'
    ? route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Simulated disk write failure' }) }) : route.continue());
  await page.getByRole('button', { name: 'Start new quest', exact: false }).click();
  await page.locator('#taskTitle').fill('Unsaved file project');
  await page.getByRole('button', { name: 'Create questline', exact: true }).click();
  await expect(page.locator('[x-show="localMode && diskError"]')).toContainText('disk write failure');
  await page.locator('[data-action="edit"][data-id="n1"]').click(); await page.locator('#taskTitle').fill('Recovered saved project');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  expect(await page.evaluate(() => Alpine.$data(document.body).project.title)).toBe('Recovered saved project');
  await page.unroute('**/api/projects');
  await page.getByRole('button', { name: 'Retry save', exact: true }).click(); await saved(page);
  await page.reload(); await expect(page.locator('#quest-overview-title')).toHaveText('Recovered saved project');
});

test('copied binary runs away from the repository and reopens its last project after process restart', async ({ page }) => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'odysseus-portable-test-'));
  const binary = path.join(folder, process.platform === 'win32' ? 'tracker.exe' : 'tracker');
  fs.copyFileSync(path.resolve('dist/odysseus-tracker') + (process.platform === 'win32' ? '.exe' : ''), binary); fs.chmodSync(binary, 0o700);
  const data = path.join(folder, 'data');
  async function start() {
    const child = spawn(binary, ['--data-dir', data, '--listen', '127.0.0.1:0'], { cwd: folder });
    const url = await new Promise((resolve, reject) => {
      let output = ''; child.on('error', reject); child.on('exit', (code) => reject(Error('Server exited: ' + code)));
      child.stdout.on('data', (chunk) => { output += chunk; const match = output.match(/Open (http:\/\/[^ ]+)/); if (match) resolve(match[1]); });
    });
    return { child, url };
  }
  const stop = (child) => new Promise((resolve) => { child.once('exit', resolve); child.kill('SIGTERM'); });
  let running = await start();
  try {
    await page.goto(running.url); await page.getByRole('button', { name: 'Get started', exact: true }).click(); await create(page, 'Portable process project');
    const before = await page.evaluate(() => JSON.parse(Alpine.$data(document.body).snapshot()));
    await stop(running.child); running = await start(); await page.goto(running.url);
    await expect(page.locator('#quest-overview-title')).toHaveText('Portable process project');
    expect(await page.evaluate(() => JSON.parse(Alpine.$data(document.body).snapshot()))).toEqual(before);
    await expect(page.getByRole('heading', { name: 'Welcome to Odysseus Tracker' })).toBeHidden();
    expect(fs.readdirSync(path.join(data, 'projects'))).toEqual(['portable-process-project.json']);
    expect(fs.readFileSync(path.join(data, 'config.yaml'), 'utf8')).toContain('last_project: portable-process-project.json');
  } finally { await stop(running.child); }
});

test('rapid structural and content saves followed by Undo persist the latest placement and history', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(async () => { const a = Alpine.$data(document.body); if (a.welcome) { await a.api('welcome', { method: 'POST' }); a.welcome = false; } });
  await page.getByRole('button', { name: 'Start new quest', exact: false }).click(); await create(page, 'Queued Undo project');
  const expected = await page.evaluate(async () => {
    const a = Alpine.$data(document.body);
    a.openAdd('n1', 'next'); a.form.title = 'Queued objective'; a.saveForm();
    a.nodes.n2.notes = 'First content'; a.persist('First update');
    a.nodes.n2.notes = 'Second content'; a.persist('Second update'); a.undo();
    if (!await a.flushDisk()) throw Error(a.diskError);
    const disk = await a.api('projects/' + a.currentFile);
    return { live: JSON.parse(a.snapshot()), disk: disk.document };
  });
  expect(expected.disk).toEqual(expected.live);
  expect(expected.live.nodes.n1.children).toEqual(['n2']);
  expect(expected.live.nodes.n2.notes).toBe('First content');
  expect(expected.live.nodes.n2.created).toBeTruthy();
  await page.reload();
  expect(await page.evaluate(() => JSON.parse(Alpine.$data(document.body).snapshot()))).toEqual(expected.live);
});
