import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { createRecentWorkspacesStore } from "../desktop/recents.js";

function makeTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function createAppStub(userDataPath) {
  return {
    getPath(name) {
      assert.equal(name, "userData");
      return userDataPath;
    },
  };
}

test("save keeps newest workspace first and deduplicates by normalized path", () => {
  const userDataDir = makeTempDir("recents-store-");
  const store = createRecentWorkspacesStore(createAppStub(userDataDir));

  store.save(path.join(userDataDir, "Docs"));
  store.save(path.join(userDataDir, ".", "Docs"));

  const list = store.load();
  assert.equal(list.length, 1);
  assert.equal(path.normalize(list[0].path), path.join(userDataDir, "Docs"));
});

test("replace sanitizes entries and removes duplicates", () => {
  const userDataDir = makeTempDir("recents-replace-");
  const store = createRecentWorkspacesStore(createAppStub(userDataDir));

  store.replace([
    { path: " ", name: "ignored" },
    { path: path.join(userDataDir, "one"), name: " One " },
    { path: path.join(userDataDir, "one"), name: "Duplicate" },
    { path: path.join(userDataDir, "two"), lastOpened: "123" },
  ]);

  const list = store.load();
  assert.equal(list.length, 2);
  assert.equal(list[0].name, "One");
  assert.equal(list[1].lastOpened, 123);
});
