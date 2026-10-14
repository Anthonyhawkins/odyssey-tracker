const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const { createHash } = require('node:crypto');
const baseline = require('../fixtures/baseline-v1.json');

async function prepare(page, embedded = false) {
  await page.context().addInitScript(() => { window.print = () => { window.printCalls = (window.printCalls || 0) + 1; }; });
  await page.addInitScript(saved => localStorage.setItem('sidequests-v1', JSON.stringify(saved)), baseline);
  await page.goto(embedded ? '/embed' : '/');
  const app = embedded ? page.frames().find(frame => frame.parentFrame()) : page;
  if (embedded) { await app.waitForFunction(() => !!window.Alpine); await app.evaluate(() => Alpine.$data(document.body).loadDemo()); }
  await expect(app.locator('[data-card]')).toHaveCount(26);
  return app;
}
async function state(app) {
  const result = await app.evaluate(() => {
    const a = Alpine.$data(document.body);
    return { cardCount: Object.keys(a.nodes).length, snapshot: a.snapshot(), last: a.lastSnapshot, undo: JSON.stringify(a.undoStack), expanded: JSON.stringify(a.expandedCards), zoom: a.zoom, storage: a.memoryOnly ? null : localStorage.getItem('sidequests-v1'), paths: [...document.querySelectorAll('.quest-links path')].map(p => p.getAttribute('d')), scroll: [a.$refs.canvas.scrollLeft, a.$refs.canvas.scrollTop] };
  });
  for (const key of ['snapshot', 'last', 'undo', 'expanded', 'storage']) if (typeof result[key] === 'string') result[key] = createHash('sha256').update(result[key]).digest('hex');
  return result;
}
for (const embedded of [false, true]) {
  test(`PDF print snapshot expands cards without changing ${embedded ? 'embedded' : 'standalone'} live state`, async ({ page }, info) => {
    const app = await prepare(page, embedded);
    await app.evaluate(() => {
      const a = Alpine.$data(document.body);
      while (a.parallelGroups().groups.get('n18').members.length < 24) { a.openAdd('n18', 'parallel'); a.form.title = 'Print objective ' + a.seq; a.saveForm(); }
      a.setGroupDensity('n18', 'verycompact'); a.setZoom(0.6); a.expandedCards = { n2: true };
      a.openEdit('n19'); a.form.status = 'inreview'; a.form.category = 'Bug'; a.form.notes = 'Plain text <script>window.exportInjected=true</script>\nSecond line\n' + 'Detailed progress context.\n'.repeat(140) + 'Final note marker'; a.saveForm();
    });
    await app.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await app.evaluate(() => { Alpine.$data(document.body).$refs.canvas.scrollTo({ left: 300, top: 100, behavior: 'instant' }); });
    const before = await state(app), pop = page.waitForEvent('popup');
    await app.getByRole('button', { name: 'Export PDF', exact: false }).click(); const print = await pop;
    const errors = []; print.on('pageerror', error => errors.push(error.message));
    await print.waitForFunction(() => document.documentElement.dataset.printReady === 'true' || document.documentElement.dataset.printError === 'true');
    expect(await print.locator('html').getAttribute('data-print-error')).toBeNull();
    await expect(print.locator('[data-card]')).toHaveCount(before.cardCount);
    await expect(print.locator('#questTree .card-secondary-details[hidden]')).toHaveCount(0);
    await expect(print.locator('.compact-quest-card,.very-compact-quest-card')).toHaveCount(0);
    await expect(print.locator('[data-card="n19"] .quest-status')).toHaveText('In Review');
    await expect(print.locator('[data-card="n19"] svg.lucide-bug')).toHaveCount(1);
    await expect(print.locator('#questTree button,#questTree select')).toHaveCount(0);
    await expect(print.locator('.appendix')).toContainText('Plain text <script>window.exportInjected=true</script>');
    await expect(print.locator('.appendix')).toContainText('Investigating staging certificate validation failures');
    expect(await print.evaluate(() => window.exportInjected)).toBeUndefined();
    expect(await print.evaluate(() => window.opener)).toBeNull();
    expect(await print.evaluate(() => window.printCalls)).toBe(1);
    const geometry = await print.evaluate(() => {
      const group = document.querySelector('[data-group="n18"]'), bounds = group.getBoundingClientRect();
      const cards = [...group.querySelectorAll('[data-card]')].map(card => { const b = card.getBoundingClientRect(); return { left: b.left, right: b.right, top: b.top, bottom: b.bottom }; });
      return { bounds: { left: bounds.left, right: bounds.right, bottom: bounds.bottom }, cards, trunk: getComputedStyle(document.querySelector('.trunk')).strokeWidth, white: [...document.querySelectorAll('.quest-node circle')].every(c => getComputedStyle(c).fill === 'rgb(255, 255, 255)'), dependencies: document.querySelectorAll('.blocking-link').length };
    });
    for (const card of geometry.cards) { expect(card.left).toBeGreaterThanOrEqual(geometry.bounds.left); expect(card.right).toBeLessThanOrEqual(geometry.bounds.right); expect(card.bottom).toBeLessThanOrEqual(geometry.bounds.bottom); }
    expect(geometry.trunk).toBe('7px'); expect(geometry.white).toBe(true); expect(geometry.dependencies).toBeGreaterThan(0);
    const pdf = await print.pdf({ preferCSSPageSize: true, printBackground: true }); fs.writeFileSync(info.outputPath('expanded-quest-map.pdf'), pdf);
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-'); expect(pdf.length).toBeGreaterThan(30000);
    const boxes = [...pdf.toString('latin1').matchAll(/\/MediaBox\s*\[([^\]]+)\]/g)].map(match => match[1].trim().split(/\s+/).map(Number));
    expect(boxes.length).toBeGreaterThanOrEqual(3); expect(boxes[0][2]).toBeGreaterThan(2000); expect(boxes.some(box => Math.abs(box[2] - 595) < 2 && Math.abs(box[3] - 842) < 2)).toBe(true);
    await print.emulateMedia({ media: 'print' }); await expect(print.locator('.print-toolbar')).toBeHidden();
    await print.emulateMedia({ media: 'screen' });
    await print.getByRole('button', { name: 'Print / Save as PDF', exact: true }).click(); expect(await print.evaluate(() => window.printCalls)).toBe(2);
    await print.close(); expect(await state(app)).toEqual(before); expect(errors).toEqual([]);
  });
}

test('PDF export protects open drafts and reports blocked popup', async ({ page }) => {
  const app = await prepare(page);
  await app.locator('[data-action="edit"][data-id="n19"]').click(); await app.locator('#taskTitle').fill('Unsaved draft');
  const before = await state(app);
  await app.evaluate(() => Alpine.$data(document.body).exportPDF());
  await expect(app.locator('.change-toast')).toContainText('Save or cancel');
  await expect(app.locator('#taskTitle')).toHaveValue('Unsaved draft'); expect(await state(app)).toEqual(before);
  await app.getByRole('button', { name: 'Cancel', exact: true }).last().click();
  await app.evaluate(() => { window.open = () => null; Alpine.$data(document.body).exportPDF(); });
  await expect(app.locator('.change-toast')).toContainText('Allow pop-ups');
  await app.evaluate(() => { window.open = () => { throw new DOMException('Blocked', 'SecurityError'); }; Alpine.$data(document.body).exportPDF(); });
  await expect(app.locator('.change-toast')).toContainText('prevents print windows');
});

test('oversized maps report an error instead of printing a clipped page', async ({ page }) => {
  const app = await prepare(page);
  await app.evaluate(() => { Alpine.$data(document.body).project.goal = 'Large project context\n'.repeat(1500); });
  await app.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const before = await state(app), opening = page.waitForEvent('popup');
  await app.getByRole('button', { name: 'Export PDF', exact: false }).click(); const print = await opening;
  await print.waitForFunction(() => document.documentElement.dataset.printError === 'true');
  await expect(print.locator('#print-status')).toContainText('too large');
  await expect(print.getByRole('button', { name: 'Print / Save as PDF', exact: true })).toBeDisabled();
  expect(await print.evaluate(() => window.printCalls)).toBeUndefined();
  await print.close(); expect(await state(app)).toEqual(before);
});
