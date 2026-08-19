import { describe, expect, it } from 'vitest';
import type { DocumentSnapshot } from '../../../../ui/src/export/documentSnapshot';
import type { MdFile } from '../../../../ui/src/types/files';
import {
  detectExportFeatures,
  enhanceExportSnapshot,
  mapWithConcurrency,
} from '../../../../ui/src/export/exportSnapshot';

function createRoot(html: string): HTMLElement {
  const root = document.createElement('div');
  root.innerHTML = html;
  return root;
}

function file(): MdFile {
  return {
    fsPath: '/docs/guide.md',
    relativePath: 'guide.md',
    parts: ['guide.md'],
    fileName: 'guide.md',
    title: 'Guide',
    extension: '.md',
    documentKind: 'markdown',
  };
}

describe('export feature detection', () => {
  it('keeps plain and code-only documents on the core runtime', () => {
    const plain = detectExportFeatures(createRoot('<p>Hello</p>'));
    const code = detectExportFeatures(createRoot('<div class="mdn-codeblock"><button class="mdn-copy-btn">Copy</button></div>'));

    expect([...plain]).toEqual(['core']);
    expect([...code]).toEqual(['core']);
  });

  it('detects portable media and HTML preview features without requiring Mermaid runtime JS', () => {
    const root = createRoot(`
      <img src="image.png" alt="Example">
      <div class="mdn-mermaid-wrap"><div class="mermaid" data-mdn-rendered="true"><svg></svg></div></div>
      <div class="mdn-html-preview-wrap"><iframe class="mdn-html-preview-iframe"></iframe></div>
    `);

    expect([...detectExportFeatures(root)]).toEqual(['core', 'htmlPreview', 'mediaModal']);
  });

  it('detects enhanced data tables and adds charts only when the chart view switcher exists', () => {
    const tableOnly = createRoot('<div class="mdn-table-wrap"><table class="mdn-table" data-mdn-enhanced="true"></table></div>');
    const chartable = createRoot(`
      <div class="mdn-table-wrap">
        <div class="mdn-table-view-dropdown"></div>
        <table class="mdn-table" data-mdn-enhanced="true"></table>
        <div class="mdn-table-chart-container"><canvas></canvas></div>
      </div>
    `);

    expect([...detectExportFeatures(tableOnly)]).toEqual(['core', 'dataTable']);
    expect([...detectExportFeatures(chartable)]).toEqual(['core', 'dataTable', 'charts']);
  });
});

describe('enhanced export snapshots', () => {
  it('enhances in a connected offscreen host, serializes the result, records visual blocks, and cleans up', async () => {
    const snapshot: DocumentSnapshot = {
      file: file(),
      markdownSource: '# Guide',
      html: '<p id="target">Guide</p><img id="hero" src="hero.png">',
    };

    const enhanced = await enhanceExportSnapshot(snapshot, {
      isDark: true,
      enhance: async ({ body }) => {
        expect(body.isConnected).toBe(true);
        body.querySelector('#target')?.setAttribute('data-enhanced', 'true');
        body.insertAdjacentHTML('beforeend', `
          <div class="mdn-html-preview-wrap"><iframe id="preview" class="mdn-html-preview-iframe"></iframe></div>
          <div class="mdn-mermaid-wrap"><div class="mermaid" data-mdn-rendered="true"><svg id="diagram"></svg></div></div>
        `);
      },
    });

    expect(enhanced.html).toContain('data-enhanced="true"');
    expect([...enhanced.features]).toEqual(['core', 'htmlPreview', 'mediaModal']);
    expect(enhanced.visualBlocks.map((block) => block.kind)).toEqual(['image', 'htmlPreview', 'mermaid']);
    expect(enhanced.warnings).toEqual([]);
    expect(document.querySelector('[data-mdn-export-staging]')).toBeNull();
  });
});

describe('mapWithConcurrency', () => {
  it('preserves input ordering while never exceeding the requested concurrency', async () => {
    let active = 0;
    let maximum = 0;
    const settled = await mapWithConcurrency([20, 5, 10, 1], 2, async (delay) => {
      active += 1;
      maximum = Math.max(maximum, active);
      await new Promise((resolve) => setTimeout(resolve, delay));
      active -= 1;
      return `done-${delay}`;
    });

    expect(maximum).toBe(2);
    expect(settled).toEqual([
      { status: 'fulfilled', value: 'done-20' },
      { status: 'fulfilled', value: 'done-5' },
      { status: 'fulfilled', value: 'done-10' },
      { status: 'fulfilled', value: 'done-1' },
    ]);
  });

  it('settles individual failures without preventing later work', async () => {
    const settled = await mapWithConcurrency([1, 2, 3], 2, async (value) => {
      if (value === 2) throw new Error('boom');
      return value * 2;
    });

    expect(settled[0]).toEqual({ status: 'fulfilled', value: 2 });
    expect(settled[1]).toMatchObject({ status: 'rejected' });
    expect(settled[2]).toEqual({ status: 'fulfilled', value: 6 });
  });
});