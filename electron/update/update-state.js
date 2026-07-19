const fs = require("fs");
const path = require("path");

function getUpdateAssetFileName(downloadUrl) {
  try {
    const parsed = new URL(String(downloadUrl || ""));
    return decodeURIComponent(parsed.pathname.split("/").pop() || "update.exe");
  } catch {
    return "update.exe";
  }
}

function createEmptyState() {
  return { status: "idle", version: "", downloadedVersion: "", downloadedFileName: "", progressPercent: 0, error: "" };
}

async function defaultDownloadUpdateFile({ url, destinationPath, onProgress }) {
  const response = await fetch(url);
  if (!response.ok || !response.body) throw new Error(`Download failed with status ${response.status}`);
  fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
  const totalBytes = Number(response.headers.get("content-length") || 0);
  const fileStream = fs.createWriteStream(destinationPath);
  let receivedBytes = 0;
  for await (const chunk of response.body) {
    receivedBytes += chunk.length;
    fileStream.write(chunk);
    if (totalBytes > 0) onProgress?.({ percent: Math.min(100, Math.round((receivedBytes / totalBytes) * 100)) });
  }
  await new Promise((resolve, reject) => fileStream.end((err) => (err ? reject(err) : resolve())));
}

function buildScheduledState(manifest) {
  return { status: "scheduled-on-exit", version: manifest.version, downloadedVersion: manifest.version, downloadedFileName: path.basename(manifest.stagedFilePath), progressPercent: 100, error: "" };
}

function getHelperPayload(manifest, resultPath) {
  return { stagedFilePath: manifest.stagedFilePath, targetExePath: manifest.targetExePath, workingDirectory: manifest.workingDirectory, relaunchArgs: manifest.relaunchArgs || [], resultFilePath: resultPath };
}

function readResultCode(fsImpl, resultPath) {
  if (!fsImpl.existsSync(resultPath)) return "";
  try { return String(fsImpl.readFileSync(resultPath, "utf8") || "").trim(); } catch { return ""; }
}
function clearResultCode(fsImpl, resultPath) { if (fsImpl.existsSync(resultPath)) fsImpl.unlinkSync(resultPath); }
function readManifest(fsImpl, manifestPath) {
  if (!fsImpl.existsSync(manifestPath)) return null;
  try { return JSON.parse(fsImpl.readFileSync(manifestPath, "utf8")); } catch { return null; }
}
function clearManifest(fsImpl, manifestPath) { if (fsImpl.existsSync(manifestPath)) fsImpl.unlinkSync(manifestPath); }
function writeManifest(fsImpl, manifestDir, manifestPath, manifest) {
  fsImpl.mkdirSync(manifestDir, { recursive: true });
  fsImpl.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
}
function restorePersistedState(fsImpl, manifestPath, resultPath) {
  const resultCode = readResultCode(fsImpl, resultPath);
  if (resultCode) {
    clearResultCode(fsImpl, resultPath);
    return { status: resultCode === "applied" ? "idle" : "error", version: "", downloadedVersion: "", downloadedFileName: "", progressPercent: 0, error: resultCode === "applied" ? "" : resultCode };
  }
  const manifest = readManifest(fsImpl, manifestPath);
  if (!manifest) return createEmptyState();
  if (!fsImpl.existsSync(manifest.stagedFilePath)) {
    clearManifest(fsImpl, manifestPath);
    return { status: "error", version: manifest.version || "", downloadedVersion: "", downloadedFileName: "", progressPercent: 0, error: "missing-staged-update" };
  }
  return { state: buildScheduledState(manifest), manifest };
}
function startDownloadState(version, fileName, progressPercent, error = "") { return { status: "downloading", version, downloadedVersion: "", downloadedFileName: fileName, progressPercent, error }; }
function downloadedState(version, fileName) { return { status: "downloaded", version, downloadedVersion: version, downloadedFileName: fileName, progressPercent: 100, error: "" }; }
function errorState(version, fileName, error) { return { status: "error", version, downloadedVersion: "", downloadedFileName: fileName, progressPercent: 0, error: error instanceof Error ? error.message : "download-failed" }; }
function isPortableRuntime(env = process.env) { return Boolean(env.PORTABLE_EXECUTABLE_DIR || env.PORTABLE_EXECUTABLE_FILE || env.PORTABLE_EXECUTABLE_APP_FILENAME); }
function isInstallerUpdateSupported({ platform = process.platform, app, env = process.env } = {}) { return platform === "win32" && app?.isPackaged === true && !isPortableRuntime(env); }

module.exports = { getUpdateAssetFileName, createEmptyState, defaultDownloadUpdateFile, buildScheduledState, getHelperPayload, readResultCode, clearResultCode, readManifest, clearManifest, writeManifest, restorePersistedState, startDownloadState, downloadedState, errorState, isPortableRuntime, isInstallerUpdateSupported };
