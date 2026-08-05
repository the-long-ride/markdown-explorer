import assert from 'node:assert/strict';
import test from 'node:test';

const parserUrl = new URL('../../ui/src/markdown/parser.ts', import.meta.url);

test('block tokens retain exact source ranges after frontmatter and comments', async () => {
  const { parse } = await import(parserUrl);
  const source = '<!-- preamble -->\n---\ntitle: Demo\n---\n\nText **bold** and `code`.\n\n$$\nx+y\n$$\n';
  const result = parse(source);
  const paragraph = result.tokens.find((token) => token.type === 'paragraph');
  const math = result.tokens.find((token) => token.type === 'math');
  assert.equal(source.slice(paragraph.sourceStart, paragraph.sourceEnd), 'Text **bold** and `code`.');
  assert.equal(paragraph.sourceText, 'Text **bold** and `code`.');
  assert.equal(source.slice(math.sourceStart, math.sourceEnd), '$$\nx+y\n$$');
  assert.equal(math.sourceText, '$$\nx+y\n$$');
});

test('multiline paragraph source range preserves newlines instead of rendered spaces', async () => {
  const { parse } = await import(parserUrl);
  const source = 'First **bold** line\nsecond _italic_ line\nthird `code` line';
  const [paragraph] = parse(source).tokens;
  assert.equal(paragraph.type, 'paragraph');
  assert.equal(paragraph.text, 'First **bold** line second _italic_ line third `code` line');
  assert.equal(paragraph.sourceText, source);
  assert.equal(paragraph.sourceStart, 0);
  assert.equal(paragraph.sourceEnd, source.length);
});

test('HTML comments are captured once and do not duplicate their source', async () => {
  const { parse } = await import(parserUrl);
  const source = '<!-- hello -->\nAfter';
  const tokens = parse(source).tokens;
  assert.equal(tokens[0].type, 'html-comment');
  assert.equal(tokens[0].content.trim(), 'hello');
  assert.equal(tokens[0].sourceText, '<!-- hello -->');
  assert.equal(tokens[1].type, 'paragraph');
  assert.equal(tokens[1].sourceText, 'After');
});

const domAnchorsUrl = new URL('../../ui/src/bookmarks/bookmarkDomAnchors.ts', import.meta.url);

test('projects mixed Markdown formatting to visible text and maps a multiline selection back to markers', async () => {
  const { projectMarkdownSource, mapRenderedOffsetsToSource } = await import(domAnchorsUrl);
  const source = '**bold** and _italic_ with `code`, ~~strike~~, $x+y$, @ &\nnext line';
  const projection = projectMarkdownSource(source);
  assert.equal(projection.text, 'bold and italic with code, strike, x+y, @ & next line');
  const visibleStart = projection.text.indexOf('bold');
  const visibleEnd = projection.text.indexOf('next line') + 'next line'.length;
  const mapped = mapRenderedOffsetsToSource(source, visibleStart, visibleEnd);
  assert.equal(source.slice(mapped.start, mapped.end), '**bold** and _italic_ with `code`, ~~strike~~, $x+y$, @ &\nnext line');
});

test('locates exact repeated object occurrence for math, Mermaid, image, and link', async () => {
  const { locateBookmarkObjectSource } = await import(domAnchorsUrl);
  const cases = [
    { kind: 'math', source: '$x$ then $x$', identity: { mathSource: 'x' }, occurrence: 1, expected: '$x$' },
    { kind: 'image', source: '![a](x.png) ![a](x.png)', identity: { url: 'x.png', alt: 'a' }, occurrence: 1, expected: '![a](x.png)' },
    { kind: 'link', source: '[A](x) [A](x)', identity: { url: 'x', label: 'A' }, occurrence: 1, expected: '[A](x)' },
    { kind: 'mermaid', source: '```mermaid\ngraph TD; A-->B\n```', identity: { mermaidSource: 'graph TD; A-->B' }, occurrence: 0, expected: '```mermaid\ngraph TD; A-->B\n```' },
  ];
  for (const item of cases) {
    const located = locateBookmarkObjectSource(item.kind, item.source, item.identity, item.occurrence);
    assert.equal(item.source.slice(located.start, located.end), item.expected);
  }
});

test('renderer emits source ranges and bookmark identities for text, code, math, Mermaid, images, and links', async () => {
  const { readFile } = await import('node:fs/promises');
  const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
  const [renderer, inline, codeRenderer] = await Promise.all([
    read('ui/src/markdown/renderer.ts'),
    read('ui/src/markdown/inline.ts'),
    read('ui/src/markdown/codeRenderer.ts'),
  ]);
  assert.match(renderer, /data-mdn-source-start/);
  assert.match(renderer, /data-mdn-source-end/);
  assert.match(renderer, /data-mdn-bookmark-kind/);
  assert.match(inline, /bookmarkAttrs\('image'/);
  assert.match(inline, /bookmarkAttrs\('link'/);
  assert.match(inline, /bookmarkAttrs\('math'/);
  assert.match(inline, /bookmarkAttrs\('code'/);
  assert.match(codeRenderer, /sourceAttributes\(token, 'mermaid'\)/);
  assert.match(codeRenderer, /data-mdn-source-start/);
});

test('safe inline HTML images and links expose bookmark identity and resolve to exact source objects', async () => {
  const { readFile } = await import('node:fs/promises');
  const inlineSource = await readFile(new URL('../../ui/src/markdown/inline.ts', import.meta.url), 'utf8');
  const { locateBookmarkObjectSource } = await import(domAnchorsUrl);
  const source = '<img src="x.png" alt="first"> <img src="x.png" alt="second"> <a href="docs.md">Docs</a>';
  assert.match(inlineSource, /decorateSafeHtmlBookmarkTag/);
  assert.match(inlineSource, /bookmarkAttrs\('image'/);
  assert.match(inlineSource, /bookmarkAttrs\('link'/);
  const image = locateBookmarkObjectSource('image', source, { url: 'x.png', alt: 'second' }, 0);
  const link = locateBookmarkObjectSource('link', source, { url: 'docs.md' }, 0);
  assert.ok(image);
  assert.ok(link);
  assert.equal(source.slice(image.start, image.end), '<img src="x.png" alt="second">');
  assert.equal(source.slice(link.start, link.end), '<a href="docs.md">Docs</a>');
});

test('object capture creates persistable image, Mermaid, and link bookmarks without relying on DOM source wrappers', async () => {
  const { captureBookmarkObjectFromSource } = await import(domAnchorsUrl);
  const { createObjectBookmarkRecord } = await import(new URL('../../ui/src/bookmarks/bookmarkModel.ts', import.meta.url));
  const { createBookmarkStore } = await import(new URL('../../ui/src/bookmarks/bookmarkStore.ts', import.meta.url));
  const values = new Map();
  const store = createBookmarkStore({
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  });
  const cases = [
    {
      kind: 'image',
      source: 'Before\n\n![Diagram](assets/diagram.png)\n\nAfter',
      identity: { alt: 'Diagram', url: 'assets/diagram.png' },
      expected: '![Diagram](assets/diagram.png)',
    },
    {
      kind: 'mermaid',
      source: '```mermaid\ngraph TD; A-->B\n```',
      identity: { mermaidSource: 'graph TD; A-->B' },
      expected: '```mermaid\ngraph TD; A-->B\n```',
    },
    {
      kind: 'link',
      source: 'Read [Guide](./guide.md) now.',
      identity: { label: 'Guide', url: './guide.md' },
      expected: '[Guide](./guide.md)',
    },
  ];
  for (const [index, item] of cases.entries()) {
    const capture = captureBookmarkObjectFromSource(item.kind, item.source, item.identity, 0, '');
    assert.ok(capture);
    assert.equal(item.source.slice(capture.sourceStart, capture.sourceEnd), item.expected);
    assert.ok(capture.renderedText);
    const record = createObjectBookmarkRecord({
      id: `object-${index}`,
      name: `Object ${index}`,
      workspaceName: 'Workspace',
      workspacePath: '/workspace',
      filePath: '/workspace/doc.md',
      source: item.source,
      sourceStart: capture.sourceStart,
      sourceEnd: capture.sourceEnd,
      renderedText: capture.renderedText,
      targetKind: item.kind,
      objectIdentity: capture.objectIdentity,
      now: index + 1,
    });
    assert.ok(record);
    store.add(record);
  }
  assert.equal(store.getSnapshot().items.length, 3);
});
