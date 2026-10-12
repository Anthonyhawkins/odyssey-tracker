const test = require('node:test');
const assert = require('node:assert/strict');
const { mutationApp, node, createApp, reviewMove, assertGraph } = require('../helpers/app.cjs');

// Retain the original gap IDs as ordinary requirement regressions.
function gap(id, name, check) { test(`${id}: ${name}`, check); }

gap('G1a', 'editor completion records a completion timestamp', () => {
  const { app } = mutationApp(); app.openEdit('n2'); app.form.status = 'complete'; app.saveForm();
  assert.equal(app.nodes.n2.done, true);
  assert.ok(app.nodes.n2.completedAt, 'Completing through Save must record completedAt');
});

gap('G1b', 'editor reopening clears the applicable completion timestamp', () => {
  const { app } = mutationApp(); app.openEdit('n4'); app.form.status = 'inprogress'; app.saveForm();
  assert.equal(app.nodes.n4.done, false);
  assert.ok(!app.nodes.n4.completedAt, 'Reopening through Save must match endpoint completion handling');
});

gap('G2', 'parallel members inherit closure of their owning questline', () => {
  const { app } = createApp(); app.loadDemo();
  app.openAbandon('n18'); app.abandonDialog.reason = 'Observability ended'; app.saveAbandon();
  assert.equal(app.branchClosed('n18'), true);
  assert.equal(app.branchClosed('n28'), true, 'Owning-line abandonment must close a parallel follow-up');
});

gap('G3', 'rejoin anchors to the actual endpoint after moving an older-ID card', () => {
  const { app } = mutationApp();
  // Main has a single newer endpoint; move the older rich leaf there through
  // the actual review/confirm flow before rejoining another side quest.
  delete app.nodes.n5; app.nodes.n1.children = app.nodes.n1.children.filter((id) => id !== 'n5');
  app.nodes.n10 = node('n10', 'n2'); app.nodes.n2.children.push('n10'); app.seq = 10;
  assertGraph(app); reviewMove(app, 'n4', 'line:n1'); app.confirmMove(); assertGraph(app);
  app.returnToMain('n6');
  assert.equal(app.nodes.n6.mergeAfterId, 'n4', 'Placement, rather than highest numeric ID, determines merge destination');
});

for (const dialog of ['showContacts', 'showTags', 'showInsights']) gap('G4', `keyboard Undo is suppressed in ${dialog}`, () => {
  const { app } = mutationApp(); app.nodes.n4.notes = 'Saved change'; app.persist();
  app[dialog] = true; const before = app.snapshot();
  app.undoKey({ ctrlKey: true, key: 'z', target: { closest: () => null }, preventDefault() {} });
  assert.ok(app.snapshot() === before, 'An active dialog must suppress application Undo');
});
