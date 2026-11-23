import { describe, expect, it, vi } from 'vitest';
import {
  REPOSITORY_SNAPSHOT_SEARCH_JUMP_EVENT, clearPendingSnapshotSearchJump, createRevisionSidebarSearch,
  getPendingSnapshotSearchJump, queueSnapshotSearchJump,
} from '../../../../ui/src/utils/snapshotSearchJump';

describe('snapshot search jump queue', () => {
  it('validates, normalizes and clears pending jumps by token', () => {
    expect(queueSnapshotSearchJump({ oid: '', relativePath: 'a.md', query: 'q' })).toBeNull();
    expect(queueSnapshotSearchJump({ oid: 'o', relativePath: '', query: 'q' })).toBeNull();
    expect(queueSnapshotSearchJump({ oid: 'o', relativePath: 'a.md', query: '  ' })).toBeNull();
    const seen = vi.fn();
    window.addEventListener(REPOSITORY_SNAPSHOT_SEARCH_JUMP_EVENT, seen);
    const req = queueSnapshotSearchJump({ oid: 'o', relativePath: '\\\\docs//a.md', query: ' q ' })!;
    expect(req).toMatchObject({ relativePath: 'docs/a.md', query: 'q' });
    expect(seen).toHaveBeenCalled();
    clearPendingSnapshotSearchJump(req.token + 1);
    expect(getPendingSnapshotSearchJump()).toBe(req);
    clearPendingSnapshotSearchJump(req.token);
    expect(getPendingSnapshotSearchJump()).toBeNull();
    window.removeEventListener(REPOSITORY_SNAPSHOT_SEARCH_JUMP_EVENT, seen);
  });

  it('builds revision sidebar search callbacks', async () => {
    expect(createRevisionSidebarSearch({ mode: 'live' } as any, null, vi.fn(), vi.fn())).toBeUndefined();
    const search = vi.fn().mockResolvedValue([]);
    const open = vi.fn();
    const cfg = createRevisionSidebarSearch({ mode: 'revision', oid: 'o' } as any, () => 'docs/a.md', search, open)!;
    await cfg.run('q', true, new AbortController().signal);
    expect(search).toHaveBeenCalled();
    queueSnapshotSearchJump({ oid: 'o', relativePath: 'a.md', query: 'q' });
    cfg.openPath!('docs/b.md');
    expect(getPendingSnapshotSearchJump()).toBeNull();
    expect(open).toHaveBeenCalledWith('docs/b.md');
    open.mockClear();
    cfg.openResult!({ relativePath: '' } as any, 'q', false);
    cfg.openResult!({ relativePath: 'docs/a.md', matchOrdinal: 3 } as any, 'q', false);
    expect(getPendingSnapshotSearchJump()).toMatchObject({ matchOrdinal: 2 });
    expect(open).not.toHaveBeenCalled();
    const staticCfg = createRevisionSidebarSearch({ mode: 'revision', oid: 'o' } as any, null, search, open)!;
    staticCfg.openResult!({ relativePath: 'docs/c.md' } as any, 'q', true);
    expect(open).toHaveBeenCalledWith('docs/c.md');
    clearPendingSnapshotSearchJump();
  });
});
