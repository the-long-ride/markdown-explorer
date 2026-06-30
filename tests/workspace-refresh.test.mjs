import test from "node:test";
import assert from "node:assert/strict";

import {
  isWatchChangeRelevant,
  shouldNotifyCurrentFileChanged,
} from "../desktop/workspace-refresh.js";

test("watch refresh ignores extra document changes when document conversion is disabled", () => {
  assert.equal(
    isWatchChangeRelevant({
      changedPath: "C:/docs/report.xlsx",
      documentConversionEnabled: false,
    }),
    false,
  );
});

test("watch refresh accepts extra document changes when document conversion is enabled", () => {
  assert.equal(
    isWatchChangeRelevant({
      changedPath: "C:/docs/report.xlsx",
      documentConversionEnabled: true,
    }),
    true,
  );
});

test("watch refresh accepts markdown changes when document conversion is disabled", () => {
  assert.equal(
    isWatchChangeRelevant({
      changedPath: "C:/docs/guide.md",
      documentConversionEnabled: false,
    }),
    true,
  );
});

test("watch refresh notifies when the current open file changed", () => {
  assert.equal(
    shouldNotifyCurrentFileChanged({
      currentFile: "C:/docs/guide.md",
      changedPath: "C:/docs/GUIDE.md",
      currentFileStillAvailable: true,
    }),
    true,
  );
});

test("watch refresh notifies when the current open file is no longer available after scan", () => {
  assert.equal(
    shouldNotifyCurrentFileChanged({
      currentFile: "C:/docs/guide.md",
      changedPath: "C:/docs/other.md",
      currentFileStillAvailable: false,
    }),
    true,
  );
});
