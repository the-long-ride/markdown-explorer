import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { createSearchIndex } from "../desktop/search-index.js";

function makeTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
}

test("search returns empty results for short queries", () => {
  const index = createSearchIndex();
  const results = index.search("a", [{ fsPath: "missing.md" }]);
  assert.deepEqual(results, []);
});

test("search ranks title matches and includes content excerpts", () => {
  const rootDir = makeTempDir("search-index-");
  const guidePath = path.join(rootDir, "guide.md");
  const notesPath = path.join(rootDir, "notes.md");

  writeFile(guidePath, ["# Performance Guide", "", "Startup performance matters here."].join("\n"));
  writeFile(notesPath, ["# Notes", "", "This file also mentions performance tuning."].join("\n"));

  const items = [
    { fsPath: notesPath, fileName: "notes.md", relativePath: "notes.md", title: "Notes" },
    { fsPath: guidePath, fileName: "guide.md", relativePath: "guide.md", title: "Performance Guide" },
  ];

  const results = createSearchIndex().search("performance", items);

  assert.equal(results.length, 3);
  assert.equal(results[0].fsPath, guidePath);
  assert.equal(results[1].fsPath, guidePath);
  assert.equal(results[2].fsPath, notesPath);
  assert.match(results[0].excerpt, /performance/i);
});

test("search skips oversized files when no path or title match exists", () => {
  const rootDir = makeTempDir("search-large-");
  const filePath = path.join(rootDir, "large.md");
  writeFile(filePath, `# Big File\n\n${"lorem ipsum ".repeat(300000)}`);

  const results = createSearchIndex().search("needle", [
    { fsPath: filePath, fileName: "large.md", relativePath: "large.md", title: "Big File" },
  ]);

  assert.deepEqual(results, []);
});

test("search handles multilingual locale-specific case folding correctly", () => {
  const rootDir = makeTempDir("search-multi-");
  const turkishPath = path.join(rootDir, "turkish.md");
  const germanPath = path.join(rootDir, "german.md");
  
  // Note: the Turkish İ and German ß change length or byte representation when lowercased natively
  writeFile(turkishPath, "Welcome to İstanbul.");
  writeFile(germanPath, "Die Hauptstraße ist lang.");

  const items = [
    { fsPath: turkishPath, fileName: "turkish.md", relativePath: "turkish.md", title: "Turkish" },
    { fsPath: germanPath, fileName: "german.md", relativePath: "german.md", title: "German" },
  ];

  const index = createSearchIndex();
  
  // Test Turkish
  const trResults = index.search("istanbul", items);
  assert.equal(trResults.length, 1);
  assert.equal(trResults[0].fsPath, turkishPath);
  assert.match(trResults[0].excerpt, /İstanbul/);
  // Verify match index is exactly where "İ" starts in the raw string (offset 11)
  assert.equal(trResults[0].matchIndex, 11);
  assert.equal(trResults[0].matchLength, 8); // "İstanbul".length

  // Test German
  const deResults = index.search("strasse", items);
  assert.equal(deResults.length, 1);
  assert.equal(deResults[0].fsPath, germanPath);
  assert.match(deResults[0].excerpt, /straße/i);
});

test("search handles unicode composed/decomposed normalization correctly", () => {
  const rootDir = makeTempDir("search-norm-");
  const nfcPath = path.join(rootDir, "nfc.md");
  const nfdPath = path.join(rootDir, "nfd.md");
  
  // NFC (composed): \u00E9
  writeFile(nfcPath, "I love caf\u00E9s.");
  
  // NFD (decomposed): e + \u0301
  writeFile(nfdPath, "Let's go to the cafe\u0301.");

  const items = [
    { fsPath: nfcPath, fileName: "nfc.md", relativePath: "nfc.md", title: "NFC" },
    { fsPath: nfdPath, fileName: "nfd.md", relativePath: "nfd.md", title: "NFD" },
  ];

  const index = createSearchIndex();
  
  // Search using NFC
  const results = index.search("caf\u00E9", items);
  assert.equal(results.length, 2);
  
  // The excerpt should contain the original representation
  const nfdMatch = results.find(r => r.fsPath === nfdPath);
  assert.ok(nfdMatch);
  assert.equal(nfdMatch.matchLength, 5); // "cafe\u0301".length
});

test("incremental search emits bounded batches and limits matches per file", async () => {
  const rootDir = makeTempDir("search-incremental-");
  const filePath = path.join(rootDir, "many.md");
  writeFile(filePath, Array.from({ length: 20 }, (_, index) => `needle ${index}`).join("\n"));

  const batches = [];
  const result = await createSearchIndex().searchIncremental(
    "needle",
    [{ fsPath: filePath, fileName: "many.md", relativePath: "many.md", title: "Many" }],
    {
      batchSize: 2,
      maxResults: 5,
      maxMatchesPerFile: 5,
      onBatch: (batch) => batches.push(batch),
    },
  );

  assert.deepEqual(batches.map((batch) => batch.length), [2, 2, 1]);
  assert.equal(result.total, 5);
  assert.equal(result.truncated, true);
  assert.equal(result.cancelled, false);
});

test("incremental search yields so an active request can be cancelled", async () => {
  const rootDir = makeTempDir("search-cancel-");
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
  const result = await createSearchIndex().searchIncremental("needle", items, {
    batchSize: 10,
    yieldEvery: 1,
    shouldCancel: () => cancelled,
  });

  assert.equal(result.cancelled, true);
  assert.ok(result.total < items.length);
});
