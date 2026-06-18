const fs = require("fs");
const os = require("os");
const path = require("path");
const childProcess = require("child_process");

function escapeForDoubleQuotes(value) {
  return String(value ?? "").replace(/"/g, '""');
}

function createWindowsUpdateScript({
  stagedFilePath,
  targetExePath,
  workingDirectory,
  relaunchArgs = [],
  resultFilePath,
}) {
  const backupExePath = `${targetExePath}.old`;
  const quotedArgs = relaunchArgs.map((arg) => `"${escapeForDoubleQuotes(arg)}"`).join(" ");
  return [
    "@echo off",
    "setlocal",
    `set TARGET_EXE="${escapeForDoubleQuotes(targetExePath)}"`,
    `set STAGED_EXE="${escapeForDoubleQuotes(stagedFilePath)}"`,
    `set BACKUP_EXE="${escapeForDoubleQuotes(backupExePath)}"`,
    `set WORK_DIR="${escapeForDoubleQuotes(workingDirectory)}"`,
    `set RESULT_FILE="${escapeForDoubleQuotes(resultFilePath || "")}"`,
    "",
    "if not %RESULT_FILE%==\"\" del /Q %RESULT_FILE% >nul 2>nul",
    "for /L %%i in (1,1,120) do (",
    "  move /Y %TARGET_EXE% %BACKUP_EXE% >nul 2>nul && goto swap",
    "  timeout /t 1 /nobreak >nul",
    ")",
    "goto launchOld",
    "",
    ":swap",
    "move /Y %STAGED_EXE% %TARGET_EXE% >nul 2>nul",
    "if errorlevel 1 (",
    "  if not %RESULT_FILE%==\"\" > %RESULT_FILE% echo install-failed",
    "  move /Y %BACKUP_EXE% %TARGET_EXE% >nul 2>nul",
    "  goto launchOld",
    ")",
    "if not %RESULT_FILE%==\"\" > %RESULT_FILE% echo applied",
    `start "" /D %WORK_DIR% %TARGET_EXE% ${quotedArgs}`.trim(),
    "del /Q %BACKUP_EXE% >nul 2>nul",
    "goto cleanup",
    "",
    ":launchOld",
    "if exist %BACKUP_EXE% move /Y %BACKUP_EXE% %TARGET_EXE% >nul 2>nul",
    "if not %RESULT_FILE%==\"\" if not exist %RESULT_FILE% > %RESULT_FILE% echo install-failed",
    `if exist %TARGET_EXE% start "" /D %WORK_DIR% %TARGET_EXE% ${quotedArgs}`.trim(),
    "",
    ":cleanup",
    "del /Q %~f0 >nul 2>nul",
    "endlocal",
  ].join("\r\n");
}

function launchWindowsUpdateHelper(payload, deps = {}) {
  const fsImpl = deps.fs || fs;
  const osImpl = deps.os || os;
  const pathImpl = deps.path || path;
  const spawnImpl = deps.spawn || childProcess.spawn;
  const scriptDir = pathImpl.join(osImpl.tmpdir(), "markdown-explorer-updater");
  fsImpl.mkdirSync(scriptDir, { recursive: true });
  const scriptPath = pathImpl.join(scriptDir, `apply-update-${Date.now()}.cmd`);
  fsImpl.writeFileSync(scriptPath, createWindowsUpdateScript(payload), "utf8");

  const child = spawnImpl(process.env.comspec || "cmd.exe", ["/d", "/s", "/c", scriptPath], {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
  child.unref();
  return scriptPath;
}

module.exports = {
  createWindowsUpdateScript,
  launchWindowsUpdateHelper,
};
