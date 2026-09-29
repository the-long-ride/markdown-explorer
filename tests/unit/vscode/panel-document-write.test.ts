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

  it.each([
    '/workspace/notes.txt',
    '/workspace/package.json',
    '/workspace/.git/config',
    '/workspace/.git/info/readme.md',
    '/workspace/sub/.GIT/hooks/x.md',
  ])('refuses to save a non-Markdown or .git path: %s', async (target) => {
    const { deps, writeFile } = createDeps({ [target]: 'x' });

    const result = await handlePanelDocumentWrite(message({ filePath: path.resolve(target) }), deps as any, {
      realpathImpl: async (value: string) => path.resolve(value),
    } as any);

    expect(result).toMatchObject({ ok: false, reason: 'read-only' });
    expect(writeFile).not.toHaveBeenCalled();
  });

  it('refuses a Markdown path whose canonical target is inside .git', async () => {
    const linked = path.resolve('/workspace/linked.md');
    const { deps, writeFile } = createDeps({ [linked]: '# A' });
    const realpathImpl = async (value: string) => {
      const resolved = path.resolve(value);
      return resolved === linked ? path.resolve('/workspace/.git/description.md') : resolved;
    };

    const result = await handlePanelDocumentWrite(message({ filePath: linked }), deps as any, { realpathImpl } as any);

    expect(result).toMatchObject({ ok: false, reason: 'read-only' });
    expect(writeFile).not.toHaveBeenCalled();
  });

  it('treats a null expected revision on an existing file as a conflict', async () => {
    const { deps, writeFile } = createDeps({ '/workspace/a.md': '# External' });

    const result = await handlePanelDocumentWrite(message({ expectedRevision: null }), deps as any, {
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

  it('writes with a null expected revision when force is set', async () => {
    const { deps, writeFile } = createDeps({ '/workspace/a.md': '# External' });

    const result = await handlePanelDocumentWrite(message({ expectedRevision: null, force: true }), deps as any, {
      realpathImpl: async (value: string) => path.resolve(value),
    } as any);

    expect(result.ok).toBe(true);
    expect(writeFile).toHaveBeenCalledTimes(1);
  });

  it('preserves a UTF-8 BOM in the conflict disk source', async () => {
    const { deps } = createDeps({ '/workspace/a.md': '﻿# External' });

    const result = await handlePanelDocumentWrite(message({ expectedRevision: '9:3' }), deps as any, {
      realpathImpl: async (value: string) => path.resolve(value),
    } as any);

    expect(result.reason).toBe('conflict');
    expect(result.diskSource).toBe('﻿# External');
  });

  it('keeps a BOM supplied in the source when writing', async () => {
    const { deps, writeFile } = createDeps({ '/workspace/a.md': '﻿# A' });
    const revision = `10:${encoder.encode('﻿# A').byteLength}`;

    const result = await handlePanelDocumentWrite(message({ expectedRevision: revision, source: '﻿# B' }), deps as any, {
      realpathImpl: async (value: string) => path.resolve(value),
    } as any);

    expect(result.ok).toBe(true);
    expect(Array.from((writeFile.mock.calls[0][1] as Uint8Array).slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
  });

  it('returns a conflict with the editor text when the document is open and dirty', async () => {
    const { deps, writeFile } = createDeps({ '/workspace/a.md': '# A' });
    (deps.workspace as any).textDocuments = [{
      uri: { fsPath: path.resolve('/workspace/a.md'), scheme: 'file' },
      isDirty: true,
      getText: () => '# Unsaved editor text',
    }];

    const result = await handlePanelDocumentWrite(message(), deps as any, {
      realpathImpl: async (value: string) => path.resolve(value),
    } as any);

    expect(result).toMatchObject({
      ok: false,
      reason: 'conflict',
      diskSource: '# Unsaved editor text',
      diskRevision: '10:3',
    });
    expect(writeFile).not.toHaveBeenCalled();
  });

  it('writes when the document is open in an editor but not dirty', async () => {
    const { deps, writeFile } = createDeps({ '/workspace/a.md': '# A' });
    (deps.workspace as any).textDocuments = [{
      uri: { fsPath: path.resolve('/workspace/a.md'), scheme: 'file' },
      isDirty: false,
      getText: () => '# A',
    }];

    const result = await handlePanelDocumentWrite(message(), deps as any, {
      realpathImpl: async (value: string) => path.resolve(value),
    } as any);

    expect(result.ok).toBe(true);
    expect(writeFile).toHaveBeenCalledTimes(1);
  });

  it('writes file: scheme documents atomically through a sibling temp file and rename', async () => {
    const { deps, files, writeFile } = createDeps({ '/workspace/a.md': '# A' });
    const target = path.resolve('/workspace/a.md');
    const rename = vi.fn(async (from: { fsPath: string }, to: { fsPath: string }, _options: { overwrite: boolean }) => {
      const temp = files.get(path.resolve(from.fsPath));
      if (!temp) throw new Error('temp missing');
      files.delete(path.resolve(from.fsPath));
      files.set(path.resolve(to.fsPath), { ...temp, mtime: 20 });
    });
    const originalWrite = writeFile.getMockImplementation()!;
    writeFile.mockImplementation(async (uri: { fsPath: string }, bytes: Uint8Array) => {
      const key = path.resolve(uri.fsPath);
      if (!files.has(key)) files.set(key, { source: '', mtime: 0 });
      return originalWrite(uri, bytes);
    });
    (deps.workspace.fs as any).rename = rename;
    (deps as any).Uri = { file: (fsPath: string) => ({ fsPath: path.resolve(fsPath), scheme: 'file' }) };

    const result = await handlePanelDocumentWrite(message(), deps as any, {
      realpathImpl: async (value: string) => path.resolve(value),
    } as any);

    expect(result).toMatchObject({ ok: true, revision: '20:3' });
    const tempPath = path.resolve((writeFile.mock.calls[0][0] as { fsPath: string }).fsPath);
    expect(tempPath).not.toBe(target);
    expect(path.dirname(tempPath)).toBe(path.dirname(target));
    expect(rename).toHaveBeenCalledWith(
      expect.objectContaining({ fsPath: tempPath }),
      expect.objectContaining({ fsPath: target }),
      { overwrite: true },
    );
    expect(files.get(target)?.source).toBe('# B');
    expect(files.has(tempPath)).toBe(false);
  });

  it('removes the temp file when the atomic rename fails', async () => {
    const { deps, files, writeFile } = createDeps({ '/workspace/a.md': '# A' });
    const originalWrite = writeFile.getMockImplementation()!;
    writeFile.mockImplementation(async (uri: { fsPath: string }, bytes: Uint8Array) => {
      const key = path.resolve(uri.fsPath);
      if (!files.has(key)) files.set(key, { source: '', mtime: 0 });
      return originalWrite(uri, bytes);
    });
    const del = vi.fn(async (uri: { fsPath: string }) => { files.delete(path.resolve(uri.fsPath)); });
    (deps.workspace.fs as any).rename = vi.fn(async () => { throw new Error('EPERM'); });
    (deps.workspace.fs as any).delete = del;
    (deps as any).Uri = { file: (fsPath: string) => ({ fsPath: path.resolve(fsPath), scheme: 'file' }) };

    const result = await handlePanelDocumentWrite(message(), deps as any, {
      realpathImpl: async (value: string) => path.resolve(value),
    } as any);

    expect(result).toMatchObject({ ok: false, reason: 'write-failed' });
    expect(del).toHaveBeenCalledTimes(1);
    expect(files.get(path.resolve('/workspace/a.md'))?.source).toBe('# A');
    expect([...files.keys()]).toEqual([path.resolve('/workspace/a.md')]);
  });

  it('keeps plain writeFile for non-file schemes', async () => {
    const { deps, writeFile } = createDeps({ '/workspace/a.md': '# A' });
    const rename = vi.fn();
    (deps.workspace.fs as any).rename = rename;
    (deps as any).Uri = { file: (fsPath: string) => ({ fsPath: path.resolve(fsPath), scheme: 'vscode-vfs' }) };

    const result = await handlePanelDocumentWrite(message(), deps as any, {
      realpathImpl: async (value: string) => path.resolve(value),
    } as any);

    expect(result.ok).toBe(true);
    expect(writeFile).toHaveBeenCalledWith(expect.objectContaining({ fsPath: path.resolve('/workspace/a.md') }), expect.any(Uint8Array));
    expect(rename).not.toHaveBeenCalled();
  });
});
