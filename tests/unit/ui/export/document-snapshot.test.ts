import { describe, expect, it, vi } from 'vitest';
import type { PlatformBridge } from '../../../../ui/src/platform/bridge';
import type { MdFile } from '../../../../ui/src/types/files';
import { findScopeFile, loadDocumentSnapshot } from '../../../../ui/src/export/documentSnapshot';

function file(fsPath: string, relativePath = 'guide.md'): MdFile {
  return {
    fsPath,
    relativePath,
    parts: relativePath.split('/'),
    fileName: relativePath.split('/').at(-1) || relativePath,
    title: 'Guide',
    extension: '.md',
    documentKind: 'markdown',
  };
}

function bridgeHarness() {
  let handler: ((message: any) => void) | null = null;
  const postMessage = vi.fn((message: any) => {
    queueMicrotask(() => handler?.({
      command: 'searchPreviewResult',
      requestId: message.requestId,
      filePath: message.filePath,
      ok: true,
      markdownSource: '# Snapshot',
    }));
  });
  const bridge: PlatformBridge = {
    postMessage,
    onMessage(next) { handler = next; return () => { handler = null; }; },
    getState: () => undefined,
    setState: () => {},
    copyToClipboard: () => {},
  };
  return { bridge, postMessage };
}

describe('document snapshot client', () => {
  it('loads workspace preview source and renders it for the requested file', async () => {
    const { bridge, postMessage } = bridgeHarness();
    const target = file('C:\\docs\\guide.md');
    const snapshot = await loadDocumentSnapshot(bridge, target, { language: 'en' } as any);

    expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
      command: 'loadSearchPreview',
      filePath: target.fsPath,
    }));
    expect(snapshot.file).toBe(target);
    expect(snapshot.markdownSource).toBe('# Snapshot');
    expect(snapshot.html).toContain('Snapshot');
  });

  it('rejects failed workspace preview responses', async () => {
    let handler: ((message: any) => void) | null = null;
    const bridge: PlatformBridge = {
      postMessage(message: any) {
        queueMicrotask(() => handler?.({
          command: 'searchPreviewResult', requestId: message.requestId,
          filePath: message.filePath, ok: false, reason: 'outside-workspace',
        }));
      },
      onMessage(next) { handler = next; return () => { handler = null; }; },
      getState: () => undefined,
      setState: () => {},
      copyToClipboard: () => {},
    };

    await expect(loadDocumentSnapshot(bridge, file('/docs/guide.md'), {} as any))
      .rejects.toThrow('outside-workspace');
  });
});

describe('findScopeFile', () => {
  const files = [
    file('C:\\docs\\guide.md', 'guide.md'),
    file('C:\\docs\\nested\\next.md', 'nested/next.md'),
  ];

  it('matches a file URL to the exact workspace file', () => {
    expect(findScopeFile({
      raw: './guide.md', resolved: 'file:///C:/docs/guide.md', kind: 'file', openable: true, copyable: true,
    }, files)).toBe(files[0]);
  });

  it('ignores fragments and query strings when matching', () => {
    expect(findScopeFile({
      raw: './next.md#part', resolved: 'file:///C:/docs/nested/next.md?x=1#part', kind: 'file', openable: true, copyable: true,
    }, files)).toBe(files[1]);
  });

  it('returns null for links outside the workspace file list', () => {
    expect(findScopeFile({
      raw: '../secret.md', resolved: 'file:///C:/secret.md', kind: 'file', openable: true, copyable: true,
    }, files)).toBeNull();
  });
});
