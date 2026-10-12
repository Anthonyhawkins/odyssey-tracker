const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '../..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const script = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
  .find((match) => match[1].includes('function questApp()'))?.[1];
assert.ok(script, 'The prototype must expose questApp() in an inline script');
const plain = (value) => JSON.parse(JSON.stringify(value));
const fixture = (name) => JSON.parse(fs.readFileSync(path.join(root, 'tests/fixtures', name), 'utf8'));

// Logic only: defer all rendering/focus callbacks. No simulated card measurements
// are presented as browser verification. Persistence and mutations are real methods.
function createApp({ snapshot, embedded = false, storageFailure = null, width = 1060 } = {}) {
  const values = new Map(snapshot ? [['sidequests-v1', JSON.stringify(snapshot)]] : []);
  const writes = [];
  const downloads = [];
  const window = {
    localStorage: {
      getItem(key) { if (storageFailure === 'read') throw Error('Storage unavailable'); return values.get(key) ?? null; },
      setItem(key, value) { if (storageFailure === 'write') throw Error('Storage unavailable'); values.set(key, value); writes.push({ key, value }); }
    },
    addEventListener() {}, setTimeout() { return 1; }, clearTimeout() {}
  };
  window.self = window;
  window.top = embedded ? {} : window;
  class TestURL extends URL {
    static createObjectURL(blob) { downloads.push(blob); return 'blob:test-export'; }
    static revokeObjectURL() {}
  }
  const document = { createElement() { return { click() {} }; } };
  const context = vm.createContext({ window, document, URL: TestURL, Blob, Intl, Date, crypto: webcrypto });
  vm.runInContext(script, context, { filename: 'index.html:questApp' });
  const app = context.questApp();
  app.$nextTick = () => {};
  app.$refs = { canvas: { clientWidth: width } };
  app.init();
  return { app, values, writes, downloads };
}

function assertGraph(app) {
  const nodes = app.nodes;
  assert.ok(nodes[app.project.root], 'Project root exists');
  assert.equal(nodes[app.project.root].parent ?? null, null, 'Root has no parent');
  for (const [id, node] of Object.entries(nodes)) {
    assert.equal(node.id, id, 'Dictionary key matches stable ID');
    assert.equal(new Set(node.children || []).size, (node.children || []).length, `${id}: duplicate children`);
    if (node.parent) {
      assert.ok(nodes[node.parent], `${id}: parent exists`);
      assert.ok(nodes[node.parent].children.includes(id), `${id}: reciprocal parent link`);
    }
    for (const child of node.children || []) {
      assert.ok(nodes[child], `${id}: child exists`);
      assert.equal(nodes[child].parent, id, `${id}: reciprocal child link`);
    }
    for (const field of ['parallelOf', 'blockedBy', 'mergeAfterId']) {
      if (node[field]) assert.ok(nodes[node[field]], `${id}: ${field} exists`);
    }
    if (node.isParallel) assert.ok(node.parallelOf, `${id}: parallel member has an anchor`);
    for (const bank of [['ownerIds', 'contacts'], ['tagIds', 'tags']]) {
      for (const ref of node[bank[0]] || []) assert.ok(app.project[bank[1]].some((entry) => entry.id === ref), `${id}: bank reference exists`);
    }
  }
  const active = new Set(), complete = new Set();
  function visit(id) {
    assert.ok(!active.has(id), `${id}: structural cycle`);
    if (complete.has(id)) return;
    active.add(id);
    for (const parent of [nodes[id].parent, nodes[id].parallelOf].filter(Boolean)) visit(parent);
    active.delete(id); complete.add(id);
  }
  Object.keys(nodes).forEach(visit);
}

function node(id, parent = null, extra = {}) {
  return { id, parent, title: `Objective ${id}`, category: 'Development', description: '',
    children: [], isSide: false, done: false, status: 'inprogress', returned: false,
    created: '2026-10-05T13:00:00.000Z', ownerIds: [], tagIds: [], links: [], notes: '', log: [], days: 0, ...extra };
}

function mutationApp() {
  const state = {
    project: { root: 'n1', title: 'Delivery', goal: 'Ship', contacts: [{ id: 'p1', name: 'Alex', email: 'alex@example.com' }], contactSeq: 1, tags: [{ id: 't1', name: 'Release', color: '#3b82f6' }], tagSeq: 1 },
    seq: 6,
    nodes: {
      n1: node('n1', null, { children: ['n2', 'n3', 'n5', 'n6'], category: 'Main Quest', color: '#3b82f6' }),
      n2: node('n2', 'n1'),
      n3: node('n3', 'n1', { isSide: true, color: '#ec4899', children: ['n4'] }),
      n4: node('n4', 'n3', { title: 'Rich leaf', description: 'Keep everything', notes: 'Line one\nLine two <plain text>', links: [{ label: 'Ticket', url: 'https://example.com/ticket' }], ownerIds: ['p1'], tagIds: ['t1'], days: 3, blockedBy: 'n2', updated: '2026-10-06T14:22:33.000Z', completedAt: '2026-10-06T14:22:33.000Z', done: true, status: 'complete', log: [{ id: 'log-stable', text: 'Investigated', timestamp: '2026-10-06T14:00:00.000Z', createdAt: '2026-10-06T14:01:00.000Z', updatedAt: '2026-10-06T14:02:00.000Z' }] }),
      n5: node('n5', 'n1', { isParallel: true, parallelOf: 'n2', blockedBy: 'n4' }),
      n6: node('n6', 'n1', { isSide: true, color: '#0ea5e9' })
    }
  };
  return createApp({ snapshot: state });
}

function add(app, parent, kind = 'next', title = 'Added work') {
  app.openAdd(parent, kind); app.form.title = title; app.saveForm();
  assert.equal(app.formError, '');
  return app.pendingFocus;
}

function reviewMove(app, id, destination) {
  app.requestMove(id); app.moveDialog.destination = destination; app.reviewMove();
  assert.equal(app.moveError, ''); assert.equal(app.moveDialog.review, true);
}

module.exports = { createApp, plain, fixture, assertGraph, mutationApp, node, add, reviewMove };
