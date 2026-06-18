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
