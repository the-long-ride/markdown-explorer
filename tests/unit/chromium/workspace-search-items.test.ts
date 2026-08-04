import { describe, expect, it } from 'vitest';
import type { MdFile } from '../../../ui/src/types';
import { resolveWorkspaceSearchItems } from '../../../chromium-xtension/src/workspace-search-items';

function makeFile(fsPath: string): MdFile {
  const fileName = fsPath.split('/').at(-1) ?? fsPath;
  return {
    fsPath,
    relativePath: fileName,
    parts: [fileName],
    fileName,
    title: fileName.replace(/\.md$/i, ''),
  };
}

describe('resolveWorkspaceSearchItems', () => {
  const first = makeFile('/workspace/first.md');
  const second = makeFile('/workspace/second.md');
  const flatList = [first, second];

  it('uses the resident flat list when the payload is omitted', () => {
    expect(resolveWorkspaceSearchItems(undefined, flatList)).toBe(flatList);
  });

  it('keeps an explicit empty scope empty', () => {
    expect(resolveWorkspaceSearchItems([], flatList)).toEqual([]);
  });

  it('resolves a custom scope to resident file objects', () => {
    expect(resolveWorkspaceSearchItems([{ fsPath: second.fsPath }], flatList)).toEqual([second]);
  });
});
