import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { handlePanelDocumentWrite } from '../../../vscode/src/core/panelDocumentWrite';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function createDeps(initial: Record<string, string>) {
  const files = new Map(Object.entries(initial).map(([filePath, source]) => [path.resolve(filePath), {
    source,
    mtime: 10,
  }]));
  const writeFile = vi.fn(async (uri: { fsPath: string }, bytes: Uint8Array) => {
    const key = path.resolve(uri.fsPath);
    const current = files.get(key);
    if (!current) throw Object.assign(new Error('missing'), { code: 'FileNotFound' });
    files.set(key, { source: decoder.decode(bytes), mtime: current.mtime + 1 });
  });
  const fs = {
    stat: vi.fn(async (uri: { fsPath: string }) => {
      const file = files.get(path.resolve(uri.fsPath));
      if (!file) throw Object.assign(new Error('missing'), { code: 'FileNotFound' });
      return { mtime: file.mtime, size: encoder.encode(file.source).byteLength, type: 1 };
    }),
    readFile: vi.fn(async (uri: { fsPath: string }) => {
      const file = files.get(path.resolve(uri.fsPath));
      if (!file) throw Object.assign(new Error('missing'), { code: 'FileNotFound' });
      return encoder.encode(file.source);
    }),
    writeFile,
  };
  const deps = {
    workspace: {
      workspaceFolders: [{ uri: { fsPath: path.resolve('/workspace') } }],
      fs,
    },
    Uri: { file: (fsPath: string) => ({ fsPath: path.resolve(fsPath) }) },
  };
  return { deps, files, writeFile };
}

function message(overrides: Record<string, unknown> = {}) {
  return {
    command: 'saveDocument' as const,
    requestId: 'save-1',
    filePath: path.resolve('/workspace/a.md'),
    source: '# B',
    expectedRevision: '10:3',
    ...overrides,
  };
}

describe('VS Code panel Markdown document writes', () => {
  it('writes through workspace.fs and returns a correlated result', async () => {
    const { deps, files, writeFile } = createDeps({ '/workspace/a.md': '# A' });

    const result = await handlePanelDocumentWrite(message(), deps as any, {
      realpathImpl: async (value: string) => path.resolve(value),
    } as any);

    expect(result).toMatchObject({
      command: 'saveDocumentResult',
      requestId: 'save-1',
      filePath: path.resolve('/workspace/a.md'),
      ok: true,
    });
    expect(writeFile).toHaveBeenCalledTimes(1);
    expect(files.get(path.resolve('/workspace/a.md'))?.source).toBe('# B');
  });

  it('rejects a path outside the active workspace', async () => {
    const { deps, writeFile } = createDeps({ '/workspace/a.md': '# A', '/escape.md': '# E' });

    const result = await handlePanelDocumentWrite(message({ filePath: path.resolve('/escape.md') }), deps as any, {
      realpathImpl: async (value: string) => path.resolve(value),
    } as any);

    expect(result).toMatchObject({ ok: false, reason: 'outside-workspace' });
    expect(writeFile).not.toHaveBeenCalled();
  });

  it('rejects a workspace path that resolves through a symlink outside the workspace', async () => {
    const linked = path.resolve('/workspace/linked.md');
    const outside = path.resolve('/outside/target.md');
    const { deps, writeFile } = createDeps({ [linked]: '# Outside' });
    const realpathImpl = vi.fn(async (value: string) => {
      const resolved = path.resolve(value);
      return resolved === linked ? outside : resolved;
    });

    const result = await handlePanelDocumentWrite(message({ filePath: linked }), deps as any, { realpathImpl } as any);

    expect(result).toMatchObject({ ok: false, reason: 'outside-workspace' });
    expect(writeFile).not.toHaveBeenCalled();
  });

  it('returns conflict and disk source without writing a stale revision', async () => {
    const { deps, writeFile } = createDeps({ '/workspace/a.md': '# External' });

    const result = await handlePanelDocumentWrite(message({ expectedRevision: '9:3' }), deps as any, {
      realpathImpl: async (value: string) => path.resolve(value),
    } as any);

    expect(result).toMatchObject({
      ok: false,
      reason: 'conflict',
      diskSource: '# External',
      diskRevision: `10:${encoder.encode('# External').byteLength}`,
    });
    expect(writeFile).not.toHaveBeenCalled();
  });

  it('force saves even when the expected revision is stale', async () => {
    const { deps, writeFile } = createDeps({ '/workspace/a.md': '# External' });

    const result = await handlePanelDocumentWrite(message({ expectedRevision: '9:3', force: true }), deps as any, {
      realpathImpl: async (value: string) => path.resolve(value),
    } as any);

    expect(result.ok).toBe(true);
    expect(writeFile).toHaveBeenCalledTimes(1);
  });

  it('reports a missing target without attempting a write', async () => {
    const { deps, writeFile } = createDeps({ '/workspace/a.md': '# A' });

    const result = await handlePanelDocumentWrite(message({ filePath: path.resolve('/workspace/missing.md') }), deps as any, {
      realpathImpl: async (value: string) => path.resolve(value),
    } as any);

    expect(result).toMatchObject({ ok: false, reason: 'missing' });
    expect(writeFile).not.toHaveBeenCalled();
  });
});
