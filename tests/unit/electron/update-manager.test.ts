import { describe, expect, test } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createUpdateManager, getUpdateAssetFileName, createEmptyState, buildScheduledState, getHelperPayload, readResultCode, clearResultCode, readManifest, clearManifest, writeManifest, restorePersistedState, startDownloadState, downloadedState, errorState } from '../../../desktop/update-manager.js';

function makeTempDir(prefix: string) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function createAppStub(rootDir: string) {
  return {
    getPath(name: string) {
      if (name === 'userData') return path.join(rootDir, 'userData');
      if (name === 'temp') return path.join(rootDir, 'temp');
      throw new Error(`unexpected path request: ${name}`);
    },
    getVersion() {
      return '1.5.2';
    },
    isPackaged: true,
  };
}

function createManagerHarness(options: { execPath?: string } = {}) {
  const rootDir = makeTempDir('update-manager-');
  const sent: any[] = [];
  const helperCalls: any[] = [];
  const downloads: any[] = [];
  const manager = createUpdateManager({
    platform: 'win32',
    app: createAppStub(rootDir),
    fs,
    path,
    execPath: options.execPath || path.join(rootDir, 'Markdown Explorer.exe'),
    relaunchArgs: ['--flag'],
    sendToWindow(message: any) {
      sent.push(message);
    },
    async downloadUpdateFile({ url, destinationPath, onProgress }: any) {
      downloads.push({ url, destinationPath });
      fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
      onProgress({ percent: 25 });
      fs.writeFileSync(destinationPath, 'next-version');
      onProgress({ percent: 100 });
    },
    async launchHelper(payload: any) {
      helperCalls.push(payload);
    },
  });

  return { rootDir, sent, helperCalls, downloads, manager };
}

describe('createUpdateManager', () => {
  test('getUpdateAssetFileName keeps the release asset extension', () => {
    expect(
      getUpdateAssetFileName('https://example.test/Markdown%20Explorer%20Setup.exe'),
    ).toBe('Markdown Explorer Setup.exe');
  });

  test('getUpdateAssetFileName falls back when no extension', () => {
    expect(
      getUpdateAssetFileName('https://example.test/download'),
    ).toBe('download');
  });

  test('getUpdateAssetFileName catches invalid URL', () => {
    expect(
      getUpdateAssetFileName('not-a-url'),
    ).toBe('update.exe');
  });

  test('startDownload stages the file and emits downloading then downloaded states', async () => {
    const { manager, sent, downloads } = createManagerHarness();

    const result = await manager.startDownload({
      version: 'v1.5.3',
      url: 'https://example.test/Markdown%20Explorer%201.5.3.exe',
    });

    expect(downloads.length).toBe(1);
    expect(path.basename(result.stagedFilePath)).toBe('Markdown Explorer 1.5.3.exe');
    expect(fs.existsSync(result.stagedFilePath)).toBe(true);
    expect(
      sent.map((message: any) => message.state.status),
    ).toEqual(
      ['downloading', 'downloading', 'downloading', 'downloaded'],
    );
    expect(sent.at(-1).state.downloadedVersion).toBe('v1.5.3');
    expect(sent.at(-1).state.downloadedFileName).toBe('Markdown Explorer 1.5.3.exe');
  });

  test('schedulePendingUpdate persists manifest for apply-on-exit', async () => {
    const { manager, sent } = createManagerHarness();
    const stagedFilePath = path.join(makeTempDir('update-stage-'), 'Markdown Explorer 1.5.3.exe');
    fs.writeFileSync(stagedFilePath, 'next-version');

    await manager.schedulePendingUpdate({
      version: 'v1.5.3',
      downloadUrl: 'https://example.test/Markdown%20Explorer%201.5.3.exe',
      stagedFilePath,
    });

    const manifest = JSON.parse(fs.readFileSync(manager.getManifestPath(), 'utf8'));
    expect(manifest.version).toBe('v1.5.3');
    expect(manifest.stagedFilePath).toBe(stagedFilePath);
    expect(sent.at(-1)).toEqual({
      command: 'updateStateChanged',
      state: {
        status: 'scheduled-on-exit',
        version: 'v1.5.3',
        downloadedVersion: 'v1.5.3',
        downloadedFileName: 'Markdown Explorer 1.5.3.exe',
        progressPercent: 100,
        error: '',
      },
    });
  });

  test('restartAndApplyUpdate launches the helper and clears the pending manifest', async () => {
    const { manager, helperCalls } = createManagerHarness();
    const stagedFilePath = path.join(makeTempDir('update-restart-'), 'Markdown Explorer 1.5.3.exe');
    fs.writeFileSync(stagedFilePath, 'next-version');

    await manager.schedulePendingUpdate({
      version: 'v1.5.3',
      downloadUrl: 'https://example.test/Markdown%20Explorer%201.5.3.exe',
      stagedFilePath,
    });
    await manager.restartAndApplyUpdate();

    expect(helperCalls.length).toBe(1);
    expect(helperCalls[0].targetExePath.endsWith('Markdown Explorer.exe')).toBe(true);
    expect(helperCalls[0].stagedFilePath).toBe(stagedFilePath);
    expect(fs.existsSync(manager.getManifestPath())).toBe(false);
  });

  test('restartAndApplyUpdate throws when no pending manifest', async () => {
    const { manager } = createManagerHarness();
    await expect(manager.restartAndApplyUpdate()).rejects.toThrow('No downloaded');
  });

  test('ensureWindows throws on non-win32 platform', async () => {
    const manager = createUpdateManager({
      platform: 'darwin',
      app: createAppStub(makeTempDir('um-darwin-')),
      fs, path,
      execPath: '/fake',
      relaunchArgs: [],
      sendToWindow: () => {},
      downloadUpdateFile: async () => {},
      launchHelper: async () => {},
    });
    await expect(
      manager.startDownload({ version: 'v1', url: 'http://example.com/update' }),
    ).rejects.toThrow('only supported on Windows');
  });

  test('startDownload emits error state on download failure', async () => {
    const dir = makeTempDir('um-dl-error-');
    const sent: any[] = [];
    const manager = createUpdateManager({
      platform: 'win32',
      app: createAppStub(dir),
      fs, path,
      execPath: path.join(dir, 'Markdown Explorer.exe'),
      relaunchArgs: [],
      sendToWindow(message: any) {
        sent.push(message);
      },
      async downloadUpdateFile() {
        throw new Error('network failure');
      },
      async launchHelper() {},
    });

    await expect(
      manager.startDownload({ version: 'v1.5.3', url: 'https://fail.com/update.exe' }),
    ).rejects.toThrow('network failure');
    expect(sent.at(-1).state.status).toBe('error');
  });

  test('applyPendingUpdateOnQuit launches helper only when a pending manifest exists', async () => {
    const { manager, helperCalls } = createManagerHarness();
    const stagedFilePath = path.join(makeTempDir('update-quit-'), 'Markdown Explorer 1.5.3.exe');
    fs.writeFileSync(stagedFilePath, 'next-version');

    expect(await manager.applyPendingUpdateOnQuit()).toBe(false);

    await manager.schedulePendingUpdate({
      version: 'v1.5.3',
      downloadUrl: 'https://example.test/Markdown%20Explorer%201.5.3.exe',
      stagedFilePath,
    });

    expect(await manager.applyPendingUpdateOnQuit()).toBe(true);
    expect(helperCalls.length).toBe(1);
    expect(fs.existsSync(manager.getManifestPath())).toBe(false);
  });

  test('applyPendingUpdateOnQuit returns false when helper already launched', async () => {
    const { manager } = createManagerHarness();
    const stagedFilePath = path.join(makeTempDir('um-quit-twice-'), 'update.exe');
    fs.writeFileSync(stagedFilePath, 'data');

    await manager.schedulePendingUpdate({
      version: 'v1.5.3',
      downloadUrl: 'https://example.com/update.exe',
      stagedFilePath,
    });
    await manager.applyPendingUpdateOnQuit();
    expect(await manager.applyPendingUpdateOnQuit()).toBe(false);
  });

  test('sendCurrentState restores a failed apply result as an error state', () => {
    const { manager, sent } = createManagerHarness();
    fs.mkdirSync(path.dirname(manager.getResultPath()), { recursive: true });
    fs.writeFileSync(manager.getResultPath(), 'install-failed', 'utf8');

    manager.sendCurrentState();

    expect(sent.at(-1).state.status).toBe('error');
    expect(sent.at(-1).state.error).toBe('install-failed');
    expect(fs.existsSync(manager.getResultPath())).toBe(false);
  });
});

describe('buildScheduledState', () => {
  test('creates scheduled state from manifest', () => {
    const state = buildScheduledState({ version: '1.0', stagedFilePath: '/tmp/update.exe' });
    expect(state.status).toBe('scheduled-on-exit');
    expect(state.version).toBe('1.0');
    expect(state.downloadedVersion).toBe('1.0');
    expect(state.downloadedFileName).toBe('update.exe');
    expect(state.progressPercent).toBe(100);
    expect(state.error).toBe('');
  });
});

describe('getHelperPayload', () => {
  test('creates helper payload with resultPath', () => {
    const payload = getHelperPayload(
      { stagedFilePath: '/tmp/update.exe', targetExePath: '/app/app.exe', workingDirectory: '/app', relaunchArgs: ['--flag'] },
      '/tmp/result.txt',
    );
    expect(payload.stagedFilePath).toBe('/tmp/update.exe');
    expect(payload.targetExePath).toBe('/app/app.exe');
    expect(payload.resultFilePath).toBe('/tmp/result.txt');
    expect(payload.relaunchArgs).toEqual(['--flag']);
  });

  test('defaults relaunchArgs to empty array when not provided', () => {
    const payload = getHelperPayload(
      { stagedFilePath: '/tmp/update.exe', targetExePath: '/app/app.exe', workingDirectory: '/app' } as any,
      '/tmp/result.txt',
    );
    expect(payload.relaunchArgs).toEqual([]);
  });
});

describe('readResultCode', () => {
  test('returns empty string when result file does not exist', () => {
    expect(readResultCode(fs, '/nonexistent/path/result.txt')).toBe('');
  });

  test('returns trimmed content when result file exists', () => {
    const dir = makeTempDir('um-rrc-');
    const f = path.join(dir, 'result.txt');
    fs.writeFileSync(f, '  applied  \n');
    expect(readResultCode(fs, f)).toBe('applied');
  });

  test('returns empty string on read error', () => {
    const dir = makeTempDir('um-rrc-err-');
    const f = path.join(dir, 'result.txt');
    fs.writeFileSync(f, 'content');
    const mockFs = { ...fs, readFileSync: () => { throw new Error('read fail'); }, existsSync: () => true };
    expect(readResultCode(mockFs as any, f)).toBe('');
  });
});

describe('clearResultCode', () => {
  test('deletes result file when it exists', () => {
    const dir = makeTempDir('um-clrc-');
    const f = path.join(dir, 'result.txt');
    fs.writeFileSync(f, 'applied');
    clearResultCode(fs, f);
    expect(fs.existsSync(f)).toBe(false);
  });

  test('does nothing when result file does not exist', () => {
    clearResultCode(fs, '/nonexistent/path/result.txt');
  });
});

describe('readManifest', () => {
  test('returns null when manifest does not exist', () => {
    expect(readManifest(fs, '/nonexistent/path/manifest.json')).toBeNull();
  });

  test('returns parsed manifest when file exists', () => {
    const dir = makeTempDir('um-rm-');
    const f = path.join(dir, 'manifest.json');
    fs.writeFileSync(f, JSON.stringify({ version: '1.0' }));
    expect(readManifest(fs, f)).toEqual({ version: '1.0' });
  });

  test('returns null when manifest is invalid JSON', () => {
    const dir = makeTempDir('um-rm-invalid-');
    const f = path.join(dir, 'manifest.json');
    fs.writeFileSync(f, 'not json');
    expect(readManifest(fs, f)).toBeNull();
  });
});

describe('clearManifest', () => {
  test('deletes manifest file when it exists', () => {
    const dir = makeTempDir('um-clm-');
    const f = path.join(dir, 'manifest.json');
    fs.writeFileSync(f, '{}');
    clearManifest(fs, f);
    expect(fs.existsSync(f)).toBe(false);
  });

  test('does nothing when manifest does not exist', () => {
    clearManifest(fs, '/nonexistent/path/manifest.json');
  });
});

describe('writeManifest', () => {
  test('creates directory and writes manifest', () => {
    const dir = makeTempDir('um-wm-');
    const manifestDir = path.join(dir, 'updates');
    const manifestPath = path.join(manifestDir, 'manifest.json');
    writeManifest(fs, manifestDir, manifestPath, { version: '1.0' });
    expect(fs.existsSync(manifestPath)).toBe(true);
    expect(JSON.parse(fs.readFileSync(manifestPath, 'utf8'))).toEqual({ version: '1.0' });
  });
});

describe('restorePersistedState', () => {
  test('returns empty state when no result or manifest', () => {
    const dir = makeTempDir('um-rps-empty-');
    const manifestPath = path.join(dir, 'manifest.json');
    const resultPath = path.join(dir, 'result.txt');
    const result = restorePersistedState(fs, manifestPath, resultPath);
    expect(result).toEqual(createEmptyState());
  });

  test('returns applied/idle state when result is "applied"', () => {
    const dir = makeTempDir('um-rps-applied-');
    const manifestPath = path.join(dir, 'manifest.json');
    const resultPath = path.join(dir, 'result.txt');
    fs.writeFileSync(resultPath, 'applied');
    const result = restorePersistedState(fs, manifestPath, resultPath);
    expect(result.status).toBe('idle');
    expect(fs.existsSync(resultPath)).toBe(false);
  });

  test('returns error state when result is not "applied"', () => {
    const dir = makeTempDir('um-rps-error-');
    const manifestPath = path.join(dir, 'manifest.json');
    const resultPath = path.join(dir, 'result.txt');
    fs.writeFileSync(resultPath, 'install-failed');
    const result = restorePersistedState(fs, manifestPath, resultPath);
    expect(result.status).toBe('error');
    expect(result.error).toBe('install-failed');
  });

  test('returns error state when manifest exists but staged file is missing', () => {
    const dir = makeTempDir('um-rps-missing-');
    const manifestPath = path.join(dir, 'manifest.json');
    const resultPath = path.join(dir, 'result.txt');
    fs.writeFileSync(manifestPath, JSON.stringify({ version: '1.0', stagedFilePath: '/nonexistent/file.exe', downloadUrl: 'http://example.com' }));
    const result = restorePersistedState(fs, manifestPath, resultPath);
    expect(result.status).toBe('error');
    expect(result.error).toBe('missing-staged-update');
    expect(fs.existsSync(manifestPath)).toBe(false);
  });

  test('returns scheduled state when manifest and staged file exist', () => {
    const dir = makeTempDir('um-rps-scheduled-');
    const manifestPath = path.join(dir, 'manifest.json');
    const resultPath = path.join(dir, 'result.txt');
    const stagedPath = path.join(dir, 'update.exe');
    fs.writeFileSync(stagedPath, 'data');
    fs.writeFileSync(manifestPath, JSON.stringify({ version: '1.0', stagedFilePath: stagedPath, downloadUrl: 'http://example.com' }));
    const result: any = restorePersistedState(fs, manifestPath, resultPath);
    expect(result.state.status).toBe('scheduled-on-exit');
    expect(result.manifest).toBeTruthy();
  });
});

describe('createEmptyState', () => {
  test('creates default idle state', () => {
    const state = createEmptyState();
    expect(state.status).toBe('idle');
    expect(state.version).toBe('');
    expect(state.progressPercent).toBe(0);
    expect(state.error).toBe('');
  });
});

describe('startDownloadState', () => {
  test('creates downloading state', () => {
    const state = startDownloadState('v1', 'app.exe', 50);
    expect(state.status).toBe('downloading');
    expect(state.version).toBe('v1');
    expect(state.progressPercent).toBe(50);
  });
});

describe('downloadedState', () => {
  test('creates downloaded state', () => {
    const state = downloadedState('v1', 'app.exe');
    expect(state.status).toBe('downloaded');
    expect(state.progressPercent).toBe(100);
  });
});

describe('errorState', () => {
  test('creates error state from Error object', () => {
    const state = errorState('v1', 'app.exe', new Error('fail'));
    expect(state.status).toBe('error');
    expect(state.error).toBe('fail');
  });

  test('creates error state from string error', () => {
    const state = errorState('v1', 'app.exe', 'string fail' as any);
    expect(state.status).toBe('error');
    expect(state.error).toBe('download-failed');
  });
});
