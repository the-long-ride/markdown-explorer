import { describe, expect, it, vi } from 'vitest';
import type { MdFile } from '../../../../ui/src/types/files';
import { composePdfArtifacts } from '../../../../ui/src/export/pdf/pdfComposer';
import { buildPdfPalette, layoutPdfVisual } from '../../../../ui/src/export/pdf/pdfPrintLayout';
import type { PdfDocumentDefinition, PdfMakeLoader, PdfVisualBlock } from '../../../../ui/src/export/pdf/pdfModel';
import type { ExportDocumentSnapshot } from '../../../../ui/src/export/exportSnapshot';
import type { ExportThemeSnapshot } from '../../../../ui/src/export/exportTheme';

const theme: ExportThemeSnapshot = {
  rootAttributes: { 'data-theme': 'dark' },
  cssVariables: { '--tx': '#eeeeee', '--tx-m': '#cfcfcf', '--bg': '#111111', '--bg-e': '#222222', '--accent': '#e5e7eb' },
  cssText: '', fontFaceCss: '',
};

function file(name: string): MdFile {
  return { fsPath: `/docs/${name}.md`, relativePath: `${name}.md`, parts: [`${name}.md`], fileName: `${name}.md`, title: name, extension: '.md', documentKind: 'markdown' };
}

function snapshot(name: string): ExportDocumentSnapshot {
  return {
    file: file(name), markdownSource: `# ${name}`,
    html: `<h1>${name}</h1><p>Selectable body text</p><div data-mdn-pdf-visual-id="pdfv-1"></div>`,
    features: new Set(['core']),
    visualBlocks: [{ id: 'pdfv-1', kind: 'mermaid', svg: '<svg width="500" height="300"><text>Diagram</text></svg>', width: 500, height: 300 }],
    warnings: [],
  };
}

function fakeLoader(definitions: PdfDocumentDefinition[]): PdfMakeLoader {
  return async () => ({
    defaultVfs: { 'Roboto-Regular.ttf': 'base64' },
    pdfMake: {
      addVirtualFileSystem: vi.fn(), addFonts: vi.fn(),
      createPdf: (definition) => {
        definitions.push(definition);
        return { getBuffer: async () => new Uint8Array([37, 80, 68, 70]) };
      },
    },
  });
}

describe('PDF print layout', () => {
  it('normalizes dark or low-contrast theme colors to a readable print palette', () => {
    const palette = buildPdfPalette(theme);
    expect(palette.page).toBe('#ffffff');
    expect(palette.text).toBe('#1f2328');
    expect(palette.muted).toBe('#57606a');
    expect(palette.panel).toBe('#f6f8fa');
    expect(palette.border).toBe('#d0d7de');
    expect(palette.link).toBe('#0969da');
  });

  it('uses aspect-aware fits and landscape only for genuinely wide visuals', () => {
    const wide = layoutPdfVisual({ id: 'wide', kind: 'chart', width: 1600, height: 520 } as PdfVisualBlock);
    const normal = layoutPdfVisual({ id: 'normal', kind: 'mermaid', width: 800, height: 600 } as PdfVisualBlock);
    const tall = layoutPdfVisual({ id: 'tall', kind: 'image', width: 500, height: 1200 } as PdfVisualBlock);

    expect(wide.orientation).toBe('landscape');
    expect(wide.fit[0]).toBeGreaterThan(500);
    expect(normal.orientation).toBe('portrait');
    expect(tall.orientation).toBe('portrait');
    expect(wide.fit).not.toEqual([500, 360]);
    expect(normal.fit).not.toEqual([500, 360]);
    expect(tall.fit).not.toEqual([500, 360]);
  });
});

describe('hybrid PDF composer', () => {
  it('keeps ordinary text semantic, resolves visuals with aspect-aware layout, and adds page numbering', async () => {
    const definitions: PdfDocumentDefinition[] = [];
    const artifacts = await composePdfArtifacts({ documents: [snapshot('Guide')], batchMode: 'separate', title: 'Guide', baseName: 'guide', theme, loadPdfMake: fakeLoader(definitions) });
    expect(artifacts[0].fileName).toBe('Guide.pdf');
    expect([...artifacts[0].bytes]).toEqual([37, 80, 68, 70]);
    expect(JSON.stringify(definitions[0].content)).toContain('Selectable body text');
    expect(JSON.stringify(definitions[0].content)).toContain('<svg');
    expect(JSON.stringify(definitions[0].content)).not.toContain('"fit":[500,360]');
    expect(definitions[0].defaultStyle?.color).toBe('#000000');
    expect(definitions[0].defaultStyle?.lineHeight).toBe(1.35);
    expect(definitions[0].pageSize).toBe('A4');
    expect([...(definitions[0].pageMargins ?? [])]).toEqual([72, 72, 72, 72]);
    expect(definitions[0].styles?.code).toMatchObject({ color: '#000000', fillColor: '#f2f2f2' });
    expect(definitions[0].styles?.h2).toMatchObject({ fontSize: 16, bold: true });
    expect(definitions[0].footer).toBeTypeOf('function');
    expect(JSON.stringify(definitions[0].footer?.(2, 5))).toContain('2 / 5');
  });

  it('adds page breaks between merged documents and has no runtime-specific gate', async () => {
    const definitions: PdfDocumentDefinition[] = [];
    const artifacts = await composePdfArtifacts({ documents: [snapshot('One'), snapshot('Two')], batchMode: 'merged', title: 'Docs', baseName: 'docs', theme, loadPdfMake: fakeLoader(definitions) });
    expect(artifacts[0].fileName).toBe('docs-merged.pdf');
    expect(definitions[0].content.some((node) => node.pageBreak === 'before')).toBe(true);
  });
});
