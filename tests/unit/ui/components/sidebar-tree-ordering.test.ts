import { describe, expect, test } from 'vitest';
import type { FolderNode, MdFile, SidebarSortMode } from '../../../../ui/src/types';
import { orderSidebarLevel } from '../../../../ui/src/components/Sidebar/sidebarTreeOrdering';
import {
  clearWorkspacePins,
  getWorkspaceSortMode,
  normalizeMaxPinnedItems,
  reconcileWorkspacePins,
  resolveSidebarPins,
  toggleWorkspacePin,
} from '../../../../ui/src/components/Sidebar/sidebarWorkspacePreferences';

const files: MdFile[] = [
  {
    fsPath: '/z.md', relativePath: 'z.md', parts: ['z.md'], fileName: 'z.md',
    title: 'Zulu', extension: '.md', documentKind: 'markdown', modifiedAt: 10,
  },
  {
    fsPath: '/a.md', relativePath: 'a.md', parts: ['a.md'], fileName: 'a.md',
    title: 'Alpha', extension: '.md', documentKind: 'markdown', modifiedAt: 30,
  },
];
const folders: FolderNode[] = [
  { name: 'Beta', path: 'beta', files: [], children: [], modifiedAt: 20 },
];

function keys(mode: SidebarSortMode, pinnedKeys: ReadonlySet<string> = new Set()) {
  return orderSidebarLevel(files, folders, {
    sortMode: mode,
    pinnedKeys,
    showTitle: true,
  }).map((item) => item.key);
}

describe('orderSidebarLevel', () => {
  test('sorts same-name entries by path after date ties and prioritizes a pinned file over folders', () => {
    const sameTitle = ['b', 'a'].map((dir) => ({ ...files[1], fsPath: `/${dir}/a.md`, modifiedAt: undefined }));
    const sameNameFolders = ['z', 'a', 'dated'].map((path) => ({
      ...folders[0], path, modifiedAt: path === 'dated' ? 21 : undefined,
    }));
    const list = orderSidebarLevel(sameTitle, sameNameFolders, {
      sortMode: 'modified-desc', pinnedKeys: new Set(['file:/b/a.md']), showTitle: false,
    });
    expect(list.map(({ key }) => key)).toEqual([
      'file:/b/a.md', 'folder:dated', 'folder:a', 'folder:z', 'file:/a/a.md',
    ]);
    expect(orderSidebarLevel(sameTitle, [], {
      sortMode: 'modified-asc', pinnedKeys: new Set(), showTitle: true,
    }).map(({ key }) => key)).toEqual(['file:/a/a.md', 'file:/b/a.md']);
  });
  test.each([
    ['name-asc', ['folder:beta', 'file:/a.md', 'file:/z.md']],
    ['name-desc', ['folder:beta', 'file:/z.md', 'file:/a.md']],
    ['modified-desc', ['folder:beta', 'file:/a.md', 'file:/z.md']],
    ['modified-asc', ['folder:beta', 'file:/z.md', 'file:/a.md']],
  ] as const)('%s sorts folders first, files after', (mode, expected) => {
    expect(keys(mode)).toEqual(expected);
  });

  test('pinned siblings stay first while retaining the selected order', () => {
    expect(keys('name-desc', new Set(['folder:beta', 'file:/a.md']))).toEqual([
      'folder:beta', 'file:/a.md', 'file:/z.md',
    ]);
  });

  test('orders by filename instead of title and breaks timestamp ties in ascending name order', () => {
    const reversedTitles = [
      { ...files[0], title: 'Alpha', modifiedAt: undefined },
      { ...files[1], title: 'Zulu', modifiedAt: undefined },
    ];
    expect(orderSidebarLevel(reversedTitles, [], {
      sortMode: 'modified-desc', pinnedKeys: new Set(), showTitle: false,
    }).map((item) => item.key)).toEqual(['file:/a.md', 'file:/z.md']);
    expect(orderSidebarLevel(reversedTitles, [], {
      sortMode: 'modified-desc', pinnedKeys: new Set(), showTitle: true,
    }).map((item) => item.key)).toEqual(['file:/z.md', 'file:/a.md']);
  });
});

describe('collectHoistedPinnedItems', () => {
  test('hoists non-root pinned files and folders to root level', async () => {
    const { collectHoistedPinnedItems } = await import('../../../../ui/src/components/Sidebar/sidebarTreeOrdering');
    const subFile: MdFile = {
      fsPath: '/sub/doc.md', relativePath: 'sub/doc.md', parts: ['sub', 'doc.md'], fileName: 'doc.md',
      title: 'Doc', extension: '.md', documentKind: 'markdown', modifiedAt: 5,
    };
    const subFolder: FolderNode = {
      name: 'nested', path: 'sub/nested', files: [], children: [], modifiedAt: 8,
    };
    const tree: FolderNode = {
      name: 'root',
      path: '',
      files: files,
      children: [
        {
          name: 'sub',
          path: 'sub',
          files: [subFile],
          children: [subFolder],
          modifiedAt: 15,
        },
      ],
    };
    const pinnedKeys = new Set(['file:/sub/doc.md', 'folder:sub/nested']);
    const { hoistedFiles, hoistedFolders } = collectHoistedPinnedItems(tree, pinnedKeys);
    expect(hoistedFiles).toEqual([subFile]);
    expect(hoistedFolders).toEqual([subFolder]);
  });
});

describe('workspace pin helpers', () => {
  test('applies defaults for missing preferences and clamps stored pin limits', () => {
    expect(getWorkspaceSortMode(undefined, 'workspace')).toBe('name-asc');
    expect(getWorkspaceSortMode({ other: 'modified-desc' }, 'workspace')).toBe('name-asc');
    expect(getWorkspaceSortMode({ workspace: 'modified-asc' }, 'workspace')).toBe('modified-asc');
    expect(normalizeMaxPinnedItems(undefined)).toBe(10);
    expect(normalizeMaxPinnedItems(-5)).toBe(1);
    expect(normalizeMaxPinnedItems('12.7')).toBe(13);
    expect(normalizeMaxPinnedItems(20)).toBe(15);
  });

  test('preserves pins until the tree loads, then removes stale pins and applies the cap', () => {
    const raw = [
      { kind: 'file', path: '/stale.md' },
      { kind: 'folder', path: 'beta' },
      { kind: 'file', path: '/a.md' },
    ] as const;
    expect(resolveSidebarPins(raw, null, 1)).toEqual(raw);
    const tree = { name: 'workspace', path: '', files, children: folders };
    expect(resolveSidebarPins(raw, tree, 1)).toEqual([raw[1]]);
    expect(resolveSidebarPins(raw, tree, 3)).toEqual([raw[1], raw[2]]);
    const other = [{ kind: 'file' as const, path: '/other.md' }];
    expect(toggleWorkspacePin({ workspace: [raw[1]], other }, 'workspace', raw[1], 1)).toEqual({ other });
  });

  test('enforces the limit but still permits unpinning', () => {
    let state = {};
    for (let index = 0; index < 10; index += 1) {
      state = toggleWorkspacePin(state, 'ws', { kind: 'file', path: `/${index}.md` }, 10);
    }
    expect(toggleWorkspacePin(state, 'ws', { kind: 'folder', path: 'extra' }, 10).ws).toHaveLength(10);
    expect(toggleWorkspacePin(state, 'ws', { kind: 'file', path: '/0.md' }, 10).ws).toHaveLength(9);
  });

  test('reconciles stale and duplicate pins and clears one workspace', () => {
    const reconciled = reconcileWorkspacePins([
      { kind: 'file', path: '/a.md' },
      { kind: 'file', path: '/missing.md' },
      { kind: 'file', path: '/a.md' },
    ], new Set(['file:/a.md']), 10);
    expect(reconciled).toEqual([{ kind: 'file', path: '/a.md' }]);
    expect(clearWorkspacePins({ ws: reconciled }, 'ws')).toEqual({});
  });
});
