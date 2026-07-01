import { describe, expect, test } from 'vitest';

import {
  collectSelectedFolderPaths,
  reconcileScopeFocusPaths,
} from '../../../../ui/src/contexts/scope-focus-reconcile.js';

describe('scope-focus-reconcile', () => {
  test('reconcileScopeFocusPaths removes stale paths and adds new files outside scoped parents', () => {
    const previousFilePaths = [
      'C:/docs/a.md',
      'C:/docs/folder/old.md',
    ];
    const nextFilePaths = [
      'C:/docs/a.md',
      'C:/docs/folder/new.md',
      'C:/docs/brand-new.md',
    ];

    const nextScopePaths = reconcileScopeFocusPaths({
      savedScopePaths: ['C:/docs/a.md', 'C:/docs/folder/old.md'],
      previousFilePaths,
      nextFilePaths,
      selectedFolderPaths: [],
    });

    expect(
      nextScopePaths.sort(),
    ).toEqual(
      [
        'C:/docs/a.md',
        'C:/docs/folder/new.md',
        'C:/docs/brand-new.md',
      ].sort(),
    );
  });

  test('reconcileScopeFocusPaths auto-includes new files under scoped folders', () => {
    const nextScopePaths = reconcileScopeFocusPaths({
      savedScopePaths: ['C:/docs/notes'],
      previousFilePaths: ['C:/docs/notes/one.md'],
      nextFilePaths: ['C:/docs/notes/one.md', 'C:/docs/notes/two.md'],
      selectedFolderPaths: ['C:/docs/notes'],
    });

    expect(
      nextScopePaths.sort(),
    ).toEqual(['C:/docs/notes', 'C:/docs/notes/two.md'].sort());
  });

  test('reconcileScopeFocusPaths returns null when savedScopePaths is null', () => {
    const nextScopePaths = reconcileScopeFocusPaths({
      savedScopePaths: null,
      previousFilePaths: ['C:/docs/a.md'],
      nextFilePaths: ['C:/docs/a.md', 'C:/docs/b.md'],
      selectedFolderPaths: [],
    });

    expect(nextScopePaths).toBeNull();
  });

  test('collectSelectedFolderPaths detects folders whose descendants are fully selected', () => {
    const tree = {
      name: 'root',
      path: 'C:/docs',
      files: [{ fsPath: 'C:/docs/root.md' }],
      children: [
        {
          name: 'notes',
          path: 'C:/docs/notes',
          files: [
            { fsPath: 'C:/docs/notes/one.md' },
            { fsPath: 'C:/docs/notes/two.md' },
          ],
          children: [],
        },
      ],
    };

    const selectedFolderPaths = collectSelectedFolderPaths(
      tree,
      new Set(['C:/docs/notes/one.md', 'C:/docs/notes/two.md']),
    );

    expect(selectedFolderPaths).toEqual(['C:/docs/notes']);
  });

  test('collectSelectedFolderPaths returns empty array when tree is null', () => {
    expect(collectSelectedFolderPaths(null, new Set(['a.md']))).toEqual([]);
  });

  test('collectSelectedFolderPaths returns empty array when selectedFilePaths is null', () => {
    expect(collectSelectedFolderPaths({ name: 'root', path: 'C:/', files: [], children: [] }, null)).toEqual([]);
  });

  test('collectSelectedFolderPaths does not include folder when only some children selected', () => {
    const tree = {
      name: 'root',
      path: 'C:/docs',
      files: [],
      children: [
        {
          name: 'sub',
          path: 'C:/docs/sub',
          files: [
            { fsPath: 'C:/docs/sub/a.md' },
            { fsPath: 'C:/docs/sub/b.md' },
          ],
          children: [],
        },
      ],
    };

    const result = collectSelectedFolderPaths(tree, new Set(['C:/docs/sub/a.md']));
    expect(result).toEqual([]);
  });

  test('collectSelectedFolderPaths handles folder with empty children and files', () => {
    const tree = {
      name: 'root',
      path: 'C:/docs',
      files: [],
      children: [
        {
          name: 'empty',
          path: 'C:/docs/empty',
          files: [],
          children: [],
        },
      ],
    };

    expect(collectSelectedFolderPaths(tree, new Set())).toEqual([]);
  });

  test('collectSelectedFolderPaths detects deeply nested full selection', () => {
    const tree = {
      name: 'root',
      path: 'C:/docs',
      files: [],
      children: [
        {
          name: 'level1',
          path: 'C:/docs/level1',
          files: [],
          children: [
            {
              name: 'level2',
              path: 'C:/docs/level1/level2',
              files: [
                { fsPath: 'C:/docs/level1/level2/x.md' },
              ],
              children: [],
            },
          ],
        },
      ],
    };

    const result = collectSelectedFolderPaths(tree, new Set(['C:/docs/level1/level2/x.md']));
    expect(result.sort()).toEqual(['C:/docs/level1', 'C:/docs/level1/level2']);
  });

  test('reconcileScopeFocusPaths with empty arrays returns empty array', () => {
    const result = reconcileScopeFocusPaths({
      savedScopePaths: [],
      previousFilePaths: [],
      nextFilePaths: [],
      selectedFolderPaths: [],
    });
    expect(result).toEqual([]);
  });

  test('reconcileScopeFocusPaths normalizes Windows backslash paths for folder match', () => {
    const backslashFile = 'C:\\docs\\notes\\sub\\new.md';
    const result = reconcileScopeFocusPaths({
      savedScopePaths: ['C:/docs/notes'],
      previousFilePaths: ['C:/docs/notes/one.md'],
      nextFilePaths: ['C:/docs/notes/one.md', backslashFile],
      selectedFolderPaths: ['C:/docs/notes'],
    });

    expect(result).toContain('C:/docs/notes');
    expect(result).toContain(backslashFile);
  });

  test('reconcileScopeFocusPaths does not auto-include new files not under any scoped folder', () => {
    const result = reconcileScopeFocusPaths({
      savedScopePaths: ['C:/docs/notes/one.md'],
      previousFilePaths: ['C:/docs/notes/one.md'],
      nextFilePaths: ['C:/docs/notes/one.md', 'C:/docs/other/orphan.md'],
      selectedFolderPaths: [],
    });

    expect(result).toEqual(['C:/docs/notes/one.md', 'C:/docs/other/orphan.md']);
  });
});
