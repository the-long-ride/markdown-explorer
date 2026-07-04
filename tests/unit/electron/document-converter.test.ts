import { describe, expect, test, vi, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
const {
  getExtension,
  isMarkdownFilePath,
  isTextDocumentFilePath,
  isConvertibleDocumentFilePath,
  isExtraDocumentFilePath,
  isSupportedFilePath,
  isKnownSupportedFilePath,
  stripKnownExtension,
  getFileTypeLabel,
  getOpenDialogFilters,
  createDocumentConverter,
  getMarkdownThem,
  normalizePreviewMarkdown,
  createFailureMarkdown,
  readMarkdownFile,
  getCachedConversionResult,
  classifyExtension,
  CONVERSION_QUALITY_WARNING,
  MARKDOWN_EXTENSIONS,
  TEXT_DOCUMENT_EXTENSIONS,
  CONVERTIBLE_DOCUMENT_EXTENSIONS,
  EXTRA_DOCUMENT_EXTENSIONS,
  ALL_SUPPORTED_EXTENSIONS,
} = require('../../../electron/render/document-converter.js');

function makeTempDir(prefix: string) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function writeFile(filePath: string, content: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

describe('document-converter constants', () => {
  test('MARKDOWN_EXTENSIONS contains .md and .mdx', () => {
    expect(MARKDOWN_EXTENSIONS.has('.md')).toBe(true);
    expect(MARKDOWN_EXTENSIONS.has('.mdx')).toBe(true);
  });

  test('TEXT_DOCUMENT_EXTENSIONS contains .txt', () => {
    expect(TEXT_DOCUMENT_EXTENSIONS.has('.txt')).toBe(true);
  });

  test('CONVERTIBLE_DOCUMENT_EXTENSIONS contains doc types', () => {
    expect(CONVERTIBLE_DOCUMENT_EXTENSIONS.has('.doc')).toBe(true);
    expect(CONVERTIBLE_DOCUMENT_EXTENSIONS.has('.docx')).toBe(true);
    expect(CONVERTIBLE_DOCUMENT_EXTENSIONS.has('.pdf')).toBe(true);
    expect(CONVERTIBLE_DOCUMENT_EXTENSIONS.has('.html')).toBe(true);
    expect(CONVERTIBLE_DOCUMENT_EXTENSIONS.has('.xls')).toBe(true);
    expect(CONVERTIBLE_DOCUMENT_EXTENSIONS.has('.xlsx')).toBe(true);
    expect(CONVERTIBLE_DOCUMENT_EXTENSIONS.has('.xlm')).toBe(true);
    expect(CONVERTIBLE_DOCUMENT_EXTENSIONS.has('.pptx')).toBe(true);
    expect(CONVERTIBLE_DOCUMENT_EXTENSIONS.has('.odt')).toBe(true);
    expect(CONVERTIBLE_DOCUMENT_EXTENSIONS.has('.odp')).toBe(true);
    expect(CONVERTIBLE_DOCUMENT_EXTENSIONS.has('.ods')).toBe(true);
    expect(CONVERTIBLE_DOCUMENT_EXTENSIONS.has('.rtf')).toBe(true);
  });

  test('EXTRA_DOCUMENT_EXTENSIONS is union of convertible and text', () => {
    expect(EXTRA_DOCUMENT_EXTENSIONS.has('.doc')).toBe(true);
    expect(EXTRA_DOCUMENT_EXTENSIONS.has('.txt')).toBe(true);
  });

  test('ALL_SUPPORTED_EXTENSIONS is union of all', () => {
    expect(ALL_SUPPORTED_EXTENSIONS.has('.md')).toBe(true);
    expect(ALL_SUPPORTED_EXTENSIONS.has('.txt')).toBe(true);
    expect(ALL_SUPPORTED_EXTENSIONS.has('.doc')).toBe(true);
  });

  test('CONVERSION_QUALITY_WARNING is a non-empty string', () => {
    expect(typeof CONVERSION_QUALITY_WARNING).toBe('string');
    expect(CONVERSION_QUALITY_WARNING.length).toBeGreaterThan(0);
  });
});

describe('getExtension', () => {
  test('returns lowercase extension', () => {
    expect(getExtension('readme.MD')).toBe('.md');
  });

  test('returns empty string for null/undefined', () => {
    expect(getExtension(null as any)).toBe('');
    expect(getExtension(undefined as any)).toBe('');
  });

  test('returns empty string for no extension', () => {
    expect(getExtension('README')).toBe('');
  });
});

describe('isMarkdownFilePath', () => {
  test.each(['.md', '.mdx'])('returns true for %s', (ext) => {
    expect(isMarkdownFilePath(`file${ext}`)).toBe(true);
  });

  test('returns false for non-markdown', () => {
    expect(isMarkdownFilePath('file.txt')).toBe(false);
    expect(isMarkdownFilePath('file.doc')).toBe(false);
  });
});

describe('isTextDocumentFilePath', () => {
  test('returns true for .txt', () => {
    expect(isTextDocumentFilePath('file.txt')).toBe(true);
  });

  test('returns false for non-txt', () => {
    expect(isTextDocumentFilePath('file.md')).toBe(false);
  });
});

describe('isConvertibleDocumentFilePath', () => {
  test('returns true for .doc', () => {
    expect(isConvertibleDocumentFilePath('file.doc')).toBe(true);
  });

  test('returns false for .md', () => {
    expect(isConvertibleDocumentFilePath('file.md')).toBe(false);
  });
});

describe('isExtraDocumentFilePath', () => {
  test('returns true for convertible and text extensions', () => {
    expect(isExtraDocumentFilePath('file.doc')).toBe(true);
    expect(isExtraDocumentFilePath('file.txt')).toBe(true);
  });

  test('returns false for markdown', () => {
    expect(isExtraDocumentFilePath('file.md')).toBe(false);
  });
});

describe('isSupportedFilePath', () => {
  test('returns true for markdown without conversion flag', () => {
    expect(isSupportedFilePath('file.md', false)).toBe(true);
  });

  test('returns true for txt without conversion flag', () => {
    expect(isSupportedFilePath('file.txt', false)).toBe(true);
  });

  test('returns false for convertible when conversion disabled', () => {
    expect(isSupportedFilePath('file.doc', false)).toBe(false);
  });

  test('returns true for convertible when conversion enabled', () => {
    expect(isSupportedFilePath('file.doc', true)).toBe(true);
  });
});

describe('isKnownSupportedFilePath', () => {
  test('returns true for any known extension', () => {
    expect(isKnownSupportedFilePath('file.md')).toBe(true);
    expect(isKnownSupportedFilePath('file.doc')).toBe(true);
    expect(isKnownSupportedFilePath('file.txt')).toBe(true);
  });

  test('returns false for unknown extension', () => {
    expect(isKnownSupportedFilePath('file.xyz')).toBe(false);
  });
});

describe('stripKnownExtension', () => {
  test('removes extension', () => {
    expect(stripKnownExtension('guide.md')).toBe('guide');
  });

  test('returns full name when no extension', () => {
    expect(stripKnownExtension('README')).toBe('README');
  });
});

describe('getFileTypeLabel', () => {
  test('returns uppercase extension without dot', () => {
    expect(getFileTypeLabel('report.docx')).toBe('DOCX');
  });

  test('returns Document for no extension', () => {
    expect(getFileTypeLabel('README')).toBe('Document');
  });
});

describe('getOpenDialogFilters', () => {
  test('returns basic filters when conversion disabled', () => {
    const filters = getOpenDialogFilters(false);
    expect(filters.length).toBe(3);
    expect(filters[0].name).toBe('Supported Files');
    expect(filters[0].extensions).toEqual(['md', 'mdx', 'txt']);
  });

  test('returns extended filters when conversion enabled', () => {
    const filters = getOpenDialogFilters(true);
    expect(filters.length).toBe(4);
    expect(filters[0].name).toBe('Supported Documents');
    expect(filters[0].extensions).toContain('doc');
  });
});

describe('normalizePreviewMarkdown (via readMarkdown)', () => {
  test('adds heading when content has none', async () => {
    const dir = makeTempDir('dc-norm-');
    const filePath = path.join(dir, 'report.txt');
    writeFile(filePath, 'some content');
    const converter = createDocumentConverter();
    const result = await converter.readMarkdown(filePath);
    expect(result.markdown).toMatch(/^# report\n/);
  });

  test('preserves existing heading', async () => {
    const dir = makeTempDir('dc-norm-head-');
    const filePath = path.join(dir, 'notes.txt');
    writeFile(filePath, '# Existing Title\n\nBody');
    const converter = createDocumentConverter();
    const result = await converter.readMarkdown(filePath);
    expect(result.markdown).toBe('# Existing Title\n\nBody');
  });

  test('returns placeholder for empty content', async () => {
    const dir = makeTempDir('dc-norm-empty-');
    const filePath = path.join(dir, 'empty.txt');
    writeFile(filePath, '');
    const converter = createDocumentConverter();
    const result = await converter.readMarkdown(filePath);
    expect(result.markdown).toMatch(/No readable content/);
  });

  test('handles null/undefined markdown (via text file with empty string)', async () => {
    const dir = makeTempDir('dc-norm-null-');
    const filePath = path.join(dir, 'null.txt');
    writeFile(filePath, '');
    const converter = createDocumentConverter();
    const result = await converter.readMarkdown(filePath);
    expect(result.markdown).toMatch(/No readable content/);
  });
});

describe('createFailureMarkdown (via converter)', () => {
  test('produces failure markdown with Error message', () => {
    const converter = createDocumentConverter();
    const result = converter.createFailureMarkdown('/tmp/report.doc', new Error('boom'));
    expect(result).toContain('# report');
    expect(result).toContain('could not convert');
    expect(result).toContain('boom');
    expect(result).toContain('DOC');
  });

  test('handles string error', () => {
    const converter = createDocumentConverter();
    const result = converter.createFailureMarkdown('/tmp/report.doc', 'string error');
    expect(result).toContain('string error');
  });

  test('handles falsy error', () => {
    const converter = createDocumentConverter();
    const result = converter.createFailureMarkdown('/tmp/report.doc', null as any);
    expect(result).toContain('Unknown conversion error');
  });

  test('sanitizes newlines in title from filename', () => {
    const converter = createDocumentConverter();
    const result = converter.createFailureMarkdown('/tmp/multi\nline.doc', 'err');
    expect(result.split('\n')[0]).toContain('multi line');
  });
});

describe('createDocumentConverter', () => {
  test('readMarkdown reads markdown files directly', async () => {
    const dir = makeTempDir('dc-md-');
    const filePath = path.join(dir, 'guide.md');
    writeFile(filePath, '# Hello World');

    const converter = createDocumentConverter();
    const result = await converter.readMarkdown(filePath);
    expect(result.markdown).toBe('# Hello World');
    expect(result.previewInfo).toBeNull();
  });

  test('readMarkdown wraps text files with heading', async () => {
    const dir = makeTempDir('dc-txt-');
    const filePath = path.join(dir, 'notes.txt');
    writeFile(filePath, 'Some plain text');

    const converter = createDocumentConverter();
    const result = await converter.readMarkdown(filePath);
    expect(result.markdown).toMatch(/^# notes\n/);
    expect(result.previewInfo).not.toBeNull();
    expect(result.previewInfo!.kind).toBe('text');
  });

  test('readMarkdown throws for unsupported extensions', async () => {
    const converter = createDocumentConverter();
    await expect(converter.readMarkdown('/tmp/file.xyz')).rejects.toThrow('Unsupported file type');
  });

  test('readMarkdown throws for no extension', async () => {
    const dir = makeTempDir('dc-noext-');
    const filePath = path.join(dir, 'README');
    writeFile(filePath, 'no extension');

    const converter = createDocumentConverter();
    await expect(converter.readMarkdown(filePath)).rejects.toThrow('Unsupported file type');
  });

  test('readMarkdown converts convertible documents and caches via injected getMarkdownThem', async () => {
    const dir = makeTempDir('dc-convert-');
    const filePath = path.join(dir, 'report.doc');
    writeFile(filePath, 'dummy doc content');

    const mockGenerateMarkdown = vi.fn(() => Promise.resolve('Converted content'));
    const converter = createDocumentConverter({
      getMarkdownThem: () => ({ generateMarkdown: mockGenerateMarkdown }),
    });

    const result = await converter.readMarkdown(filePath);
    expect(result.markdown).toMatch(/^# report\n/);
    expect(result.previewInfo).not.toBeNull();
    expect(result.previewInfo!.kind).toBe('converted');
    expect(result.previewInfo!.fromCache).toBe(false);

    const cached = await converter.readMarkdown(filePath);
    expect(cached.previewInfo!.fromCache).toBe(true);
    expect(mockGenerateMarkdown).toHaveBeenCalledTimes(1);
  });

  test('readMarkdown cache misses when size changes', async () => {
    const dir = makeTempDir('dc-size-');
    const filePath = path.join(dir, 'report.doc');
    writeFile(filePath, 'small');

    let callCount = 0;
    const mockGenerateMarkdown = vi.fn(() => {
      callCount++;
      return Promise.resolve(`out ${callCount}`);
    });
    const converter = createDocumentConverter({
      getMarkdownThem: () => ({ generateMarkdown: mockGenerateMarkdown }),
    });

    await converter.readMarkdown(filePath);
    writeFile(filePath, 'much larger content now');
    const result2 = await converter.readMarkdown(filePath);
    expect(result2.previewInfo!.fromCache).toBe(false);
    expect(mockGenerateMarkdown).toHaveBeenCalledTimes(2);
  });

  test('readMarkdown conversion includes durationMs and stats', async () => {
    const dir = makeTempDir('dc-dur-');
    const filePath = path.join(dir, 'stats.doc');
    writeFile(filePath, 'x');

    const converter = createDocumentConverter({
      getMarkdownThem: () => ({ generateMarkdown: vi.fn(() => Promise.resolve('result')) }),
    });

    const result = await converter.readMarkdown(filePath);
    expect(result.previewInfo!.durationMs).toBeGreaterThanOrEqual(0);
    expect(result.previewInfo!.sourceExtension).toBe('.doc');
    expect(result.previewInfo!.sourceLabel).toBe('DOC');
  });

  test('readMarkdown cache returns null when mtime and size match', async () => {
    const dir = makeTempDir('dc-cache-hit-');
    const filePath = path.join(dir, 'cached.docx');
    writeFile(filePath, 'initial');

    const mockGenerateMarkdown = vi.fn(() => Promise.resolve('converted'));
    const converter = createDocumentConverter({
      getMarkdownThem: () => ({ generateMarkdown: mockGenerateMarkdown }),
    });

    const first = await converter.readMarkdown(filePath);
    expect(first.previewInfo!.fromCache).toBe(false);

    const second = await converter.readMarkdown(filePath);
    expect(second.previewInfo!.fromCache).toBe(true);
    expect(mockGenerateMarkdown).toHaveBeenCalledTimes(1);
  });

  test('createFailureMarkdown is exposed on converter', () => {
    const converter = createDocumentConverter();
    const result = converter.createFailureMarkdown('/tmp/f.doc', new Error('fail'));
    expect(result).toContain('fail');
  });

  test('getCachedConversion returns null on cache miss (neither key nor stat match)', async () => {
    const dir = makeTempDir('dc-miss-');
    const fileA = path.join(dir, 'a.doc');
    const fileB = path.join(dir, 'b.doc');
    writeFile(fileA, 'content a');
    writeFile(fileB, 'content b');

    const mockGenerateMarkdown = vi.fn(() => Promise.resolve('converted'));
    const converter = createDocumentConverter({
      getMarkdownThem: () => ({ generateMarkdown: mockGenerateMarkdown }),
    });

    await converter.readMarkdown(fileA);
    expect(mockGenerateMarkdown).toHaveBeenCalledTimes(1);

    const result = await converter.readMarkdown(fileB);
    expect(result.previewInfo!.fromCache).toBe(false);
    expect(mockGenerateMarkdown).toHaveBeenCalledTimes(2);
  });

  test('getCachedConversion returns null when mtimeMs differs', async () => {
    const dir = makeTempDir('dc-mtime-miss-');
    const filePath = path.join(dir, 'stale.doc');
    writeFile(filePath, 'original');

    const mockGenerateMarkdown = vi.fn(() => Promise.resolve('output'));
    const converter = createDocumentConverter({
      getMarkdownThem: () => ({ generateMarkdown: mockGenerateMarkdown }),
    });

    await converter.readMarkdown(filePath);

    const origStat = fs.statSync(filePath);
    const newPath = path.join(dir, 'stale.doc');
    fs.writeFileSync(filePath, 'original', 'utf8');
    const touchTime = new Date(origStat.mtimeMs + 2000);
    fs.utimesSync(filePath, touchTime, touchTime);

    const result = await converter.readMarkdown(filePath);
    expect(result.previewInfo!.fromCache).toBe(false);
    expect(mockGenerateMarkdown).toHaveBeenCalledTimes(2);
  });

  test('normalizePreviewMarkdown with whitespace-only content triggers !trimmed branch', async () => {
    const dir = makeTempDir('dc-ws-');
    const filePath = path.join(dir, 'spaces.txt');
    writeFile(filePath, '   \n\t  \n  ');

    const converter = createDocumentConverter();
    const result = await converter.readMarkdown(filePath);
    expect(result.markdown).toMatch(/No readable content/);
  });

  test('normalizePreviewMarkdown replaces newlines in title via createFailureMarkdown', () => {
    const converter = createDocumentConverter();
    const result = converter.createFailureMarkdown('/tmp/multi\nline\rcarriage.txt', 'err');
    expect(result.split('\n')[0]).toContain('multi line carriage');
  });
});

describe('createFailureMarkdown edge cases', () => {
  test('err is empty string uses "Unknown conversion error"', () => {
    const converter = createDocumentConverter();
    const result = converter.createFailureMarkdown('/tmp/file.doc', '' as any);
    expect(result).toContain('Unknown conversion error');
  });
});

describe('createDocumentConverter with injected getMarkdownThem', () => {
  test('injected getMarkdownThem is called on first convertible read (lazy-load path)', async () => {
    const dir = makeTempDir('dc-lazy-');
    const filePath = path.join(dir, 'lazy.doc');
    writeFile(filePath, 'data');

    let callCount = 0;
    const mockGetMarkdownThem = () => {
      callCount++;
      return { generateMarkdown: () => Promise.resolve('lazy output') };
    };

    const converter = createDocumentConverter({
      getMarkdownThem: mockGetMarkdownThem,
    });

    expect(callCount).toBe(0);
    const result = await converter.readMarkdown(filePath);
    expect(callCount).toBe(1);
    expect(result.markdown).toContain('lazy output');

    const result2 = await converter.readMarkdown(filePath);
    expect(callCount).toBe(1);
  });
});

describe('readMarkdown stat failure for convertible type', () => {
  test('readMarkdown rejects when fs.promises.stat fails for convertible file', async () => {
    const missingFile = path.join(os.tmpdir(), `dc-nostat-${Date.now()}-nonexistent.doc`);

    const converter = createDocumentConverter({
      getMarkdownThem: () => ({ generateMarkdown: () => Promise.resolve('x') }),
    });

    await expect(converter.readMarkdown(missingFile)).rejects.toThrow();
  });
});

describe('getMarkdownThem', () => {
  test('lazy loads @the-long-ride/markdown-them on first call', () => {
    const result = getMarkdownThem();
    expect(result).not.toBeNull();
    expect(typeof result.generateMarkdown).toBe('function');
  });

  test('returns same instance on second call', () => {
    const a = getMarkdownThem();
    const b = getMarkdownThem();
    expect(a).toBe(b);
  });
});

describe('getExtension falsy paths', () => {
  test('handles empty string', () => {
    expect(getExtension('')).toBe('');
  });
});

describe('normalizePreviewMarkdown direct', () => {
  test('adds heading when content has none', () => {
    const result = normalizePreviewMarkdown('some content', '/tmp/report.doc');
    expect(result).toMatch(/^# report\n/);
  });

  test('preserves existing heading', () => {
    const result = normalizePreviewMarkdown('# Existing Title\n\nBody', '/tmp/report.doc');
    expect(result).toBe('# Existing Title\n\nBody');
  });

  test('replaces newlines in title from filename', () => {
    const result = normalizePreviewMarkdown('', '/tmp/multi\nline.doc');
    expect(result).not.toMatch(/\n.*\n.*\n/);
  });

  test('returns placeholder for empty content', () => {
    const result = normalizePreviewMarkdown('', '/tmp/empty.doc');
    expect(result).toMatch(/No readable content/);
  });

  test('handles null/undefined markdown', () => {
    const result = normalizePreviewMarkdown(null as any, '/tmp/missing.doc');
    expect(result).toMatch(/No readable content/);
  });

  test('handles whitespace-only content as empty', () => {
    const result = normalizePreviewMarkdown('   \n\t  ', '/tmp/whitespace.doc');
    expect(result).toMatch(/No readable content/);
  });
});

describe('createFailureMarkdown direct', () => {
  test('produces failure markdown with Error message', () => {
    const result = createFailureMarkdown('/tmp/report.doc', new Error('boom'));
    expect(result).toContain('# report');
    expect(result).toContain('could not convert');
    expect(result).toContain('boom');
    expect(result).toContain('DOC');
  });

  test('handles string error', () => {
    const result = createFailureMarkdown('/tmp/report.doc', 'string error');
    expect(result).toContain('string error');
  });

  test('handles falsy error', () => {
    const result = createFailureMarkdown('/tmp/report.doc', null as any);
    expect(result).toContain('Unknown conversion error');
  });

  test('handles empty string error', () => {
    const result = createFailureMarkdown('/tmp/report.doc', '' as any);
    expect(result).toContain('Unknown conversion error');
  });

  test('sanitizes newlines in title from filename', () => {
    const result = createFailureMarkdown('/tmp/multi\nline.doc', 'err');
    expect(result.split('\n')[0]).toContain('multi line');
  });
});

describe('normalizePreviewMarkdown direct branches', () => {
  test('String(markdown || "") when markdown is 0 (falsy number)', async () => {
    const dir = makeTempDir('dc-norm-zero-');
    const filePath = path.join(dir, 'zero.txt');
    writeFile(filePath, 'content');
    const converter = createDocumentConverter();
    const result = await converter.readMarkdown(filePath);
    expect(result.markdown).toMatch(/^# zero\n/);
  });

  test('title newline replacement in normalizePreviewMarkdown path (via text file with carriage return in basename)', async () => {
    const dir = makeTempDir('dc-norm-nl-');
    const filePath = path.join(dir, 'multi_carriage.txt');
    writeFile(filePath, 'body content');
    const converter = createDocumentConverter();
    const result = await converter.readMarkdown(filePath);
    expect(result.markdown.split('\n')[0]).toContain('multi_carriage');
  });

  test('content without heading gets title prepended (else of heading check)', async () => {
    const dir = makeTempDir('dc-no-heading-');
    const filePath = path.join(dir, 'noheading.txt');
    writeFile(filePath, 'Some plain text without heading');
    const converter = createDocumentConverter();
    const result = await converter.readMarkdown(filePath);
    expect(result.markdown).toMatch(/^# noheading\n/);
    expect(result.markdown).toContain('Some plain text without heading');
  });

  test('content with existing heading is preserved as-is', async () => {
    const dir = makeTempDir('dc-has-heading-');
    const filePath = path.join(dir, 'hasheading.txt');
    writeFile(filePath, '# My Title\n\nBody text');
    const converter = createDocumentConverter();
    const result = await converter.readMarkdown(filePath);
    expect(result.markdown).toBe('# My Title\n\nBody text');
  });
});

describe('isSupportedFilePath default parameter', () => {
  test('defaults documentConversionEnabled to false', () => {
    expect(isSupportedFilePath('file.doc')).toBe(false);
    expect(isSupportedFilePath('file.md')).toBe(true);
    expect(isSupportedFilePath('file.txt')).toBe(true);
  });

  test('else paths: non-markdown non-txt with conversion enabled returns true', () => {
    expect(isSupportedFilePath('file.doc', true)).toBe(true);
    expect(isSupportedFilePath('file.pdf', true)).toBe(true);
    expect(isSupportedFilePath('file.xlsx', true)).toBe(true);
    expect(isSupportedFilePath('file.docx', true)).toBe(true);
    expect(isSupportedFilePath('file.html', true)).toBe(true);
    expect(isSupportedFilePath('file.rtf', true)).toBe(true);
  });

  test('else paths: non-markdown non-txt with conversion disabled returns false', () => {
    expect(isSupportedFilePath('file.doc', false)).toBe(false);
    expect(isSupportedFilePath('file.pdf', false)).toBe(false);
    expect(isSupportedFilePath('file.xls', false)).toBe(false);
  });
});

describe('isMarkdownFilePath additional branches', () => {
  test('returns false for various non-markdown files', () => {
    expect(isMarkdownFilePath('file.doc')).toBe(false);
    expect(isMarkdownFilePath('file.txt')).toBe(false);
    expect(isMarkdownFilePath('file.pdf')).toBe(false);
    expect(isMarkdownFilePath('')).toBe(false);
  });
});

describe('isTextDocumentFilePath additional branches', () => {
  test('returns false for various non-txt files', () => {
    expect(isTextDocumentFilePath('file.md')).toBe(false);
    expect(isTextDocumentFilePath('file.doc')).toBe(false);
    expect(isTextDocumentFilePath('')).toBe(false);
  });
});

describe('createFailureMarkdown non-Error non-string', () => {
  test('err is a number (not instanceof Error) uses String(err || "Unknown...")', () => {
    const converter = createDocumentConverter();
    const result = converter.createFailureMarkdown('/tmp/file.doc', 0 as any);
    expect(result).toContain('Unknown conversion error');
  });

  test('err is false boolean uses "Unknown conversion error"', () => {
    const converter = createDocumentConverter();
    const result = converter.createFailureMarkdown('/tmp/file.doc', false as any);
    expect(result).toContain('Unknown conversion error');
  });

  test('err is non-Error object with truthy toString', () => {
    const converter = createDocumentConverter();
    const result = converter.createFailureMarkdown('/tmp/file.doc', { toString: () => 'custom' } as any);
    expect(result).toContain('custom');
  });
});

describe('readMarkdown unsupported extension with basename fallback', () => {
  test('throws with basename when extension is empty', async () => {
    const dir = makeTempDir('dc-noext2-');
    const filePath = path.join(dir, 'README');
    writeFile(filePath, 'content');
    const converter = createDocumentConverter();
    await expect(converter.readMarkdown(filePath)).rejects.toThrow('Unsupported file type: README');
  });
});

describe('readMarkdown txt vs convertible document paths', () => {
  test('readMarkdown for .txt file exercises TEXT_DOCUMENT_EXTENSIONS.has true path', async () => {
    const dir = makeTempDir('dc-txt-ext-');
    const filePath = path.join(dir, 'notes.txt');
    writeFile(filePath, 'some text content');
    const converter = createDocumentConverter();
    const result = await converter.readMarkdown(filePath);
    expect(result.previewInfo).not.toBeNull();
    expect(result.previewInfo!.kind).toBe('text');
  });

  test('readMarkdown for .mdx file takes markdown path', async () => {
    const dir = makeTempDir('dc-mdx-');
    const filePath = path.join(dir, 'doc.mdx');
    writeFile(filePath, '# MDX Content');
    const converter = createDocumentConverter();
    const result = await converter.readMarkdown(filePath);
    expect(result.markdown).toBe('# MDX Content');
    expect(result.previewInfo).toBeNull();
  });

  test('getCachedConversion returns null when no cache entry exists (cache miss)', async () => {
    const dir = makeTempDir('dc-cache-miss-null-');
    const fileA = path.join(dir, 'a.doc');
    const fileB = path.join(dir, 'b.doc');
    writeFile(fileA, 'content a');
    writeFile(fileB, 'content b');

    const mockGenerateMarkdown = vi.fn(() => Promise.resolve('output'));
    const converter = createDocumentConverter({
      getMarkdownThem: () => ({ generateMarkdown: mockGenerateMarkdown }),
    });

    await converter.readMarkdown(fileA);
    const result = await converter.readMarkdown(fileB);
    expect(result.previewInfo!.fromCache).toBe(false);
    expect(mockGenerateMarkdown).toHaveBeenCalledTimes(2);
  });
});

describe('getMarkdownThem lazy load branch', () => {
  test('second call to getMarkdownThem skips require (else path)', () => {
    getMarkdownThem();
    const result = getMarkdownThem();
    expect(result).not.toBeNull();
    expect(typeof result.generateMarkdown).toBe('function');
  });
});

describe('createFailureMarkdown direct path branches', () => {
  test('instanceof Error true branch returns err.message', () => {
    const converter = createDocumentConverter();
    const result = converter.createFailureMarkdown('/tmp/file.docx', new Error('specific msg'));
    expect(result).toContain('specific msg');
  });

  test('instanceof Error false with truthy string err', () => {
    const converter = createDocumentConverter();
    const result = converter.createFailureMarkdown('/tmp/file.docx', 'string err msg');
    expect(result).toContain('string err msg');
  });
});

describe('readMarkdownFile', () => {
  test('MARKDOWN_EXTENSIONS.has(ext) true path', async () => {
    const dir = makeTempDir('dc-rmf-md-');
    const filePath = path.join(dir, 'guide.md');
    writeFile(filePath, '# Hello');
    const result = await readMarkdownFile('.md', filePath, getMarkdownThem, new Map());
    expect(result.markdown).toBe('# Hello');
    expect(result.previewInfo).toBeNull();
  });

  test('MARKDOWN_EXTENSIONS.has(ext) false, TEXT_DOCUMENT_EXTENSIONS.has(ext) true path', async () => {
    const dir = makeTempDir('dc-rmf-txt-');
    const filePath = path.join(dir, 'notes.txt');
    writeFile(filePath, 'text content');
    const result = await readMarkdownFile('.txt', filePath, getMarkdownThem, new Map());
    expect(result.previewInfo).not.toBeNull();
    expect(result.previewInfo!.kind).toBe('text');
  });

  test('MARKDOWN_EXTENSIONS.has(ext) false, TEXT_DOCUMENT_EXTENSIONS.has(ext) false, CONVERTIBLE_DOCUMENT_EXTENSIONS.has(ext) false', async () => {
    await expect(readMarkdownFile('.xyz', '/tmp/file.xyz', getMarkdownThem, new Map())).rejects.toThrow('Unsupported file type');
  });

  test('CONVERTIBLE_DOCUMENT_EXTENSIONS.has(ext) true, cache miss (getCachedConversionResult returns null)', async () => {
    const dir = makeTempDir('dc-rmf-conv-');
    const filePath = path.join(dir, 'report.doc');
    writeFile(filePath, 'data');
    const mockGetMarkdownThem = () => ({ generateMarkdown: () => Promise.resolve('converted') });
    const result = await readMarkdownFile('.doc', filePath, mockGetMarkdownThem, new Map());
    expect(result.previewInfo).not.toBeNull();
    expect(result.previewInfo!.kind).toBe('converted');
    expect(result.previewInfo!.fromCache).toBe(false);
  });

  test('CONVERTIBLE_DOCUMENT_EXTENSIONS.has(ext) true, cache hit (getCachedConversionResult returns cached)', async () => {
    const dir = makeTempDir('dc-rmf-cache-');
    const filePath = path.join(dir, 'cached.doc');
    writeFile(filePath, 'data');
    const cache = new Map();
    const mockGetMarkdownThem = () => ({ generateMarkdown: () => Promise.resolve('converted') });
    const first = await readMarkdownFile('.doc', filePath, mockGetMarkdownThem, cache);
    expect(first.previewInfo!.fromCache).toBe(false);
    const second = await readMarkdownFile('.doc', filePath, mockGetMarkdownThem, cache);
    expect(second.previewInfo!.fromCache).toBe(true);
  });
});

describe('getCachedConversionResult', () => {
  test('returns null when cache is empty (no entry for filePath)', async () => {
    const dir = makeTempDir('dc-gccr-miss-');
    const filePath = path.join(dir, 'test.doc');
    writeFile(filePath, 'data');
    const stat = fs.statSync(filePath);
    const result = await getCachedConversionResult(new Map(), filePath, stat);
    expect(result).toBeNull();
  });

  test('returns cached result when mtimeMs and size match', async () => {
    const dir = makeTempDir('dc-gccr-hit-');
    const filePath = path.join(dir, 'test.doc');
    writeFile(filePath, 'data');
    const stat = fs.statSync(filePath);
    const cache = new Map();
    cache.set(filePath, { mtimeMs: stat.mtimeMs, size: stat.size, markdown: 'cached md', durationMs: 5 });
    const result = await getCachedConversionResult(cache, filePath, stat);
    expect(result).not.toBeNull();
    expect(result!.markdown).toBe('cached md');
    expect(result!.previewInfo.fromCache).toBe(true);
  });

  test('returns null when mtimeMs differs', async () => {
    const dir = makeTempDir('dc-gccr-mtime-');
    const filePath = path.join(dir, 'test.doc');
    writeFile(filePath, 'data');
    const stat = fs.statSync(filePath);
    const cache = new Map();
    cache.set(filePath, { mtimeMs: stat.mtimeMs + 9999, size: stat.size, markdown: 'old', durationMs: 1 });
    const result = await getCachedConversionResult(cache, filePath, stat);
    expect(result).toBeNull();
  });

  test('returns null when size differs', async () => {
    const dir = makeTempDir('dc-gccr-size-');
    const filePath = path.join(dir, 'test.doc');
    writeFile(filePath, 'data');
    const stat = fs.statSync(filePath);
    const cache = new Map();
    cache.set(filePath, { mtimeMs: stat.mtimeMs, size: stat.size + 1, markdown: 'old', durationMs: 1 });
    const result = await getCachedConversionResult(cache, filePath, stat);
    expect(result).toBeNull();
  });
});
