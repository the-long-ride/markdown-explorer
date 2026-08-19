import { describe, expect, it, vi } from 'vitest';
import { handleChromeExportHostCommand } from '../../../chromium-xtension/src/chrome-host-export';

interface Tree { [name: string]: Tree | Uint8Array; }

function fileHandle(name: string, bytes: Uint8Array): any {
  return {
    kind: 'file',
    name,
    async getFile() {
      return new File([bytes], name, { type: name.endsWith('.png') ? 'image/png' : '' });
    },
  };
}

function directoryHandle(name: string, tree: Tree): any {
  const entries = Object.entries(tree).map(([entryName, value]) => [
    entryName,
    value instanceof Uint8Array ? fileHandle(entryName, value) : directoryHandle(entryName, value),
  ] as const);
  const byName = new Map(entries);
  return {
    kind: 'directory',
    name,
    async *values() {
      for (const [, handle] of entries) yield handle;
    },
    async getDirectoryHandle(child: string) {
      const handle = byName.get(child);
      if (!handle || handle.kind !== 'directory') throw new Error('missing directory');
      return handle;
    },
    async getFileHandle(child: string) {
      const handle = byName.get(child);
      if (!handle || handle.kind !== 'file') throw new Error('missing file');
      return handle;
    },
  };
}

const root = () => directoryHandle('workspace', {
  'README.md': new TextEncoder().encode('# Docs'),
  assets: { 'logo.png': new Uint8Array([1, 2, 3, 255]) },
  examples: { 'demo.json': new TextEncoder().encode('{"ok":true}') },
  '.git': { config: new TextEncoder().encode('[core]') },
});

describe('Chromium export host adapter', () => {
  it('lists files recursively, omits .git, and sorts paths', async () => {
    const sent: any[] = [];
    const handled = await handleChromeExportHostCommand(
      { command: 'listWorkspaceExportResources', requestId: 'list-1' },
      { activeHandle: root(), send: (message) => sent.push(message) },
    );

    expect(handled).toBe(true);
    expect(sent[0]).toMatchObject({ command: 'workspaceExportResourcesResult', requestId: 'list-1', ok: true });
    const paths = sent[0].resources.map((item: any) => item.relativePath);
    expect(new Set(paths)).toEqual(new Set(['README.md', 'assets/logo.png', 'examples/demo.json']));
    expect(paths).toEqual([...paths].sort((a: string, b: string) => a.localeCompare(b)));
    expect(sent[0].resources.find((item: any) => item.relativePath === 'assets/logo.png').size).toBe(4);
  });

  it('reads document-relative binary resources with MIME and base64', async () => {
    const sent: any[] = [];
    await handleChromeExportHostCommand({
      command: 'readWorkspaceExportResource',
      requestId: 'read-1',
      documentPath: 'docs/readme.md',
      resourcePath: '../assets/logo.png',
    }, { activeHandle: root(), send: (message) => sent.push(message) });

    expect(sent[0]).toEqual({
      command: 'workspaceExportResourceResult',
      requestId: 'read-1',
      ok: true,
      relativePath: 'assets/logo.png',
      mimeType: 'image/png',
      dataBase64: 'AQID/w==',
    });
  });

  it('rejects traversal above the granted workspace root', async () => {
    const sent: any[] = [];
    const handle = root();
    const getDirectory = vi.spyOn(handle, 'getDirectoryHandle');
    await handleChromeExportHostCommand({
      command: 'readWorkspaceExportResource',
      requestId: 'escape',
      documentPath: 'docs/readme.md',
      resourcePath: '../../secret.txt',
    }, { activeHandle: handle, send: (message) => sent.push(message) });

    expect(sent[0]).toEqual({
      command: 'workspaceExportResourceResult', requestId: 'escape', ok: false, reason: 'outside-workspace',
    });
    expect(getDirectory).not.toHaveBeenCalled();
  });

  it('returns a structured failure when no workspace handle is active', async () => {
    const sent: any[] = [];
    await handleChromeExportHostCommand(
      { command: 'readWorkspaceExportResource', requestId: 'none', resourcePath: 'assets/logo.png' },
      { activeHandle: null, send: (message) => sent.push(message) },
    );
    expect(sent[0]).toEqual({
      command: 'workspaceExportResourceResult', requestId: 'none', ok: false, reason: 'missing',
    });
  });
});
