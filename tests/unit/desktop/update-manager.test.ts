import { describe, expect, test } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { createUpdateManager, getUpdateAssetFileName } from '../../../desktop/update-manager.js';

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
