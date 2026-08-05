import assert from 'node:assert/strict';
import test from 'node:test';

const modelUrl = new URL('../../ui/src/bookmarks/bookmarkModel.ts', import.meta.url);
const storeUrl = new URL('../../ui/src/bookmarks/bookmarkStore.ts', import.meta.url);

class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
}

const baseInput = {
  id: 'bookmark-1',
  name: 'Third hello',
  workspaceName: 'Docs',
  workspacePath: '/docs',
  filePath: '/docs/readme.md',
  now: 100,
};

test('migrates v1 bookmarks to v2 deterministically and idempotently', async () => {
  const { normalizeBookmarkDocument } = await import(modelUrl);
  const v1 = {
    version: 1,
    items: [{
      id: 'legacy', name: 'Legacy', workspaceKey: '/docs', workspaceName: 'Docs', workspacePath: '/docs',
      filePath: '/docs/readme.md', selectedText: 'Hello', matchOrdinal: 2, matchIndex: 12,
      prefix: 'Hello Hello ', suffix: ' world', createdAt: 1, updatedAt: 2,
    }],
  };
  const once = normalizeBookmarkDocument(v1);
  const twice = normalizeBookmarkDocument(once);
  assert.equal(once.version, 2);
  assert.deepEqual(twice, once);
  assert.equal(once.items[0].targetKind, 'text');
  assert.equal(once.items[0].sourceAnchor.occurrence, 2);
  assert.equal(once.items[0].sourceAnchor.start, 12);
  assert.equal(once.items[0].renderedText, 'Hello');
});

test('creates a multiline mixed-format source anchor with readable preview', async () => {
  const { createTextBookmarkRecord } = await import(modelUrl);
  const source = 'Before **bold** and `code` with $math$\nthen _italic_ @ & after';
  const start = source.indexOf('**bold**');
  const end = source.indexOf(' after');
  const record = createTextBookmarkRecord({
    ...baseInput,
    source,
    sourceStart: start,
    sourceEnd: end,
    renderedText: 'bold and code with math\nthen italic @ &',
  });
  assert.equal(record.targetKind, 'text');
  assert.equal(record.sourceAnchor.fragment, '**bold** and `code` with $math$\nthen _italic_ @ &');
  assert.equal(record.renderedText, 'bold and code with math\nthen italic @ &');
  assert.ok(record.sourceAnchor.fingerprint.length >= 8);
});

test('resolves the third of ten identical words by exact occurrence', async () => {
  const { createTextBookmarkRecord, resolveBookmarkTarget } = await import(modelUrl);
  const source = Array.from({ length: 10 }, () => 'Hello').join(' ');
  const starts = [...source.matchAll(/Hello/g)].map((match) => match.index);
  const record = createTextBookmarkRecord({
    ...baseInput,
    source,
    sourceStart: starts[2],
    sourceEnd: starts[2] + 5,
    renderedText: 'Hello',
  });
  assert.deepEqual(resolveBookmarkTarget(record, source), {
    status: 'resolved', sourceStart: starts[2], sourceEnd: starts[2] + 5, occurrence: 2, kind: 'text',
  });
});

test('relocates a target after edits using surrounding source context', async () => {
  const { createTextBookmarkRecord, resolveBookmarkTarget } = await import(modelUrl);
  const original = 'Alpha\nImportant target\nOmega';
  const start = original.indexOf('Important target');
  const record = createTextBookmarkRecord({
    ...baseInput,
    source: original,
    sourceStart: start,
    sourceEnd: start + 'Important target'.length,
    renderedText: 'Important target',
  });
  const edited = 'New intro\nAlpha\nImportant target\nOmega';
  const relocated = edited.indexOf('Important target');
  assert.deepEqual(resolveBookmarkTarget(record, edited), {
    status: 'resolved', sourceStart: relocated, sourceEnd: relocated + 'Important target'.length, occurrence: 0, kind: 'text',
  });
});

test('returns targetChanged when identical edited targets are ambiguous', async () => {
  const { createTextBookmarkRecord, resolveBookmarkTarget } = await import(modelUrl);
  const original = 'prefix one\nSame\nsuffix one';
  const start = original.indexOf('Same');
  const record = createTextBookmarkRecord({
    ...baseInput,
    source: original,
    sourceStart: start,
    sourceEnd: start + 4,
    renderedText: 'Same',
  });
  assert.deepEqual(resolveBookmarkTarget(record, 'Same\nSame'), { status: 'targetChanged' });
});

test('resolves math, mermaid, image, and link identities to exact occurrences', async () => {
  const { createObjectBookmarkRecord, resolveBookmarkTarget } = await import(modelUrl);
  const cases = [
    { kind: 'math', fragment: '$x+y$', identity: { mathSource: 'x+y' } },
    { kind: 'mermaid', fragment: '```mermaid\ngraph TD; A-->B\n```', identity: { mermaidSource: 'graph TD; A-->B' } },
    { kind: 'image', fragment: '![logo](logo.png)', identity: { url: 'logo.png', alt: 'logo' } },
    { kind: 'link', fragment: '[Docs](https://example.com)', identity: { url: 'https://example.com', label: 'Docs' } },
  ];
  for (const item of cases) {
    const source = `${item.fragment}\nother\n${item.fragment}`;
    const start = source.lastIndexOf(item.fragment);
    const record = createObjectBookmarkRecord({
      ...baseInput,
      name: item.kind,
      targetKind: item.kind,
      source,
      sourceStart: start,
      sourceEnd: start + item.fragment.length,
      renderedText: item.kind,
      objectIdentity: item.identity,
    });
    const resolved = resolveBookmarkTarget(record, source);
    assert.equal(resolved.status, 'resolved');
    assert.equal(resolved.sourceStart, start);
    assert.equal(resolved.occurrence, 1);
    assert.equal(resolved.kind, item.kind);
  }
});

test('batch deletion persists one atomic snapshot', async () => {
  const { createBookmarkStore } = await import(storeUrl);
  const storage = new MemoryStorage();
  let writes = 0;
  const observed = {
    getItem: (key) => storage.getItem(key),
    setItem: (key, value) => { writes += 1; storage.setItem(key, value); },
  };
  const store = createBookmarkStore(observed);
  const record = (id) => ({
    id, name: id, workspaceKey: '/docs', workspaceName: 'Docs', workspacePath: '/docs', filePath: '/docs/a.md',
    targetKind: 'text', renderedText: id, selectedText: id, matchOrdinal: 0, matchIndex: 0, prefix: '', suffix: '',
    sourceAnchor: { start: 0, end: id.length, fragment: id, fingerprint: `fp-${id}`, occurrence: 0, prefix: '', suffix: '' },
    createdAt: 1, updatedAt: 1,
  });
  store.add(record('a')); store.add(record('b')); store.add(record('c'));
  const before = writes;
  assert.equal(store.removeMany(['a', 'c']), true);
  assert.equal(writes, before + 1);
  assert.deepEqual(store.getSnapshot().items.map((item) => item.id), ['b']);
  assert.equal(store.removeMany(['missing']), false);
  assert.equal(writes, before + 1);
});
