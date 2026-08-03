import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadPanelSearchPreview } from '../../../vscode/src/core/panelSearchPreview';

const tempDirs: string[] = [];

afterEach(() => {
  for (const directory of tempDirs.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

function makeItem(fileName = 'Guide.md', source = '# Guide\n\nTarget result') {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'markdown-explorer-vscode-preview-'));
  tempDirs.push(directory);
  const fsPath = path.join(directory, fileName);
  fs.writeFileSync(fsPath, source, 'utf8');
  return {
    fsPath,
    relativePath: fileName,
    parts: [],
    fileName,
    title: 'Guide',
    extension: path.extname(fileName).slice(1),
    documentKind: 'markdown' as const,
  };
}

describe('loadPanelSearchPreview', () => {
  it('returns the complete source for an indexed Markdown file', async () => {
    const item = makeItem();

    await expect(loadPanelSearchPreview(
      { requestId: 'preview-1', filePath: item.fsPath },
      [item],
    )).resolves.toEqual({
      command: 'searchPreviewResult',
      requestId: 'preview-1',
      ok: true,
      filePath: item.fsPath,
      markdownSource: '# Guide\n\nTarget result',
    });
  });

  it('rejects a file that is not in the indexed workspace', async () => {
    const item = makeItem();
    const outside = path.join(path.dirname(item.fsPath), 'Outside.md');
    fs.writeFileSync(outside, '# Outside', 'utf8');

    await expect(loadPanelSearchPreview(
      { requestId: 'preview-2', filePath: outside },
      [item],
    )).resolves.toEqual({
      command: 'searchPreviewResult',
      requestId: 'preview-2',
      ok: false,
      filePath: outside,
      reason: 'outside-workspace',
    });
  });
});
