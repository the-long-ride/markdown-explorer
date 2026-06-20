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
  const quotedArgs = relaunchArgs.map((arg) => `"${escapeForDoubleQuotes(arg)}"`).join(" ");
  const isZip = stagedFilePath.toLowerCase().endsWith(".zip");

  if (isZip) {
    return createZipUpdateScript({
      stagedFilePath, targetExePath, workingDirectory, relaunchArgs, resultFilePath, quotedArgs,
    });
  }

  return createExeUpdateScript({
    stagedFilePath, targetExePath, workingDirectory, relaunchArgs, resultFilePath, quotedArgs,
  });
}

function createExeUpdateScript({
  stagedFilePath,
  targetExePath,
  workingDirectory,
  relaunchArgs,
  resultFilePath,
  quotedArgs,
}) {
  const backupExePath = `${targetExePath}.old`;
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
    "echo Waiting for app to exit...",
    "for /L %%i in (1,1,120) do (",
    "  move /Y %TARGET_EXE% %BACKUP_EXE% >nul 2>nul && goto swap",
    "  timeout /t 1 /nobreak >nul",
    ")",
    "goto launchOld",
    "",
    ":swap",
    "echo Applying update...",
    "move /Y %STAGED_EXE% %TARGET_EXE% >nul 2>nul",
    "if errorlevel 1 (",
    "  if not %RESULT_FILE%==\"\" > %RESULT_FILE% echo install-failed",
    "  move /Y %BACKUP_EXE% %TARGET_EXE% >nul 2>nul",
    "  goto launchOld",
    ")",
    "if not %RESULT_FILE%==\"\" > %RESULT_FILE% echo applied",
    "del /Q %BACKUP_EXE% >nul 2>nul",
    `start "" /D %WORK_DIR% %TARGET_EXE% ${quotedArgs}`.trim(),
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

function createZipUpdateScript({
  stagedFilePath,
  targetExePath,
  workingDirectory,
  quotedArgs,
  resultFilePath,
}) {
  const extractDir = `${workingDirectory}\\__update_extracted`;
  const quotedZip = escapeForDoubleQuotes(stagedFilePath);
  const quotedExtract = escapeForDoubleQuotes(extractDir);
  const quotedWorkDir = escapeForDoubleQuotes(workingDirectory);
  const quotedTarget = escapeForDoubleQuotes(targetExePath);
  const quotedResult = escapeForDoubleQuotes(resultFilePath || "");

  return [
    "@echo off",
    "setlocal enabledelayedexpansion",
    `set RESULT_FILE="${quotedResult}"`,
    "",
    "if not %RESULT_FILE%==\"\" del /Q %RESULT_FILE% >nul 2>nul",
    "",
    "echo Waiting for app to exit...",
    ":wait",
    `2>nul (>>"${quotedTarget}" echo off) && goto ready`,
    "timeout /t 1 /nobreak >nul",
    "goto wait",
    "",
    ":ready",
    "echo Extracting update...",
    `powershell -NoProfile -Command "Expand-Archive -Path '${quotedZip}' -DestinationPath '${quotedExtract}' -Force"`,
    "if errorlevel 1 goto failed",
    "",
    "echo Copying files...",
    `for /d %%D in ("${quotedExtract}\\*") do set STAGING_DIR=%%D`,
    "if not defined STAGING_DIR set STAGING_DIR=%quotedExtract%",
    "",
    `robocopy "!STAGING_DIR!" "${quotedWorkDir}" /E /IS /IT /NP /NFL /NDL /R:3 /W:2 /XD __update_extracted`,
    "if errorlevel 8 goto failed",
    "",
    "if not %RESULT_FILE%==\"\" > %RESULT_FILE% echo applied",
    `start "" /D "${quotedWorkDir}" "${quotedTarget}" ${quotedArgs}`,
    "goto cleanup",
    "",
    ":failed",
    "if not %RESULT_FILE%==\"\" > %RESULT_FILE% echo install-failed",
    `if exist "${quotedTarget}" start "" /D "${quotedWorkDir}" "${quotedTarget}" ${quotedArgs}`,
    "",
    ":cleanup",
    `rmdir /S /Q "${quotedExtract}" >nul 2>nul`,
    `del /Q "${quotedZip}" >nul 2>nul`,
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