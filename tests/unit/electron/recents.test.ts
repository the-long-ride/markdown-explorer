import { describe, expect, test, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createRecentWorkspacesStore } from '../../../electron/workspace/recents.js';

function makeTempDir(prefix: string) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function createAppStub(userDataPath: string) {
  return {
    getPath(name: string) {
      expect(name).toEqual('userData');
      return userDataPath;
    },
  };
}

describe('createRecentWorkspacesStore', () => {
  test('save keeps newest workspace first and deduplicates by normalized path', () => {
    const userDataDir = makeTempDir('recents-store-');
    const store = createRecentWorkspacesStore(createAppStub(userDataDir));

    store.save(path.join(userDataDir, 'Docs'));
    store.save(path.join(userDataDir, '.', 'Docs'));

    const list = store.load();
    expect(list.length).toBe(1);
    expect(path.normalize(list[0].path)).toEqual(path.join(userDataDir, 'Docs'));
  });

  test('replace sanitizes entries and removes duplicates', () => {
    const userDataDir = makeTempDir('recents-replace-');
    const store = createRecentWorkspacesStore(createAppStub(userDataDir));

    store.replace([
      { path: ' ', name: 'ignored' },
      { path: path.join(userDataDir, 'one'), name: ' One ' },
      { path: path.join(userDataDir, 'one'), name: 'Duplicate' },
      { path: path.join(userDataDir, 'two'), lastOpened: '123' },
    ]);

    const list = store.load();
    expect(list.length).toBe(2);
    expect(list[0].name).toBe('One');
    expect(list[1].lastOpened).toBe(123);
  });

  test('load returns [] when file contains invalid JSON', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const userDataDir = makeTempDir('recents-load-');
    const recentsFile = path.join(userDataDir, 'recent-workspaces.json');
    fs.writeFileSync(recentsFile, 'not json at all', 'utf8');
    const store = createRecentWorkspacesStore(createAppStub(userDataDir));

    const list = store.load();
    expect(list).toEqual([]);
  });

  test('load returns [] when JSON.parse yields null', () => {
    const userDataDir = makeTempDir('recents-load-null-');
    const recentsFile = path.join(userDataDir, 'recent-workspaces.json');
    fs.writeFileSync(recentsFile, 'null', 'utf8');
    const store = createRecentWorkspacesStore(createAppStub(userDataDir));

    const list = store.load();
    expect(list).toEqual([]);
  });

  test('save catches writeFileSync failure', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const userDataDir = makeTempDir('recents-save-fail-');
    const recentsFile = path.join(userDataDir, 'recent-workspaces.json');
    fs.writeFileSync(recentsFile, '[]', 'utf8');
    fs.chmodSync(recentsFile, 0o444);
    const store = createRecentWorkspacesStore(createAppStub(userDataDir));

    expect(() => store.save(path.join(userDataDir, 'Notes'))).not.toThrow();

    fs.chmodSync(recentsFile, 0o644);
  });

  test('remove removes a workspace by normalized path', () => {
    const userDataDir = makeTempDir('recents-remove-');
    const store = createRecentWorkspacesStore(createAppStub(userDataDir));

    store.save(path.join(userDataDir, 'alpha'));
    store.save(path.join(userDataDir, 'beta'));
    store.remove(path.join(userDataDir, 'alpha'));

    const list = store.load();
    expect(list.length).toBe(1);
    expect(path.normalize(list[0].path)).toEqual(path.join(userDataDir, 'beta'));
  });

  test('replace with empty string path returns []', () => {
    const userDataDir = makeTempDir('recents-replace-empty-');
    const store = createRecentWorkspacesStore(createAppStub(userDataDir));

    store.replace([{ path: '', name: 'empty' }]);
    expect(store.load()).toEqual([]);
  });

  test('replace with whitespace-only path returns []', () => {
    const userDataDir = makeTempDir('recents-replace-ws-');
    const store = createRecentWorkspacesStore(createAppStub(userDataDir));

    store.replace([{ path: '   ', name: 'ws' }]);
    expect(store.load()).toEqual([]);
  });

  test('replace falls back to basename when name is empty string', () => {
    const userDataDir = makeTempDir('recents-replace-namews-');
    const store = createRecentWorkspacesStore(createAppStub(userDataDir));
    const wsPath = path.join(userDataDir, 'MyProject');

    store.replace([{ path: wsPath, name: '' }]);
    const list = store.load();
    expect(list[0].name).toBe('MyProject');
  });

  test('replace falls back to basename when name is whitespace-only', () => {
    const userDataDir = makeTempDir('recents-replace-namews2-');
    const store = createRecentWorkspacesStore(createAppStub(userDataDir));
    const wsPath = path.join(userDataDir, 'ProjX');

    store.replace([{ path: wsPath, name: '   ' }]);
    const list = store.load();
    expect(list[0].name).toBe('ProjX');
  });

  test('replace uses Date.now() when lastOpened is non-finite', () => {
    const userDataDir = makeTempDir('recents-replace-nonfin-');
    const store = createRecentWorkspacesStore(createAppStub(userDataDir));
    const wsPath = path.join(userDataDir, 'project');
    const before = Date.now();

    store.replace([{ path: wsPath, name: 'p', lastOpened: Infinity }]);
    const after = Date.now();
    const list = store.load();
    expect(list[0].lastOpened).toBeGreaterThanOrEqual(before);
    expect(list[0].lastOpened).toBeLessThanOrEqual(after);
  });

  test('replace uses Date.now() when lastOpened is NaN', () => {
    const userDataDir = makeTempDir('recents-replace-nan-');
    const store = createRecentWorkspacesStore(createAppStub(userDataDir));
    const wsPath = path.join(userDataDir, 'project');
    const before = Date.now();

    store.replace([{ path: wsPath, name: 'p', lastOpened: NaN }]);
    const after = Date.now();
    const list = store.load();
    expect(list[0].lastOpened).toBeGreaterThanOrEqual(before);
    expect(list[0].lastOpened).toBeLessThanOrEqual(after);
  });

  test('replace uses finite lastOpened as number', () => {
    const userDataDir = makeTempDir('recents-replace-fin-');
    const store = createRecentWorkspacesStore(createAppStub(userDataDir));
    const wsPath = path.join(userDataDir, 'project');

    store.replace([{ path: wsPath, name: 'p', lastOpened: 1700000000000 }]);
    const list = store.load();
    expect(list[0].lastOpened).toBe(1700000000000);
  });

  test('replace with non-string path returns []', () => {
    const userDataDir = makeTempDir('recents-replace-nspath-');
    const store = createRecentWorkspacesStore(createAppStub(userDataDir));

    store.replace([{ path: 42, name: 'num' } as any]);
    expect(store.load()).toEqual([]);
  });

  test('replace with path that is only whitespace returns []', () => {
    const userDataDir = makeTempDir('recents-replace-wspath-');
    const store = createRecentWorkspacesStore(createAppStub(userDataDir));

    store.replace([{ path: '   ', name: 'ws' }]);
    expect(store.load()).toEqual([]);
  });

  test('replace uses Date.now() when lastOpened is undefined', () => {
    const userDataDir = makeTempDir('recents-replace-undef-');
    const store = createRecentWorkspacesStore(createAppStub(userDataDir));
    const wsPath = path.join(userDataDir, 'project');
    const before = Date.now();

    store.replace([{ path: wsPath, name: 'p', lastOpened: undefined as any }]);
    const after = Date.now();
    const list = store.load();
    expect(list[0].lastOpened).toBeGreaterThanOrEqual(before);
    expect(list[0].lastOpened).toBeLessThanOrEqual(after);
  });

  test('replace falls back to path as name when basename returns empty', () => {
    const userDataDir = makeTempDir('recents-replace-basenull-');
    const store = createRecentWorkspacesStore(createAppStub(userDataDir));

    store.replace([{ path: '/', name: '' }]);
    const list = store.load();
    expect(list[0].name).toBe('/');
  });

  test('replace uses Date.now() when lastOpened is a non-numeric string', () => {
    const userDataDir = makeTempDir('recents-replace-nonnum-');
    const store = createRecentWorkspacesStore(createAppStub(userDataDir));
    const wsPath = path.join(userDataDir, 'project');
    const before = Date.now();

    store.replace([{ path: wsPath, name: 'p', lastOpened: 'not-a-number' as any }]);
    const after = Date.now();
    const list = store.load();
    expect(list[0].lastOpened).toBeGreaterThanOrEqual(before);
    expect(list[0].lastOpened).toBeLessThanOrEqual(after);
  });

  test('replace with null workspace entry returns []', () => {
    const userDataDir = makeTempDir('recents-replace-nullws-');
    const store = createRecentWorkspacesStore(createAppStub(userDataDir));

    store.replace([null as any]);
    expect(store.load()).toEqual([]);
  });

  test('replace with undefined lastOpened uses Date.now()', () => {
    const userDataDir = makeTempDir('recents-replace-undeflo-');
    const store = createRecentWorkspacesStore(createAppStub(userDataDir));
    const wsPath = path.join(userDataDir, 'project');
    const before = Date.now();

    store.replace([{ path: wsPath, name: 'p' }]);
    const after = Date.now();
    const list = store.load();
    expect(list[0].lastOpened).toBeGreaterThanOrEqual(before);
    expect(list[0].lastOpened).toBeLessThanOrEqual(after);
  });

  test('replace with array returns []', () => {
    const userDataDir = makeTempDir('recents-replace-noarr2-');
    const store = createRecentWorkspacesStore(createAppStub(userDataDir));

    store.replace([] as any);
    expect(store.load()).toEqual([]);
  });

  test('save uses folderPath as name when basename returns empty', () => {
    const userDataDir = makeTempDir('recents-save-basename-');
    const store = createRecentWorkspacesStore(createAppStub(userDataDir));

    store.save('/');
    const list = store.load();
    expect(list.length).toBe(1);
    expect(list[0].name).toBe('/');
  });

  test('replace with non-array workspaces returns []', () => {
    const userDataDir = makeTempDir('recents-replace-noarr-');
    const store = createRecentWorkspacesStore(createAppStub(userDataDir));

    store.replace({} as any);
    expect(store.load()).toEqual([]);
  });

  test('replace deduplicates by normalized path', () => {
    const userDataDir = makeTempDir('recents-replace-dedup-');
    const store = createRecentWorkspacesStore(createAppStub(userDataDir));
    const wsPath = path.join(userDataDir, 'Docs');

    store.replace([
      { path: wsPath, name: 'First' },
      { path: path.join(userDataDir, '.', 'Docs'), name: 'Second' },
    ]);
    const list = store.load();
    expect(list.length).toBe(1);
    expect(list[0].name).toBe('First');
  });

  test('replace limits to 100 entries', () => {
    const userDataDir = makeTempDir('recents-replace-limit-');
    const store = createRecentWorkspacesStore(createAppStub(userDataDir));

    const workspaces = Array.from({ length: 120 }, (_, i) => ({
      path: path.join(userDataDir, `ws-${i}`),
      name: `ws-${i}`,
    }));
    store.replace(workspaces);
    const list = store.load();
    expect(list.length).toBe(100);
  });

  test('replace falls back to basename when name is non-string', () => {
    const userDataDir = makeTempDir('recents-replace-namens-');
    const store = createRecentWorkspacesStore(createAppStub(userDataDir));
    const wsPath = path.join(userDataDir, 'NamedFolder');

    store.replace([{ path: wsPath, name: 42 } as any]);
    const list = store.load();
    expect(list[0].name).toBe('NamedFolder');
  });
});
