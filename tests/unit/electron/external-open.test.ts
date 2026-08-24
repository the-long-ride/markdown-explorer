import { describe, expect, test } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { findExternalOpenRequest, createExternalOpenQueue } = require('../../../electron/core/external-open.js');

function fsFor(entries: Record<string, 'file' | 'directory'>) {
  return {
    existsSync(path: string) { return entries[path] !== undefined; },
    statSync(path: string) { return { isFile: () => entries[path] === 'file', isDirectory: () => entries[path] === 'directory' }; },
  };
}

describe('external Explorer launches', () => {
  test('parses plain markdown files and folders while ignoring unrelated flags', () => {
    const fs = fsFor({ 'C:/Docs/guide.md': 'file', 'C:/Docs': 'directory', 'C:/Docs/report.txt': 'file' });
    expect(findExternalOpenRequest(['Markdown Explorer.exe', '--squirrel-firstrun', 'C:/Docs/guide.md'], fs)).toEqual({
      mode: 'file', filePath: 'C:/Docs/guide.md',
    });
    expect(findExternalOpenRequest(['Markdown Explorer.exe', 'C:/Docs'], fs)).toEqual({ mode: 'folder', folderPath: 'C:/Docs' });
    expect(findExternalOpenRequest(['Markdown Explorer.exe', 'C:/Docs/report.txt'], fs)).toBeNull();
  });

  test('parses the explicit parent-workspace file mode and rejects invalid flagged targets', () => {
    const fs = fsFor({ 'C:/Repo/docs/guide.mdx': 'file', 'C:/Repo/docs/report.txt': 'file' });
    expect(findExternalOpenRequest(['Markdown Explorer.exe', '--open-with-folder', 'C:/Repo/docs/guide.mdx'], fs)).toEqual({
      mode: 'file-with-parent-workspace',
      filePath: 'C:/Repo/docs/guide.mdx',
      folderPath: 'C:/Repo/docs',
    });
    expect(findExternalOpenRequest(['Markdown Explorer.exe', '--open-with-folder', 'C:/Repo/docs/report.txt'], fs)).toBeNull();
  });

  test('ignores app entry point in unpackaged dev launches', () => {
    const fs = fsFor({ '.': 'directory', 'C:/Docs/guide.md': 'file' });
    expect(findExternalOpenRequest(['electron.exe', '.', 'C:/Docs/guide.md'], fs, { isPackaged: false })).toEqual({
      mode: 'file', filePath: 'C:/Docs/guide.md',
    });
    expect(findExternalOpenRequest(['electron.exe', '.'], fs, { isPackaged: false })).toBeNull();
  });

  test('queues newest structured launch until renderer becomes ready and delivers it once', () => {
    const queue = createExternalOpenQueue();
    queue.push({ mode: 'file', filePath: 'C:/Docs/first.md' });
    queue.push({ mode: 'file-with-parent-workspace', filePath: 'C:/Docs/second.mdx', folderPath: 'C:/Docs' });
    expect(queue.take()).toEqual({ mode: 'file-with-parent-workspace', filePath: 'C:/Docs/second.mdx', folderPath: 'C:/Docs' });
    expect(queue.take()).toBeNull();
  });
});
