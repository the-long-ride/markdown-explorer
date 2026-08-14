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

describe('copyImage module', () => {
  test('prepareStandaloneSvgForRasterization inlines dimensions and xmlns namespaces', async () => {
    const { prepareStandaloneSvgForRasterization } = await import('../../../../ui/src/dom/copyImage');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 400 300');
    const { svgXml, width, height } = prepareStandaloneSvgForRasterization(svg);
    expect(svgXml).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svgXml).toContain('width="400"');
    expect(svgXml).toContain('height="300"');
    expect(width).toBe(400);
    expect(height).toBe(300);
  });

  test('writeBlobToClipboard invokes navigator.clipboard.write with PNG ClipboardItem', async () => {
    const { writeBlobToClipboard } = await import('../../../../ui/src/dom/copyImage');
    let writtenItems: any[] = [];
    (globalThis as any).ClipboardItem = class MockClipboardItem {
      types: string[];
      constructor(public data: Record<string, Blob>) {
        this.types = Object.keys(data);
      }
    };
    (navigator as any).clipboard = {
      write: async (items: any[]) => {
        writtenItems = items;
      },
    };

    const blob = new Blob(['png-binary-data'], { type: 'image/png' });
    const ok = await writeBlobToClipboard(blob);
    expect(ok).toBe(true);
    expect(writtenItems.length).toBe(1);
    expect(writtenItems[0].types).toContain('image/png');
  });
});

