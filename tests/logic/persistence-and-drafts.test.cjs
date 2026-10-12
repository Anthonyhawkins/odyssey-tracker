const test = require('node:test');
const assert = require('node:assert/strict');
const { createApp, fixture, plain, assertGraph, mutationApp, add } = require('../helpers/app.cjs');

test('frozen sidequests-v1 snapshot loads unchanged and persists only project/nodes/seq', () => {
  const snapshot = fixture('baseline-v1.json'); const { app, values, writes } = createApp({ snapshot });
  assert.deepEqual(JSON.parse(app.snapshot()), snapshot);
  app.openEdit('n19'); app.form.notes += '\nSaved'; app.saveForm();
  const stored = JSON.parse(values.get('sidequests-v1'));
  assert.deepEqual(Object.keys(stored).sort(), ['nodes', 'project', 'seq']);
  assert.ok(writes.every((entry) => entry.key === 'sidequests-v1'));
  assert.equal(createApp({ snapshot: stored }).app.nodes.n19.notes, app.nodes.n19.notes);
  assert.equal(createApp({ snapshot: stored }).app.undoStack.length, 0);
});

test('legacy owner strings become reusable contacts without rewriting IDs, content or history', () => {
  const snapshot = fixture('legacy-owner.json'); const { app } = createApp({ snapshot });
  assert.equal(app.project.contacts.length, 2);
  assert.equal(app.nodes.n1.ownerIds[0], app.nodes.n2.ownerIds[0]);
  for (const [id, original] of Object.entries(snapshot.nodes)) {
    const migrated = plain(app.nodes[id]); delete migrated.ownerIds; assert.deepEqual(migrated, original);
  }
  assertGraph(app); app.persist();
  const reload = createApp({ snapshot: JSON.parse(app.snapshot()) }).app;
  assert.deepEqual(plain(reload.project.contacts), plain(app.project.contacts)); assertGraph(reload);
});

test('stale sequence counter cannot overwrite existing card IDs', () => {
  const snapshot = fixture('legacy-owner.json'); snapshot.seq = 0;
  const { app } = createApp({ snapshot }); const originals = Object.keys(app.nodes);
  const added = add(app, 'n2'); assert.equal(added, 'n4');
  originals.forEach((id) => assert.ok(app.nodes[id])); assertGraph(app);
});

for (const mode of ['embedded', 'read', 'write']) test(`${mode} storage unavailability preserves editing, banks and session Undo`, () => {
  const { app, writes } = createApp({ embedded: mode === 'embedded', storageFailure: mode === 'embedded' ? null : mode });
  app.loadDemo(); const before = app.snapshot();
  app.openEdit('n19'); app.form.notes += '\nMemory edit'; app.logDraft = { text: 'Memory log', timestamp: '2026-10-10T12:00' }; app.saveLogEntry(); app.saveForm();
  assert.ok(app.nodes.n19.notes.includes('Memory edit')); assert.equal(app.nodes.n19.log.length, 3);
  assert.equal(app.memoryOnly, true); assert.equal(writes.length, 0);
  app.undo(); assert.equal(app.snapshot(), before); assertGraph(app);
});

test('export shape differs from storage and includes complete banks and node content', async () => {
  const { app, downloads } = createApp({ snapshot: fixture('baseline-v1.json') });
  app.exportData(); const exported = JSON.parse(await downloads[0].text());
  assert.deepEqual(Object.keys(exported).sort(), ['nodes', 'project']);
  assert.deepEqual(exported, { project: plain(app.project), nodes: plain(app.nodes) });
});

test('Undo retains only 50 snapshots and text input keeps normal keyboard Undo', () => {
  const { app } = mutationApp();
  for (let i = 1; i <= 55; i++) { app.nodes.n4.notes = `Edit ${i}`; app.persist(); }
  assert.equal(app.undoStack.length, 50);
  for (let i = 0; i < 50; i++) app.undo();
  assert.equal(app.nodes.n4.notes, 'Edit 5');
  app.nodes.n4.notes = 'Typing'; app.persist(); const before = app.snapshot();
  app.undoKey({ ctrlKey: true, key: 'z', target: { closest: () => ({}) }, preventDefault() { assert.fail('Text input shortcut was intercepted'); } });
  assert.equal(app.snapshot(), before);
});

test('replacement asks first, cancel retains data, and Undo restores the old project', () => {
  const { app } = mutationApp(); const before = app.snapshot();
  app.requestDemo(); assert.equal(app.confirmation.kind, 'demo'); assert.equal(app.snapshot(), before);
  app.confirmation = null; assert.equal(app.snapshot(), before);
  app.requestDemo(); app.confirmReplacement(); assert.notEqual(app.snapshot(), before); assertGraph(app);
  app.undo(); assert.equal(app.snapshot(), before);
  app.requestNewProject(); assert.equal(app.confirmation.kind, 'project');
});

test('editor drafts isolate notes, links, logs and banks until Save; cancel discards them', () => {
  const { app } = mutationApp(); const before = app.snapshot();
  app.openEdit('n4'); app.form.notes = 'Draft notes'; app.form.links[0].label = 'Draft ticket';
  app.form.people[0].name = 'Draft owner'; app.form.tags[0].name = 'Draft tag';
  app.logDraft = { text: 'Draft entry', timestamp: '2026-10-10T12:00' }; app.saveLogEntry();
  assert.equal(app.snapshot(), before); app.modal = false; app.openEdit('n4'); assert.equal(app.snapshot(), before);
  assert.equal(app.form.log.length, 1); assert.equal(app.form.people[0].name, 'Alex');
  app.form.notes += '\nSaved'; app.saveForm(); assert.ok(app.nodes.n4.notes.endsWith('Saved')); app.undo(); assert.equal(app.snapshot(), before);
});

test('log validation rejects empty text/invalid dates and preserves chronological history', () => {
  const { app } = mutationApp(); app.openEdit('n4');
  app.logDraft = { text: '  ', timestamp: '2026-10-10T12:00' }; app.saveLogEntry(); assert.match(app.logError, /Write an update/);
  app.logDraft = { text: 'An update', timestamp: 'invalid' }; app.saveLogEntry(); assert.match(app.logError, /valid date/);
  app.logDraft = { text: 'Newest <plain text>', timestamp: '2026-10-10T12:00' }; app.saveLogEntry();
  assert.equal(app.sortedFormLog()[0].text, 'Newest <plain text>'); assert.equal(app.nodes.n4.log.length, 1);
  app.editLogEntry('log-stable'); app.logDraft.text = 'Revised'; app.saveLogEntry();
  assert.equal(app.form.log.find((entry) => entry.id === 'log-stable').timestamp, '2026-10-06T14:00:00.000Z');
  assert.ok(app.form.log.find((entry) => entry.id === 'log-stable').updatedAt);
});

test('shared bank edits propagate; assignment removal retains banks; bank deletion clears assignments', () => {
  const { app } = mutationApp(); app.nodes.n2.ownerIds = ['p1']; app.nodes.n2.tagIds = ['t1'];
  app.savePeople([{ contactId: 'p1', name: 'Alex renamed', email: 'new@example.com' }]);
  app.saveTags([{ id: 't1', name: 'Release renamed', color: '#ec4899' }]);
  assert.equal(app.peopleFor(app.nodes.n2)[0].name, app.peopleFor(app.nodes.n4)[0].name);
  assert.equal(app.tagsFor(app.nodes.n2)[0].color, '#ec4899');
  app.openEdit('n4'); app.form.people = []; app.form.tags = []; app.saveForm();
  assert.equal(app.project.contacts.length, 1); assert.equal(app.project.tags.length, 1);
  app.removeContact('p1'); app.removeTag('t1');
  assert.equal(app.nodes.n2.ownerIds.length, 0); assert.equal(app.nodes.n2.tagIds.length, 0); assertGraph(app);
});

test('links allow only HTTP/HTTPS/mailto and generated link labels cannot inject markup', () => {
  const { app } = mutationApp();
  for (const url of ['javascript:alert(1)', 'data:text/html,test', 'file:///tmp/test']) assert.throws(() => app.cleanLinks([{ label: 'Unsafe', url }]), /HTTP, HTTPS or mailto/);
  for (const url of ['http://example.com', 'https://example.com', 'mailto:person@example.com']) assert.equal(app.cleanLinks([{ label: 'Safe', url }]).length, 1);
  app.nodes.n4.links = [{ label: '<img src=x onerror=alert(1)>', url: 'https://example.com/?q="' }];
  const markup = app.cardLinksHTML('n4'); assert.ok(!markup.includes('<img')); assert.ok(markup.includes('&lt;img'));
  assert.ok(markup.includes('rel="noopener noreferrer"')); assert.ok(markup.includes('target="_blank"'));
});

test('new complete cards record creation-time completion, including a new project root', () => {
  const { app } = mutationApp();
  app.openAdd('n6', 'next'); app.form.title = 'Already complete'; app.form.status = 'complete'; app.saveForm();
  const saved = app.nodes[app.pendingFocus]; assert.equal(saved.completedAt, saved.created);
  app.newProject(); app.form.title = 'Completed delivery'; app.form.status = 'complete'; app.saveForm();
  assert.equal(app.nodes.n1.completedAt, app.nodes.n1.created); assertGraph(app);
});

test('editing complete legacy cards preserves existing or absent completion history; transitions are undoable', () => {
  const { app } = mutationApp(); const historical = app.nodes.n4.completedAt;
  app.openEdit('n4'); app.form.notes += '\nMore context'; app.saveForm();
  assert.equal(app.nodes.n4.completedAt, historical);
  delete app.nodes.n4.completedAt; app.lastSnapshot = app.snapshot();
  app.openEdit('n4'); app.form.notes += '\nLegacy context'; app.saveForm();
  assert.ok(!app.nodes.n4.completedAt, 'Do not invent a legacy completion time');
  app.openEdit('n4'); app.form.status = 'undefined'; app.saveForm(); assert.equal(app.nodes.n4.completedAt, null);
  app.openEdit('n4'); app.form.status = 'complete'; const before = app.snapshot(); app.saveForm();
  assert.equal(app.nodes.n4.completedAt, app.nodes.n4.updated);
  app.undo(); assert.equal(app.snapshot(), before);
});
