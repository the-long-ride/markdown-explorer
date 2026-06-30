import { describe, expect, test } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createRecentWorkspacesStore } from '../../../desktop/recents.js';

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
});
