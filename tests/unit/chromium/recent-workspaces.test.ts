import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserRecentWorkspaces } from '../../../chromium-xtension/src/recent-workspaces';

vi.mock('../../../chromium-xtension/src/file-access', () => ({
  saveHandleToIDB: vi.fn(),
  loadHandlesFromIDB: vi.fn(),
  deleteHandleFromIDB: vi.fn(),
}));

import { saveHandleToIDB, loadHandlesFromIDB, deleteHandleFromIDB } from '../../../chromium-xtension/src/file-access';

const mockLoadHandlesFromIDB = vi.mocked(loadHandlesFromIDB);
const mockSaveHandleToIDB = vi.mocked(saveHandleToIDB);
const mockDeleteHandleFromIDB = vi.mocked(deleteHandleFromIDB);

function makeHandle(name: string) {
  return { kind: 'directory', name } as unknown as FileSystemDirectoryHandle;
}

beforeEach(() => {
  (BrowserRecentWorkspaces as any).handles.clear();
  vi.clearAllMocks();
});

describe('BrowserRecentWorkspaces.getHandle', () => {
  it('returns cached handle on cache hit', async () => {
    const handle = makeHandle('cached');
    (BrowserRecentWorkspaces as any).handles.set('/cached', handle);
    const result = await BrowserRecentWorkspaces.getHandle('/cached');
    expect(result).toBe(handle);
    expect(mockLoadHandlesFromIDB).not.toHaveBeenCalled();
  });

  it('falls back to IDB when not in cache', async () => {
    const handle = makeHandle('from-idb');
    mockLoadHandlesFromIDB.mockResolvedValue([
      { path: '/from-idb', name: 'from-idb', handle, lastOpened: 100 },
    ]);
    const result = await BrowserRecentWorkspaces.getHandle('/from-idb');
    expect(result).toBe(handle);
    expect((BrowserRecentWorkspaces as any).handles.has('/from-idb')).toBe(true);
  });

  it('returns null when not found in cache or IDB', async () => {
    mockLoadHandlesFromIDB.mockResolvedValue([]);
    const result = await BrowserRecentWorkspaces.getHandle('/missing');
    expect(result).toBeNull();
  });

  it('caches handle from IDB after fallback', async () => {
    const handle = makeHandle('lazy');
    mockLoadHandlesFromIDB.mockResolvedValue([
      { path: '/lazy', name: 'lazy', handle, lastOpened: 50 },
    ]);
    await BrowserRecentWorkspaces.getHandle('/lazy');
    mockLoadHandlesFromIDB.mockResolvedValue([]);
    const result = await BrowserRecentWorkspaces.getHandle('/lazy');
    expect(result).toBe(handle);
    expect(mockLoadHandlesFromIDB).toHaveBeenCalledTimes(1);
  });
});

describe('BrowserRecentWorkspaces.load', () => {
  it('sorts by lastOpened descending', async () => {
    const h1 = makeHandle('old');
    const h2 = makeHandle('new');
    const h3 = makeHandle('mid');
    mockLoadHandlesFromIDB.mockResolvedValue([
      { path: '/old', name: 'old', handle: h1, lastOpened: 100 },
      { path: '/new', name: 'new', handle: h2, lastOpened: 300 },
      { path: '/mid', name: 'mid', handle: h3, lastOpened: 200 },
    ]);
    const result = await BrowserRecentWorkspaces.load();
    expect(result.map(r => r.path)).toEqual(['/new', '/mid', '/old']);
  });

  it('caches all handles from IDB into in-memory Map', async () => {
    const h1 = makeHandle('a');
    const h2 = makeHandle('b');
    mockLoadHandlesFromIDB.mockResolvedValue([
      { path: '/a', name: 'a', handle: h1, lastOpened: 10 },
      { path: '/b', name: 'b', handle: h2, lastOpened: 20 },
    ]);
    await BrowserRecentWorkspaces.load();
    expect((BrowserRecentWorkspaces as any).handles.get('/a')).toBe(h1);
    expect((BrowserRecentWorkspaces as any).handles.get('/b')).toBe(h2);
  });

  it('returns stripped objects without handle', async () => {
    const h = makeHandle('stripped');
    mockLoadHandlesFromIDB.mockResolvedValue([
      { path: '/stripped', name: 'stripped', handle: h, lastOpened: 500 },
    ]);
    const result = await BrowserRecentWorkspaces.load();
    expect(result).toEqual([{ name: 'stripped', path: '/stripped', lastOpened: 500 }]);
    expect((result[0] as any).handle).toBeUndefined();
  });

  it('returns empty array when IDB throws', async () => {
    mockLoadHandlesFromIDB.mockRejectedValue(new Error('IDB failure'));
    const result = await BrowserRecentWorkspaces.load();
    expect(result).toEqual([]);
  });

  it('returns empty array when no workspaces exist', async () => {
    mockLoadHandlesFromIDB.mockResolvedValue([]);
    const result = await BrowserRecentWorkspaces.load();
    expect(result).toEqual([]);
  });
});

describe('BrowserRecentWorkspaces.save', () => {
  it('sets in-memory handle', async () => {
    const handle = makeHandle('saved');
    mockSaveHandleToIDB.mockResolvedValue(undefined);
    mockLoadHandlesFromIDB.mockResolvedValue([
      { path: '/saved', name: 'saved', handle, lastOpened: 999 },
    ]);
    await BrowserRecentWorkspaces.save('saved', '/saved', handle);
    expect((BrowserRecentWorkspaces as any).handles.get('/saved')).toBe(handle);
  });

  it('calls saveHandleToIDB with correct arguments', async () => {
    const handle = makeHandle('args');
    mockSaveHandleToIDB.mockResolvedValue(undefined);
    mockLoadHandlesFromIDB.mockResolvedValue([]);
    await BrowserRecentWorkspaces.save('args', '/args', handle);
    expect(mockSaveHandleToIDB).toHaveBeenCalledWith('/args', handle, 'args');
  });

  it('calls load after save and returns result', async () => {
    const handle = makeHandle('round');
    mockSaveHandleToIDB.mockResolvedValue(undefined);
    mockLoadHandlesFromIDB.mockResolvedValue([
      { path: '/round', name: 'round', handle, lastOpened: 777 },
    ]);
    const result = await BrowserRecentWorkspaces.save('round', '/round', handle);
    expect(mockLoadHandlesFromIDB).toHaveBeenCalled();
    expect(result).toEqual([{ name: 'round', path: '/round', lastOpened: 777 }]);
  });

  it('continues when saveHandleToIDB throws', async () => {
    const handle = makeHandle('err-save');
    mockSaveHandleToIDB.mockRejectedValue(new Error('IDB write failed'));
    mockLoadHandlesFromIDB.mockResolvedValue([]);
    const result = await BrowserRecentWorkspaces.save('err-save', '/err-save', handle);
    expect((BrowserRecentWorkspaces as any).handles.get('/err-save')).toBe(handle);
    expect(result).toEqual([]);
  });
});

describe('BrowserRecentWorkspaces.remove', () => {
  it('deletes from in-memory Map', async () => {
    const handle = makeHandle('gone');
    (BrowserRecentWorkspaces as any).handles.set('/gone', handle);
    mockDeleteHandleFromIDB.mockResolvedValue(undefined);
    mockLoadHandlesFromIDB.mockResolvedValue([]);
    await BrowserRecentWorkspaces.remove('/gone');
    expect((BrowserRecentWorkspaces as any).handles.has('/gone')).toBe(false);
  });

  it('calls deleteHandleFromIDB with correct path', async () => {
    mockDeleteHandleFromIDB.mockResolvedValue(undefined);
    mockLoadHandlesFromIDB.mockResolvedValue([]);
    await BrowserRecentWorkspaces.remove('/del-path');
    expect(mockDeleteHandleFromIDB).toHaveBeenCalledWith('/del-path');
  });

  it('calls load after remove and returns result', async () => {
    const other = makeHandle('rem-remaining');
    mockDeleteHandleFromIDB.mockResolvedValue(undefined);
    mockLoadHandlesFromIDB.mockResolvedValue([
      { path: '/rem-remaining', name: 'rem-remaining', handle: other, lastOpened: 555 },
    ]);
    const result = await BrowserRecentWorkspaces.remove('/removed');
    expect(mockLoadHandlesFromIDB).toHaveBeenCalled();
    expect(result).toEqual([{ name: 'rem-remaining', path: '/rem-remaining', lastOpened: 555 }]);
  });

  it('continues when deleteHandleFromIDB throws', async () => {
    const handle = makeHandle('del-err');
    (BrowserRecentWorkspaces as any).handles.set('/del-err', handle);
    mockDeleteHandleFromIDB.mockRejectedValue(new Error('IDB delete failed'));
    mockLoadHandlesFromIDB.mockResolvedValue([]);
    const result = await BrowserRecentWorkspaces.remove('/del-err');
    expect((BrowserRecentWorkspaces as any).handles.has('/del-err')).toBe(false);
    expect(result).toEqual([]);
  });
});
