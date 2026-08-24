import { expect, it } from 'vitest';
import type { MdFile } from '../../../../ui/src/types/files';
import { buildStandaloneExportHtml } from '../../../../ui/src/export/exportHtml';

function file(relativePath: string): MdFile {
  return {
    fsPath: `/workspace/${relativePath}`,
    relativePath,
    parts: relativePath.split('/'),
    fileName: relativePath.split('/').at(-1) || relativePath,
    title: relativePath,
    extension: '.md',
    documentKind: 'markdown',
  };
}

it('keeps generated merged IDs separate from the plain document-ID namespace', () => {
  const dotted = file('guide/a.b.md');
  const dashed = file('guide/a-b.md');
  // With the legacy allocator, the first collision becomes
  // doc-guide-a-b-md-1-1o2nscm, which is also this file's plain base ID.
  const generatedIdMimic = file('guide/a-b-md-1-1o2nscm');
  const pages = [dotted, dashed, generatedIdMimic].map((entry) => ({
    file: entry,
    html: `<p>${entry.relativePath}</p>`,
  }));

  const html = buildStandaloneExportHtml({
    pages,
    layout: 'explorer',
    title: 'Global merged ID collision',
    themeCss: '',
  });
  const ids = [...html.matchAll(/<section id="([^"]+)"/g)].map((match) => match[1]);

  expect(ids).toHaveLength(3);
  expect(new Set(ids).size).toBe(3);
  ids.forEach((id) => expect(html).toContain(`href="#${id}"`));
});
