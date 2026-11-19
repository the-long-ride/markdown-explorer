import { describe, expect, it, vi } from 'vitest';
import { writeSingleFileDocument } from '../../../website-app/src/web-file-mode';

function createHandle(initialSource = '# A', initialModified = 10, permission: 'granted' | 'denied' | 'prompt' = 'prompt') {
  let source = initialSource;
  let lastModified = initialModified;
  const requestPermission = vi.fn(async () => permission === 'denied' ? 'denied' : 'granted');
  const write = vi.fn(async (next: string) => { source = String(next); });
  const handle: any = {
    kind: 'file',
    name: 'a.md',
    queryPermission: vi.fn(async () => permission),
    requestPermission,
    getFile: vi.fn(async () => ({
      lastModified,
      size: new TextEncoder().encode(source).byteLength,
      text: async () => source,
    })),
    createWritable: vi.fn(async () => ({
      write,
      close: vi.fn(async () => { lastModified += 1; }),
    })),
  };
  return { handle, requestPermission, readSource: () => source };
}

describe('web single-file Markdown writes', () => {
  it('requests write permission and saves the selected file', async () => {
    const { handle, requestPermission, readSource } = createHandle();

    const result = await writeSingleFileDocument(handle, '# B', '10:3', false);

    expect(requestPermission).toHaveBeenCalledWith({ mode: 'readwrite' });
    expect(result.ok).toBe(true);
    expect(readSource()).toBe('# B');
  });

  it('returns conflict without overwriting a stale selected file', async () => {
    const { handle, readSource } = createHandle('# External', 20, 'granted');

    const result = await writeSingleFileDocument(handle, '# Mine', '10:3', false);

    expect(result).toMatchObject({ ok: false, reason: 'conflict', diskSource: '# External' });
    expect(handle.createWritable).not.toHaveBeenCalled();
    expect(readSource()).toBe('# External');
  });

  it('returns permission denied without writing', async () => {
    const { handle } = createHandle('# A', 10, 'denied');

    const result = await writeSingleFileDocument(handle, '# B', null, false);

    expect(result).toMatchObject({ ok: false, reason: 'permission-denied' });
    expect(handle.createWritable).not.toHaveBeenCalled();
  });
});
