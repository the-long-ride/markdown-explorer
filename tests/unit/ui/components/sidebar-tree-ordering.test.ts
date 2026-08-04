import { describe, expect, test } from 'vitest';
import type { FolderNode, MdFile, SidebarSortMode } from '../../../../ui/src/types';
import { orderSidebarLevel } from '../../../../ui/src/components/Sidebar/sidebarTreeOrdering';
import {
  clearWorkspacePins,
  reconcileWorkspacePins,
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
});

describe('workspace pin helpers', () => {
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
