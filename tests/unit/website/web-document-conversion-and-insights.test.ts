import { describe, it, expect, vi } from 'vitest';
import zlib from 'node:zlib';
import { supportsWorkspaceInsights } from '../../../ui/src/insights/runtimeCapabilities';
import {
  EXTRA_DOCUMENT_EXTENSIONS,
  isExtraDocumentFile,
  isSupportedWebDocumentFile,
  convertWebDocumentToMarkdown,
} from '../../../website-app/src/web-document-converter';
import { handleWebInsightsHostCommand } from '../../../website-app/src/web-insights-host';
import { handleWebTestMessage } from '../../../website-app/src/web-test-message-router';
import { BrowserScanner } from '../../../website-app/src/scanner';

function makeSimpleZip(entries: Record<string, string>): ArrayBuffer {
  const parts: Buffer[] = [];
  for (const [name, content] of Object.entries(entries)) {
    const nameBuf = Buffer.from(name);
    const dataBuf = Buffer.from(content);
    const compBuf = zlib.deflateRawSync(dataBuf);
    const local = Buffer.alloc(30 + nameBuf.length + compBuf.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(0, 14);
    local.writeUInt32LE(compBuf.length, 18);
    local.writeUInt32LE(dataBuf.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    nameBuf.copy(local, 30);
    compBuf.copy(local, 30 + nameBuf.length);
    parts.push(local);
  }
  const combined = Buffer.concat(parts);
  const ab = new ArrayBuffer(combined.length);
  new Uint8Array(ab).set(combined);
  return ab;
}

describe('Web - Document Conversion & Workspace Insights', () => {
  describe('Workspace Insights capability in Web', () => {
    it('returns true for supportsWorkspaceInsights("web") even when __webBus is present', () => {
      const orig = globalThis.window;
      try {
        (globalThis as any).window = { __webBus: new EventTarget() };
        expect(supportsWorkspaceInsights('web')).toBe(true);
      } finally {
        (globalThis as any).window = orig;
      }
    });

    it('returns false only for vscode runtime', () => {
      expect(supportsWorkspaceInsights('vscode')).toBe(false);
      expect(supportsWorkspaceInsights('electron')).toBe(true);
      expect(supportsWorkspaceInsights('web')).toBe(true);
    });

    it('handles insights commands via handleWebInsightsHostCommand', async () => {
      const messages: any[] = [];
      const context = {
        getFlatList: () => [
          {
            fsPath: 'doc1.md',
            relativePath: 'doc1.md',
            parts: ['doc1.md'],
            fileName: 'doc1.md',
            title: 'Doc 1',
            extension: '.md',
            documentKind: 'markdown' as const,
          },
          {
            fsPath: 'notes.txt',
            relativePath: 'notes.txt',
            parts: ['notes.txt'],
            fileName: 'notes.txt',
            title: 'notes',
            extension: '.txt',
            documentKind: 'document' as const,
          },
        ],
        getFileContent: (path: string) => (path === 'doc1.md' ? '# Hello Insights' : 'Some text notes'),
        send: (m: any) => messages.push(m),
      };

      const scanHandled = await handleWebInsightsHostCommand(
        { command: 'scanInsightsWorkspace', requestId: 'req-scan-1' },
        context,
      );
      expect(scanHandled).toBe(true);

      const batch = messages.find(m => m.command === 'insightsScanBatch');
      expect(batch).toBeDefined();
      expect(batch.entries.length).toBe(2);
      expect(batch.entries[0].relativePath).toBe('doc1.md');

      const complete = messages.find(m => m.command === 'insightsScanComplete');
      expect(complete).toBeDefined();
      expect(complete.totalEntries).toBe(2);

      const readHandled = await handleWebInsightsHostCommand(
        { command: 'readInsightsDocumentSource', requestId: 'req-read-1', relativePath: 'doc1.md' },
        context,
      );
      expect(readHandled).toBe(true);
      const readRes = messages.find(m => m.command === 'insightsDocumentSourceResult');
      expect(readRes.status).toBe('ok');
      expect(readRes.source).toBe('# Hello Insights');

      const probeHandled = await handleWebInsightsHostCommand(
        { command: 'probeWorkspaceResource', requestId: 'req-probe-1', documentPath: 'doc1.md', resourcePath: 'notes.txt' },
        context,
      );
      expect(probeHandled).toBe(true);
      const probeRes = messages.find(m => m.command === 'workspaceResourceProbeResult');
      expect(probeRes.status).toBe('exists');

      const watchHandled = await handleWebInsightsHostCommand(
        { command: 'setInsightsWatchState', requestId: 'req-watch-1' },
        context,
      );
      expect(watchHandled).toBe(true);
      const watchRes = messages.find(m => m.command === 'insightsRuntimeCapabilities');
      expect(watchRes.capabilities.fileChanges).toBe('unsupported');
    });
  });

  describe('Document Conversion extensions & checks', () => {
    it('recognizes all extra document extensions', () => {
      for (const ext of EXTRA_DOCUMENT_EXTENSIONS) {
        expect(isExtraDocumentFile(`file${ext}`)).toBe(true);
      }
      expect(isExtraDocumentFile('file.md')).toBe(false);
      expect(isExtraDocumentFile('file.mdx')).toBe(false);
      expect(isExtraDocumentFile('file.unknown')).toBe(false);
    });

    it('determines supported web document files depending on documentConversionEnabled flag', () => {
      expect(isSupportedWebDocumentFile('readme.md', false)).toBe(true);
      expect(isSupportedWebDocumentFile('readme.mdx', false)).toBe(true);
      expect(isSupportedWebDocumentFile('readme.markdown', false)).toBe(true);

      expect(isSupportedWebDocumentFile('table.csv', false)).toBe(false);
      expect(isSupportedWebDocumentFile('table.csv', true)).toBe(true);
      expect(isSupportedWebDocumentFile('report.docx', false)).toBe(false);
      expect(isSupportedWebDocumentFile('report.docx', true)).toBe(true);
    });
  });

  describe('Document format conversions', () => {
    it('converts markdown files with previewInfo: null', async () => {
      const res = await convertWebDocumentToMarkdown({
        name: 'test.md',
        text: '# Pure Markdown\n\nContent.',
      });
      expect(res.markdown).toBe('# Pure Markdown\n\nContent.');
      expect(res.previewInfo).toBeNull();
    });

    it('converts plain text files with TXT previewInfo and readOnly: false', async () => {
      const res = await convertWebDocumentToMarkdown({
        name: 'notes.txt',
        text: 'Just plain notes.',
      });
      expect(res.markdown).toBe('Just plain notes.');
      expect(res.previewInfo).toEqual({
        convertedFrom: 'TXT',
        readOnly: false,
        kind: 'text',
        sourceExtension: '.txt',
        sourceLabel: 'TXT',
      });
    });

    it('wraps CSV/TSV in data table code blocks with readOnly: true', async () => {
      const csvRes = await convertWebDocumentToMarkdown({
        name: 'data.csv',
        text: 'name,age\nAlice,30\nBob,25',
      });
      expect(csvRes.markdown).toBe('```csv\nname,age\nAlice,30\nBob,25\n```');
      expect(csvRes.previewInfo?.convertedFrom).toBe('CSV');
      expect(csvRes.previewInfo?.readOnly).toBe(true);

      const tsvRes = await convertWebDocumentToMarkdown({
        name: 'data.tsv',
        text: 'name\tage\nAlice\t30',
      });
      expect(tsvRes.markdown).toBe('```tsv\nname\tage\nAlice\t30\n```');
      expect(tsvRes.previewInfo?.convertedFrom).toBe('TSV');
      expect(tsvRes.previewInfo?.readOnly).toBe(true);
    });

    it('converts HTML files to readable markdown', async () => {
      const html = '<h1>Title</h1><p>Paragraph with <a href="https://example.com">link</a></p>';
      const res = await convertWebDocumentToMarkdown({
        name: 'doc.html',
        text: html,
      });
      expect(res.markdown).toContain('Title');
      expect(res.markdown).toContain('Paragraph');
      expect(res.previewInfo?.convertedFrom).toBe('HTML');
      expect(res.previewInfo?.readOnly).toBe(true);
    });

    it('converts RTF files by stripping formatting control words', async () => {
      const rtf = '{\\rtf1\\ansi\\deff0 {\\fonttbl{\\f0 Courier;}}\\pard\\b Heading\\b0\\par Paragraph text.\\par}';
      const res = await convertWebDocumentToMarkdown({
        name: 'doc.rtf',
        text: rtf,
      });
      expect(res.markdown).toContain('Heading');
      expect(res.markdown).toContain('Paragraph text.');
      expect(res.previewInfo?.convertedFrom).toBe('RTF');
      expect(res.previewInfo?.readOnly).toBe(true);
    });

    it('converts DOCX zip files by extracting word/document.xml', async () => {
      const docXml = '<w:document><w:body><w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Main Header</w:t></w:r></w:p><w:p><w:r><w:t>Hello DOCX paragraph.</w:t></w:r></w:p></w:body></w:document>';
      const zipBuffer = makeSimpleZip({ 'word/document.xml': docXml });

      const res = await convertWebDocumentToMarkdown({
        name: 'sample.docx',
        arrayBuffer: async () => zipBuffer,
      });

      expect(res.markdown).toContain('# Main Header');
      expect(res.markdown).toContain('Hello DOCX paragraph.');
      expect(res.previewInfo?.convertedFrom).toBe('DOCX');
      expect(res.previewInfo?.readOnly).toBe(true);
    });

    it('converts XLSX zip files into markdown tables', async () => {
      const stringsXml = '<sst><si><t>Product</t></si><si><t>Price</t></si><si><t>Apples</t></si></sst>';
      const sheetXml = '<worksheet><sheetData><row><c t="s"><v>0</v></c><c t="s"><v>1</v></c></row><row><c t="s"><v>2</v></c><c><v>10</v></c></row></sheetData></worksheet>';
      const zipBuffer = makeSimpleZip({
        'xl/sharedStrings.xml': stringsXml,
        'xl/worksheets/sheet1.xml': sheetXml,
      });

      const res = await convertWebDocumentToMarkdown({
        name: 'sheet.xlsx',
        arrayBuffer: async () => zipBuffer,
      });

      expect(res.markdown).toContain('| Product | Price |');
      expect(res.markdown).toContain('| Apples | 10 |');
      expect(res.previewInfo?.convertedFrom).toBe('XLSX');
    });
  });

  describe('BrowserScanner documentConversion toggle', () => {
    it('includes extra documents when documentConversion is true', async () => {
      const fakeFiles = new Map<string, any>([
        ['readme.md', { kind: 'file', name: 'readme.md', getFile: async () => ({ text: async () => '# Readme', lastModified: 100 }) }],
        ['report.docx', { kind: 'file', name: 'report.docx', getFile: async () => ({ text: async () => '', lastModified: 200 }) }],
        ['data.csv', { kind: 'file', name: 'data.csv', getFile: async () => ({ text: async () => 'a,b\n1,2', lastModified: 300 }) }],
      ]);

      const mockDirHandle: any = {
        values: async function* () {
          for (const item of fakeFiles.values()) {
            yield item;
          }
        },
      };

      const mdOnly = await BrowserScanner.scan(mockDirHandle, { documentConversion: false });
      expect(mdOnly.flat.map(f => f.fileName)).toEqual(['readme.md']);

      const withExtra = await BrowserScanner.scan(mockDirHandle, { documentConversion: true });
      expect(withExtra.flat.map(f => f.fileName).sort()).toEqual(['data.csv', 'readme.md', 'report.docx']);
      expect(withExtra.flat.find(f => f.fileName === 'readme.md')?.documentKind).toBe('markdown');
      expect(withExtra.flat.find(f => f.fileName === 'data.csv')?.documentKind).toBe('document');
    });
  });

  describe('Test Router setDocumentConversion handling', () => {
    it('updates documentConversionEnabled and refreshes test workspace', async () => {
      let docConvEnabled = false;
      let refreshed = false;

      const deps = {
        getReadyHandled: () => true,
        setReadyHandled: vi.fn(),
        setCurrentFile: vi.fn(),
        getCurrentFile: () => null,
        getFlatList: () => [],
        send: vi.fn(),
        sendTestReady: vi.fn(),
        sendTestContent: vi.fn(),
        refreshTestWorkspace: async () => { refreshed = true; },
        getDocumentConversionEnabled: () => docConvEnabled,
        setDocumentConversionEnabled: (val: boolean) => { docConvEnabled = val; },
      };

      await handleWebTestMessage(
        { command: 'setDocumentConversion', enabled: true },
        deps,
      );

      expect(docConvEnabled).toBe(true);
      expect(refreshed).toBe(true);
    });
  });
});
