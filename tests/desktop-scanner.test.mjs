import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import DesktopScanner from "../desktop/scanner.js";

function makeTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
}

test("extractMdxTitle prefers frontmatter title", () => {
  const title = DesktopScanner.extractMdxTitle([
    "---",
    'title: "Frontmatter Title"',
    "---",
    "",
    "export const title = 'Ignored';",
  ].join("\n"));

  assert.equal(title, "Frontmatter Title");
});

test("extractTitle falls back to markdown heading when MDX metadata is absent", () => {
  const rootDir = makeTempDir("mdx-title-");
  const filePath = path.join(rootDir, "sample.mdx");
  writeFile(filePath, ["Intro", "", "# Visible Heading"].join("\n"));

  assert.equal(DesktopScanner.extractTitle(filePath, true), "Visible Heading");
});

test("scan ignores excluded folders and unsupported files", () => {
  const rootDir = makeTempDir("scanner-scan-");
  writeFile(path.join(rootDir, "docs", "guide.md"), "# Guide");
  writeFile(path.join(rootDir, ".git", "ignored.md"), "# Git");
  writeFile(path.join(rootDir, "node_modules", "pkg.md"), "# Pkg");
  writeFile(path.join(rootDir, "notes.txt"), "plain text");
  writeFile(path.join(rootDir, "image.png"), "not supported");

  const { flat, tree } = DesktopScanner.scan(rootDir);

  assert.deepEqual(
    flat.map((entry) => entry.relativePath).sort(),
    [path.join("docs", "guide.md"), "notes.txt"].sort(),
  );
  assert.equal(tree.children.length, 1);
  assert.equal(tree.children[0].name, "docs");
});
