import { describe, expect, it, vi } from 'vitest';
import { findScopeFile, loadDocumentSnapshot } from '../../../../ui/src/export/documentSnapshot';

function bridge(reply?: (req: any) => any) {
  let handler: any = null;
  return {
    onMessage: (h: any) => { handler = h; return () => { handler = null; }; },
    postMessage: vi.fn((msg: any) => {
      if (!reply) return;
      queueMicrotask(() => { handler?.({ command: 'other' }); handler?.({ command: 'searchPreviewResult', requestId: 'nope' }); handler?.(reply(msg)); });
    }),
  } as any;
}
const file: any = { fsPath: '/w/a.md', relativePath: 'a.md', fileName: 'a.md', title: 'A' };

describe('loadDocumentSnapshot failures', () => {
  it('rejects with the host reason, a default message, or a timeout', async () => {
    await expect(loadDocumentSnapshot(bridge((m) => ({ command: 'searchPreviewResult', requestId: m.requestId, ok: false, reason: 'denied' })), file, {} as any)).rejects.toThrow('denied');
    await expect(loadDocumentSnapshot(bridge((m) => ({ command: 'searchPreviewResult', requestId: m.requestId, ok: true })), file, {} as any)).rejects.toThrow('Unable to load document snapshot');
    await expect(loadDocumentSnapshot(bridge(), file, {} as any, 5)).rejects.toThrow('Document snapshot timed out');
  });
});

describe('findScopeFile', () => {
  const files: any[] = [
    { fsPath: '/w/docs/a.md', relativePath: 'docs/a.md' },
    { fsPath: '/w/docs/Guide.md', relativePath: 'docs/Guide.md' },
    { fsPath: '/w/top.md', relativePath: 'top.md' },
  ];
  const link = (raw: string, extra: Record<string, any> = {}) => ({ raw, resolved: '/nowhere/x.md', openable: true, kind: 'relative', ...extra }) as any;

  it('rejects non-openable and non-file links', () => {
    expect(findScopeFile(link('a.md', { openable: false }), files)).toBeNull();
    expect(findScopeFile(link('a.md', { kind: 'external' }), files)).toBeNull();
    expect(findScopeFile(link('#x'), files)).toBeNull();
    expect(findScopeFile(link('../../x.md'), files, '/w/docs/a.md')).toBeNull();
  });

  it('resolves exact, relative-to-current, relative current path and case-insensitive targets', () => {
    expect(findScopeFile(link('x', { resolved: '/w/top.md' }), files)).toBe(files[2]);
    expect(findScopeFile(link('./guide.md'), files, '/w/docs/a.md')).toBe(files[1]);
    expect(findScopeFile(link('Guide.md'), files, 'docs/other.md')).toBe(files[1]);
    expect(findScopeFile(link('/top.md'), files, 'C:/elsewhere.md')).toBe(files[2]);
    expect(findScopeFile(link('missing.md'), files, null)).toBeNull();
  });
});
