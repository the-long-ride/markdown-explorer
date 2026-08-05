import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
const modelUrl = new URL('../../ui/src/bookmarks/bookmarkModel.ts', import.meta.url);
const storeUrl = new URL('../../ui/src/bookmarks/bookmarkStore.ts', import.meta.url);
const labelsUrl = new URL('../../ui/src/bookmarks/bookmarkDefaultName.ts', import.meta.url);
const commandsUrl = new URL('../../ui/src/bookmarks/bookmarkCommands.ts', import.meta.url);

class SilentStorage {
  getItem() { return null; }
  setItem() {}
}

test('bookmark storage rejects silent persistence failures without mutating the snapshot', async () => {
  const [{ createTextBookmarkRecord }, { createBookmarkStore }] = await Promise.all([
    import(modelUrl),
    import(storeUrl),
  ]);
  const record = createTextBookmarkRecord({
    id: 'persist-check',
    name: 'Persist check',
    workspaceName: 'Docs',
    workspacePath: '/docs',
    filePath: '/docs/readme.md',
    source: 'Hello world',
    sourceStart: 0,
    sourceEnd: 5,
    renderedText: 'Hello',
    now: 1,
  });
  assert.ok(record);
  const store = createBookmarkStore(new SilentStorage());
  assert.throws(() => store.add(record), /bookmark-persist-failed/);
  assert.deepEqual(store.getSnapshot().items, []);
});

test('Mermaid bookmark names use the first entrypoint node label', async () => {
  const { getMermaidBookmarkDefaultName } = await import(labelsUrl);
  assert.equal(getMermaidBookmarkDefaultName('flowchart TD\n  validate{Valid?} --> done[Done]\n  start([Begin import]) --> validate'), 'Begin import');
  assert.equal(getMermaidBookmarkDefaultName('flowchart TD\n  start[Telemetry ingestion]\n  validate{Valid?}\n  start --> validate'), 'Telemetry ingestion');
  assert.equal(getMermaidBookmarkDefaultName('stateDiagram-v2\n  [*] --> Idle\n  Idle --> Running'), 'Idle');
  assert.equal(getMermaidBookmarkDefaultName('sequenceDiagram\n  participant API as Public API\n  API->>DB: Query'), 'Public API');
});


test('image and link captures save through one verified command and failed writes return an explicit reason', async () => {
  const [{ captureBookmarkObjectFromSource }, { createBookmarkStore }, { saveBookmarkCapture }] = await Promise.all([
    import(new URL('../../ui/src/bookmarks/bookmarkDomAnchors.ts', import.meta.url)),
    import(storeUrl),
    import(commandsUrl),
  ]);
  const values = new Map();
  const store = createBookmarkStore({
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  });
  const cases = [
    { kind: 'image', source: '![Graph](graph.png)', identity: { alt: 'Graph', url: 'graph.png' } },
    { kind: 'link', source: '[Guide](guide.md)', identity: { label: 'Guide', url: 'guide.md' } },
  ];
  for (const [index, item] of cases.entries()) {
    const capture = captureBookmarkObjectFromSource(item.kind, item.source, item.identity);
    assert.ok(capture);
    const result = saveBookmarkCapture({
      name: `Saved ${item.kind}`,
      workspaceName: 'Docs',
      workspacePath: '/docs',
      filePath: '/docs/readme.md',
      documentText: item.source,
      ...capture,
    }, store);
    assert.equal(result.ok, true);
    assert.equal(store.getSnapshot().items.find((bookmark) => bookmark.name === `Saved ${item.kind}`)?.targetKind, item.kind);
  }

  const failure = saveBookmarkCapture({
    name: 'Broken image', workspaceName: 'Docs', workspacePath: '/docs', filePath: '/docs/readme.md',
    documentText: '![Graph](graph.png)', targetKind: 'image', sourceStart: 0, sourceEnd: 19,
    renderedText: 'Graph', objectIdentity: { alt: 'Graph', url: 'graph.png' },
  }, createBookmarkStore(new SilentStorage()));
  assert.deepEqual(failure, { ok: false, reason: 'storage-unavailable' });
});

test('bookmark rename command verifies the persisted name', async () => {
  const [{ createBookmarkStore }, { saveBookmarkCapture, renameBookmarkWithVerification }] = await Promise.all([
    import(storeUrl), import(commandsUrl),
  ]);
  const values = new Map();
  const store = createBookmarkStore({ getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) });
  const saved = saveBookmarkCapture({
    name: 'Original', workspaceName: 'Docs', workspacePath: '/docs', filePath: '/docs/readme.md',
    documentText: 'Hello', targetKind: 'text', sourceStart: 0, sourceEnd: 5, renderedText: 'Hello',
  }, store);
  assert.equal(saved.ok, true);
  if (!saved.ok) return;
  assert.deepEqual(renameBookmarkWithVerification(saved.record.id, 'Updated', store), { ok: true });
  assert.equal(store.getSnapshot().items[0].name, 'Updated');
});

test('direct object actions open one naming dialog and emit verified success or error notices', async () => {
  const [selectionMenu, content, panel, notice, css] = await Promise.all([
    read('ui/src/components/Bookmarks/BookmarkSelectionMenu.tsx'),
    read('ui/src/components/Content/Content.tsx'),
    read('ui/src/components/Bookmarks/BookmarksPanel.tsx'),
    read('ui/src/utils/actionNotice.ts'),
    read('ui/src/styles/global/global-action-notice.css'),
  ]);
  assert.match(selectionMenu, /state\?\.presentation === 'dialog'/);
  assert.match(selectionMenu, /open=\{isDialogOpen\}/);
  assert.doesNotMatch(selectionMenu, /openDialogImmediately/);
  assert.match(selectionMenu, /saveBookmarkCapture/);
  assert.match(selectionMenu, /dispatchActionNotice\(translations\.savedSuccess, 'success'\)/);
  assert.match(selectionMenu, /translations\.saveFailed/);
  assert.match(content, /if \(!opened\) showActionNotice\(t\.bookmarks\.targetUnavailable, 'error'\)/);
  assert.match(panel, /translations\.renamedSuccess/);
  assert.match(panel, /translations\.renameFailed/);
  assert.match(notice, /ActionNoticeTone = 'neutral' \| 'success' \| 'error'/);
  assert.match(css, /mdn-action-notice--success[\s\S]*var\(--accent\)/);
  assert.match(css, /mdn-action-notice--error[\s\S]*#991b1b|#dc2626|#7f1d1d/);
});

test('bookmark save and edit feedback labels exist in every supported language', async () => {
  const [types, english, locales] = await Promise.all([
    read('ui/src/contexts/translationTypes.ts'),
    read('ui/src/contexts/translations.ts'),
    read('ui/src/contexts/translationsData.ts'),
  ]);
  for (const key of ['savedSuccess', 'saveFailed', 'renamedSuccess', 'renameFailed', 'storageUnavailable']) {
    assert.match(types, new RegExp(`${key}: string`));
    assert.match(english, new RegExp(`${key}:`));
    assert.equal((locales.match(new RegExp(`${key}:`, 'g')) || []).length, 9);
  }
});
