import { describe, expect, it, vi } from 'vitest';
import {
  createValidatedCacheDocument, executeExternalLinkChecks, isMarkdownInsightsEntry,
} from '../../../../ui/src/insights/workspaceInsightsSession';

describe('workspace insights session helpers', () => {
  it('detects markdown entries by path or extension', () => {
    expect(isMarkdownInsightsEntry({ relativePath: 'a.MDX' } as any)).toBe(true);
    expect(isMarkdownInsightsEntry({ relativePath: 'README', extension: '.md' } as any)).toBe(true);
    expect(isMarkdownInsightsEntry({ relativePath: 'a.txt' } as any)).toBe(false);
  });

  it('falls back to entry size and mtime for cache documents', () => {
    const entry: any = { relativePath: 'a.md', sizeBytes: 3, mtimeMs: 4 };
    expect(createValidatedCacheDocument(entry, {} as any, 'h', { persisted: {} } as any)).toMatchObject({ sizeBytes: 3, mtimeMs: 4, contentHash: 'h' });
    expect(createValidatedCacheDocument(entry, { sizeBytes: 9, mtimeMs: 8 } as any, 'h', { persisted: {} } as any)).toMatchObject({ sizeBytes: 9, mtimeMs: 8 });
  });

  it('skips external link checks when disabled or without http urls', async () => {
    const bridge: any = { postMessage: vi.fn(), onMessage: vi.fn(() => () => undefined) };
    const ref = { current: null };
    expect(await executeExternalLinkChecks(bridge, ['https://x'], { enabled: false } as any, new Set(), ref, vi.fn())).toEqual([]);
    expect(await executeExternalLinkChecks(bridge, ['mailto:a', 'ftp://b'], { enabled: true } as any, new Set(), ref, vi.fn())).toEqual([]);
    expect(bridge.postMessage).not.toHaveBeenCalled();
  });
});
