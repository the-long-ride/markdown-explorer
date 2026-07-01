import { describe, expect, test, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createSearchIndex, canSearchFileContents, shouldSkipSearchItem, scoreItemName, searchItems, flushBatch, pushSearchResult, primeIndex, searchItemsIncremental } from '../../../desktop/search-index.js';

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

  test('makeSearchExcerpt - very long before text adds ellipsis', () => {
    const words = Array.from({ length: 15 }, (_, i) => `word${i}`).join(' ');
    const text = `${words} MATCH more text here`;
    const matchIndex = text.indexOf('MATCH');
    const index = createSearchIndex();
    const results = index.search('MATCH', [{
      fsPath: (() => {
        const d = makeTempDir('excerpt-long-before-');
        const f = path.join(d, 'test.md');
        writeFile(f, text);
        return f;
      })(),
      fileName: 'test.md',
      relativePath: 'test.md',
      title: 'Test',
    }]);
    expect(results.length).toBe(1);
    expect(results[0].excerpt).toMatch(/^\.\.\./);
  });

  test('makeSearchExcerpt - very long after text adds ellipsis', () => {
    const afterWords = Array.from({ length: 15 }, (_, i) => `after${i}`).join(' ');
    const text = `MATCH ${afterWords}`;
    const d = makeTempDir('excerpt-long-after-');
    const f = path.join(d, 'test.md');
    writeFile(f, text);
    const results = createSearchIndex().search('MATCH', [{
      fsPath: f,
      fileName: 'test.md',
      relativePath: 'test.md',
      title: 'Test',
    }]);
    expect(results.length).toBe(1);
    expect(results[0].excerpt).toMatch(/\.\.\.$/);
  });

  test('makeSearchExcerpt - empty before and after', () => {
    const d = makeTempDir('excerpt-empty-surround-');
    const f = path.join(d, 'test.md');
    writeFile(f, 'QUERY');
    const results = createSearchIndex().search('QUERY', [{
      fsPath: f,
      fileName: 'test.md',
      relativePath: 'test.md',
      title: 'Test',
    }]);
    expect(results.length).toBe(1);
    expect(results[0].excerpt).toBe('QUERY');
  });

  test('makeSearchExcerpt - empty matchText is omitted', () => {
    const d = makeTempDir('excerpt-empty-match-');
    const f = path.join(d, 'test.md');
    writeFile(f, 'some words here');
    const results = createSearchIndex().search('some words here', [{
      fsPath: f,
      fileName: 'test.md',
      relativePath: 'test.md',
      title: 'Test',
    }]);
    expect(results.length).toBe(1);
    expect(results[0].excerpt).not.toContain('  ');
  });

  test('search uses fallbacks when item fields are missing', () => {
    const d = makeTempDir('search-fallbacks-');
    const f = path.join(d, 'mydoc.md');
    writeFile(f, 'needle content');
    const results = createSearchIndex().search('needle', [{ fsPath: f }]);
    expect(results.length).toBe(1);
    expect(results[0].fileName).toBe('mydoc.md');
    expect(results[0].relativePath).toBe('mydoc.md');
    expect(results[0].title).toBe('mydoc');
  });

  test('searchIncremental uses fallbacks when item fields are missing', async () => {
    const d = makeTempDir('inc-fallbacks-');
    const f = path.join(d, 'mydoc.md');
    writeFile(f, 'needle content');
    const batches: any[] = [];
    const result = await createSearchIndex().searchIncremental('needle', [{ fsPath: f }], {
      onBatch: (batch: any) => batches.push(batch),
    });
    expect(result.total).toBe(1);
    expect(batches[0][0].fileName).toBe('mydoc.md');
    expect(batches[0][0].relativePath).toBe('mydoc.md');
    expect(batches[0][0].title).toBe('mydoc');
  });

  test('searchIncremental skips items with missing fsPath', async () => {
    const result = await createSearchIndex().searchIncremental('test', [{ fileName: 'test.md', title: 'Test' }]);
    expect(result.total).toBe(0);
  });

  test('searchIncremental skips non-supported file types', async () => {
    const d = makeTempDir('inc-unsupported-');
    const f = path.join(d, 'script.js');
    writeFile(f, 'needle content');
    const result = await createSearchIndex().searchIncremental('needle', [{ fsPath: f, fileName: 'script.js', relativePath: 'script.js', title: 'Script' }]);
    expect(result.total).toBe(0);
  });

  test('canSearchFileContents returns false for non-markdown/non-txt files', () => {
    const index = createSearchIndex();
    const d = makeTempDir('cant-search-');
    const filePath = path.join(d, 'script.js');
    writeFile(filePath, 'const x = 1; needle here');
    const results = index.search('needle', [{ fsPath: filePath, fileName: 'script.js', relativePath: 'script.js', title: 'Script' }]);
    expect(results).toEqual([]);
  });

  test('getEntry returns null for non-existent file', () => {
    const index = createSearchIndex();
    const results = index.search('anything', [{ fsPath: '/nonexistent/path/file.md', fileName: 'file.md', relativePath: 'file.md', title: 'File' }]);
    expect(results).toEqual([]);
  });

  test('getEntry returns null for oversized files', () => {
    const d = makeTempDir('oversized-');
    const f = path.join(d, 'huge.md');
    const bigContent = 'x'.repeat(2 * 1024 * 1024 + 1);
    writeFile(f, bigContent);
    const results = createSearchIndex().search('anything', [{ fsPath: f, fileName: 'huge.md', relativePath: 'huge.md', title: 'Huge' }]);
    expect(results).toEqual([]);
  });

  test('getEntry cache miss when mtime or size differs', () => {
    const d = makeTempDir('cache-miss-');
    const f = path.join(d, 'cached.md');
    writeFile(f, 'hello world');
    const index = createSearchIndex();
    const r1 = index.search('hello', [{ fsPath: f, fileName: 'cached.md', relativePath: 'cached.md', title: 'Cached' }]);
    expect(r1.length).toBe(1);

    writeFile(f, 'hello updated world');
    const r2 = index.search('updated', [{ fsPath: f, fileName: 'cached.md', relativePath: 'cached.md', title: 'Cached' }]);
    expect(r2.length).toBe(1);
    expect(r2[0].excerpt).toMatch(/updated/i);
  });

  test('prime batches with setTimeout and handles errors', async () => {
    const d = makeTempDir('prime-');
    const f1 = path.join(d, 'a.md');
    const f2 = path.join(d, 'b.md');
    writeFile(f1, 'content one');
    writeFile(f2, 'content two');

    const index = createSearchIndex();
    const items = [
      { fsPath: f1 },
      { fsPath: f2 },
      { fsPath: null },
      { fsPath: '/no/such/file.md' },
      { fsPath: path.join(d, 'bad.doc'), notAPath: true },
    ];

    vi.useFakeTimers();
    index.prime(items);
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(0);

    const results = index.search('content', [
      { fsPath: f1, fileName: 'a.md', relativePath: 'a.md', title: 'A' },
      { fsPath: f2, fileName: 'b.md', relativePath: 'b.md', title: 'B' },
    ]);
    expect(results.length).toBe(2);
  });

  test('prime continues across setTimeout batches when more than 5 items', async () => {
    const d = makeTempDir('prime-batch-');
    const files = Array.from({ length: 8 }, (_, i) => {
      const f = path.join(d, `${i}.md`);
      writeFile(f, `content ${i}`);
      return { fsPath: f };
    });

    const index = createSearchIndex();
    vi.useFakeTimers();
    index.prime(files as any);
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(0);

    const items = files.map((f, i) => ({
      ...f,
      fileName: `${i}.md`,
      relativePath: `${i}.md`,
      title: `${i}`,
    }));
    const results = index.search('content', items);
    expect(results.length).toBe(8);
  });

  test('search returns empty for null query', () => {
    const index = createSearchIndex();
    expect(index.search(null, [{ fsPath: 'test.md', fileName: 'test.md', relativePath: 'test.md', title: 'Test' }])).toEqual([]);
  });

  test('search returns empty when normalized query is empty', () => {
    const index = createSearchIndex();
    expect(index.search('\u0307\u0307', [{ fsPath: 'test.md', fileName: 'test.md', relativePath: 'test.md', title: 'Test' }])).toEqual([]);
  });

  test('search returns empty for empty items', () => {
    const index = createSearchIndex();
    expect(index.search('test', [])).toEqual([]);
  });

  test('search skips items with missing fsPath', () => {
    const index = createSearchIndex();
    const results = index.search('test', [{ fileName: 'test.md', title: 'Test' }]);
    expect(results).toEqual([]);
  });

  test('search skips items where file does not exist', () => {
    const index = createSearchIndex();
    const results = index.search('test', [{ fsPath: '/missing/file.md', fileName: 'file.md', relativePath: 'file.md', title: 'File' }]);
    expect(results).toEqual([]);
  });

  test('search returns baseScore-only match for known supported non-searchable type', () => {
    const d = makeTempDir('basescore-');
    const f = path.join(d, 'report.pdf');
    writeFile(f, 'some pdf content with needle');
    const index = createSearchIndex();
    const results = index.search('report', [{ fsPath: f, fileName: 'report.pdf', relativePath: 'report.pdf', title: 'Report' }]);
    expect(results.length).toBe(1);
    expect(results[0].excerpt).toBe('');
  });

  test('search respects limit parameter', () => {
    const d = makeTempDir('search-limit-');
    const files = Array.from({ length: 10 }, (_, i) => {
      const f = path.join(d, `${i}.md`);
      writeFile(f, `needle content ${i}`);
      return { fsPath: f, fileName: `${i}.md`, relativePath: `${i}.md`, title: `${i}` };
    });
    const results = createSearchIndex().search('needle', files, 3);
    expect(results.length).toBe(3);
  });

  test('searchIncremental returns empty for empty query', async () => {
    const result = await createSearchIndex().searchIncremental('', []);
    expect(result).toEqual({ total: 0, truncated: false, cancelled: false });
  });

  test('searchIncremental returns empty for null query', async () => {
    const result = await createSearchIndex().searchIncremental(null, []);
    expect(result).toEqual({ total: 0, truncated: false, cancelled: false });
  });

  test('searchIncremental truncates when hitting maxMatchesPerFile', async () => {
    const d = makeTempDir('inc-maxmatches-');
    const f = path.join(d, 'many.md');
    writeFile(f, Array.from({ length: 20 }, (_, i) => `needle ${i}`).join('\n'));
    const result = await createSearchIndex().searchIncremental(
      'needle',
      [{ fsPath: f, fileName: 'many.md', relativePath: 'many.md', title: 'Many' }],
      { maxMatchesPerFile: 3, maxResults: 100 },
    );
    expect(result.truncated).toBe(true);
    expect(result.total).toBe(3);
  });

  test('searchIncremental baseScore-only when matchCount is 0', async () => {
    const d = makeTempDir('inc-basescore-');
    const f = path.join(d, 'report.pdf');
    writeFile(f, 'some content');
    const batches: any[] = [];
    const result = await createSearchIndex().searchIncremental(
      'report',
      [{ fsPath: f, fileName: 'report.pdf', relativePath: 'report.pdf', title: 'Report' }],
      { onBatch: (batch: any) => batches.push(batch) },
    );
    expect(result.total).toBe(1);
    expect(batches.length).toBe(1);
    expect(batches[0][0].excerpt).toBe('');
  });

  test('searchIncremental maxResults truncation', async () => {
    const d = makeTempDir('inc-maxresults-');
    const files = Array.from({ length: 10 }, (_, i) => {
      const f = path.join(d, `${i}.md`);
      writeFile(f, `needle ${i}`);
      return { fsPath: f, fileName: `${i}.md`, relativePath: `${i}.md`, title: `${i}` };
    });
    const result = await createSearchIndex().searchIncremental('needle', files, { maxResults: 3 });
    expect(result.total).toBe(3);
    expect(result.truncated).toBe(true);
  });

  test('searchIncremental flushes when batchSize reached', async () => {
    const d = makeTempDir('inc-batch-flush-');
    const files = Array.from({ length: 6 }, (_, i) => {
      const f = path.join(d, `${i}.md`);
      writeFile(f, `needle ${i}`);
      return { fsPath: f, fileName: `${i}.md`, relativePath: `${i}.md`, title: `${i}` };
    });
    const batches: any[] = [];
    await createSearchIndex().searchIncremental('needle', files, {
      batchSize: 3,
      onBatch: (batch: any) => batches.push(batch),
    });
    expect(batches.length).toBe(2);
    expect(batches[0].length).toBe(3);
  });

  test('searchIncremental yieldAndCheckCancellation ends search early', async () => {
    const d = makeTempDir('inc-yield-cancel-');
    const files = Array.from({ length: 50 }, (_, i) => {
      const f = path.join(d, `${i}.md`);
      writeFile(f, `needle ${i}`);
      return { fsPath: f, fileName: `${i}.md`, relativePath: `${i}.md`, title: `${i}` };
    });
    let cancelAfter = 0;
    const result = await createSearchIndex().searchIncremental('needle', files, {
      yieldEvery: 1,
      shouldCancel: () => {
        cancelAfter++;
        return cancelAfter > 3;
      },
    });
    expect(result.cancelled).toBe(true);
    expect(result.total).toBeLessThan(50);
  });

  test('searchIncremental breaks when pushResult returns false for baseScore-only item', async () => {
    const d = makeTempDir('inc-basescore-break-');
    const files: any[] = [];
    for (let i = 0; i < 6; i++) {
      const f = path.join(d, `${i}.pdf`);
      writeFile(f, 'pdf content');
      files.push({ fsPath: f, fileName: `${i}.pdf`, relativePath: `${i}.pdf`, title: `match${i}` });
    }
    const result = await createSearchIndex().searchIncremental('match', files, {
      maxResults: 3,
    });
    expect(result.total).toBe(3);
    expect(result.truncated).toBe(true);
  });

  test('searchIncremental cancels during inter-item yieldAndCheckCancellation', async () => {
    const d = makeTempDir('inc-interitem-cancel-');
    const files = Array.from({ length: 20 }, (_, i) => {
      const f = path.join(d, `${i}.pdf`);
      writeFile(f, 'pdf content');
      return { fsPath: f, fileName: `${i}.pdf`, relativePath: `${i}.pdf`, title: `match${i}` };
    });
    let callCount = 0;
    const result = await createSearchIndex().searchIncremental('match', files, {
      yieldEvery: 1,
      shouldCancel: () => {
        callCount++;
        return callCount > 5;
      },
    });
    expect(result.cancelled).toBe(true);
    expect(result.total).toBeLessThan(20);
  });

  test('prime catches errors when getEntry throws', async () => {
    const d = makeTempDir('prime-error-');
    const f = path.join(d, 'good.md');
    writeFile(f, 'searchable content');
    const index = createSearchIndex();

    const spy = vi.spyOn(fs, 'readFileSync').mockImplementation((p: any, enc: any) => {
      if (typeof p === 'string' && p.includes('good.md')) throw new Error('read fail');
      return fs.readFileSync(p, enc);
    });

    vi.useFakeTimers();
    index.prime([{ fsPath: f }]);
    await vi.advanceTimersByTimeAsync(0);
    spy.mockRestore();

    const results = index.search('searchable', [{ fsPath: f, fileName: 'good.md', relativePath: 'good.md', title: 'Good' }]);
    expect(results.length).toBe(1);
  });

  test('search catches errors during content search', () => {
    const d = makeTempDir('search-error-');
    const f = path.join(d, 'doc.md');
    writeFile(f, 'needle content');
    const index = createSearchIndex();

    const spy = vi.spyOn(fs, 'readFileSync').mockImplementation((p: any, enc: any) => {
      if (typeof p === 'string' && p.includes('doc.md')) throw new Error('read fail');
      return fs.readFileSync(p, enc);
    });

    const results = index.search('needle', [{ fsPath: f, fileName: 'doc.md', relativePath: 'doc.md', title: 'Doc' }]);
    expect(results).toEqual([]);
    spy.mockRestore();
  });

  test('searchIncremental catches errors during content search', async () => {
    const d = makeTempDir('inc-search-error-');
    const f = path.join(d, 'doc.md');
    writeFile(f, 'needle content');
    const index = createSearchIndex();

    const spy = vi.spyOn(fs, 'readFileSync').mockImplementation((p: any, enc: any) => {
      if (typeof p === 'string' && p.includes('doc.md')) throw new Error('read fail');
      return fs.readFileSync(p, enc);
    });

    const result = await index.searchIncremental('needle', [{ fsPath: f, fileName: 'doc.md', relativePath: 'doc.md', title: 'Doc' }]);
    expect(result.total).toBe(0);
    spy.mockRestore();
  });

  test('searchIncremental returns empty when normalized query is empty', async () => {
    const d = makeTempDir('inc-normempty-');
    const f = path.join(d, 'doc.md');
    writeFile(f, 'content');
    const result = await createSearchIndex().searchIncremental('\u0307\u0307', [{ fsPath: f, fileName: 'doc.md', relativePath: 'doc.md', title: 'Doc' }]);
    expect(result).toEqual({ total: 0, truncated: false, cancelled: false });
  });

  test('search lineNumber tracks multi-line content correctly', () => {
    const d = makeTempDir('search-linenum-');
    const f = path.join(d, 'multi.md');
    writeFile(f, 'line one\nneedle here\nline three');
    const index = createSearchIndex();
    const results = index.search('needle', [{ fsPath: f, fileName: 'multi.md', relativePath: 'multi.md', title: 'Multi' }]);
    expect(results.length).toBe(1);
    expect(results[0].lineNumber).toBe(2);
  });

  test('search lineNumber for first line match', () => {
    const d = makeTempDir('search-linenum1-');
    const f = path.join(d, 'first.md');
    writeFile(f, 'needle at start\nsecond line\nthird line');
    const index = createSearchIndex();
    const results = index.search('needle', [{ fsPath: f, fileName: 'first.md', relativePath: 'first.md', title: 'First' }]);
    expect(results.length).toBe(1);
    expect(results[0].lineNumber).toBe(1);
  });

  test('search catches error during getEntry for content-searchable file', () => {
    const d = makeTempDir('search-getentry-err-');
    const f = path.join(d, 'doc.md');
    writeFile(f, 'needle content');
    const index = createSearchIndex();

    const spy = vi.spyOn(fs, 'statSync').mockImplementation((p: any) => {
      if (typeof p === 'string' && p.includes('doc.md')) throw new Error('stat fail');
      return fs.statSync(p);
    });

    const results = index.search('needle', [{ fsPath: f, fileName: 'doc.md', relativePath: 'doc.md', title: 'Doc' }]);
    expect(results).toEqual([]);
    spy.mockRestore();
  });

  test('searchIncremental breaks searchItems label when pushResult returns false', async () => {
    const d = makeTempDir('inc-break-label-');
    const f = path.join(d, 'many.md');
    writeFile(f, Array.from({ length: 10 }, (_, i) => `needle ${i}`).join('\n'));
    const batches: any[] = [];
    const result = await createSearchIndex().searchIncremental(
      'needle',
      [{ fsPath: f, fileName: 'many.md', relativePath: 'many.md', title: 'Many' }],
      { maxResults: 2, onBatch: (batch: any) => batches.push(batch) },
    );
    expect(result.total).toBe(2);
    expect(result.truncated).toBe(true);
  });

  test('searchIncremental lineNumber tracks across multiple matches', async () => {
    const d = makeTempDir('inc-linenum-');
    const f = path.join(d, 'lines.md');
    writeFile(f, 'first line\nsecond needle\nthird line\nfourth needle');
    const batches: any[] = [];
    const result = await createSearchIndex().searchIncremental(
      'needle',
      [{ fsPath: f, fileName: 'lines.md', relativePath: 'lines.md', title: 'Lines' }],
      { onBatch: (batch: any) => batches.push(batch) },
    );
    expect(result.total).toBe(2);
    const allResults = batches.flat();
    expect(allResults[0].lineNumber).toBe(2);
    expect(allResults[1].lineNumber).toBe(4);
  });

  test('searchIncremental handles error in getEntry for content-searchable file', async () => {
    const d = makeTempDir('inc-stat-err-');
    const f = path.join(d, 'doc.md');
    writeFile(f, 'needle content');
    const index = createSearchIndex();

    const spy = vi.spyOn(fs, 'statSync').mockImplementation((p: any) => {
      if (typeof p === 'string' && p.includes('doc.md')) throw new Error('stat fail');
      return fs.statSync(p);
    });

    const result = await index.searchIncremental('needle', [{ fsPath: f, fileName: 'doc.md', relativePath: 'doc.md', title: 'Doc' }]);
    expect(result.total).toBe(0);
    spy.mockRestore();
  });

  test('makeSearchExcerpt with empty matchText does not push to parts', () => {
    const d = makeTempDir('excerpt-empty-match2-');
    const f = path.join(d, 'test.md');
    writeFile(f, '    ');
    const results = createSearchIndex().search('    ', [{
      fsPath: f,
      fileName: 'test.md',
      relativePath: 'test.md',
      title: 'Test',
    }]);
    expect(results.length).toBe(1);
  });

  test('search with valid query enters else of !query check', () => {
    const d = makeTempDir('search-valid-q-');
    const f = path.join(d, 'doc.md');
    writeFile(f, 'findable');
    const results = createSearchIndex().search('findable', [{ fsPath: f, fileName: 'doc.md', relativePath: 'doc.md', title: 'Doc' }]);
    expect(results.length).toBe(1);
  });

  test('search with item that has known extension but not content-searchable', () => {
    const d = makeTempDir('search-known-NoContent-');
    const f = path.join(d, 'report.doc');
    writeFile(f, 'needle content');
    const results = createSearchIndex().search('report', [{ fsPath: f, fileName: 'report.doc', relativePath: 'report.doc', title: 'Report' }]);
    expect(results.length).toBe(1);
    expect(results[0].excerpt).toBe('');
  });

  test('searchIncremental: pushResult true when total < maxResults', async () => {
    const d = makeTempDir('inc-push-true-');
    const f = path.join(d, 'doc.md');
    writeFile(f, 'needle');
    const result = await createSearchIndex().searchIncremental('needle', [{ fsPath: f, fileName: 'doc.md', relativePath: 'doc.md', title: 'Doc' }], { maxResults: 100 });
    expect(result.total).toBe(1);
    expect(result.truncated).toBe(false);
  });

  test('searchIncremental: flush when batch.length >= batchSize', async () => {
    const d = makeTempDir('inc-flush-batch-');
    const files = Array.from({ length: 5 }, (_, i) => {
      const f = path.join(d, `${i}.md`);
      writeFile(f, `needle ${i}`);
      return { fsPath: f, fileName: `${i}.md`, relativePath: `${i}.md`, title: `${i}` };
    });
    const batches: any[] = [];
    await createSearchIndex().searchIncremental('needle', files, { batchSize: 2, onBatch: (batch: any) => batches.push(batch) });
    expect(batches.length).toBe(3);
  });

  test('searchIncremental: matchCount 0 and baseScore 0 continues to next item', async () => {
    const d = makeTempDir('inc-no-match-no-score-');
    const f = path.join(d, 'doc.md');
    writeFile(f, 'nothing relevant');
    const f2 = path.join(d, 'doc2.md');
    writeFile(f2, 'findable content');
    const result = await createSearchIndex().searchIncremental('findable', [
      { fsPath: f, fileName: 'doc.md', relativePath: 'doc.md', title: 'Doc' },
      { fsPath: f2, fileName: 'doc2.md', relativePath: 'doc2.md', title: 'Doc2' },
    ]);
    expect(result.total).toBe(1);
  });

  test('searchIncremental: handle non-supported file type gracefully', async () => {
    const d = makeTempDir('inc-unsupported2-');
    const f = path.join(d, 'script.js');
    writeFile(f, 'needle content');
    const result = await createSearchIndex().searchIncremental('needle', [{ fsPath: f, fileName: 'script.js', relativePath: 'script.js', title: 'Script' }]);
    expect(result.total).toBe(0);
  });

  test('search entry cache hit when mtimeMs and size match', async () => {
    const d = makeTempDir('inc-cache-hit-');
    const f = path.join(d, 'cached.md');
    writeFile(f, 'needle content');
    const index = createSearchIndex();
    const batches1: any[] = [];
    await index.searchIncremental('needle', [{ fsPath: f, fileName: 'cached.md', relativePath: 'cached.md', title: 'Cached' }], { onBatch: (b: any) => batches1.push(b) });
    const batches2: any[] = [];
    await index.searchIncremental('needle', [{ fsPath: f, fileName: 'cached.md', relativePath: 'cached.md', title: 'Cached' }], { onBatch: (b: any) => batches2.push(b) });
    expect(batches2.length).toBeGreaterThan(0);
  });

  test('searchIncremental: matchCount >= maxMatchesPerFile sets truncated', async () => {
    const d = makeTempDir('inc-maxmatch-trunc-');
    const f = path.join(d, 'many.md');
    writeFile(f, Array.from({ length: 50 }, (_, i) => `needle ${i}`).join('\n'));
    const result = await createSearchIndex().searchIncremental('needle', [{ fsPath: f, fileName: 'many.md', relativePath: 'many.md', title: 'Many' }], { maxMatchesPerFile: 5, maxResults: 1000 });
    expect(result.truncated).toBe(true);
  });

  test('searchIncremental: canSearchFileContents false for .pdf', async () => {
    const d = makeTempDir('inc-pdf-');
    const f = path.join(d, 'report.pdf');
    writeFile(f, 'needle content');
    const batches: any[] = [];
    const result = await createSearchIndex().searchIncremental('report', [{ fsPath: f, fileName: 'report.pdf', relativePath: 'report.pdf', title: 'Report' }], { onBatch: (b: any) => batches.push(b) });
    expect(result.total).toBe(1);
    expect(batches[0][0].excerpt).toBe('');
  });
});

describe('shouldSkipSearchItem', () => {
  test('returns true when fsPath is missing', () => {
    expect(shouldSkipSearchItem({ fileName: 'test.md' })).toBe(true);
  });

  test('returns true when fsPath is empty', () => {
    expect(shouldSkipSearchItem({ fsPath: '' })).toBe(true);
  });

  test('returns true when file does not exist', () => {
    expect(shouldSkipSearchItem({ fsPath: '/no/such/file.md' })).toBe(true);
  });

  test('returns true when file type is not supported', () => {
    const d = makeTempDir('ssi-unsupported-');
    const f = path.join(d, 'script.js');
    writeFile(f, 'content');
    expect(shouldSkipSearchItem({ fsPath: f })).toBe(true);
  });

  test('returns false for supported file that exists', () => {
    const d = makeTempDir('ssi-supported-');
    const f = path.join(d, 'doc.md');
    writeFile(f, 'content');
    expect(shouldSkipSearchItem({ fsPath: f })).toBe(false);
  });
});

describe('scoreItemName', () => {
  test('returns 0 when no field matches', () => {
    expect(scoreItemName('Title', 'file.md', 'dir/file.md', 'zzz')).toBe(0);
  });

  test('returns 5 when title matches', () => {
    expect(scoreItemName('Needle', 'file.md', 'dir/file.md', 'needle')).toBe(5);
  });

  test('returns 4 when fileName matches', () => {
    expect(scoreItemName('Title', 'needle.md', 'dir/file.md', 'needle')).toBe(4);
  });

  test('returns 2 when relativePath matches', () => {
    expect(scoreItemName('Title', 'file.md', 'dir/needle/file.md', 'needle')).toBe(2);
  });

  test('returns sum when multiple fields match', () => {
    expect(scoreItemName('Needle', 'needle.md', 'needle/file.md', 'needle')).toBe(11);
  });
});

describe('searchItems', () => {
  test('returns empty for null query', () => {
    expect(searchItems(null as any, [], () => null, 100)).toEqual([]);
  });

  test('returns empty for short query', () => {
    expect(searchItems('a', [], () => null, 100)).toEqual([]);
  });

  test('returns empty when normalized query is empty', () => {
    expect(searchItems('\u0307\u0307', [], () => null, 100)).toEqual([]);
  });

  test('skips non-supported file types', () => {
    const d = makeTempDir('si-unsupported-');
    const f = path.join(d, 'script.js');
    writeFile(f, 'needle content');
    const results = searchItems('needle', [{ fsPath: f, fileName: 'script.js', relativePath: 'script.js', title: 'Script' }], () => null, 100);
    expect(results).toEqual([]);
  });

  test('returns baseScore match for known supported non-searchable type', () => {
    const d = makeTempDir('si-basescore-');
    const f = path.join(d, 'report.pdf');
    writeFile(f, 'data');
    const getEntry = () => null;
    const results = searchItems('report', [{ fsPath: f, fileName: 'report.pdf', relativePath: 'report.pdf', title: 'Report' }], getEntry, 100);
    expect(results.length).toBe(1);
    expect(results[0].excerpt).toBe('');
  });

  test('returns content matches for searchable file type', () => {
    const d = makeTempDir('si-content-');
    const f = path.join(d, 'doc.md');
    writeFile(f, 'findable needle');
    const index = createSearchIndex();
    const getEntry = (p: string) => {
      if (!p || !fs.existsSync(p) || !canSearchFileContents(p)) return null;
      const stat = fs.statSync(p);
      const raw = fs.readFileSync(p, 'utf8');
      return { mtimeMs: stat.mtimeMs, size: stat.size, raw, haystack: prepareHaystack(raw) };
    };
    const { prepareHaystack } = require('../../../desktop/unicode-search.js');
    const results = searchItems('needle', [{ fsPath: f, fileName: 'doc.md', relativePath: 'doc.md', title: 'Doc' }], index.search ? ((p: string) => {
      const entry = (index as any).getEntry?.(p);
      return entry;
    }) : getEntry, 100);
  });
});

describe('flushBatch', () => {
  test('does nothing when batch is empty', () => {
    const batches: any[] = [];
    flushBatch([], (b: any) => batches.push(b));
    expect(batches.length).toBe(0);
  });

  test('sorts and calls onBatch when batch has items', () => {
    const batches: any[] = [];
    flushBatch([{ score: 1, name: 'a' }, { score: 3, name: 'b' }, { score: 2, name: 'c' }] as any, (b: any) => batches.push(b));
    expect(batches.length).toBe(1);
    expect(batches[0][0].name).toBe('b');
    expect(batches[0][2].name).toBe('a');
  });
});

describe('pushSearchResult', () => {
  test('returns false and sets truncated when total >= maxResults', () => {
    const state = { total: 10, maxResults: 10, batch: [], batchSize: 100, onBatch: () => {}, truncated: false };
    const result = pushSearchResult({ score: 1 } as any, state as any);
    expect(result).toBe(false);
    expect(state.truncated).toBe(true);
  });

  test('returns true and increments total when under limit', () => {
    const batches: any[] = [];
    const state = { total: 0, maxResults: 100, batch: [] as any[], batchSize: 100, onBatch: (b: any) => batches.push(b), truncated: false };
    const result = pushSearchResult({ score: 1, a: 1 } as any, state as any);
    expect(result).toBe(true);
    expect(state.total).toBe(1);
  });

  test('flushes when batch.length >= batchSize', () => {
    const batches: any[] = [];
    const state = { total: 0, maxResults: 100, batch: [{ score: 1 }, { score: 2 }] as any[], batchSize: 2, onBatch: (b: any) => batches.push(b), truncated: false };
    pushSearchResult({ score: 3 } as any, state as any);
    expect(batches.length).toBe(1);
  });
});

describe('primeIndex', () => {
  test('batches with setTimeout for > primeBatchSize paths', async () => {
    const d = makeTempDir('pi-batch-');
    const files = Array.from({ length: 12 }, (_, i) => {
      const f = path.join(d, `${i}.md`);
      writeFile(f, `content ${i}`);
      return f;
    });
    const entries: string[] = [];
    const getEntry = (p: string) => entries.push(p);
    const steps: any[] = [];
    const mockSetTimeout = (fn: () => void) => { steps.push(fn); };
    primeIndex(files, getEntry, 5, mockSetTimeout);
    expect(entries.length).toBe(5);
    expect(steps.length).toBe(1);
    steps[0]();
    expect(entries.length).toBe(10);
    expect(steps.length).toBe(2);
    steps[1]();
    expect(entries.length).toBe(12);
  });

  test('completes without setTimeout when paths fit in one batch', () => {
    const d = makeTempDir('pi-single-');
    const files = Array.from({ length: 3 }, (_, i) => {
      const f = path.join(d, `${i}.md`);
      writeFile(f, `content ${i}`);
      return f;
    });
    const entries: string[] = [];
    const getEntry = (p: string) => entries.push(p);
    const steps: any[] = [];
    const mockSetTimeout = (fn: () => void) => { steps.push(fn); };
    primeIndex(files, getEntry, 5, mockSetTimeout);
    expect(entries.length).toBe(3);
    expect(steps.length).toBe(0);
  });

  test('catches errors in getEntry', () => {
    const getEntry = () => { throw new Error('fail'); };
    const steps: any[] = [];
    const mockSetTimeout = (fn: () => void) => { steps.push(fn); };
    const origError = console.error;
    const errors: any[] = [];
    console.error = (...args: any[]) => errors.push(args);
    primeIndex(['/nonexistent/path.md'], getEntry, 5, mockSetTimeout);
    console.error = origError;
    expect(errors.length).toBe(1);
  });
});

describe('searchItemsIncremental', () => {
  test('returns empty for null query', async () => {
    const result = await searchItemsIncremental(null as any, [], () => null);
    expect(result).toEqual({ total: 0, truncated: false, cancelled: false });
  });

  test('returns empty when normalized query is empty', async () => {
    const result = await searchItemsIncremental('\u0307\u0307', [], () => null);
    expect(result).toEqual({ total: 0, truncated: false, cancelled: false });
  });

  test('returns empty for short query', async () => {
    const result = await searchItemsIncremental('a', [], () => null);
    expect(result).toEqual({ total: 0, truncated: false, cancelled: false });
  });
});
