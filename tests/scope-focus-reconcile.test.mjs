import test from "node:test";
import assert from "node:assert/strict";

import {
  collectSelectedFolderPaths,
  reconcileScopeFocusPaths,
} from "../ui/src/contexts/scope-focus-reconcile.js";

test("reconcileScopeFocusPaths removes stale paths and adds new files outside scoped parents", () => {
  const previousFilePaths = [
    "C:/docs/a.md",
    "C:/docs/folder/old.md",
  ];
  const nextFilePaths = [
    "C:/docs/a.md",
    "C:/docs/folder/new.md",
    "C:/docs/brand-new.md",
  ];

  const nextScopePaths = reconcileScopeFocusPaths({
    savedScopePaths: ["C:/docs/a.md", "C:/docs/folder/old.md"],
    previousFilePaths,
    nextFilePaths,
    selectedFolderPaths: [],
  });

  assert.deepEqual(
    nextScopePaths.sort(),
    [
      "C:/docs/a.md",
      "C:/docs/folder/new.md",
      "C:/docs/brand-new.md",
    ].sort(),
  );
});

test("reconcileScopeFocusPaths auto-includes new files under scoped folders", () => {
  const nextScopePaths = reconcileScopeFocusPaths({
    savedScopePaths: ["C:/docs/notes"],
    previousFilePaths: ["C:/docs/notes/one.md"],
    nextFilePaths: ["C:/docs/notes/one.md", "C:/docs/notes/two.md"],
    selectedFolderPaths: ["C:/docs/notes"],
  });

  assert.deepEqual(
    nextScopePaths.sort(),
    ["C:/docs/notes", "C:/docs/notes/two.md"].sort(),
  );
});

test("reconcileScopeFocusPaths returns null when no scope entry exists", () => {
  const nextScopePaths = reconcileScopeFocusPaths({
    savedScopePaths: null,
    previousFilePaths: ["C:/docs/a.md"],
    nextFilePaths: ["C:/docs/a.md", "C:/docs/b.md"],
    selectedFolderPaths: [],
  });

  assert.equal(nextScopePaths, null);
});

test("collectSelectedFolderPaths detects folders whose descendants are fully selected", () => {
  const tree = {
    name: "root",
    path: "C:/docs",
    files: [{ fsPath: "C:/docs/root.md" }],
    children: [
      {
        name: "notes",
        path: "C:/docs/notes",
        files: [
          { fsPath: "C:/docs/notes/one.md" },
          { fsPath: "C:/docs/notes/two.md" },
        ],
        children: [],
      },
    ],
  };

  const selectedFolderPaths = collectSelectedFolderPaths(
    tree,
    new Set(["C:/docs/notes/one.md", "C:/docs/notes/two.md"]),
  );

  assert.deepEqual(selectedFolderPaths, ["C:/docs/notes"]);
});
