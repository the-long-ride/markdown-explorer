import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';
import os from 'node:os';
import path from 'node:path';

const existsSyncOverride: { value: (() => boolean) | null } = vi.hoisted(() => ({ value: null as (() => boolean) | null }));

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  const wrappedExistsSync = (...args: unknown[]) =>
    existsSyncOverride.value ? existsSyncOverride.value() : actual.existsSync(...(args as [string]));
  return {
    ...actual,
    default: { ...actual, existsSync: wrappedExistsSync },
    existsSync: wrappedExistsSync,
  };
});

import fs from 'node:fs';

import {
  MARKDOWN_EXTENSIONS,
  TEXT_DOCUMENT_EXTENSIONS,
  CONVERTIBLE_DOCUMENT_EXTENSIONS,
  EXTRA_DOCUMENT_EXTENSIONS,
  ALL_SUPPORTED_EXTENSIONS,
  getExtension,
  isMarkdownFilePath,
  isTextDocumentFilePath,
  isConvertibleDocumentFilePath,
  isExtraDocumentFilePath,
  isSupportedFilePath,
  isKnownSupportedFilePath,
  stripKnownExtension,
  getFileTypeLabel,
  createFailureMarkdown,
  DocumentConverter,
} from '../../../vscode/src/core/documentConversion';

function makeTempDir(prefix: string) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function writeFile(filePath: string, content: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

describe('extension sets', () => {
  test('MARKDOWN_EXTENSIONS contains .md and .mdx', () => {
    expect(MARKDOWN_EXTENSIONS.has('.md')).toBe(true);
    expect(MARKDOWN_EXTENSIONS.has('.mdx')).toBe(true);
    expect(MARKDOWN_EXTENSIONS.has('.txt')).toBe(false);
  });

  test('TEXT_DOCUMENT_EXTENSIONS contains .txt only', () => {
    expect(TEXT_DOCUMENT_EXTENSIONS.has('.txt')).toBe(true);
    expect(TEXT_DOCUMENT_EXTENSIONS.size).toBe(1);
  });

  test('CONVERTIBLE_DOCUMENT_EXTENSIONS contains office/doc extensions', () => {
    expect(CONVERTIBLE_DOCUMENT_EXTENSIONS.has('.doc')).toBe(true);
    expect(CONVERTIBLE_DOCUMENT_EXTENSIONS.has('.docx')).toBe(true);
    expect(CONVERTIBLE_DOCUMENT_EXTENSIONS.has('.pdf')).toBe(true);
    expect(CONVERTIBLE_DOCUMENT_EXTENSIONS.has('.xls')).toBe(true);
    expect(CONVERTIBLE_DOCUMENT_EXTENSIONS.has('.pptx')).toBe(true);
    expect(CONVERTIBLE_DOCUMENT_EXTENSIONS.has('.rtf')).toBe(true);
  });

  test('EXTRA_DOCUMENT_EXTENSIONS is union of convertible + text', () => {
    expect(EXTRA_DOCUMENT_EXTENSIONS.has('.txt')).toBe(true);
    expect(EXTRA_DOCUMENT_EXTENSIONS.has('.pdf')).toBe(true);
  });

  test('ALL_SUPPORTED_EXTENSIONS is union of markdown + extra', () => {
    expect(ALL_SUPPORTED_EXTENSIONS.has('.md')).toBe(true);
    expect(ALL_SUPPORTED_EXTENSIONS.has('.txt')).toBe(true);
    expect(ALL_SUPPORTED_EXTENSIONS.has('.pdf')).toBe(true);
  });
});

describe('getExtension', () => {
  test('returns lowercase extension', () => {
    expect(getExtension('/foo/bar.MD')).toBe('.md');
    expect(getExtension('/foo/bar.TXT')).toBe('.txt');
  });

  test('handles paths without extension', () => {
    expect(getExtension('/foo/bar')).toBe('');
    expect(getExtension('noextension')).toBe('');
  });

  test('handles empty path', () => {
    expect(getExtension('')).toBe('');
  });

  test('handles null/undefined gracefully', () => {
    expect(getExtension(null as any)).toBe('');
    expect(getExtension(undefined as any)).toBe('');
  });

  test('handles double extension', () => {
    expect(getExtension('file.tar.gz')).toBe('.gz');
  });
});

describe('file type predicates', () => {
  test('isMarkdownFilePath recognizes .md and .mdx', () => {
    expect(isMarkdownFilePath('readme.md')).toBe(true);
    expect(isMarkdownFilePath('page.mdx')).toBe(true);
    expect(isMarkdownFilePath('notes.txt')).toBe(false);
  });

  test('isTextDocumentFilePath recognizes .txt', () => {
    expect(isTextDocumentFilePath('notes.txt')).toBe(true);
    expect(isTextDocumentFilePath('readme.md')).toBe(false);
  });

  test('isConvertibleDocumentFilePath recognizes office/docs', () => {
    expect(isConvertibleDocumentFilePath('report.doc')).toBe(true);
    expect(isConvertibleDocumentFilePath('sheet.xlsx')).toBe(true);
    expect(isConvertibleDocumentFilePath('notes.txt')).toBe(false);
  });

  test('isExtraDocumentFilePath recognizes text + convertible', () => {
    expect(isExtraDocumentFilePath('notes.txt')).toBe(true);
    expect(isExtraDocumentFilePath('report.pdf')).toBe(true);
    expect(isExtraDocumentFilePath('readme.md')).toBe(false);
  });

  test('isSupportedFilePath without conversion handles .md and .txt', () => {
    expect(isSupportedFilePath('readme.md')).toBe(true);
    expect(isSupportedFilePath('notes.txt')).toBe(true);
    expect(isSupportedFilePath('report.doc')).toBe(false);
    expect(isSupportedFilePath('image.png')).toBe(false);
  });

  test('isSupportedFilePath with conversion enabled handles .doc', () => {
    expect(isSupportedFilePath('report.doc', true)).toBe(true);
    expect(isSupportedFilePath('report.ppt', true)).toBe(false);
    expect(isSupportedFilePath('image.png', true)).toBe(false);
  });

  test('isKnownSupportedFilePath recognizes all supported extensions', () => {
    expect(isKnownSupportedFilePath('readme.md')).toBe(true);
    expect(isKnownSupportedFilePath('notes.txt')).toBe(true);
    expect(isKnownSupportedFilePath('report.pdf')).toBe(true);
    expect(isKnownSupportedFilePath('image.png')).toBe(false);
  });
});

describe('stripKnownExtension', () => {
  test('strips known extension from filename', () => {
    expect(stripKnownExtension('guide.md')).toBe('guide');
    expect(stripKnownExtension('report.docx')).toBe('report');
  });

  test('returns unchanged filename when no extension', () => {
    expect(stripKnownExtension('Makefile')).toBe('Makefile');
  });

  test('strips extension regardless of whether it is in known set', () => {
    expect(stripKnownExtension('image.png')).toBe('image');
    expect(stripKnownExtension('data.csv')).toBe('data');
  });

  test('handles empty string', () => {
    expect(stripKnownExtension('')).toBe('');
  });
});

describe('getFileTypeLabel', () => {
  test('returns uppercase extension without dot', () => {
    expect(getFileTypeLabel('readme.md')).toBe('MD');
    expect(getFileTypeLabel('report.docx')).toBe('DOCX');
    expect(getFileTypeLabel('sheet.XLS')).toBe('XLS');
  });

  test('returns Document for files without extension', () => {
    expect(getFileTypeLabel('Makefile')).toBe('Document');
  });

  test('handles empty string', () => {
    expect(getFileTypeLabel('')).toBe('Document');
  });
});

describe('createFailureMarkdown', () => {
  test('formats error message in code block', () => {
    const md = createFailureMarkdown('/path/report.doc', new Error('Conversion failed'));
    expect(md).toContain('# report');
    expect(md).toContain('could not convert this DOC file');
    expect(md).toContain('```text');
    expect(md).toContain('Conversion failed');
    expect(md).toContain('```');
  });

  test('handles non-Error throwables', () => {
    const md = createFailureMarkdown('/path/report.pdf', 'scary string error');
    expect(md).toContain('scary string error');
  });

  test('handles null error', () => {
    const md = createFailureMarkdown('/path/report.pdf', null);
    expect(md).toContain('Unknown conversion error');
  });

  test('strips newlines from title', () => {
    const md = createFailureMarkdown('/path/file\r\nname.doc', new Error('fail'));
    expect(md).toContain('# file name');
  });
});

describe('DocumentConverter', () => {
  test('readMarkdown returns raw content for .md files', async () => {
    const rootDir = makeTempDir('dc-md-');
    writeFile(path.join(rootDir, 'readme.md'), '# Hello');
    const converter = new DocumentConverter();

    const result = await converter.readMarkdown(path.join(rootDir, 'readme.md'));
    expect(result.markdown).toBe('# Hello');
    expect(result.previewInfo).toBeNull();
  });

  test('readMarkdown normalizes .txt content', async () => {
    const rootDir = makeTempDir('dc-txt-');
    writeFile(path.join(rootDir, 'notes.txt'), 'plain text without heading');
    const converter = new DocumentConverter();

    const result = await converter.readMarkdown(path.join(rootDir, 'notes.txt'));
    expect(result.markdown).toContain('# notes');
    expect(result.markdown).toContain('plain text without heading');
    expect(result.previewInfo!.kind).toBe('text');
    expect(result.previewInfo!.sourceExtension).toBe('.txt');
  });

  test('readMarkdown normalizes .txt with existing heading', async () => {
    const rootDir = makeTempDir('dc-txth1-');
    writeFile(path.join(rootDir, 'notes.txt'), '# Already Heading\nmore');
    const converter = new DocumentConverter();

    const result = await converter.readMarkdown(path.join(rootDir, 'notes.txt'));
    expect(result.markdown).toContain('# Already Heading');
    expect(result.markdown).not.toContain('# notes');
  });

  test('readMarkdown normalizes .txt that is empty', async () => {
    const rootDir = makeTempDir('dc-txtempty-');
    writeFile(path.join(rootDir, 'empty.txt'), '');
    const converter = new DocumentConverter();

    const result = await converter.readMarkdown(path.join(rootDir, 'empty.txt'));
    expect(result.markdown).toContain('No readable content was found');
  });

  test('readMarkdown normalizes .txt with whitespace-only content', async () => {
    const rootDir = makeTempDir('dc-txtws-');
    writeFile(path.join(rootDir, 'ws.txt'), '   \n  ');
    const converter = new DocumentConverter();

    const result = await converter.readMarkdown(path.join(rootDir, 'ws.txt'));
    expect(result.markdown).toContain('# ws');
    expect(result.markdown).toContain('No readable content was found');
  });

  test('readMarkdown throws on unsupported extension', async () => {
    const rootDir = makeTempDir('dc-bad-');
    writeFile(path.join(rootDir, 'image.png'), 'not a text file');
    const converter = new DocumentConverter();

    await expect(converter.readMarkdown(path.join(rootDir, 'image.png'))).rejects.toThrow(
      'Unsupported file type',
    );
  });

  test('readMarkdown throws on file with no extension', async () => {
    const rootDir = makeTempDir('dc-noext-');
    writeFile(path.join(rootDir, 'Makefile'), 'all: build');
    const converter = new DocumentConverter();

    await expect(converter.readMarkdown(path.join(rootDir, 'Makefile'))).rejects.toThrow(
      'Unsupported file type',
    );
  });
});

const mockedGenerateMarkdown = vi.fn().mockResolvedValue('mocked conversion');

function interceptMarkdownThemRequire(mock: Record<string, unknown>) {
  const Module = require('module');
  const origRequire = Module.prototype.require;
  Module.prototype.require = function (id: string, ...args: unknown[]) {
    if (id === '@the-long-ride/markdown-them' || id.endsWith('markdown-them.cjs')) {
      return mock;
    }
    return origRequire.apply(this, [id, ...args]);
  };
  return () => {
    Module.prototype.require = origRequire;
  };
}

describe('createFailureMarkdown empty string branch', () => {
  test('treats empty string as Unknown conversion error', () => {
    const md = createFailureMarkdown('/path/report.pdf', '');
    expect(md).toContain('Unknown conversion error');
  });
});

describe('normalizePreviewMarkdown (indirect via .txt)', () => {
  test('content with existing H1 heading is returned as-is', async () => {
    const rootDir = makeTempDir('dc-npm-h1-');
    writeFile(path.join(rootDir, 'mydoc.txt'), '# My Heading\n\nSome paragraph');
    const converter = new DocumentConverter();

    const result = await converter.readMarkdown(path.join(rootDir, 'mydoc.txt'));
    expect(result.markdown).toBe('# My Heading\n\nSome paragraph');
  });

  test('content without heading gets title prepended', async () => {
    const rootDir = makeTempDir('dc-npm-nohead-');
    writeFile(path.join(rootDir, 'mydoc.txt'), 'Just a paragraph');
    const converter = new DocumentConverter();

    const result = await converter.readMarkdown(path.join(rootDir, 'mydoc.txt'));
    expect(result.markdown).toContain('# mydoc');
    expect(result.markdown).toContain('Just a paragraph');
  });
});

describe('DocumentConverter cache', () => {
  let restore: () => void;

  beforeEach(() => {
    mockedGenerateMarkdown.mockReset();
    mockedGenerateMarkdown.mockResolvedValue('mocked conversion');
    restore = interceptMarkdownThemRequire({
      generateMarkdown: mockedGenerateMarkdown,
      convertTextToMarkdown: vi.fn(),
      inferOutputPath: vi.fn(),
      convertFileToMarkdown: vi.fn(),
      convertAndReturnMarkdown: vi.fn(),
    });
  });

  afterEach(() => {
    restore();
  });

  test('cache miss: first read of convertible doc converts and caches', async () => {
    const rootDir = makeTempDir('dc-cache-miss-');
    const filePath = path.join(rootDir, 'report.doc');
    writeFile(filePath, 'dummy');
    mockedGenerateMarkdown.mockResolvedValue('converted body');

    const converter = new DocumentConverter();
    const result = await converter.readMarkdown(filePath);

    expect(mockedGenerateMarkdown).toHaveBeenCalledWith(filePath);
    expect(result.previewInfo!.fromCache).toBe(false);
    expect(result.previewInfo!.kind).toBe('converted');
    expect(result.previewInfo!.sourceExtension).toBe('.doc');
    expect(result.previewInfo!.sourceLabel).toBe('DOC');
    expect(result.markdown).toContain('# report');
    expect(result.markdown).toContain('converted body');
  });

  test('cache hit: second read with same mtime/size returns fromCache:true', async () => {
    const rootDir = makeTempDir('dc-cache-hit-');
    const filePath = path.join(rootDir, 'sheet.pdf');
    writeFile(filePath, 'dummy content');
    mockedGenerateMarkdown.mockResolvedValue('pdf content');

    const converter = new DocumentConverter();
    const first = await converter.readMarkdown(filePath);
    expect(first.previewInfo!.fromCache).toBe(false);

    const second = await converter.readMarkdown(filePath);
    expect(second.previewInfo!.fromCache).toBe(true);
    expect(second.markdown).toBe(first.markdown);
    expect(mockedGenerateMarkdown).toHaveBeenCalledTimes(1);
  });

  test('cache invalidates when file size changes', async () => {
    const rootDir = makeTempDir('dc-cache-inval-');
    const filePath = path.join(rootDir, 'memo.docx');
    writeFile(filePath, 'v1');
    mockedGenerateMarkdown.mockResolvedValue('version 1');

    const converter = new DocumentConverter();
    await converter.readMarkdown(filePath);

    writeFile(filePath, 'v1-longer-content-here');
    mockedGenerateMarkdown.mockResolvedValue('version 2');

    const result = await converter.readMarkdown(filePath);
    expect(result.previewInfo!.fromCache).toBe(false);
    expect(mockedGenerateMarkdown).toHaveBeenCalledTimes(2);
  });

  test('PPTX files are passed to the bundled conversion runtime', async () => {
    const filePath = path.resolve('tests/fixtures/sample-presentation.pptx');
    mockedGenerateMarkdown.mockResolvedValue('PowerPoint preview body');

    const converter = new DocumentConverter();
    const result = await converter.readMarkdown(filePath);

    expect(mockedGenerateMarkdown).toHaveBeenCalledWith(filePath);
    expect(result.markdown).toContain('# sample-presentation');
    expect(result.markdown).toContain('PowerPoint preview body');
    expect(result.previewInfo).toMatchObject({
      kind: 'converted',
      sourceExtension: '.pptx',
      sourceLabel: 'PPTX',
      fromCache: false,
    });
  });
});

describe('getMarkdownThem bundled path', () => {
  const bundledMock = {
    generateMarkdown: vi.fn().mockResolvedValue('bundled result'),
    convertTextToMarkdown: vi.fn(),
    inferOutputPath: vi.fn(),
    convertFileToMarkdown: vi.fn(),
    convertAndReturnMarkdown: vi.fn(),
  };
  const npmMock = {
    generateMarkdown: mockedGenerateMarkdown,
    convertTextToMarkdown: vi.fn(),
    inferOutputPath: vi.fn(),
    convertFileToMarkdown: vi.fn(),
    convertAndReturnMarkdown: vi.fn(),
  };

  test('takes bundled path when existsSync returns true', async () => {
    const rootDir = makeTempDir('dc-bundled-');
    const filePath = path.join(rootDir, 'test.doc');
    writeFile(filePath, 'dummy');

    existsSyncOverride.value = () => true;

    const restore = interceptMarkdownThemRequire(bundledMock);

    vi.resetModules();
    const mod = await import('../../../vscode/src/core/documentConversion');
    const FreshDC = mod.DocumentConverter;

    bundledMock.generateMarkdown.mockResolvedValue('bundled result');
    const converter = new FreshDC();
    const result = await converter.readMarkdown(filePath);
    expect(result.previewInfo!.kind).toBe('converted');
    expect(result.markdown).toContain('bundled result');

    existsSyncOverride.value = null;
    restore();
  });

  test('falls back to npm package when existsSync returns false', async () => {
    const rootDir = makeTempDir('dc-npm-fallback-');
    const filePath = path.join(rootDir, 'test2.rtf');
    writeFile(filePath, 'dummy');

    existsSyncOverride.value = () => false;

    const restore = interceptMarkdownThemRequire(npmMock);

    vi.resetModules();
    const mod = await import('../../../vscode/src/core/documentConversion');
    const FreshDC = mod.DocumentConverter;

    mockedGenerateMarkdown.mockResolvedValue('npm result');
    const converter = new FreshDC();
    const result = await converter.readMarkdown(filePath);
    expect(result.previewInfo!.kind).toBe('converted');
    expect(result.previewInfo!.sourceExtension).toBe('.rtf');
    expect(result.markdown).toContain('npm result');

    existsSyncOverride.value = null;
    restore();
  });
});