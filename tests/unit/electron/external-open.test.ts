import { describe, expect, test } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { findExternalOpenPath, createExternalOpenQueue } = require('../../../electron/core/external-open.js');

function fsFor(entries: Record<string, 'file' | 'directory'>) {
  return {
    existsSync(path: string) { return entries[path] !== undefined; },
    statSync(path: string) { return { isFile: () => entries[path] === 'file', isDirectory: () => entries[path] === 'directory' }; },
  };
}

describe('external Explorer launches', () => {
  test('accepts markdown files and folders while ignoring executable flags', () => {
    const fs = fsFor({ 'C:/Docs/guide.md': 'file', 'C:/Docs': 'directory', 'C:/Docs/report.txt': 'file' });
    expect(findExternalOpenPath(['Markdown Explorer.exe', '--squirrel-firstrun', 'C:/Docs/guide.md'], fs)).toBe('C:/Docs/guide.md');
    expect(findExternalOpenPath(['Markdown Explorer.exe', 'C:/Docs'], fs)).toBe('C:/Docs');
    expect(findExternalOpenPath(['Markdown Explorer.exe', 'C:/Docs/report.txt'], fs)).toBeNull();
  });

  test('queues newest launch until renderer becomes ready and delivers it once', () => {
    const queue = createExternalOpenQueue();
    queue.push('C:/Docs/first.md');
    queue.push('C:/Docs/second.mdx');
    expect(queue.take()).toBe('C:/Docs/second.mdx');
    expect(queue.take()).toBeNull();
  });
});
