import { describe, expect, it, vi } from 'vitest';
import { documentRevision, writeTextFile } from '../../../chromium-xtension/src/file-access';

function createFileHandle(initialSource = '# A', initialModified = 10) {
  let source = initialSource;
  let lastModified = initialModified;
  const close = vi.fn(async () => { lastModified += 1; });
  const write = vi.fn(async (next: string) => { source = String(next); });
  const handle: any = {
    kind: 'file',
    name: 'a.md',
    getFile: vi.fn(async () => ({
      lastModified,
      size: new TextEncoder().encode(source).byteLength,
      text: async () => source,
    })),
    createWritable: vi.fn(async () => ({ write, close })),
  };
  return { handle, readSource: () => source, write, close };
}

function createRoot(fileHandle: any, permission: 'granted' | 'denied' | 'prompt' = 'prompt') {
  const requestPermission = vi.fn(async () => permission === 'denied' ? 'denied' : 'granted');
  const root: any = {
    kind: 'directory',
    name: 'workspace',
    queryPermission: vi.fn(async () => permission),
    requestPermission,
    getFileHandle: vi.fn(async () => fileHandle),
    getDirectoryHandle: vi.fn(async () => { throw new DOMException('Not found', 'NotFoundError'); }),
  };
  return { root, requestPermission };
}

describe('browser Markdown document writes', () => {
  it('derives revision from lastModified and byte size', async () => {
    const { handle } = createFileHandle('# A', 25);
    await expect(documentRevision(handle)).resolves.toBe('25:3');
  });

  it('requests readwrite permission before creating a writable stream', async () => {
    const { handle, readSource } = createFileHandle();
    const { root, requestPermission } = createRoot(handle);
    const expectedRevision = await documentRevision(handle);

    const result = await writeTextFile(root, 'a.md', '# B', expectedRevision, false);

    expect(requestPermission).toHaveBeenCalledWith({ mode: 'readwrite' });
    expect(handle.createWritable).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(true);
    expect(readSource()).toBe('# B');
  });

  it('denies the save without opening a writable stream when permission is denied', async () => {
    const { handle } = createFileHandle();
    const { root } = createRoot(handle, 'denied');

    const result = await writeTextFile(root, 'a.md', '# B', null, false);

    expect(result).toMatchObject({ ok: false, reason: 'permission-denied' });
    expect(handle.createWritable).not.toHaveBeenCalled();
  });

  it('returns conflict data without overwriting a stale revision', async () => {
    const { handle, readSource } = createFileHandle('# External', 20);
    const { root } = createRoot(handle, 'granted');

    const result = await writeTextFile(root, 'a.md', '# Mine', '10:3', false);

    expect(result).toMatchObject({ ok: false, reason: 'conflict', diskSource: '# External' });
    expect(result.diskRevision).toBe(await documentRevision(handle));
    expect(handle.createWritable).not.toHaveBeenCalled();
    expect(readSource()).toBe('# External');
  });

  it('force saves over a stale revision', async () => {
    const { handle, readSource } = createFileHandle('# External', 20);
    const { root } = createRoot(handle, 'granted');

    const result = await writeTextFile(root, 'a.md', '# Mine', '10:3', true);

    expect(result.ok).toBe(true);
    expect(readSource()).toBe('# Mine');
  });

  it('rejects traversal before resolving a file handle', async () => {
    const { handle } = createFileHandle();
    const { root } = createRoot(handle, 'granted');

    const result = await writeTextFile(root, '../escape.md', '# Nope', null, false);

    expect(result).toMatchObject({ ok: false, reason: 'outside-workspace' });
    expect(root.getFileHandle).not.toHaveBeenCalled();
  });
});
