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

module.exports = { getUpdateAssetFileName, createEmptyState, defaultDownloadUpdateFile, buildScheduledState, getHelperPayload };
