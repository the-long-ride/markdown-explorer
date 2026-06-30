import { describe, expect, test } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createSearchIndex } from '../../../desktop/search-index.js';

function makeTempDir(prefix: string) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function writeFile(filePath: string, content: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

describe('createSearchIndex', () => {
  test('search returns empty results for short queries', () => {
    const index = createSearchIndex();
    const results = index.search('a', [{ fsPath: 'missing.md' }]);
    expect(results).toEqual([]);
  });

  test('search ranks title matches and includes content excerpts', () => {
    const rootDir = makeTempDir('search-index-');
    const guidePath = path.join(rootDir, 'guide.md');
    const notesPath = path.join(rootDir, 'notes.md');

    writeFile(guidePath, ['# Performance Guide', '', 'Startup performance matters here.'].join('\n'));
    writeFile(notesPath, ['# Notes', '', 'This file also mentions performance tuning.'].join('\n'));

    const items = [
      { fsPath: notesPath, fileName: 'notes.md', relativePath: 'notes.md', title: 'Notes' },
      { fsPath: guidePath, fileName: 'guide.md', relativePath: 'guide.md', title: 'Performance Guide' },
    ];

    const results = createSearchIndex().search('performance', items);

    expect(results.length).toBe(3);
    expect(results[0].fsPath).toBe(guidePath);
    expect(results[1].fsPath).toBe(guidePath);
    expect(results[2].fsPath).toBe(notesPath);
    expect(results[0].excerpt).toMatch(/performance/i);
  });

  test('search skips oversized files when no path or title match exists', () => {
    const rootDir = makeTempDir('search-large-');
    const filePath = path.join(rootDir, 'large.md');
    writeFile(filePath, `# Big File\n\n${'lorem ipsum '.repeat(300000)}`);

    const results = createSearchIndex().search('needle', [
      { fsPath: filePath, fileName: 'large.md', relativePath: 'large.md', title: 'Big File' },
    ]);

    expect(results).toEqual([]);
  });

  test('search handles multilingual locale-specific case folding correctly', () => {
    const rootDir = makeTempDir('search-multi-');
    const turkishPath = path.join(rootDir, 'turkish.md');
    const germanPath = path.join(rootDir, 'german.md');

    writeFile(turkishPath, 'Welcome to \u0130stanbul.');
    writeFile(germanPath, 'Die Hauptstra\u00DFe ist lang.');

    const items = [
      { fsPath: turkishPath, fileName: 'turkish.md', relativePath: 'turkish.md', title: 'Turkish' },
      { fsPath: germanPath, fileName: 'german.md', relativePath: 'german.md', title: 'German' },
    ];

    const index = createSearchIndex();

    const trResults = index.search('istanbul', items);
    expect(trResults.length).toBe(1);
    expect(trResults[0].fsPath).toBe(turkishPath);
    expect(trResults[0].excerpt).toMatch(/\u0130stanbul/);
    expect(trResults[0].matchIndex).toBe(11);
    expect(trResults[0].matchLength).toBe(8);

    const deResults = index.search('strasse', items);
    expect(deResults.length).toBe(1);
    expect(deResults[0].fsPath).toBe(germanPath);
    expect(deResults[0].excerpt).toMatch(/stra\u00DFe/i);
  });

  test('search handles unicode composed/decomposed normalization correctly', () => {
    const rootDir = makeTempDir('search-norm-');
    const nfcPath = path.join(rootDir, 'nfc.md');
    const nfdPath = path.join(rootDir, 'nfd.md');

    writeFile(nfcPath, 'I love caf\u00E9s.');
    writeFile(nfdPath, "Let's go to the cafe\u0301.");

    const items = [
      { fsPath: nfcPath, fileName: 'nfc.md', relativePath: 'nfc.md', title: 'NFC' },
      { fsPath: nfdPath, fileName: 'nfd.md', relativePath: 'nfd.md', title: 'NFD' },
    ];

    const index = createSearchIndex();

    const results = index.search('caf\u00E9', items);
    expect(results.length).toBe(2);

    const nfdMatch = results.find((r: any) => r.fsPath === nfdPath);
    expect(nfdMatch).toBeTruthy();
    expect(nfdMatch!.matchLength).toBe(5);
  });

  test('incremental search emits bounded batches and limits matches per file', async () => {
    const rootDir = makeTempDir('search-incremental-');
    const filePath = path.join(rootDir, 'many.md');
    writeFile(filePath, Array.from({ length: 20 }, (_, index) => `needle ${index}`).join('\n'));

    const batches: any[] = [];
    const result = await createSearchIndex().searchIncremental(
      'needle',
      [{ fsPath: filePath, fileName: 'many.md', relativePath: 'many.md', title: 'Many' }],
      {
        batchSize: 2,
        maxResults: 5,
        maxMatchesPerFile: 5,
        onBatch: (batch: any) => batches.push(batch),
      },
    );

    expect(batches.map((batch: any) => batch.length)).toEqual([2, 2, 1]);
    expect(result.total).toBe(5);
    expect(result.truncated).toBe(true);
    expect(result.cancelled).toBe(false);
  });

  test('incremental search yields so an active request can be cancelled', async () => {
    const rootDir = makeTempDir('search-cancel-');
    const items = Array.from({ length: 40 }, (_, index) => {
      const filePath = path.join(rootDir, `${index}.md`);
      writeFile(filePath, `needle ${index}`);
      return {
        fsPath: filePath,
        fileName: `${index}.md`,
        relativePath: `${index}.md`,
        title: `${index}`,
      };
    });

    let cancelled = false;
    setImmediate(() => { cancelled = true; });
    const result = await createSearchIndex().searchIncremental('needle', items, {
      batchSize: 10,
      yieldEvery: 1,
      shouldCancel: () => cancelled,
    });

    expect(result.cancelled).toBe(true);
    expect(result.total).toBeLessThan(items.length);
  });
});
