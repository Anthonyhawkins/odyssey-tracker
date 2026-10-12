const { test, expect } = require('@playwright/test');
const baseline = require('../fixtures/baseline-v1.json');

for (const embedded of [false, true]) for (const width of [1600, 390]) {
  test(`background choices preserve graph geometry and ${embedded ? 'embedded session editing' : 'standalone persistence'} at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.addInitScript((saved) => localStorage.setItem('sidequests-v1', JSON.stringify(saved)), baseline);
    await page.goto(embedded ? '/embed' : '/');
    const host = embedded ? page.frames().find((frame) => frame.parentFrame()) : page;
    if (embedded) {
      await host.waitForFunction(() => !!window.Alpine);
      await host.evaluate(() => Alpine.$data(document.body).loadDemo());
    }
    const viewport = host.locator('.graph-viewport');
    const selector = host.getByLabel('Background', { exact: true });
    await expect(host.locator('[data-card]')).toHaveCount(26);
    await expect(selector).toHaveValue('dotted-grid');
    await expect(viewport).toHaveCSS('background-size', '19px 19px');
    const state = await host.evaluate(() => {
      const a = Alpine.$data(document.body);
      return { data: a.snapshot(), paths: [...document.querySelectorAll('.quest-links path')].map(p => p.getAttribute('d')), width: a.graphWidth, height: a.graphHeight, undo: a.undoStack.length };
    });
    await selector.selectOption('none'); await expect(viewport).toHaveCSS('background-image', 'none');
    await selector.selectOption('backdrop'); await expect(viewport).toHaveCSS('background-size', 'cover');
    await expect(viewport).toHaveCSS('background-image', /map\.png/);
    await host.evaluate(() => new Promise((resolve, reject) => { const image = new Image(); image.onload = resolve; image.onerror = reject; image.src = 'map.png'; }));
    const box = await viewport.boundingBox();
    await page.mouse.move(box.x + 20, box.y + 40); await page.mouse.down(); await page.mouse.move(box.x + 20, box.y + 100); await page.mouse.up();
    await expect(viewport).not.toHaveClass(/is-panning/);
    await host.getByRole('button', { name: 'Zoom in', exact: true }).click();
    expect(await host.evaluate(() => Alpine.$data(document.body).zoom)).toBeGreaterThan(1);
    await host.getByRole('button', { name: 'Fit all', exact: true }).click();
    await viewport.scrollIntoViewIfNeeded();
    await viewport.screenshot({ path: info.outputPath('backdrop.png') });
    const after = await host.evaluate(() => {
      const a = Alpine.$data(document.body);
      return { data: a.snapshot(), paths: [...document.querySelectorAll('.quest-links path')].map(p => p.getAttribute('d')), width: a.graphWidth, height: a.graphHeight, undo: a.undoStack.length };
    });
    expect(after).toEqual(state);
    if (!embedded) {
      await page.reload(); await expect(selector).toHaveValue('backdrop');
      expect(await page.evaluate(() => JSON.parse(localStorage.getItem('sidequests-v1')))).toEqual(baseline);
    }
    await selector.selectOption('dotted-grid');
    await expect(viewport).toHaveCSS('background-image', /radial-gradient/);
  });
}
