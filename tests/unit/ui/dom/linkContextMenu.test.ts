import { describe, expect, test } from 'vitest';
import { resolveRenderedLink } from '../../../../ui/src/dom/linkContextMenu';

describe('resolveRenderedLink', () => {
  test('normalizes web URLs', () => {
    const anchor = document.createElement('a');
    anchor.href = 'https://example.com/a';
    expect(resolveRenderedLink(anchor, '/tmp/readme.md').resolved).toBe('https://example.com/a');
  });

  test('uses internal markdown target metadata instead of href hash placeholder', () => {
    const anchor = document.createElement('a');
    anchor.href = '#';
    anchor.dataset.mdnTarget = 'guide/setup.md#install';
    const result = resolveRenderedLink(anchor, '/tmp/docs/readme.md');
    expect(result.resolved).toBe('file:///tmp/docs/guide/setup.md#install');
    expect(result.openable).toBe(true);
  });

  test('resolves fragments against the current document', () => {
    const anchor = document.createElement('a');
    anchor.setAttribute('href', '#part');
    const result = resolveRenderedLink(anchor, '/tmp/docs/readme.md');
    expect(result.kind).toBe('fragment');
    expect(result.resolved).toBe('file:///tmp/docs/readme.md#part');
  });

  test('resolves virtual workspace links from the current document folder', () => {
    const anchor = document.createElement('a');
    anchor.dataset.mdnTarget = '../guide.md';
    const result = resolveRenderedLink(
      anchor,
      'docs/reference/readme.md',
      'https://example.test/app/index.html',
    );
    expect(result.resolved).toBe('https://example.test/app/docs/guide.md');
  });

  test('blocks dangerous schemes', () => {
    const anchor = document.createElement('a');
    anchor.setAttribute('href', 'javascript:alert(1)');
    const result = resolveRenderedLink(anchor, '/tmp/docs/readme.md');
    expect(result.openable).toBe(false);
    expect(result.copyable).toBe(false);
  });
});
