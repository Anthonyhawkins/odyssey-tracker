const { test, expect } = require('@playwright/test');
const baseline = require('../fixtures/baseline-v1.json');
const legacy = require('../fixtures/legacy-owner.json');

test.beforeEach(async ({ page }) => {
  const errors = []; page.on('pageerror', (error) => errors.push(error.message));
  page.context().on('page', (other) => other.on('pageerror', (error) => errors.push(error.message)));
  page.baselineErrors = errors;
});
test.afterEach(async ({ page }) => { expect(page.baselineErrors, 'No uncaught browser errors').toEqual([]); });

async function settle(page) {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
async function load(page, snapshot = baseline) {
  await page.addInitScript((saved) => localStorage.setItem('sidequests-v1', JSON.stringify(saved)), snapshot);
  await page.goto('/', { waitUntil: 'networkidle' });
  // Verify utility CSS actually arrived; an unstyled render is not a valid check.
  await page.waitForFunction(() => getComputedStyle(document.querySelector('.quest-map-panel')).borderRadius === '16px');
  await expect(page.locator('[data-card]')).toHaveCount(Object.keys(snapshot.nodes).length);
  await settle(page);
}

test('example retains central trunk, smooth curves, opaque markers and group action placement', async ({ page }, info) => {
  await load(page);
  const geometry = await page.evaluate(() => {
    const tree = document.getElementById('questTree'), svg = tree.querySelector('.quest-links');
    const trunk = svg.querySelector('.trunk'), branches = [...svg.querySelectorAll('path.branch')];
    const circles = [...svg.querySelectorAll('.quest-node circle')];
    return {
      width: tree.offsetWidth, trunkX: Number(trunk.getAttribute('d').split(' ')[1]),
      trunkWidth: getComputedStyle(trunk).strokeWidth,
      sideWidths: branches.map((p) => getComputedStyle(p).strokeWidth),
      curves: branches.filter((p) => p.getAttribute('d').includes(' C ')).length,
      markers: circles.map((c) => ({ fill: getComputedStyle(c).fill, r: Number(c.getAttribute('r')) })),
      markerAfterPaths: [...svg.children].findIndex((e) => e.classList.contains('quest-node')) > [...svg.children].map((e) => e.tagName.toLowerCase()).lastIndexOf('path')
    };
  });
  expect(geometry.trunkX).toBe(geometry.width / 2); expect(geometry.trunkWidth).toBe('7px');
  expect(geometry.curves).toBeGreaterThan(0); expect(new Set(geometry.sideWidths)).toEqual(new Set(['2.5px']));
  expect(geometry.markers.length).toBeGreaterThan(3);
  geometry.markers.forEach((m) => { expect(m.fill).toBe('rgb(255, 255, 255)'); expect(m.r).toBe(16); });
  expect(geometry.markerAfterPaths).toBe(true);
  for (const id of ['n4', 'n18']) {
    const group = page.locator(`[data-group="${id}"]`);
    await expect(group.locator('.group-header-actions [data-action="parallel"]')).toHaveText('.');
    await expect(group.locator('.group-header-actions [data-action="side"]')).toHaveText('!');
    await expect(group.locator('.quest-actions')).toHaveCount(0);
  }
  await expect(page.locator('[data-group-endpoint="n4"]')).toHaveCount(0);
  await expect(page.locator('[data-group-endpoint="n18"] [data-action="return"]')).toHaveCount(1);
  await page.getByRole('button', { name: 'Fit all', exact: true }).click();
  await page.screenshot({ path: info.outputPath('example-fit.png') });
});

test('nested merge is after source work, targets parent lane and stays anchored after mainline append', async ({ page }) => {
  await load(page);
  const before = await page.evaluate(() => {
    const a = Alpine.$data(document.body), tree = document.getElementById('questTree');
    const marker = tree.querySelector('.quest-node[data-related^="n7 "] circle');
    const source = tree.querySelector('[data-position="n7"]'), parent = tree.querySelector('[data-position="n6"]');
    return { mergeY: a.nodes.n7.mergeY, mergeAfterId: a.nodes.n7.mergeAfterId, markerX: +marker.getAttribute('cx'), markerY: +marker.getAttribute('cy'), parentX: parseFloat(parent.style.left) + 150, sourceBottom: parseFloat(source.style.top) + source.offsetHeight, mainX: a.graphWidth / 2 };
  });
  expect(before.markerX).toBe(before.parentX); expect(before.markerX).not.toBe(before.mainX);
  expect(before.markerY).toBeGreaterThan(before.sourceBottom);
  await page.evaluate(() => { const a = Alpine.$data(document.body); a.openAdd('n16', 'next'); a.form.title = 'Later mainline work'; a.saveForm(); });
  await settle(page);
  const after = await page.evaluate(() => ({ y: Alpine.$data(document.body).nodes.n7.mergeY, anchor: Alpine.$data(document.body).nodes.n7.mergeAfterId }));
  expect(after).toEqual({ y: before.mergeY, anchor: before.mergeAfterId });
});

test('24-card grids render all densities, scroll to last card, retain editor access and avoid adjacent card overlap', async ({ page }, info) => {
  await load(page);
  await page.evaluate(() => {
    const a = Alpine.$data(document.body);
    while (a.parallelGroups().groups.get('n18').members.length < 24) {
      a.openAdd('n18', 'parallel'); a.form.title = 'Observability task ' + a.seq; a.saveForm();
    }
    a.summaryExpanded = false;
  });
  await settle(page);
  for (const density of ['normal', 'compact', 'verycompact']) {
    await page.evaluate((value) => Alpine.$data(document.body).setGroupDensity('n18', value), density); await settle(page);
    const metrics = await page.evaluate(() => {
      const a = Alpine.$data(document.body), group = a.parallelGroups().groups.get('n18'), box = document.querySelector('[data-group="n18"]');
      const r = box.getBoundingClientRect(), adjacent = [...document.querySelectorAll('[data-position]')].filter((e) => !e.closest('.parallel-group')).map((e) => e.getBoundingClientRect());
      return { rows: group.rows, counts: Array.from({ length: group.rows }, (_, row) => group.cells.filter((cell) => cell.row === row).length), count: box.querySelectorAll('[data-card]').length, overlaps: adjacent.filter((b) => r.left < b.right && r.right > b.left && r.top < b.bottom && r.bottom > b.top).length };
    });
    expect(metrics.rows).toBeLessThanOrEqual(3); expect(Math.max(...metrics.counts) - Math.min(...metrics.counts)).toBeLessThanOrEqual(1);
    expect(metrics.count).toBe(24); expect(metrics.overlaps).toBe(0);
    const last = page.locator('[data-group="n18"] [data-action="edit"]').last();
    await last.scrollIntoViewIfNeeded(); await last.click();
    await expect(page.locator('.card-detail-panel')).toBeVisible();
    await page.locator('.editor-footer').getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.screenshot({ path: info.outputPath(`group-24-${density}.png`) });
  }
  const reopened = await page.context().newPage(); await reopened.goto('/', { waitUntil: 'networkidle' });
  await expect(reopened.locator('[data-group="n18"] [data-card]')).toHaveCount(24);
  await expect(reopened.locator('[data-group-density="n18"]')).toHaveValue('verycompact'); await reopened.close();
});

test('every dependency remains drawn, including same-group/resolved links, and endpoints follow horizontal scroll', async ({ page }) => {
  await page.setViewportSize({ width: 700, height: 900 }); await load(page);
  await page.evaluate(() => {
    const a = Alpine.$data(document.body); a.nodes.n27.blockedBy = 'n26'; a.nodes.n25.blockedBy = 'n18';
    a.setGroupDensity('n18', 'normal');
  }); await settle(page);
  await expect(page.locator('.dependency-links path')).toHaveCount(3);
  await expect(page.locator('.dependency-links path.dependency-resolved')).toHaveCount(1);
  const selector = '.dependency-links path[data-related="n27 n26"]';
  const before = await page.locator(selector).getAttribute('d');
  const scroll = await page.evaluate(() => {
    const box = document.querySelector('[data-group-scroll="n18"]'); box.scrollLeft = box.scrollWidth;
    return { left: box.scrollLeft, max: box.scrollWidth - box.clientWidth };
  }); await settle(page);
  expect(scroll.max).toBeGreaterThan(0); expect(scroll.left).toBe(scroll.max);
  expect(await page.locator(selector).getAttribute('d')).not.toBe(before);
  const points = await page.evaluate(() => {
    const svg = document.querySelector('.dependency-links'), group = document.querySelector('[data-group="n18"]');
    const left = parseFloat(group.style.left), right = left + group.offsetWidth;
    return [...svg.querySelectorAll('circle[data-related="n27 n26"]')].map((c) => ({ x: +c.getAttribute('cx'), left, right }));
  });
  points.forEach((p) => { expect(p.x).toBeGreaterThanOrEqual(p.left); expect(p.x).toBeLessThanOrEqual(p.right); });
});

test('standalone legacy data and saved editor content survive reload; Cancel preserves stored data', async ({ page }) => {
  await load(page, legacy);
  await page.evaluate(() => { const a = Alpine.$data(document.body); a.openEdit('n2'); });
  await page.locator('.notes-toggle').nth(0).click();
  await page.locator('#cardNotes').fill('Saved plain text\n<img src=x onerror=alert(1)>');
  await page.getByRole('button', { name: 'Close notes drawer', exact: true }).click();
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await settle(page);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('sidequests-v1')));
  expect(Object.keys(saved).sort()).toEqual(['nodes', 'project', 'seq']);
  expect(saved.project.contacts).toHaveLength(2); expect(saved.nodes.n2.completedAt).toBe(legacy.nodes.n2.completedAt);
  // Remove the seeding init script by opening a new page in the same fresh context.
  const reloaded = await page.context().newPage(); await reloaded.goto('/', { waitUntil: 'networkidle' });
  await expect(reloaded.locator('[data-card]')).toHaveCount(3);
  expect(await reloaded.evaluate(() => Alpine.$data(document.body).nodes.n2.notes)).toBe(saved.nodes.n2.notes);
  await reloaded.evaluate(() => { const a = Alpine.$data(document.body); a.openEdit('n2'); });
  await reloaded.locator('#taskTitle').fill('Discarded title');
  await reloaded.locator('.editor-footer').getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await reloaded.evaluate(() => JSON.parse(localStorage.getItem('sidequests-v1')))).toEqual(saved);
  await reloaded.close();
});

for (const mode of ['embedded', 'storage-failure']) test(`${mode} Add log, Save and Cancel work in real browser without storage`, async ({ page }) => {
  if (mode === 'storage-failure') await page.addInitScript(() => {
    Storage.prototype.getItem = () => { throw Error('Storage disabled for test'); };
    Storage.prototype.setItem = () => { throw Error('Storage disabled for test'); };
  });
  await page.goto(mode === 'embedded' ? '/embed' : '/', { waitUntil: 'networkidle' });
  const ui = mode === 'embedded' ? page.frameLocator('iframe') : page;
  await ui.getByRole('button', { name: 'Load example', exact: true }).click();
  await expect(ui.locator('[data-card]')).toHaveCount(26); await expect(ui.locator('.session-notice')).toBeVisible();
  const frame = mode === 'embedded' ? page.frames().find((f) => f.parentFrame()) : page;
  await frame.evaluate(() => Alpine.$data(document.body).openEdit('n19'));
  await ui.locator('.notes-toggle').nth(1).click();
  await ui.locator('#logEntryText').fill('Memory-only update <plain text>');
  await ui.locator('#logTimestamp').fill('2026-10-12T10:00');
  await ui.getByRole('button', { name: 'Add entry', exact: true }).click();
  await expect(ui.locator('.log-entry')).toHaveCount(3);
  expect(await frame.evaluate(() => Alpine.$data(document.body).nodes.n19.log.length)).toBe(2);
  await ui.getByRole('button', { name: 'Close log drawer', exact: true }).click();
  await ui.getByRole('button', { name: 'Save changes', exact: true }).click();
  expect(await frame.evaluate(() => Alpine.$data(document.body).nodes.n19.log.length)).toBe(3);
  await frame.evaluate(() => Alpine.$data(document.body).openEdit('n19'));
  await ui.locator('#taskTitle').fill('Unsaved title');
  await ui.locator('.editor-footer').getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await frame.evaluate(() => Alpine.$data(document.body).nodes.n19.title)).toBe('Repair broken staging environment');
});

test('overview collapse expands canvas; Notes/Log switch from adjacent drawers to narrow overlays', async ({ page }, info) => {
  await load(page); const expanded = await page.locator('.graph-viewport').boundingBox();
  await page.getByRole('button', { name: 'Hide overview & metrics', exact: false }).click();
  const collapsed = await page.locator('.graph-viewport').boundingBox(); expect(collapsed.height).toBeGreaterThan(expanded.height);
  await page.evaluate(() => Alpine.$data(document.body).openEdit('n19'));
  await page.locator('.notes-toggle').nth(0).click();
  await expect(page.locator('#card-notes-drawer')).toBeVisible();
  const notes = await page.locator('#card-notes-drawer').boundingBox(), card = await page.locator('.card-detail-panel').boundingBox();
  expect(notes.x + notes.width).toBe(card.x); expect(notes.height).toBe(1000);
  await page.locator('.notes-toggle').nth(1).click(); await expect(page.locator('#card-notes-drawer')).toBeHidden();
  await expect(page.locator('#card-log-drawer')).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  const log = await page.locator('#card-log-drawer').boundingBox(); expect(log.x).toBe(0); expect(log.width).toBe(390); expect(log.height).toBe(844);
  await page.screenshot({ path: info.outputPath('narrow-log.png') });
});

test('editor completion records history, preserves it on unrelated saves, and reopening clears it', async ({ page }) => {
  await load(page);
  await page.evaluate(() => Alpine.$data(document.body).openEdit('n13'));
  await page.locator('#questState').selectOption('complete');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  const completed = await page.evaluate(() => JSON.parse(localStorage.getItem('sidequests-v1')).nodes.n13.completedAt);
  expect(completed).toBeTruthy();
  await page.evaluate(() => Alpine.$data(document.body).openEdit('n13'));
  await expect(page.locator('.editor-card-history')).toContainText('Completed');
  await page.locator('#taskTitle').fill('Scope confirmed');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  expect(await page.evaluate(() => Alpine.$data(document.body).nodes.n13.completedAt)).toBe(completed);
  await page.evaluate(() => Alpine.$data(document.body).openEdit('n13'));
  await page.locator('#questState').selectOption('inprogress');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('sidequests-v1')).nodes.n13.completedAt)).toBeNull();
});

test('application Undo stays suppressed on bank/insights dialog buttons and resumes after closing', async ({ page }) => {
  await load(page);
  await page.evaluate(() => { const a = Alpine.$data(document.body); a.nodes.n19.notes += '\nSaved update'; a.persist(); a.notice = ''; });
  for (const dialog of ['showContacts', 'showTags', 'showInsights']) {
    await page.evaluate((key) => { Alpine.$data(document.body)[key] = true; }, dialog);
    const overlay = page.locator(`[x-show="${dialog}"]`);
    await expect(overlay).toBeVisible(); await overlay.locator('button').first().focus();
    await page.keyboard.press('Control+z');
    expect(await page.evaluate(() => Alpine.$data(document.body).nodes.n19.notes)).toContain('Saved update');
    await page.evaluate((key) => { Alpine.$data(document.body)[key] = false; }, dialog);
  }
  await page.getByRole('button', { name: 'Undo', exact: false }).first().focus(); await page.keyboard.press('Control+z');
  expect(await page.evaluate(() => Alpine.$data(document.body).nodes.n19.notes)).not.toContain('Saved update');
});

test('owning-line abandonment closes parallel controls and movement; nested work stays independent and Undo restores controls', async ({ page }) => {
  await load(page);
  await page.evaluate(() => { const a = Alpine.$data(document.body); a.openAbandon('n18'); });
  await page.locator('#abandonReason').fill('Observability stopped');
  await page.locator('.abandon-save').click(); await settle(page);
  await expect(page.locator('[data-group="n18"] .group-header-actions')).toHaveCount(0);
  await expect(page.locator('[data-group-endpoint="n18"]')).toHaveCount(0);
  await expect(page.locator('[data-position="n29"] [data-action="next"]')).toHaveCount(1);
  await page.evaluate(() => Alpine.$data(document.body).openEdit('n28'));
  await expect(page.locator('.move-card-button')).toBeDisabled();
  await expect(page.locator('.card-move-section')).toContainText('closed');
  await page.locator('.editor-footer').getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Undo', exact: false }).first().click(); await settle(page);
  await expect(page.locator('[data-group="n18"] .group-header-actions')).toHaveCount(1);
  await expect(page.locator('[data-group-endpoint="n18"]')).toHaveCount(1);
});
