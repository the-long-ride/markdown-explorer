import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { createSearchWorkerController } from "../desktop/search-worker-controller.js";

function createFixture(prefix, fileCount, content) {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  return Array.from({ length: fileCount }, (_, index) => {
    const fsPath = path.join(rootDir, `${index}.md`);
    fs.writeFileSync(fsPath, content(index), "utf8");
    return {
      tabId: "tab-1",
      tabLabel: "Docs",
      fsPath,
      fileName: `${index}.md`,
      relativePath: `${index}.md`,
      title: `File ${index}`,
    };
  });
}

test("search worker streams bounded result batches", async (t) => {
  const items = createFixture(
    "search-worker-batches-",
    3,
    () => Array.from({ length: 80 }, (_, index) => `needle ${index}`).join("\n"),
  );
  const messages = [];
  let resolveDone;
  const done = new Promise((resolve) => { resolveDone = resolve; });
  const controller = createSearchWorkerController({
    onMessage(message) {
      messages.push(message);
      if (message.type === "done" && message.requestId === "request-1") resolveDone(message);
    },
  });
  t.after(() => controller.dispose());

  controller.setItems(items);
  controller.search({ requestId: "request-1", query: "needle", batchSize: 50 });
  const completion = await done;

  const batches = messages.filter((message) => message.type === "batch");
  assert.ok(batches.length > 1);
  assert.ok(batches.every((message) => message.results.length <= 50));
  assert.equal(completion.cancelled, false);
  assert.equal(completion.total, 240);
});

test("search worker cancels stale search when a newer query starts", async (t) => {
  const items = createFixture(
    "search-worker-cancel-",
    80,
    (index) => `common term ${index}\n${index === 79 ? "latest-only" : "other"}`,
  );
  const messages = [];
  let resolveLatest;
  const latestDone = new Promise((resolve) => { resolveLatest = resolve; });
  const controller = createSearchWorkerController({
    onMessage(message) {
      messages.push(message);
      if (message.type === "done" && message.requestId === "latest") resolveLatest(message);
    },
  });
  t.after(() => controller.dispose());

  controller.setItems(items);
  controller.search({ requestId: "stale", query: "common", yieldEvery: 1 });
  controller.search({ requestId: "latest", query: "latest-only", yieldEvery: 1 });
  const completion = await latestDone;

  assert.equal(completion.cancelled, false);
  assert.equal(completion.total, 1);
  assert.ok(messages.some(
    (message) => message.type === "done" && message.requestId === "stale" && message.cancelled,
  ));
});