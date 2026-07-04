import { describe, expect, test, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  createWindowsUpdateScript,
  createInstallerUpdateScript,
  createExeUpdateScript,
  createZipUpdateScript,
  escapeForDoubleQuotes,
  isInstallerExe,
  launchWindowsUpdateHelper,
} from '../../../desktop/update-helper.js';

function makeTempDir(prefix: string) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

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

describe('escapeForDoubleQuotes', () => {
  test('escapes double quotes in strings', () => {
    expect(escapeForDoubleQuotes('hello "world"')).toBe('hello ""world""');
  });

  test('handles null and undefined', () => {
    expect(escapeForDoubleQuotes(null as any)).toBe('');
    expect(escapeForDoubleQuotes(undefined as any)).toBe('');
  });

  test('returns string unchanged when no double quotes', () => {
    expect(escapeForDoubleQuotes('hello world')).toBe('hello world');
  });
});

describe('isInstallerExe additional branches', () => {
  test('returns false for non-exe file', () => {
    expect(isInstallerExe('setup.zip')).toBe(false);
  });

  test('returns false for file without setup or installer in name', () => {
    expect(isInstallerExe('update.exe')).toBe(false);
  });

  test('returns false for empty string', () => {
    expect(isInstallerExe('')).toBe(false);
  });

  test('returns false for null', () => {
    expect(isInstallerExe(null as any)).toBe(false);
  });
});

describe('createWindowsUpdateScript zip path', () => {
  test('creates zip update script for .zip staged file', () => {
    const script = createWindowsUpdateScript({
      stagedFilePath: 'C:/temp/update.zip',
      targetExePath: 'C:/Apps/Markdown Explorer/Markdown Explorer.exe',
      workingDirectory: 'C:/Apps/Markdown Explorer',
      relaunchArgs: [],
      resultFilePath: 'C:/temp/result.txt',
    });

    expect(script).toMatch(/Expand-Archive/);
    expect(script).toMatch(/robocopy/);
  });
});

describe('createInstallerUpdateScript', () => {
  test('generates installer script with correct structure', () => {
    const script = createInstallerUpdateScript({
      stagedFilePath: 'C:/temp/Setup.exe',
      targetExePath: 'C:/App/app.exe',
      workingDirectory: 'C:/App',
      quotedArgs: '--flag',
      resultFilePath: 'C:/temp/result.txt',
    });

    expect(script).toMatch(/Running installer update/);
    expect(script).toMatch(/start \/wait/);
    expect(script).toContain('Setup.exe');
  });
});

describe('createExeUpdateScript', () => {
  test('generates exe swap script with move and backup', () => {
    const script = createExeUpdateScript({
      stagedFilePath: 'C:/temp/app.exe',
      targetExePath: 'C:/App/app.exe',
      workingDirectory: 'C:/App',
      relaunchArgs: [],
      quotedArgs: '',
      resultFilePath: 'C:/temp/result.txt',
    });

    expect(script).toMatch(/move \/Y %STAGED_EXE% %TARGET_EXE%/);
    expect(script).toMatch(/BACKUP_EXE/);
  });
});

describe('createZipUpdateScript', () => {
  test('generates zip extraction script', () => {
    const script = createZipUpdateScript({
      stagedFilePath: 'C:/temp/update.zip',
      targetExePath: 'C:/App/app.exe',
      workingDirectory: 'C:/App',
      quotedArgs: '',
      resultFilePath: 'C:/temp/result.txt',
    });

    expect(script).toMatch(/Expand-Archive/);
    expect(script).toMatch(/robocopy/);
    expect(script).toMatch(/__update_extracted/);
  });
});

describe('launchWindowsUpdateHelper', () => {
  test('writes script and spawns child process', () => {
    const dir = makeTempDir('uh-launch-');
    const scriptDir = path.join(dir, 'scripts');
    fs.mkdirSync(scriptDir, { recursive: true });
    const targetPath = path.join(dir, 'app.exe');
    fs.writeFileSync(targetPath, 'dummy');

    let spawned = false;
    let unrefCalled = false;
    const mockSpawn = () => {
      spawned = true;
      return { unref: () => { unrefCalled = true; } };
    };

    const result = launchWindowsUpdateHelper(
      {
        stagedFilePath: path.join(dir, 'update.exe'),
        targetExePath: targetPath,
        workingDirectory: dir,
        relaunchArgs: [],
        resultFilePath: path.join(dir, 'result.txt'),
      },
      {
        fs: {
          mkdirSync: () => {},
          writeFileSync: () => {},
        },
        os: { tmpdir: () => scriptDir },
        path,
        spawn: mockSpawn as any,
      },
    );

    expect(typeof result).toBe('string');
  });
});
