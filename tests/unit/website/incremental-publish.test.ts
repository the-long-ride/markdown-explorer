import { expect, it } from 'vitest';
import { nextIncrementalPublishCount, treeHasEmptyFolder } from '../../../website-app/src/incremental-publish';
import type { FolderNode } from '../../../ui/src/types';
import { buildVirtualMdFile } from '../../../website-app/src/user-virtual-workspaces';

it('grows scan batches exponentially up to the configured maximum', () => {
  expect(nextIncrementalPublishCount(0)).toBe(32);
  expect(nextIncrementalPublishCount(32)).toBe(64);
  expect(nextIncrementalPublishCount(64)).toBe(128);
  expect(nextIncrementalPublishCount(2048)).toBe(3072);
  expect(nextIncrementalPublishCount(10, 5, 6)).toBe(16);
  expect(nextIncrementalPublishCount(Number.NaN, 0, 0)).toBe(1);
});

it('publishes a final folder tree when an empty descendant would not increase the file count', () => {
  const empty: FolderNode = { name: 'empty', path: 'group/empty', files: [], children: [] };
  const group: FolderNode = { name: 'group', path: 'group', files: [], children: [empty] };
  const root: FolderNode = { name: 'root', path: '', files: [], children: [group] };
  expect(treeHasEmptyFolder(null)).toBe(false);
  expect(treeHasEmptyFolder(root)).toBe(true);
  empty.files.push(buildVirtualMdFile('group/empty/note.md', '# Notes'));
  expect(treeHasEmptyFolder(root)).toBe(false);
});
