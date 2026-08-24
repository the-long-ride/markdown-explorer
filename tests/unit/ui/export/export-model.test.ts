import { describe, expect, it } from 'vitest';
import type { MdFile } from '../../../../ui/src/types/files';
import {
  buildExportJob,
  fileNameFromPath,
  filesInFolder,
  folderOptions,
  pdfOutputName,
  safeBaseName,
  type ExportSourceMode,
} from '../../../../ui/src/export/exportModel';

function file(relativePath: string): MdFile {
  const parts = relativePath.split('/');
  return {
    fsPath: `/workspace/${relativePath}`,
    relativePath,
    parts,
    fileName: parts[parts.length - 1] || relativePath,
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
  it('recursively selects a folder while preserving workspace/source order', () => {
    expect(filesInFolder(files, 'guide').map((item) => item.relativePath)).toEqual([
      'guide/intro.md',
      'guide/deep/setup.md',
      'guide/deep/api.mdx',
    ]);
  });

  it('does not match a similarly-prefixed sibling folder', () => {
    const result = filesInFolder([...files, file('guidebook/readme.md')], 'guide');
    expect(result.some((item) => item.relativePath.startsWith('guidebook/'))).toBe(false);
  });

  it('builds sorted recursive folder choices from document paths', () => {
    expect(folderOptions(files)).toEqual(['guide', 'guide/deep']);
  });
});

describe('export output names', () => {
  it('sanitizes standalone base names and preserves a safe fallback', () => {
    expect(safeBaseName(' Docs / API ')).toBe('Docs-API');
    expect(safeBaseName('***')).toBe('markdown-explorer');
  });

  it('uses relative paths for batch PDF names and extracts host result leaf names', () => {
    expect(pdfOutputName(file('guide/intro.md'), true)).toBe('guide-intro.md.pdf');
    expect(fileNameFromPath('C:\\Exports\\guide-intro.md.pdf')).toBe('guide-intro.md.pdf');
    expect(fileNameFromPath('/tmp/site.zip')).toBe('site.zip');
  });
});

describe('buildExportJob', () => {
  it('accepts whole workspace as a first-class source mode', () => {
    const sourceMode: ExportSourceMode = 'workspace';
    expect(sourceMode).toBe('workspace');
  });

  it('deduplicates selected files while preserving the source order used by exported navigation', () => {
    const job = buildExportJob({
      format: 'html', layout: 'document', batchMode: 'separate',
      files: [files[0], files[1], files[0]],
    });
    expect(job.files.map((item) => item.relativePath)).toEqual(['z.md', 'guide/intro.md']);
  });

  it('rejects Full Markdown Explorer layout for PDF', () => {
    expect(() => buildExportJob({
      format: 'pdf', layout: 'explorer', batchMode: 'separate', files: [files[1]],
    })).toThrow('PDF export supports Document only layout');
  });

  it('rejects an empty export selection', () => {
    expect(() => buildExportJob({ format: 'pdf', layout: 'explorer', batchMode: 'merged', files: [] }))
      .toThrow('Select at least one document');
  });
});
