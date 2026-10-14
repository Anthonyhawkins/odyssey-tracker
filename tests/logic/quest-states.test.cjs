const test = require('node:test');
const assert = require('node:assert/strict');
const { mutationApp, createApp, fixture, plain, assertGraph, reviewMove } = require('../helpers/app.cjs');

for (const status of ['planning', 'ready', 'inprogress', 'inreview', 'complete']) {
  test(`${status} saves, reloads and undoes with consistent completion history`, () => {
    const { app } = mutationApp(), original = app.snapshot();
    app.openAdd('n6', 'next'); app.form.title = 'Lifecycle objective'; app.form.status = status; app.form.category = 'Bug'; app.saveForm();
    const id = app.pendingFocus, saved = app.nodes[id];
    assert.equal(saved.status, status); assert.equal(saved.done, status === 'complete');
    assert.equal(!!saved.completedAt, status === 'complete');
    assert.equal(app.cardState(saved), status); assert.equal(saved.category, 'Bug'); assertGraph(app);
    const reloaded = createApp({ snapshot: JSON.parse(app.snapshot()) }).app;
    reloaded.openEdit(id); assert.equal(reloaded.form.status, status); assert.equal(reloaded.form.category, 'Bug');
    app.undo(); assert.equal(app.snapshot(), original);
  });
  test(`reopening Complete as ${status} retains IDs and correct history`, () => {
    const { app } = mutationApp(), before = app.snapshot(), created = app.nodes.n4.created, completed = app.nodes.n4.completedAt;
    app.openEdit('n4'); app.form.status = status; app.saveForm();
    assert.equal(app.nodes.n4.id, 'n4'); assert.equal(app.nodes.n4.created, created);
    assert.equal(app.nodes.n4.done, status === 'complete'); assert.equal(app.nodes.n4.completedAt, status === 'complete' ? completed : null);
    app.undo(); assert.equal(app.snapshot(), before);
  });
}

test('blocker and abandonment remain derived while selectable state survives', () => {
  const { app } = mutationApp();
  for (const status of ['planning', 'ready', 'inprogress', 'inreview']) {
    app.nodes.n5.status = status; assert.equal(app.cardState(app.nodes.n5), status); // n4 is complete.
    app.nodes.n4.done = false; assert.equal(app.cardState(app.nodes.n5), 'blocked'); assert.equal(app.nodes.n5.status, status);
    app.nodes.n4.done = true; assert.equal(app.cardState(app.nodes.n5), status);
  }
  app.nodes.n5.abandoned = true; assert.equal(app.cardState(app.nodes.n5), 'abandoned');
});

test('legacy Undefined is preserved on load and unrelated editing', () => {
  const { app } = createApp({ snapshot: fixture('baseline-v1.json') });
  const original = plain(app.nodes.n16); app.openEdit('n16'); assert.equal(app.form.status, 'undefined');
  app.form.notes = 'Legacy edit'; app.saveForm(); assert.equal(app.nodes.n16.status, 'undefined'); assert.equal(app.cardState(app.nodes.n16), 'undefined');
  assert.equal(app.nodes.n16.id, original.id); assert.equal(app.nodes.n16.created, original.created);
  app.openEdit('n16'); app.form.status = 'planning'; app.saveForm(); assert.equal(app.nodes.n16.status, 'planning');
});

test('new states survive movement and categories have distinct embedded icons', () => {
  const { app } = mutationApp();
  for (const status of ['planning', 'ready', 'inreview']) {
    app.nodes.n4.status = status; app.nodes.n4.done = false; app.lastSnapshot = app.snapshot();
    const before = app.snapshot(); reviewMove(app, 'n4', 'group:n2'); app.confirmMove();
    assert.equal(app.nodes.n4.status, status); app.undo(); assert.equal(app.snapshot(), before);
  }
  assert.ok(app.categories.includes('Operations')); assert.ok(app.categories.includes('Bug'));
  assert.match(app.categoryIcon('Operations'), /lucide-settings-2/); assert.match(app.categoryIcon('Bug'), /lucide-bug/);
  assert.equal(app.defaults().status, 'inprogress');
});
