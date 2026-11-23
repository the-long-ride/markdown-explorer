import { describe, expect, it, vi } from 'vitest';
import { composePdfArtifacts } from '../../../../ui/src/export/pdf/pdfComposer';

const theme = { rootAttributes: {}, cssVariables: {}, cssText: '', fontFaceCss: '' } as any;
const file = (title: string) => ({ fsPath: `/d/${title}.md`, relativePath: `${title}.md`, parts: [], fileName: 'Fallback Name.mdx', title, extension: '.md', documentKind: 'markdown' }) as any;

function loader(definitions: any[], buffer: unknown = new ArrayBuffer(4)) {
  const pdfMake = { addVirtualFileSystem: vi.fn(), addFonts: vi.fn(), createPdf: (definition: any) => { definitions.push(definition); return { getBuffer: async () => buffer }; } };
  return { pdfMake, load: async () => ({ defaultVfs: {}, pdfMake }) } as any;
}

describe('composePdfArtifacts visual fallbacks', () => {
  it('rejects empty document lists', async () => {
    await expect(composePdfArtifacts({ documents: [], batchMode: 'separate', title: 'x', baseName: 'x', theme, loadPdfMake: loader([]).load })).rejects.toThrow('no documents');
  });

  it('resolves image, fallback and missing visuals inside lists and tables', async () => {
    const definitions: any[] = [];
    const html = '<ul><li><a href="https://x.dev">link</a><div data-mdn-pdf-visual-id="img"></div></li></ul><ol><li><div data-mdn-pdf-visual-id="none"></div></li></ol><table><tr><td><div data-mdn-pdf-visual-id="missing"></div></td></tr></table><blockquote><div data-mdn-pdf-visual-id="empty"></div></blockquote>';
    const documents = [{
      file: file(''), markdownSource: '', html, features: new Set(['core']), warnings: [],
      visualBlocks: [
        { id: 'img', kind: 'image', image: 'data:image/png;base64,AA', width: 10, height: 10, warning: 'w1' },
        { id: 'none', kind: 'chart', fallbackText: 'chart text', width: 10, height: 10 },
        { id: 'empty', kind: 'chart', width: 10, height: 10 },
      ],
    }] as any;
    const { load } = loader(definitions, new Uint8Array([1, 2, 3, 4]).subarray(1));
    const artifacts = await composePdfArtifacts({ documents, batchMode: 'separate', title: '', baseName: 'b', theme, loadPdfMake: load });
    expect(artifacts[0].fileName).toBe('Fallback Name.pdf');
    expect([...artifacts[0].bytes]).toEqual([2, 3, 4]);
    const json = JSON.stringify(definitions[0].content);
    expect(json).toContain('data:image/png;base64,AA');
    expect(json).toContain('chart text');
    expect(json).toContain('Visual block unavailable');
    const ab = await composePdfArtifacts({ documents, batchMode: 'merged', title: 'T', baseName: 'b', theme, loadPdfMake: loader([]).load });
    expect(ab[0].bytes).toBeInstanceOf(Uint8Array);
  });
});
