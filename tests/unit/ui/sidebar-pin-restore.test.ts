import { describe, expect, test } from 'vitest';
import {
  collectSidebarItemKeys,
  resolveSidebarPins,
} from '../../../ui/src/components/Sidebar/sidebarWorkspacePreferences';
import type { FolderNode, MdFile, SidebarPinnedItem } from '../../../ui/src/types';

const file = (fsPath: string): MdFile => ({
  fsPath,
  fileName: fsPath.split('/').pop()!,
  title: fsPath.split('/').pop()!,
  relativePath: fsPath,
}) as unknown as MdFile;

const tree: FolderNode = {
  name: 'w',
  path: 'w',
  files: [file('w/a.md'), file('w/b.md')],
  children: [],
} as unknown as FolderNode;

const pins: SidebarPinnedItem[] = [
  { kind: 'file', path: 'w/a.md' },
  { kind: 'file', path: 'w/gone.md' },
];

describe('resolveSidebarPins', () => {
  test('keeps pins untouched while the workspace tree is not loaded', () => {
    expect(resolveSidebarPins(pins, null, 10)).toEqual(pins);
  });

  test('prunes deleted files once the tree is loaded', () => {
    const validKeys = collectSidebarItemKeys(tree.files, tree.children);
    const resolved = resolveSidebarPins(pins, tree, 10);
    expect(resolved.map((p) => p.path)).toEqual(['w/a.md']);
    expect(validKeys.size).toBeGreaterThan(0);
  });
});
