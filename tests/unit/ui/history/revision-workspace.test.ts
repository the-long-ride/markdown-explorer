import { describe, expect, it } from 'vitest';
import {
  buildRevisionWorkspaceProjection,
  revisionFilePath,
} from '../../../../ui/src/history/revisionWorkspace';

describe('revision workspace projection', () => {
  it('builds a nested read-only workspace tree with synthetic revision paths', () => {
    const projection = buildRevisionWorkspaceProjection('abc', [
      { path: 'README.md' },
      { path: 'docs/a.md' },
      { path: 'docs/nested/b.txt' },
    ]);

    expect(projection.fileList.map((file) => file.relativePath)).toEqual([
      'README.md',
      'docs/a.md',
      'docs/nested/b.txt',
    ]);
    expect(revisionFilePath('abc', 'docs/a.md')).toBe('revision://abc/docs/a.md');

    const readme = projection.fileList[0];
    expect(readme).toMatchObject({
      fsPath: 'revision://abc/README.md',
      fileName: 'README.md',
      title: 'README',
      extension: '.md',
      documentKind: 'markdown',
    });

    const docs = projection.tree.children.find((folder) => folder.name === 'docs');
    expect(docs?.files.map((file) => file.fileName)).toEqual(['a.md']);
    expect(docs?.children[0]?.name).toBe('nested');
    expect(docs?.children[0]?.files[0]).toMatchObject({
      fileName: 'b.txt',
      documentKind: 'document',
    });
  });
});
