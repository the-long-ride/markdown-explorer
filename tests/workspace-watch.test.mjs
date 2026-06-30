import test from "node:test";
import assert from "node:assert/strict";

import { createWorkspaceWatchController } from "../desktop/workspace-watch.js";

test("workspace watcher debounces burst events into one refresh", async () => {
  const watched = [];
  let refreshCount = 0;
  let watcherHandler = null;

  const controller = createWorkspaceWatchController({
    fs: {
      watch(target, _options, handler) {
        watcherHandler = handler;
        watched.push(target);
        return { close() {} };
      },
    },
    setTimeout,
    clearTimeout,
    debounceMs: 5,
    async onRefresh() {
      refreshCount += 1;
    },
  });

  controller.watchWorkspace("C:/docs");
  watcherHandler?.("rename", "a.md");
  watcherHandler?.("change", "a.md");

  await new Promise((resolve) => setTimeout(resolve, 20));

  assert.deepEqual(watched, ["C:/docs"]);
  assert.equal(refreshCount, 1);
});

test("workspace watcher ignores stale scheduled refreshes after workspace switch", async () => {
  const refreshedWorkspaces = [];
  const handlers = new Map();

  const controller = createWorkspaceWatchController({
    fs: {
      watch(target, _options, handler) {
        handlers.set(target, handler);
        return {
          close() {
            handlers.delete(target);
          },
        };
      },
    },
    setTimeout,
    clearTimeout,
    debounceMs: 5,
    async onRefresh(workspacePath) {
      refreshedWorkspaces.push(workspacePath);
    },
  });

  controller.watchWorkspace("C:/docs-one");
  handlers.get("C:/docs-one")?.("change", "a.md");
  controller.watchWorkspace("C:/docs-two");
  handlers.get("C:/docs-two")?.("change", "b.md");

  await new Promise((resolve) => setTimeout(resolve, 20));

  assert.deepEqual(refreshedWorkspaces, ["C:/docs-two"]);
});

test("workspace watcher passes changed file details to refresh", async () => {
  let watcherHandler = null;
  const refreshes = [];

  const controller = createWorkspaceWatchController({
    fs: {
      watch(_target, _options, handler) {
        watcherHandler = handler;
        return { close() {} };
      },
    },
    setTimeout,
    clearTimeout,
    debounceMs: 5,
    async onRefresh(workspacePath, change) {
      refreshes.push({ workspacePath, change });
    },
  });

  controller.watchWorkspace("C:/docs");
  watcherHandler?.("change", "guide.md");

  await new Promise((resolve) => setTimeout(resolve, 20));

  assert.equal(refreshes.length, 1);
  assert.equal(refreshes[0].workspacePath, "C:/docs");
  assert.equal(refreshes[0].change.eventType, "change");
  assert.equal(refreshes[0].change.relativePath, "guide.md");
  assert.equal(refreshes[0].change.fsPath.replace(/\\/g, "/"), "C:/docs/guide.md");
});
