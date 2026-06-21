import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { createUpdateManager, getUpdateAssetFileName } from "../desktop/update-manager.js";

function makeTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function createAppStub(rootDir) {
  return {
    getPath(name) {
      if (name === "userData") return path.join(rootDir, "userData");
      if (name === "temp") return path.join(rootDir, "temp");
      throw new Error(`unexpected path request: ${name}`);
    },
    getVersion() {
      return "1.5.2";
    },
    isPackaged: true,
  };
}

function createManagerHarness(options = {}) {
  const rootDir = makeTempDir("update-manager-");
  const sent = [];
  const helperCalls = [];
  const downloads = [];
  const manager = createUpdateManager({
    platform: "win32",
    app: createAppStub(rootDir),
    fs,
    path,
    execPath: options.execPath || path.join(rootDir, "Markdown Explorer.exe"),
    relaunchArgs: ["--flag"],
    sendToWindow(message) {
      sent.push(message);
    },
    async downloadUpdateFile({ url, destinationPath, onProgress }) {
      downloads.push({ url, destinationPath });
      fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
      onProgress({ percent: 25 });
      fs.writeFileSync(destinationPath, "next-version");
      onProgress({ percent: 100 });
    },
    async launchHelper(payload) {
      helperCalls.push(payload);
    },
  });

  return { rootDir, sent, helperCalls, downloads, manager };
}

test("getUpdateAssetFileName keeps the release asset extension", () => {
  assert.equal(
    getUpdateAssetFileName("https://example.test/Markdown%20Explorer%20Setup.exe"),
    "Markdown Explorer Setup.exe",
  );
});

test("startDownload stages the file and emits downloading then downloaded states", async () => {
  const { manager, sent, downloads } = createManagerHarness();

  const result = await manager.startDownload({
    version: "v1.5.3",
    url: "https://example.test/Markdown%20Explorer%201.5.3.exe",
  });

  assert.equal(downloads.length, 1);
  assert.equal(path.basename(result.stagedFilePath), "Markdown Explorer 1.5.3.exe");
  assert.equal(fs.existsSync(result.stagedFilePath), true);
  assert.deepEqual(
    sent.map((message) => message.state.status),
    ["downloading", "downloading", "downloading", "downloaded"],
  );
  assert.equal(sent.at(-1).state.downloadedVersion, "v1.5.3");
  assert.equal(sent.at(-1).state.downloadedFileName, "Markdown Explorer 1.5.3.exe");
});

test("schedulePendingUpdate persists manifest for apply-on-exit", async () => {
  const { manager, sent } = createManagerHarness();
  const stagedFilePath = path.join(makeTempDir("update-stage-"), "Markdown Explorer 1.5.3.exe");
  fs.writeFileSync(stagedFilePath, "next-version");

  await manager.schedulePendingUpdate({
    version: "v1.5.3",
    downloadUrl: "https://example.test/Markdown%20Explorer%201.5.3.exe",
    stagedFilePath,
  });

  const manifest = JSON.parse(fs.readFileSync(manager.getManifestPath(), "utf8"));
  assert.equal(manifest.version, "v1.5.3");
  assert.equal(manifest.stagedFilePath, stagedFilePath);
  assert.deepEqual(sent.at(-1), {
    command: "updateStateChanged",
    state: {
      status: "scheduled-on-exit",
      version: "v1.5.3",
      downloadedVersion: "v1.5.3",
      downloadedFileName: "Markdown Explorer 1.5.3.exe",
      progressPercent: 100,
      error: "",
    },
  });
});

test("restartAndApplyUpdate launches the helper and clears the pending manifest", async () => {
  const { manager, helperCalls } = createManagerHarness();
  const stagedFilePath = path.join(makeTempDir("update-restart-"), "Markdown Explorer 1.5.3.exe");
  fs.writeFileSync(stagedFilePath, "next-version");

  await manager.schedulePendingUpdate({
    version: "v1.5.3",
    downloadUrl: "https://example.test/Markdown%20Explorer%201.5.3.exe",
    stagedFilePath,
  });
  await manager.restartAndApplyUpdate();

  assert.equal(helperCalls.length, 1);
  assert.equal(helperCalls[0].targetExePath.endsWith("Markdown Explorer.exe"), true);
  assert.equal(helperCalls[0].stagedFilePath, stagedFilePath);
  assert.equal(fs.existsSync(manager.getManifestPath()), false);
});

test("applyPendingUpdateOnQuit launches helper only when a pending manifest exists", async () => {
  const { manager, helperCalls } = createManagerHarness();
  const stagedFilePath = path.join(makeTempDir("update-quit-"), "Markdown Explorer 1.5.3.exe");
  fs.writeFileSync(stagedFilePath, "next-version");

  assert.equal(await manager.applyPendingUpdateOnQuit(), false);

  await manager.schedulePendingUpdate({
    version: "v1.5.3",
    downloadUrl: "https://example.test/Markdown%20Explorer%201.5.3.exe",
    stagedFilePath,
  });

  assert.equal(await manager.applyPendingUpdateOnQuit(), true);
  assert.equal(helperCalls.length, 1);
  assert.equal(fs.existsSync(manager.getManifestPath()), false);
});

test("sendCurrentState restores a failed apply result as an error state", () => {
  const { manager, sent } = createManagerHarness();
  fs.mkdirSync(path.dirname(manager.getResultPath()), { recursive: true });
  fs.writeFileSync(manager.getResultPath(), "install-failed", "utf8");

  manager.sendCurrentState();

  assert.equal(sent.at(-1).state.status, "error");
  assert.equal(sent.at(-1).state.error, "install-failed");
  assert.equal(fs.existsSync(manager.getResultPath()), false);
});
