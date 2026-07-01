import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  normalizeSearchQuery,
  filterSearchIndexTabs,
  isValidExternalUrl,
  extractWorkspaceName,
  findFileInfo,
  shouldOpenFirstFile,
} from '../../../chromium-xtension/src/chrome-host';
import type { MdFile } from '../../../ui/src/types';

describe('normalizeSearchQuery', () => {
  it('lowercases and trims a string', () => {
    expect(normalizeSearchQuery('  Hello World  ')).toBe('hello world');
  });

  it('handles undefined', () => {
    expect(normalizeSearchQuery(undefined)).toBe('');
  });

  it('handles null', () => {
    expect(normalizeSearchQuery(null)).toBe('');
  });

  it('handles empty string', () => {
    expect(normalizeSearchQuery('')).toBe('');
  });

  it('handles number input', () => {
    expect(normalizeSearchQuery(42 as any)).toBe('42');
  });

  it('trims whitespace-only input', () => {
    expect(normalizeSearchQuery('   ')).toBe('');
  });

  it('preserves already lowercase input', () => {
    expect(normalizeSearchQuery('test')).toBe('test');
  });
});

describe('filterSearchIndexTabs', () => {
  it('returns matching tabs for active workspace', () => {
    const tabs = [
      { tabId: '1', workspacePath: '/ws-a' },
      { tabId: '2', workspacePath: '/ws-b' },
    ];
    const result = filterSearchIndexTabs(tabs, '/ws-a');
    expect(result).toHaveLength(1);
    expect(result[0].tabId).toBe('1');
    expect(result[0].workspacePath).toBe('/ws-a');
  });

  it('excludes tabs with empty workspacePath', () => {
    const tabs = [
      { tabId: '1', workspacePath: '' },
      { tabId: '2', workspacePath: '/ws' },
    ];
    const result = filterSearchIndexTabs(tabs, '/ws');
    expect(result).toHaveLength(1);
    expect(result[0].tabId).toBe('2');
  });

  it('excludes tabs with empty tabId', () => {
    const tabs = [
      { tabId: '', workspacePath: '/ws' },
      { tabId: '2', workspacePath: '/ws' },
    ];
    const result = filterSearchIndexTabs(tabs, '/ws');
    expect(result).toHaveLength(1);
    expect(result[0].tabId).toBe('2');
  });

  it('returns empty when no tabs match', () => {
    const result = filterSearchIndexTabs(
      [{ tabId: '1', workspacePath: '/other' }],
      '/ws',
    );
    expect(result).toHaveLength(0);
  });

  it('handles non-array input', () => {
    const result = filterSearchIndexTabs('not-an-array' as any, '/ws');
    expect(result).toHaveLength(0);
  });

  it('handles null input', () => {
    const result = filterSearchIndexTabs(null as any, '/ws');
    expect(result).toHaveLength(0);
  });

  it('handles tabs with missing properties', () => {
    const tabs = [{}, { tabId: '1' }, { workspacePath: '/ws' }];
    const result = filterSearchIndexTabs(tabs, '/ws');
    expect(result).toHaveLength(0);
  });

  it('handles tab with undefined tabId', () => {
    const tabs = [{ tabId: undefined, workspacePath: '/ws' }];
    const result = filterSearchIndexTabs(tabs, '/ws');
    expect(result).toHaveLength(0);
  });

  it('returns multiple matches', () => {
    const tabs = [
      { tabId: '1', workspacePath: '/ws' },
      { tabId: '2', workspacePath: '/ws' },
      { tabId: '3', workspacePath: '/other' },
    ];
    const result = filterSearchIndexTabs(tabs, '/ws');
    expect(result).toHaveLength(2);
  });
});

describe('isValidExternalUrl', () => {
  it('accepts http URL', () => {
    expect(isValidExternalUrl('http://example.com')).toBe(true);
  });

  it('accepts https URL', () => {
    expect(isValidExternalUrl('https://example.com')).toBe(true);
  });

  it('accepts uppercase HTTP', () => {
    expect(isValidExternalUrl('HTTP://example.com')).toBe(true);
  });

  it('accepts uppercase HTTPS', () => {
    expect(isValidExternalUrl('HTTPS://example.com')).toBe(true);
  });

  it('rejects ftp URL', () => {
    expect(isValidExternalUrl('ftp://example.com')).toBe(false);
  });

  it('rejects javascript URL', () => {
    expect(isValidExternalUrl('javascript:alert(1)')).toBe(false);
  });

  it('rejects data URL', () => {
    expect(isValidExternalUrl('data:text/html,test')).toBe(false);
  });

  it('rejects non-string input', () => {
    expect(isValidExternalUrl(123 as any)).toBe(false);
  });

  it('rejects null', () => {
    expect(isValidExternalUrl(null)).toBe(false);
  });

  it('rejects undefined', () => {
    expect(isValidExternalUrl(undefined)).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isValidExternalUrl('')).toBe(false);
  });

  it('rejects relative URL', () => {
    expect(isValidExternalUrl('./path/to/file')).toBe(false);
  });

  it('rejects blob URL', () => {
    expect(isValidExternalUrl('blob:chrome-extension://fake')).toBe(false);
  });
});

describe('extractWorkspaceName', () => {
  it('extracts last segment from path', () => {
    expect(extractWorkspaceName('user/projects/my-workspace')).toBe('my-workspace');
  });

  it('returns single segment path as-is', () => {
    expect(extractWorkspaceName('my-workspace')).toBe('my-workspace');
  });

  it('returns fallback for empty string', () => {
    expect(extractWorkspaceName('')).toBe('Workspace');
  });

  it('returns fallback for empty last segment from trailing slash', () => {
    expect(extractWorkspaceName('path/to/')).toBe('Workspace');
  });

  it('handles root-only slash path', () => {
    expect(extractWorkspaceName('/')).toBe('Workspace');
  });

  it('handles deep nested paths', () => {
    expect(extractWorkspaceName('a/b/c/d/workspace')).toBe('workspace');
  });
});

describe('findFileInfo', () => {
  const flatList: MdFile[] = [
    {
      fsPath: 'docs/intro.md',
      relativePath: 'docs/intro.md',
      parts: ['docs', 'intro.md'],
      fileName: 'intro.md',
      title: 'Introduction',
      extension: '.md',
      documentKind: 'markdown',
    },
    {
      fsPath: 'readme.md',
      relativePath: 'readme.md',
      parts: ['readme.md'],
      fileName: 'readme.md',
      title: 'README',
      extension: '.md',
      documentKind: 'markdown',
    },
  ];

  it('finds existing file in flatList', () => {
    const result = findFileInfo(flatList, 'docs/intro.md');
    expect(result.relativePath).toBe('docs/intro.md');
    expect(result.title).toBe('Introduction');
  });

  it('returns fallback for missing file', () => {
    const result = findFileInfo(flatList, 'guide/tutorial.md');
    expect(result.relativePath).toBe('guide/tutorial.md');
    expect(result.title).toBe('tutorial.md');
  });

  it('returns fallback for file with no directory', () => {
    const result = findFileInfo(flatList, 'unknown.md');
    expect(result.relativePath).toBe('unknown.md');
    expect(result.title).toBe('unknown.md');
  });

  it('handles empty flatList', () => {
    const result = findFileInfo([], 'docs/intro.md');
    expect(result.relativePath).toBe('docs/intro.md');
    expect(result.title).toBe('intro.md');
  });

  it('finds root-level file', () => {
    const result = findFileInfo(flatList, 'readme.md');
    expect(result.relativePath).toBe('readme.md');
    expect(result.title).toBe('README');
  });
});

describe('shouldOpenFirstFile', () => {
  const flatList: MdFile[] = [
    {
      fsPath: 'a.md',
      relativePath: 'a.md',
      parts: ['a.md'],
      fileName: 'a.md',
      title: 'A',
      extension: '.md',
      documentKind: 'markdown',
    },
    {
      fsPath: 'b.md',
      relativePath: 'b.md',
      parts: ['b.md'],
      fileName: 'b.md',
      title: 'B',
      extension: '.md',
      documentKind: 'markdown',
    },
  ];

  it('returns first file when no current file and openFirstFile is true', () => {
    expect(shouldOpenFirstFile(null, true, flatList)).toBe('a.md');
  });

  it('returns first file when openFirstFile is undefined (default)', () => {
    expect(shouldOpenFirstFile(null, undefined, flatList)).toBe('a.md');
  });

  it('returns null when openFirstFile is false and no current file', () => {
    expect(shouldOpenFirstFile(null, false, flatList)).toBe(null);
  });

  it('returns current file when it exists and openFirstFile is true', () => {
    expect(shouldOpenFirstFile('b.md', true, flatList)).toBe('b.md');
  });

  it('returns current file when it exists and openFirstFile is false', () => {
    expect(shouldOpenFirstFile('b.md', false, flatList)).toBe('b.md');
  });

  it('returns null when no current file and empty flatList', () => {
    expect(shouldOpenFirstFile(null, true, [])).toBe(null);
  });

  it('returns null when no current file and openFirstFile is false and empty flatList', () => {
    expect(shouldOpenFirstFile(null, false, [])).toBe(null);
  });
});
