const { test, expect } = require('@playwright/test');
const baseline = require('../fixtures/baseline-v1.json');
const choices = [ ['planning','Planning'], ['ready','Ready'], ['inprogress','In Progress'], ['inreview','In Review'], ['complete','Complete'] ];
for (const embedded of [false, true]) {
  test(`new lifecycle states and categories render in all densities in ${embedded ? 'embedded' : 'standalone'} mode`, async ({ page }, info) => {
    await page.addInitScript(saved => {
      if (!sessionStorage.getItem('quest-states-seeded')) { localStorage.setItem('sidequests-v1', JSON.stringify(saved)); sessionStorage.setItem('quest-states-seeded', 'yes'); }
    }, baseline);
    await page.goto(embedded ? '/embed' : '/'); const app = embedded ? page.frames().find(frame => frame.parentFrame()) : page;
    if (embedded) { await app.waitForFunction(() => !!window.Alpine); await app.evaluate(() => Alpine.$data(document.body).loadDemo()); }
    await expect(app.locator('[data-card]')).toHaveCount(26);
    for (const [value,label] of choices) {
      await app.evaluate(() => Alpine.$data(document.body).openEdit('n28'));
      expect(await app.locator('#questState option').allTextContents()).toEqual(choices.map(choice => choice[1]));
      await app.locator('#questState').selectOption(value);
      await app.locator('[x-model="form.category"]').selectOption(value === 'planning' ? 'Operations' : 'Bug');
      await app.getByRole('button', { name: 'Save changes', exact: true }).click();
      for (const density of ['normal','compact','verycompact']) {
        await app.locator('[data-group-density="n18"]').selectOption(density);
        const card = app.locator('[data-card="n28"]');
        if (density === 'verycompact') await expect(card.locator('.density-status')).toHaveAttribute('aria-label', label);
        else await expect(card.locator('.quest-status')).toHaveText(label);
        await expect(card.locator('svg.lucide-' + (value === 'planning' ? 'settings-2' : 'bug'))).toHaveCount(1);
      }
    }
    await app.evaluate(() => Alpine.$data(document.body).openEdit('n28')); await app.locator('#questState').selectOption('inreview');
    await app.getByRole('button', { name: 'Save changes', exact: true }).click();
    await app.locator('[data-group-density="n18"]').selectOption('normal');
    await expect(app.locator('[data-group="n18"]')).toHaveClass(/density-normal/);
    await app.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await app.locator('[data-group="n18"]').scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath('in-review-bug.png') });
    if (!embedded) { await page.reload(); expect(await page.evaluate(() => Alpine.$data(document.body).nodes.n28.status)).toBe('inreview'); }
    await app.evaluate(() => Alpine.$data(document.body).openEdit('n16'));
    await expect(app.locator('#questState')).toHaveValue('undefined'); await expect(app.locator('#questState')).toContainText('Undefined (legacy)');
    await app.getByRole('button', { name: 'Cancel', exact: true }).last().click();
    expect(await app.evaluate(() => Alpine.$data(document.body).nodes.n16.status)).toBe('undefined');
    await app.evaluate(() => Alpine.$data(document.body).openEdit('n12')); await app.locator('#questState').selectOption('ready');
    await app.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect(app.locator('[data-card="n12"] .quest-status')).toHaveText('Blocked');
    expect(await app.evaluate(() => Alpine.$data(document.body).nodes.n12.status)).toBe('ready');
  });
}
