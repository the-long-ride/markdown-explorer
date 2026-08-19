import { describe, expect, it, vi } from 'vitest';
import type { MdFile } from '../../../../ui/src/types/files';
import { composePdfArtifacts } from '../../../../ui/src/export/pdf/pdfComposer';
import type { PdfDocumentDefinition, PdfMakeLoader } from '../../../../ui/src/export/pdf/pdfModel';
import type { ExportDocumentSnapshot } from '../../../../ui/src/export/exportSnapshot';
import type { ExportThemeSnapshot } from '../../../../ui/src/export/exportTheme';

const theme: ExportThemeSnapshot = {
  rootAttributes: { 'data-theme': 'dark' }, cssVariables: { '--tx': '#eeeeee', '--bg-e': '#222222' },
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
    visualBlocks: [{ id: 'pdfv-1', kind: 'mermaid', svg: '<svg width="100" height="40"><text>Diagram</text></svg>' }],
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

describe('hybrid PDF composer', () => {
  it('keeps ordinary text semantic and resolves Mermaid visual refs to SVG', async () => {
    const definitions: PdfDocumentDefinition[] = [];
    const artifacts = await composePdfArtifacts({ documents: [snapshot('Guide')], batchMode: 'separate', title: 'Guide', baseName: 'guide', theme, loadPdfMake: fakeLoader(definitions) });
    expect(artifacts[0].fileName).toBe('Guide.pdf');
    expect([...artifacts[0].bytes]).toEqual([37, 80, 68, 70]);
    expect(JSON.stringify(definitions[0].content)).toContain('Selectable body text');
    expect(JSON.stringify(definitions[0].content)).toContain('<svg');
    expect(JSON.stringify(definitions[0].content)).not.toContain('footer');
  });

  it('adds page breaks between merged documents and has no runtime-specific gate', async () => {
    const definitions: PdfDocumentDefinition[] = [];
    const artifacts = await composePdfArtifacts({ documents: [snapshot('One'), snapshot('Two')], batchMode: 'merged', title: 'Docs', baseName: 'docs', theme, loadPdfMake: fakeLoader(definitions) });
    expect(artifacts[0].fileName).toBe('docs-merged.pdf');
    expect(definitions[0].content.some((node) => node.pageBreak === 'before')).toBe(true);
  });
});
