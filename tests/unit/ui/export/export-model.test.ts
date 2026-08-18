import { describe, expect, it } from 'vitest';
import type { MdFile } from '../../../../ui/src/types/files';
import { buildExportJob, filesInFolder } from '../../../../ui/src/export/exportModel';

function file(relativePath: string): MdFile {
  return {
    fsPath: `/workspace/${relativePath}`,
    relativePath,
    parts: relativePath.split('/'),
    fileName: relativePath.split('/').at(-1) || relativePath,
    title: relativePath.replace(/\.mdx?$/, ''),
    extension: relativePath.endsWith('.mdx') ? '.mdx' : '.md',
    documentKind: 'markdown',
  };
}

const files = [
  file('z.md'),
  file('guide/intro.md'),
  file('guide/deep/setup.md'),
  file('guide/deep/api.mdx'),
  file('other.md'),
];

describe('filesInFolder', () => {
  it('recursively selects a folder and sorts by relative path', () => {
    expect(filesInFolder(files, 'guide').map((item) => item.relativePath)).toEqual([
      'guide/deep/api.mdx',
      'guide/deep/setup.md',
      'guide/intro.md',
    ]);
  });

  it('does not match a similarly-prefixed sibling folder', () => {
    const result = filesInFolder([...files, file('guidebook/readme.md')], 'guide');
    expect(result.some((item) => item.relativePath.startsWith('guidebook/'))).toBe(false);
  });
});

describe('buildExportJob', () => {
  it('deduplicates and sorts selected files', () => {
    const job = buildExportJob({
      format: 'html', layout: 'document', batchMode: 'separate',
      files: [files[0], files[1], files[0]],
    });
    expect(job.files.map((item) => item.relativePath)).toEqual(['guide/intro.md', 'z.md']);
  });

  it('rejects an empty export selection', () => {
    expect(() => buildExportJob({ format: 'pdf', layout: 'explorer', batchMode: 'merged', files: [] }))
      .toThrow('Select at least one document');
  });
});
