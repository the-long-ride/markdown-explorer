import test from "node:test";
import assert from "node:assert/strict";

import { createWindowsUpdateScript, isInstallerExe } from "../desktop/update-helper.js";

test("isInstallerExe detects NSIS-style setup filenames", () => {
  assert.equal(isInstallerExe("Markdown Explorer Setup.exe"), true);
  assert.equal(isInstallerExe("Markdown Explorer Installer.exe"), true);
  assert.equal(isInstallerExe("Markdown Explorer Portable.exe"), false);
});

test("createWindowsUpdateScript runs installer exes instead of swapping the app binary", () => {
  const script = createWindowsUpdateScript({
    stagedFilePath: "C:/temp/Markdown Explorer Setup.exe",
    targetExePath: "C:/Apps/Markdown Explorer/Markdown Explorer.exe",
    workingDirectory: "C:/Apps/Markdown Explorer",
    relaunchArgs: ["--from-update"],
    resultFilePath: "C:/temp/result.txt",
  });

  assert.match(script, /start \/wait "" "C:\/temp\/Markdown Explorer Setup\.exe" \/S/);
  assert.doesNotMatch(script, /move \/Y %STAGED_EXE% %TARGET_EXE%/);
});

test("createWindowsUpdateScript keeps portable exes on the swap path", () => {
  const script = createWindowsUpdateScript({
    stagedFilePath: "C:/temp/Markdown Explorer Portable.exe",
    targetExePath: "C:/Apps/Markdown Explorer/Markdown Explorer.exe",
    workingDirectory: "C:/Apps/Markdown Explorer",
    relaunchArgs: [],
    resultFilePath: "C:/temp/result.txt",
  });

  assert.match(script, /move \/Y %STAGED_EXE% %TARGET_EXE%/);
  assert.doesNotMatch(script, /start \/wait "" "C:\/temp\/Markdown Explorer Portable\.exe" \/S/);
});
