const { test, expect } = require('@playwright/test');
const baseline = require('../fixtures/baseline-v1.json');
const legacy = require('../fixtures/legacy-owner.json');
const { assertGraph } = require('../helpers/app.cjs');

async function settle(page) {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
async function snapshot(page) {
  await settle(page); return page.evaluate(() => JSON.parse(Alpine.$data(document.body).snapshot()));
}
async function exportJSON(page, ui = page) {
  const pending = page.waitForEvent('download');
  await ui.getByRole('button', { name: 'Export JSON', exact: false }).click();
  const download = await pending, stream = await download.createReadStream(), chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  expect(download.suggestedFilename()).toMatch(/^odysseus-tracker-.*\.json$/);
  const exported = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  expect(Object.keys(exported).sort()).toEqual(['nodes', 'project']);
  return exported;
}
async function loadOnce(page, saved) {
  // Seeding once per tab allows a real reload to read edits rather than
  // accidentally replacing storage with the original fixture on every load.
  await page.addInitScript((value) => {
    if (!sessionStorage.getItem('compatibility-fixture-seeded')) {
      localStorage.setItem('sidequests-v1', JSON.stringify(value));
      sessionStorage.setItem('compatibility-fixture-seeded', 'yes');
    }
  }, saved);
  await page.goto('/', { waitUntil: 'networkidle' });
  await expect(page.locator('[data-card]')).toHaveCount(Object.keys(saved.nodes).length);
}

test.beforeEach(async ({ page }) => {
  const errors = []; page.on('pageerror', (error) => errors.push(error.message)); page.compatibilityErrors = errors;
});
test.afterEach(async ({ page }) => expect(page.compatibilityErrors).toEqual([]));

for (const [name, saved, id] of [['baseline', baseline, 'n19'], ['legacy', legacy, 'n2']]) {
  test(`${name} snapshot survives actual save/reload, downloaded export, Undo and another reload`, async ({ page }) => {
    await loadOnce(page, saved); const before = await snapshot(page); assertGraph(before);
    for (const [key, original] of Object.entries(saved.nodes)) {
      // Legacy migration adds ownerIds; browser layout may calculate mergeY.
      for (const [field, value] of Object.entries(original)) expect(before.nodes[key][field], `${key}.${field}`).toEqual(value);
    }
    await page.evaluate((key) => Alpine.$data(document.body).openEdit(key), id);
    await page.locator('.notes-toggle').nth(0).click();
    await page.locator('#cardNotes').fill('Compatibility update\nKeep <plain text> and all other fields.');
    await page.getByRole('button', { name: 'Close notes drawer', exact: true }).click();
    await page.getByRole('button', { name: 'Save changes', exact: true }).click();
    const changed = await snapshot(page); assertGraph(changed);
    const unedited = { ...changed.nodes[id] }; delete unedited.notes; delete unedited.updated;
    const original = { ...before.nodes[id] }; delete original.notes; delete original.updated;
    // Save already normalized absent optional fields in the accepted prototype.
    // Check those exact defaults while requiring every existing field to survive.
    original.blockedBy ??= ''; original.days ??= 0;
    original.status ??= original.done ? 'complete' : 'inprogress';
    original.log ??= []; original.tagIds ??= [];
    expect(unedited).toEqual(original); expect(changed.project).toEqual(before.project);
    expect(Object.keys(changed.nodes)).toEqual(Object.keys(before.nodes)); expect(changed.seq).toBe(before.seq);
    expect(await exportJSON(page)).toEqual({ project: changed.project, nodes: changed.nodes });
    await page.getByRole('button', { name: 'Undo', exact: false }).first().click();
    expect(await snapshot(page)).toEqual(before);
    await page.reload({ waitUntil: 'networkidle' }); expect(await snapshot(page)).toEqual(before);
    expect(await page.evaluate(() => Alpine.$data(document.body).undoStack.length)).toBe(0);
    await page.evaluate((key) => Alpine.$data(document.body).openEdit(key), id);
    await page.locator('#taskTitle').fill('Persistent compatibility edit');
    await page.getByRole('button', { name: 'Save changes', exact: true }).click();
    const persistent = await snapshot(page);
    await page.reload({ waitUntil: 'networkidle' }); expect(await snapshot(page)).toEqual(persistent);
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('sidequests-v1')));
    expect(Object.keys(stored).sort()).toEqual(['nodes', 'project', 'seq']);
    expect(await exportJSON(page)).toEqual({ project: persistent.project, nodes: persistent.nodes });
  });
}

test('old snapshot move/delete preserve full identity and banks through export, Undo and reload', async ({ page }) => {
  await loadOnce(page, baseline); const before = await snapshot(page);
  // Add content to an eligible leaf using the actual editor draft, rather than
  // changing the frozen fixture just to suit this mutation scenario.
  await page.evaluate(() => {
    const a = Alpine.$data(document.body); a.openEdit('n24');
    a.form.notes = 'Move and retain'; a.form.log = [{ id: 'compat-log', text: 'Historical progress', timestamp: '2026-10-06T12:00:00.000Z', createdAt: '2026-10-06T12:01:00.000Z' }];
    a.form.links = [{ label: 'Ticket', url: 'https://example.com/compatibility' }];
    a.assignPerson(a.project.contacts[0].id); a.assignTag(a.project.tags[0].id); a.saveForm();
  });
  const rich = await snapshot(page); assertGraph(rich);
  await page.evaluate(() => Alpine.$data(document.body).openEdit('n24'));
  await page.locator('.move-card-button').click(); await page.locator('#moveDestination').selectOption('group:n18');
  await page.getByRole('button', { name: 'Review move', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm move', exact: true }).click();
  const moved = await snapshot(page); assertGraph(moved);
  const content = (card) => Object.fromEntries(Object.entries(card).filter(([key]) => !['parent', 'isParallel', 'parallelOf'].includes(key)));
  expect(content(moved.nodes.n24)).toEqual(content(rich.nodes.n24)); expect(moved.project).toEqual(rich.project);
  expect(await exportJSON(page)).toEqual({ project: moved.project, nodes: moved.nodes });
  await page.getByRole('button', { name: 'Undo', exact: false }).first().click(); expect(await snapshot(page)).toEqual(rich);
  await page.evaluate(() => Alpine.$data(document.body).openEdit('n24'));
  await page.locator('.card-delete-section .card-delete-button').click();
  await page.locator('.delete-confirm').click(); const deleted = await snapshot(page); assertGraph(deleted);
  expect(deleted.nodes.n24).toBeUndefined(); expect(deleted.project).toEqual(rich.project);
  expect(await exportJSON(page)).toEqual({ project: deleted.project, nodes: deleted.nodes });
  await page.getByRole('button', { name: 'Undo', exact: false }).first().click(); expect(await snapshot(page)).toEqual(rich);
  await page.getByRole('button', { name: 'Undo', exact: false }).first().click(); expect(await snapshot(page)).toEqual(before);
  await page.reload({ waitUntil: 'networkidle' }); expect(await snapshot(page)).toEqual(before);
});

for (const mode of ['embedded', 'read-failure', 'write-failure']) {
  test(`${mode} edits and structural changes remain exportable and undoable without durable saving`, async ({ page }) => {
    if (mode === 'write-failure') {
      await loadOnce(page, baseline);
      await page.evaluate(() => { Storage.prototype.setItem = () => { throw Error('Writes disabled'); }; });
    } else {
      if (mode === 'read-failure') await page.addInitScript(() => {
        Storage.prototype.getItem = () => { throw Error('Reads disabled'); };
        Storage.prototype.setItem = () => { throw Error('Writes disabled'); };
      });
      await page.goto(mode === 'embedded' ? '/embed' : '/', { waitUntil: 'networkidle' });
    }
    const frame = mode === 'embedded' ? page.frames().find((f) => f.parentFrame()) : page;
    const ui = mode === 'embedded' ? page.frameLocator('iframe') : page;
    if (mode !== 'write-failure') { await ui.getByRole('button', { name: 'Load example', exact: true }).click(); }
    await expect(ui.locator('[data-card]')).toHaveCount(26); const before = await snapshot(frame);
    await frame.evaluate(() => { const a = Alpine.$data(document.body); a.openEdit('n19'); a.form.notes = 'Memory-only saved edit'; a.saveForm(); });
    await expect(ui.locator('.session-notice')).toBeVisible(); const edited = await snapshot(frame);
    // Downloads are surfaced by the top-level Page even when triggered in a frame.
    expect(await exportJSON(page, ui)).toEqual({ project: edited.project, nodes: edited.nodes });
    await frame.evaluate(() => { const a = Alpine.$data(document.body); a.openAdd('n16', 'next'); a.form.title = 'Memory objective'; a.saveForm(); });
    let current = await snapshot(frame); const added = Object.values(current.nodes).find((n) => n.title === 'Memory objective'); assertGraph(current);
    await frame.evaluate((id) => { const a = Alpine.$data(document.body); a.requestMove(id); a.moveDialog.destination = 'group:n18'; a.reviewMove(); a.confirmMove(); }, added.id);
    current = await snapshot(frame); expect(current.nodes[added.id].parallelOf).toBe('n18'); assertGraph(current);
    expect(await exportJSON(page, ui)).toEqual({ project: current.project, nodes: current.nodes });
    await frame.evaluate((id) => { const a = Alpine.$data(document.body); a.requestDelete(id); a.confirmDelete(); }, added.id);
    current = await snapshot(frame); expect(current.nodes[added.id]).toBeUndefined();
    expect(await exportJSON(page, ui)).toEqual({ project: current.project, nodes: current.nodes });
    // Undo deletion, movement, creation, and the editor save in order.
    for (let i = 0; i < 4; i++) { await frame.evaluate(() => Alpine.$data(document.body).undo()); await settle(frame); }
    expect(await snapshot(frame)).toEqual(before);
    if (mode === 'write-failure') expect(await page.evaluate(() => JSON.parse(localStorage.getItem('sidequests-v1')))).toEqual(baseline);
    if (mode === 'embedded') expect(await page.evaluate(() => localStorage.getItem('sidequests-v1'))).toBeNull();
  });
}
