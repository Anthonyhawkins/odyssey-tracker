const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp, plain, fixture, assertGraph, mutationApp, node, add, reviewMove } = require('../helpers/app.cjs');

test('frozen baseline snapshot and built-in example have valid graph and bank references', () => {
  const { app } = createApp({ snapshot: fixture('baseline-v1.json') }); assertGraph(app);
  app.loadDemo(); assertGraph(app);
});

test('serial, side, nested and parallel additions preserve reciprocal graph links and distinct topology', () => {
  const { app } = mutationApp();
  const serial = add(app, 'n6');
  const side = add(app, serial, 'side');
  const nested = add(app, side, 'side');
  const parallel = add(app, nested, 'parallel');
  assert.equal(app.nodes[serial].isSide, false);
  assert.equal(app.branchRoot(serial).id, 'n6');
  assert.equal(app.nodes[side].blockedBy, '');
  assert.equal(app.nodes[parallel].parallelOf, nested);
  assert.equal(app.branchColor(parallel), app.branchColor(nested));
  assertGraph(app);
});

test('adding work on one branch does not push unrelated mainline objectives down', () => {
  const { app } = mutationApp();
  const before = app.graphLayout().placed.get('n2').y;
  let tip = 'n6'; for (let i = 0; i < 4; i++) tip = add(app, tip);
  assert.equal(app.graphLayout().placed.get('n2').y, before);
});

for (const density of ['normal', 'compact', 'verycompact']) {
  for (const count of [4, 9, 24]) test(`${count}-card ${density} grid balances rows and retains every member`, () => {
    const { app } = mutationApp();
    for (let i = 2; i < count; i++) add(app, 'n2', 'parallel');
    app.setGroupDensity('n2', density);
    const group = app.parallelGroups().groups.get('n2');
    assert.equal(group.members.length, count);
    assert.equal(group.cells.length, count);
    assert.equal(new Set(group.cells.map((cell) => `${cell.row}:${cell.column}`)).size, count);
    assert.ok(group.rows >= 1 && group.rows <= 3);
    const rows = Array.from({ length: group.rows }, (_, row) => group.cells.filter((cell) => cell.row === row).length);
    assert.ok(Math.max(...rows) - Math.min(...rows) <= 1);
    assert.equal(group.cardWidth, { normal: 300, compact: 208, verycompact: 168 }[density]);
    assertGraph(app);
  });
}

test('explicit density survives snapshots; implicit density changes at four members', () => {
  const { app } = mutationApp();
  assert.equal(app.parallelGroups().groups.get('n2').density, 'normal');
  add(app, 'n2', 'parallel'); add(app, 'n2', 'parallel');
  assert.equal(app.parallelGroups().groups.get('n2').density, 'compact');
  app.setGroupDensity('n2', 'verycompact');
  const restored = createApp({ snapshot: JSON.parse(app.snapshot()) }).app;
  assert.equal(restored.parallelGroups().groups.get('n2').density, 'verycompact');
});

const guards = [
  ['main root', 'n1', () => {}, /main quest starting/],
  ['child parent reference', 'n4', (a) => { a.nodes.n7 = node('n7', 'n4'); }, /child/],
  ['child list reference', 'n4', (a) => { a.nodes.n7 = node('n7', 'n6'); a.nodes.n4.children.push('n7'); }, /child/],
  ['parallel anchor', 'n4', (a) => { a.nodes.n7 = node('n7', 'n3', { isParallel: true, parallelOf: 'n4' }); }, /parallel anchor|anchors parallel/],
  ['merge destination', 'n4', (a) => { a.nodes.n6.returned = true; a.nodes.n6.mergeAfterId = 'n4'; }, /merge/],
  ['merged branch origin', 'n4', (a) => { a.nodes.n6.parent = 'n4'; a.nodes.n6.returned = true; }, /origin|merge relationships/],
  ['abandonment record', 'n4', (a) => { a.nodes.n4.abandoned = true; }, /abandonment/]
];
for (const field of ['returned', 'mergeOrder', 'mergeAfterId', 'mergedAt']) {
  guards.push([`merge record ${field}`, 'n4', (a) => { a.nodes.n4[field] = field === 'mergeAfterId' ? 'n2' : field === 'mergedAt' ? '2026-10-06T14:00:00.000Z' : 1; }, /records a merge/]);
}
for (const [label, id, change, pattern] of guards) {
  for (const operation of ['deletionReasons', 'moveReasons']) test(`${operation} protects ${label}`, () => {
    const { app } = mutationApp(); delete app.nodes.n5.blockedBy; change(app);
    assert.match(app[operation](id).join(' '), pattern);
  });
}

test('deletion protects blocker dependents; side roots are forbidden move sources', () => {
  const { app } = mutationApp();
  assert.match(app.deletionReasons('n4').join(' '), /blocker/);
  assert.match(app.moveReasons('n6').join(' '), /entire side quests/);
});

test('empty side quest deletion and Undo restore its original graph', () => {
  const { app } = mutationApp(); const before = app.snapshot();
  app.requestDelete('n6'); app.confirmDelete(); assert.ok(!app.nodes.n6); assertGraph(app);
  app.undo(); assert.equal(app.snapshot(), before); assertGraph(app);
});

test('safe leaf deletion retains banks; Undo restores full content and group membership', () => {
  const { app } = mutationApp(); const before = app.snapshot(), banks = plain(app.project);
  app.requestDelete('n5'); app.confirmDelete();
  assert.ok(!app.nodes.n5); assert.equal(app.parallelGroups().groups.size, 0);
  assert.deepEqual(plain(app.project), banks); assertGraph(app);
  app.undo(); assert.equal(app.snapshot(), before); assertGraph(app);
});

test('delete confirmation rechecks relationships added after opening; cancel leaves state intact', () => {
  const { app } = mutationApp(); delete app.nodes.n5.blockedBy;
  app.requestDelete('n4'); const before = app.snapshot(); app.deleteDialog = null;
  assert.equal(app.snapshot(), before);
  app.requestDelete('n4'); app.nodes.n2.blockedBy = 'n4'; app.confirmDelete();
  assert.ok(app.nodes.n4); assert.match(app.deleteError, /blocked/); assertGraph(app);
});

for (const destination of ['group:n2', 'line:n6']) test(`move to ${destination} preserves identity, full content, dependencies and timestamps; Undo restores placement`, () => {
  const { app } = mutationApp(); const before = app.snapshot(), content = plain(app.nodes.n4);
  reviewMove(app, 'n4', destination); app.confirmMove();
  const moved = plain(app.nodes.n4);
  for (const key of ['parent', 'isParallel', 'parallelOf']) { delete moved[key]; delete content[key]; }
  assert.deepEqual(moved, content);
  assert.equal(app.nodes.n5.blockedBy, 'n4');
  assert.equal(app.branchColor('n4'), destination === 'group:n2' ? '#3b82f6' : '#0ea5e9');
  assertGraph(app); app.undo(); assert.equal(app.snapshot(), before); assertGraph(app);
});

test('moving a group member dissolves a one-card source group and retains unrelated merge history', () => {
  const { app } = mutationApp();
  app.nodes.n3.returned = true; app.nodes.n3.mergedAt = '2026-10-06T14:00:00.000Z'; app.nodes.n3.mergeAfterId = 'n2'; app.nodes.n3.mergeOrder = 7; app.seq = 7;
  app.lastSnapshot = app.snapshot(); const history = plain(app.nodes.n3);
  reviewMove(app, 'n5', 'line:n6'); app.confirmMove();
  assert.equal(app.parallelGroups().groups.size, 0); assert.deepEqual(plain(app.nodes.n3), history); assertGraph(app);
});

test('move cancellation, unsaved drafts and direct confirmation without review cannot change placement', () => {
  const { app } = mutationApp(); const before = app.snapshot();
  app.requestMove('n4'); app.confirmMove(); assert.equal(app.snapshot(), before);
  reviewMove(app, 'n4', 'line:n6'); app.moveDialog = null; assert.equal(app.snapshot(), before);
  app.openEdit('n4'); app.form.notes += '\nDraft';
  assert.match(app.moveReasons('n4', true).join(' '), /Save or cancel/);
  assert.throws(() => app.movePlan('n4', 'line:n6'), /Save or cancel/);
});

test('move confirmation rejects a closed destination and requests review when its endpoint changes', () => {
  const { app } = mutationApp(); reviewMove(app, 'n4', 'line:n6');
  app.nodes.n6.abandoned = true; app.confirmMove(); assert.equal(app.nodes.n4.parent, 'n3'); assert.equal(app.moveDialog.review, false);
  delete app.nodes.n6.abandoned; reviewMove(app, 'n4', 'line:n6');
  app.nodes.n7 = node('n7', 'n6'); app.nodes.n6.children.push('n7'); app.seq = 7;
  app.confirmMove(); assert.equal(app.nodes.n4.parent, 'n3'); assert.match(app.moveError, /Review the move again/); assertGraph(app);
});

test('move confirmation rechecks source eligibility after review', () => {
  const { app } = mutationApp(); reviewMove(app, 'n4', 'line:n6');
  app.nodes.n7 = node('n7', 'n4'); app.nodes.n4.children.push('n7'); app.confirmMove();
  assert.equal(app.nodes.n4.parent, 'n3'); assert.equal(app.moveDialog.review, false); assert.match(app.moveError, /child/); assertGraph(app);
});

test('closed sources, closed destinations, no-op groups/lines and ambiguous endpoints are rejected', () => {
  const { app } = mutationApp();
  assert.ok(!app.moveDestinations('n4').some((d) => d.key === 'line:n3'));
  assert.ok(!app.moveDestinations('n5').some((d) => d.key === 'group:n2'));
  app.nodes.n3.abandoned = true; assert.match(app.moveReasons('n4').join(' '), /closed/); delete app.nodes.n3.abandoned;
  app.nodes.n6.abandoned = true; assert.ok(!app.moveDestinations('n4').some((d) => d.key === 'line:n6'));
  app.nodes.n7 = node('n7', 'n1'); app.nodes.n1.children.push('n7');
  assert.ok(!app.moveDestinations('n4').some((d) => d.key === 'line:n1'));
});

test('a cycle-producing destination through parallel references is rejected without mutation', () => {
  const { app } = mutationApp();
  // A move to n6 would make n4 -> n6 -> n4. The anchor guard may reject
  // this before the explicit ancestry traversal is reached.
  app.nodes.n6.parallelOf = 'n4';
  const before = app.snapshot();
  assert.throws(() => app.movePlan('n4', 'line:n6'), /anchors parallel/);
  assert.equal(app.snapshot(), before);
});

test('nested rejoin targets its originating side quest and preserves anchoring after destination append', () => {
  const { app } = mutationApp();
  const nested = add(app, 'n4', 'side'); const work = add(app, nested);
  app.returnToMain(work);
  assert.equal(app.nodes[work].mergeAfterId, 'n4');
  const merge = plain(app.nodes[work]); add(app, 'n4');
  assert.deepEqual(plain(app.nodes[work]), merge); assertGraph(app);
});
