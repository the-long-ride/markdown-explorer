import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { searchMarkdownItems } from '../../../vscode/src/core/panelSearch';

const tempDirs: string[] = [];

afterEach(() => {
  for (const directory of tempDirs.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

function makeItem(content: string, fileName = 'ReleaseNotes.md') {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'markdown-explorer-vscode-case-'));
  tempDirs.push(directory);
  const fsPath = path.join(directory, fileName);
  fs.writeFileSync(fsPath, content, 'utf8');
  return {
    fsPath,
    fileName,
    relativePath: fileName,
    title: fileName.replace(/\.md$/i, ''),
  } as any;
}

describe('searchMarkdownItems matchCase', () => {
  it('keeps case-insensitive matching as the default', () => {
    const item = makeItem('Alpha alpha ALPHA');
    expect(searchMarkdownItems('alpha', [item], [item])).toHaveLength(3);
  });

  it('matches exact content and metadata casing when enabled', () => {
    const item = makeItem('Alpha alpha ALPHA');
    const exact = searchMarkdownItems('Alpha', [item], [item], 80, { matchCase: true });
    expect(exact).toHaveLength(1);
    expect(exact[0].matchIndex).toBe(0);

    expect(searchMarkdownItems('Release', [item], [item], 80, { matchCase: true }).length).toBeGreaterThan(0);
    expect(searchMarkdownItems('release', [item], [item], 80, { matchCase: true })).toHaveLength(0);
  });
});
