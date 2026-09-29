import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { searchMarkdownItems, searchMarkdownItemsIncremental } from '../../../vscode/src/core/panelSearch';

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

describe('searchMarkdownItemsIncremental', () => {
  it('streams bounded batches up to the 10000-result ceiling', async () => {
    const item = makeItem('', 'Result.md');
    const batches: Array<readonly any[]> = [];
    const result = await searchMarkdownItemsIncremental(
      'result',
      Array.from({ length: 10_001 }, () => item),
      [item],
      {
        batchSize: 100,
        yieldEvery: 50,
        onBatch: (batch) => batches.push(batch),
      },
    );

    expect(result).toMatchObject({ total: 10_000, truncated: true, cancelled: false });
    expect(batches.length).toBe(100);
    expect(Math.max(...batches.map((batch) => batch.length))).toBeLessThanOrEqual(100);
    expect(batches.flat()).toHaveLength(10_000);
  });

  it('cancels between yielded item batches', async () => {
    const item = makeItem('', 'Cancel.md');
    let checks = 0;
    const result = await searchMarkdownItemsIncremental(
      'cancel',
      Array.from({ length: 20 }, () => item),
      [item],
      {
        batchSize: 2,
        yieldEvery: 1,
        shouldCancel: () => checks++ > 2,
      },
    );

    expect(result.cancelled).toBe(true);
    expect(result.total).toBeLessThan(20);
  });
});
