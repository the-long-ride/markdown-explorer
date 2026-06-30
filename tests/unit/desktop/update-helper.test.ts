import { describe, expect, test } from 'vitest';

import { createWindowsUpdateScript, isInstallerExe } from '../../../desktop/update-helper.js';

describe('update-helper', () => {
  test('isInstallerExe detects NSIS-style setup filenames', () => {
    expect(isInstallerExe('Markdown Explorer Setup.exe')).toBe(true);
    expect(isInstallerExe('Markdown Explorer Installer.exe')).toBe(true);
    expect(isInstallerExe('Markdown Explorer Portable.exe')).toBe(false);
  });

  test('createWindowsUpdateScript runs installer exes instead of swapping the app binary', () => {
    const script = createWindowsUpdateScript({
      stagedFilePath: 'C:/temp/Markdown Explorer Setup.exe',
      targetExePath: 'C:/Apps/Markdown Explorer/Markdown Explorer.exe',
      workingDirectory: 'C:/Apps/Markdown Explorer',
      relaunchArgs: ['--from-update'],
      resultFilePath: 'C:/temp/result.txt',
    });

    expect(script).toMatch(/start \/wait "" "C:\/temp\/Markdown Explorer Setup\.exe" \/S/);
    expect(script).not.toMatch(/move \/Y %STAGED_EXE% %TARGET_EXE%/);
  });

  test('createWindowsUpdateScript keeps portable exes on the swap path', () => {
    const script = createWindowsUpdateScript({
      stagedFilePath: 'C:/temp/Markdown Explorer Portable.exe',
      targetExePath: 'C:/Apps/Markdown Explorer/Markdown Explorer.exe',
      workingDirectory: 'C:/Apps/Markdown Explorer',
      relaunchArgs: [],
      resultFilePath: 'C:/temp/result.txt',
    });

    expect(script).toMatch(/move \/Y %STAGED_EXE% %TARGET_EXE%/);
    expect(script).not.toMatch(/start \/wait "" "C:\/temp\/Markdown Explorer Portable\.exe" \/S/);
  });
});
