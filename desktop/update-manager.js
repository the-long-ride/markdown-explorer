const fs = require("fs");
const path = require("path");
const os = require("os");
const { launchWindowsUpdateHelper } = require("./update-helper");

function getUpdateAssetFileName(downloadUrl) {
  try {
    const parsed = new URL(String(downloadUrl || ""));
    return decodeURIComponent(parsed.pathname.split("/").pop() || "update.exe");
  } catch {
    return "update.exe";
  }
}

function createEmptyState() {
  return {
    status: "idle",
    version: "",
    downloadedVersion: "",
    downloadedFileName: "",
    progressPercent: 0,
    error: "",
  };
}

async function defaultDownloadUpdateFile({ url, destinationPath, onProgress }) {
  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(`Download failed with status ${response.status}`);
  }

  fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
  const totalBytes = Number(response.headers.get("content-length") || 0);
  const fileStream = fs.createWriteStream(destinationPath);
  let receivedBytes = 0;

  for await (const chunk of response.body) {
    receivedBytes += chunk.length;
    fileStream.write(chunk);
    if (totalBytes > 0) {
      onProgress?.({
        percent: Math.min(100, Math.round((receivedBytes / totalBytes) * 100)),
      });
    }
  }

  await new Promise((resolve, reject) => {
    fileStream.end((err) => (err ? reject(err) : resolve()));
  });
}

function createUpdateManager(deps = {}) {
  const fsImpl = deps.fs || fs;
  const pathImpl = deps.path || path;
  const osImpl = deps.os || os;
  const platform = deps.platform || process.platform;
  const app = deps.app;
  const sendToWindow = deps.sendToWindow || (() => {});
  const downloadUpdateFile = deps.downloadUpdateFile || defaultDownloadUpdateFile;
  const launchHelper = deps.launchHelper || ((payload) =>
    launchWindowsUpdateHelper(payload, {
      fs: fsImpl,
      os: osImpl,
      path: pathImpl,
      spawn: deps.spawn,
    }));
  const execPath = deps.execPath || process.execPath;
  const relaunchArgs = deps.relaunchArgs || process.argv.slice(1);
  const manifestDir = pathImpl.join(app.getPath("userData"), "updates");
  const manifestPath = pathImpl.join(manifestDir, "pending-update.json");
  const resultPath = pathImpl.join(manifestDir, "last-update-result.txt");
  const stagingDir = pathImpl.join(app.getPath("temp"), "markdown-explorer-updater", "staged");

  let state = createEmptyState();
  let lastDownloaded = null;
  let helperLaunched = false;

  function emitState(nextState) {
    state = {
      ...createEmptyState(),
      ...nextState,
    };
    sendToWindow({
      command: "updateStateChanged",
      state,
    });
  }

  function ensureWindows() {
    if (platform !== "win32") {
      throw new Error("In-app updates are only supported on Windows.");
    }
  }

  function getManifestPath() {
    return manifestPath;
  }

  function getResultPath() {
    return resultPath;
  }

  function clearManifest() {
    if (fsImpl.existsSync(manifestPath)) {
      fsImpl.unlinkSync(manifestPath);
    }
  }

  function readResultCode() {
    if (!fsImpl.existsSync(resultPath)) return "";
    try {
      return String(fsImpl.readFileSync(resultPath, "utf8") || "").trim();
    } catch {
      return "";
    }
  }

  function clearResultCode() {
    if (fsImpl.existsSync(resultPath)) {
      fsImpl.unlinkSync(resultPath);
    }
  }

  function readManifest() {
    if (!fsImpl.existsSync(manifestPath)) return null;
    try {
      return JSON.parse(fsImpl.readFileSync(manifestPath, "utf8"));
    } catch {
      return null;
    }
  }

  function writeManifest(manifest) {
    fsImpl.mkdirSync(manifestDir, { recursive: true });
    fsImpl.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
  }

  function buildScheduledState(manifest) {
    return {
      status: "scheduled-on-exit",
      version: manifest.version,
      downloadedVersion: manifest.version,
      downloadedFileName: pathImpl.basename(manifest.stagedFilePath),
      progressPercent: 100,
      error: "",
    };
  }

  function getHelperPayload(manifest) {
    return {
      stagedFilePath: manifest.stagedFilePath,
      targetExePath: manifest.targetExePath,
      workingDirectory: manifest.workingDirectory,
      relaunchArgs: manifest.relaunchArgs || [],
      resultFilePath: resultPath,
    };
  }

  function launchHelperForManifest(manifest) {
    launchHelper(getHelperPayload(manifest));
    helperLaunched = true;
  }

  function restorePersistedState() {
    const resultCode = readResultCode();
    if (resultCode) {
      clearResultCode();
      return {
        status: resultCode === "applied" ? "idle" : "error",
        version: "",
        downloadedVersion: "",
        downloadedFileName: "",
        progressPercent: 0,
        error: resultCode === "applied" ? "" : resultCode,
      };
    }

    const manifest = readManifest();
    if (!manifest) return createEmptyState();
    if (!fsImpl.existsSync(manifest.stagedFilePath)) {
      clearManifest();
      return {
        status: "error",
        version: manifest.version || "",
        downloadedVersion: "",
        downloadedFileName: "",
        progressPercent: 0,
        error: "missing-staged-update",
      };
    }
    lastDownloaded = {
      version: manifest.version,
      downloadUrl: manifest.downloadUrl,
      stagedFilePath: manifest.stagedFilePath,
    };
    return buildScheduledState(manifest);
  }

  async function startDownload({ version, url }) {
    ensureWindows();
    helperLaunched = false;
    const fileName = getUpdateAssetFileName(url);
    const destinationPath = pathImpl.join(stagingDir, fileName);
    emitState({
      status: "downloading",
      version,
      downloadedVersion: "",
      downloadedFileName: fileName,
      progressPercent: 0,
      error: "",
    });

    try {
      await downloadUpdateFile({
        url,
        destinationPath,
        onProgress(progress) {
          emitState({
            status: "downloading",
            version,
            downloadedVersion: "",
            downloadedFileName: fileName,
            progressPercent: Number(progress?.percent) || 0,
            error: "",
          });
        },
      });
      lastDownloaded = {
        version,
        downloadUrl: url,
        stagedFilePath: destinationPath,
      };
      emitState({
        status: "downloaded",
        version,
        downloadedVersion: version,
        downloadedFileName: fileName,
        progressPercent: 100,
        error: "",
      });
      return { stagedFilePath: destinationPath, fileName };
    } catch (error) {
      try {
        if (fsImpl.existsSync(destinationPath)) fsImpl.unlinkSync(destinationPath);
      } catch {}
      emitState({
        status: "error",
        version,
        downloadedVersion: "",
        downloadedFileName: fileName,
        progressPercent: 0,
        error: error instanceof Error ? error.message : "download-failed",
      });
      throw error;
    }
  }

  async function schedulePendingUpdate(payload = {}) {
    ensureWindows();
    const manifest = {
      version: payload.version || lastDownloaded?.version || "",
      downloadUrl: payload.downloadUrl || lastDownloaded?.downloadUrl || "",
      stagedFilePath: payload.stagedFilePath || lastDownloaded?.stagedFilePath || "",
      targetExePath: execPath,
      workingDirectory: pathImpl.dirname(execPath),
      relaunchArgs,
      createdAt: Date.now(),
    };
    writeManifest(manifest);
    lastDownloaded = {
      version: manifest.version,
      downloadUrl: manifest.downloadUrl,
      stagedFilePath: manifest.stagedFilePath,
    };
    emitState(buildScheduledState(manifest));
    return manifest;
  }

  async function restartAndApplyUpdate() {
    ensureWindows();
    const manifest = readManifest() || (lastDownloaded ? await schedulePendingUpdate(lastDownloaded) : null);
    if (!manifest) throw new Error("No downloaded update is ready to apply.");
    emitState({
      ...buildScheduledState(manifest),
      status: "applying",
    });
    clearManifest();
    launchHelperForManifest(manifest);
    return true;
  }

  async function applyPendingUpdateOnQuit() {
    ensureWindows();
    if (helperLaunched) return false;
    const manifest = readManifest();
    if (!manifest) return false;
    clearManifest();
    launchHelperForManifest(manifest);
    return true;
  }

  function sendCurrentState() {
    emitState(state.status === "idle" ? restorePersistedState() : state);
  }

  state = restorePersistedState();

  return {
    getManifestPath,
    getResultPath,
    getState() {
      return state;
    },
    startDownload,
    schedulePendingUpdate,
    restartAndApplyUpdate,
    applyPendingUpdateOnQuit,
    sendCurrentState,
    clearManifest,
    readManifest,
  };
}

module.exports = {
  createUpdateManager,
  getUpdateAssetFileName,
};
