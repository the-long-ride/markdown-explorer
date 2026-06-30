import test from "node:test";
import assert from "node:assert/strict";

import {
  createStartupReadyAck,
  deferWorkspaceLoad,
} from "../desktop/startup-workspace.js";

test("startup ready ack exposes app shell before workspace files exist", () => {
  const ack = createStartupReadyAck({
    workspacePath: "C:/docs/project",
    recentWorkspaces: [{ name: "Project", path: "C:/docs/project" }],
    documentConversionEnabled: true,
    hostInfo: {
      appVersion: "1.0.0",
      appRuntime: "desktop",
      hostPlatform: "windows",
      hostArch: "x64",
      isMaximized: true,
    },
  });

  assert.deepEqual(ack, {
    command: "readyAck",
    fileList: [],
    tree: null,
    theme: "dark",
    themeStyle: "default",
    defaultExpanded: true,
    workspaceName: "project",
    workspacePath: "C:/docs/project",
    recentWorkspaces: [{ name: "Project", path: "C:/docs/project" }],
    documentConversionEnabled: true,
    appVersion: "1.0.0",
    appRuntime: "desktop",
    hostPlatform: "windows",
    hostArch: "x64",
    isMaximized: true,
  });
});

test("startup workspace load waits for scheduler so first paint is not blocked", async () => {
  const calls = [];
  let scheduled = null;

  deferWorkspaceLoad({
    schedule(fn) {
      scheduled = fn;
    },
    ensureHeavyModules() {
      calls.push("heavy");
    },
    bindWorkspaceWatch() {
      calls.push("watch");
    },
    sendLoading(label) {
      calls.push(`loading:${label}`);
    },
    async sendWorkspaceData() {
      calls.push("workspace");
    },
    async sendInitialContent(openFirstFile) {
      calls.push(`content:${openFirstFile}`);
    },
    sendUpdateState() {
      calls.push("updates");
    },
    onError(err) {
      calls.push(`error:${err.message}`);
    },
  });

  assert.deepEqual(calls, []);
  assert.equal(typeof scheduled, "function");

  await scheduled();

  assert.deepEqual(calls, [
    "loading:Loading workspace...",
    "heavy",
    "watch",
    "workspace",
    "content:false",
    "updates",
  ]);
});
