import { describe, expect, it, vi } from 'vitest';
import type { MdFile } from '../../../ui/src/types';
import { resolveWebNavigationTarget } from '../../../website-app/src/web-navigation';
import { handleWebTestMessage } from '../../../website-app/src/web-test-message-router';

function mdFile(relativePath: string, title = relativePath): MdFile {
  const parts = relativePath.split('/');
  const fileName = parts.at(-1) || relativePath;
  const dot = fileName.lastIndexOf('.');
  return {
    fsPath: relativePath,
    relativePath,
    parts,
    fileName,
    title,
    extension: dot === -1 ? '.md' : fileName.slice(dot),
    documentKind: 'markdown',
  };
}

const files: MdFile[] = [
  mdFile('README.md', 'README'),
  mdFile('docs/install-macos.md', 'Install macOS'),
  mdFile('docs/my guide.md', 'My Guide'),
  mdFile('manual-tests/test-basic.md', 'Basic'),
  mdFile('manual-tests/test-interactive.mdx', 'Interactive'),
  mdFile('manual-tests/test-navigation.md', 'Navigation'),
];

describe('resolveWebNavigationTarget', () => {
  it('resolves same-folder relative links and strips fragments', () => {
    expect(resolveWebNavigationTarget('./test-basic.md#headings', 'manual-tests/test-navigation.md', files)).toEqual({
      kind: 'file',
      filePath: 'manual-tests/test-basic.md',
    });
    expect(resolveWebNavigationTarget('./test-interactive.mdx', 'manual-tests/test-navigation.md', files)).toEqual({
      kind: 'file',
      filePath: 'manual-tests/test-interactive.mdx',
    });
  });

  it('resolves workspace-root links starting with / and parent ../ links', () => {
    expect(resolveWebNavigationTarget('/manual-tests/test-basic.md', 'docs/install-macos.md', files)).toEqual({
      kind: 'file',
      filePath: 'manual-tests/test-basic.md',
    });
    expect(resolveWebNavigationTarget('../README.md', 'manual-tests/test-navigation.md', files)).toEqual({
      kind: 'file',
      filePath: 'README.md',
    });
    expect(resolveWebNavigationTarget('../docs/my%20guide.md#step-1', 'manual-tests/test-navigation.md', files)).toEqual({
      kind: 'file',
      filePath: 'docs/my guide.md',
    });
  });

  it('returns notFound when navigating above workspace root or to missing files', () => {
    expect(resolveWebNavigationTarget('../README.md', 'README.md', files)).toEqual({
      kind: 'notFound',
      href: '../README.md',
    });
    expect(resolveWebNavigationTarget('/manual-tests/missing.md', 'README.md', files)).toEqual({
      kind: 'notFound',
      href: 'manual-tests/missing.md',
    });
    expect(resolveWebNavigationTarget('https://example.com/doc.md', 'README.md', files)).toEqual({
      kind: 'notFound',
      href: 'https://example.com/doc.md',
    });
  });

  it('keeps current file for fragment-only targets and returns welcome for empty targets', () => {
    expect(resolveWebNavigationTarget('#headings', 'manual-tests/test-navigation.md', files)).toEqual({
      kind: 'file',
      filePath: 'manual-tests/test-navigation.md',
    });
    expect(resolveWebNavigationTarget('', 'manual-tests/test-navigation.md', files)).toEqual({
      kind: 'welcome',
    });
  });

  it('resolves case-insensitive paths and handles decoded empty and root-only links', () => {
    expect(resolveWebNavigationTarget(undefined, 'README.md', files)).toEqual({ kind: 'welcome' });
    expect(resolveWebNavigationTarget('%20', 'README.md', files)).toEqual({ kind: 'file', filePath: 'README.md' });
    expect(resolveWebNavigationTarget('%20', null, files)).toEqual({ kind: 'welcome' });
    expect(resolveWebNavigationTarget('/', 'README.md', files)).toEqual({ kind: 'notFound', href: '/' });
    expect(resolveWebNavigationTarget('INSTALL-MACOS.MD', 'docs/other.md', files)).toEqual({
      kind: 'file', filePath: 'docs/install-macos.md',
    });
  });
});

describe('handleWebTestMessage navigate', () => {
  it('resolves relative test workspace links and sends navNotFound without clobbering currentFile', async () => {
    const sent: any[] = [];
    let currentFile: string | null = 'test-navigation.md';
    const sendTestContent = vi.fn(async () => {});
    const testFiles = [
      mdFile('test-navigation.md'),
      mdFile('test-basic.md'),
      mdFile('test-interactive.mdx'),
    ];
    const deps = {
      getReadyHandled: () => true,
      setReadyHandled: vi.fn(),
      setCurrentFile: (path: string | null) => { currentFile = path; },
      getCurrentFile: () => currentFile,
      getFlatList: () => testFiles,
      send: (msg: unknown) => { sent.push(msg); },
      sendTestReady: vi.fn(async () => {}),
      sendTestContent,
      refreshTestWorkspace: vi.fn(async () => {}),
      getWorkspaceOperationMetadata: () => ({}),
      setDocumentConversionEnabled: vi.fn(),
    };

    await handleWebTestMessage({ command: 'navigate', path: './test-basic.md#headings' }, deps);
    expect(currentFile).toBe('test-basic.md');
    expect(sendTestContent).toHaveBeenCalledWith('test-basic.md');

    await handleWebTestMessage({ command: 'navigate', path: './test-interactive.mdx' }, deps);
    expect(currentFile).toBe('test-interactive.mdx');
    expect(sendTestContent).toHaveBeenCalledWith('test-interactive.mdx');

    await handleWebTestMessage({ command: 'navigate', path: '../README.md' }, deps);
    expect(currentFile).toBe('test-interactive.mdx');
    expect(sent.at(-1)).toEqual({ command: 'navNotFound', href: '../README.md' });
  });
});
