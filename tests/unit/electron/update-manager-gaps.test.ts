import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  createUpdateManager,
} from '../../../desktop/update-manager.js';

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

describe('sendCurrentState', () => {
  let rootDir: string;

  beforeEach(() => {
    rootDir = makeTempDir('um-scs-');
  });

  afterEach(() => {
    fs.rmSync(rootDir, { recursive: true, force: true });
  });

  it('emits non-idle current state directly without checking persisted state', async () => {
    const sent: any[] = [];
    const manager = createUpdateManager({
      platform: 'win32',
      app: createAppStub(rootDir),
      fs,
      path,
      execPath: path.join(rootDir, 'Markdown Explorer.exe'),
      relaunchArgs: [],
      sendToWindow(msg: any) { sent.push(msg); },
      downloadUpdateFile: async () => {},
      launchHelper: async () => {},
    });

    await manager.startDownload({ version: 'v2.0', url: 'https://example.test/Setup.exe' });
    sent.length = 0;

    manager.sendCurrentState();

    expect(sent.length).toBe(1);
    expect(sent[0].state.status).toBe('downloaded');
  });

  it('falls through to persisted state when idle', () => {
    const sent: any[] = [];
    const manager = createUpdateManager({
      platform: 'win32',
      app: createAppStub(rootDir),
      fs,
      path,
      execPath: path.join(rootDir, 'Markdown Explorer.exe'),
      relaunchArgs: [],
      sendToWindow(msg: any) { sent.push(msg); },
      downloadUpdateFile: async () => {},
      launchHelper: async () => {},
    });

    fs.mkdirSync(path.dirname(manager.getResultPath()), { recursive: true });
    fs.writeFileSync(manager.getResultPath(), 'install-failed', 'utf8');

    manager.sendCurrentState();

    expect(sent.at(-1).state.status).toBe('error');
    expect(sent.at(-1).state.error).toBe('install-failed');
  });
});

describe('schedulePendingUpdate', () => {
  let rootDir: string;

  beforeEach(() => {
    rootDir = makeTempDir('um-spu-');
  });

  afterEach(() => {
    fs.rmSync(rootDir, { recursive: true, force: true });
  });

  it('uses lastDownloaded fallback when payload fields are missing', async () => {
    const sent: any[] = [];
    const manager = createUpdateManager({
      platform: 'win32',
      app: createAppStub(rootDir),
      fs,
      path,
      execPath: path.join(rootDir, 'Markdown Explorer.exe'),
      relaunchArgs: ['--flag'],
      sendToWindow(msg: any) { sent.push(msg); },
      async downloadUpdateFile({ url, destinationPath, onProgress }: any) {
        fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
        fs.writeFileSync(destinationPath, 'data');
        onProgress({ percent: 100 });
      },
      launchHelper: async () => {},
    });

    await manager.startDownload({ version: 'v1.5.3', url: 'https://example.test/Update.exe' });
    sent.length = 0;

    await manager.schedulePendingUpdate({});

    const manifest = JSON.parse(fs.readFileSync(manager.getManifestPath(), 'utf8'));
    expect(manifest.version).toBe('v1.5.3');
    expect(sent.at(-1).state.status).toBe('scheduled-on-exit');
  });

  it('uses empty string fallbacks when no lastDownloaded and no payload', async () => {
    const sent: any[] = [];
    const manager = createUpdateManager({
      platform: 'win32',
      app: createAppStub(rootDir),
      fs,
      path,
      execPath: path.join(rootDir, 'Markdown Explorer.exe'),
      relaunchArgs: [],
      sendToWindow(msg: any) { sent.push(msg); },
      downloadUpdateFile: async () => {},
      launchHelper: async () => {},
    });

    await manager.schedulePendingUpdate({});

    const manifest = JSON.parse(fs.readFileSync(manager.getManifestPath(), 'utf8'));
    expect(manifest.version).toBe('');
    expect(manifest.downloadUrl).toBe('');
    expect(manifest.stagedFilePath).toBe('');
  });
});

describe('restartAndApplyUpdate with lastDownloaded fallback', () => {
  let rootDir: string;

  beforeEach(() => {
    rootDir = makeTempDir('um-rau-');
  });

  afterEach(() => {
    fs.rmSync(rootDir, { recursive: true, force: true });
  });

  it('auto-schedules from lastDownloaded when no manifest exists', async () => {
    const helperCalls: any[] = [];
    const manager = createUpdateManager({
      platform: 'win32',
      app: createAppStub(rootDir),
      fs,
      path,
      execPath: path.join(rootDir, 'Markdown Explorer.exe'),
      relaunchArgs: ['--flag'],
      sendToWindow() {},
      async downloadUpdateFile({ url, destinationPath, onProgress }: any) {
        fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
        fs.writeFileSync(destinationPath, 'next');
        onProgress({ percent: 100 });
      },
      async launchHelper(payload: any) { helperCalls.push(payload); },
    });

    await manager.startDownload({ version: 'v2.0', url: 'https://example.test/Update.exe' });

    const result = await manager.restartAndApplyUpdate();

    expect(result).toBe(true);
    expect(helperCalls.length).toBe(1);
  });

  it('returns full manifest with relaunchArgs from lastDownloaded path', async () => {
    const helperCalls: any[] = [];
    const manager = createUpdateManager({
      platform: 'win32',
      app: createAppStub(rootDir),
      fs,
      path,
      execPath: path.join(rootDir, 'Markdown Explorer.exe'),
      relaunchArgs: ['--test'],
      sendToWindow() {},
      async downloadUpdateFile({ destinationPath, onProgress }: any) {
        fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
        fs.writeFileSync(destinationPath, 'data');
        onProgress({ percent: 100 });
      },
      async launchHelper(payload: any) { helperCalls.push(payload); },
    });

    await manager.startDownload({ version: 'v3.0', url: 'https://example.test/Update.exe' });
    await manager.restartAndApplyUpdate();

    expect(helperCalls[0].relaunchArgs).toEqual(['--test']);
  });
});

describe('defaultDownloadUpdateFile (via createUpdateManager)', () => {
  let rootDir: string;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    rootDir = makeTempDir('um-dduf-');
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    fs.rmSync(rootDir, { recursive: true, force: true });
    globalThis.fetch = originalFetch;
  });

  it('throws on non-2xx response via startDownload', async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: false,
      status: 404,
      body: null,
    })) as any;

    const sent: any[] = [];
    const manager = createUpdateManager({
      platform: 'win32',
      app: createAppStub(rootDir),
      fs,
      path,
      execPath: path.join(rootDir, 'app.exe'),
      relaunchArgs: [],
      sendToWindow(msg: any) { sent.push(msg); },
      launchHelper: async () => {},
    });

    await expect(
      manager.startDownload({ version: 'v1', url: 'https://fail.com/update.exe' }),
    ).rejects.toThrow('Download failed with status 404');
    expect(sent.at(-1).state.status).toBe('error');
  });

  it('throws when response body is null via startDownload', async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      body: null,
      headers: new Map(),
    })) as any;

    const manager = createUpdateManager({
      platform: 'win32',
      app: createAppStub(rootDir),
      fs,
      path,
      execPath: path.join(rootDir, 'app.exe'),
      relaunchArgs: [],
      sendToWindow() {},
      launchHelper: async () => {},
    });

    await expect(
      manager.startDownload({ version: 'v1', url: 'https://fail.com/update.exe' }),
    ).rejects.toThrow();
  });

  it('downloads file and reports progress via default path', async () => {
    const chunks = [Buffer.from('hello '), Buffer.from('world')];
    const body = (async function* () { for (const c of chunks) yield c; })();
    const headers = new Map([['content-length', '12']]);

    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      body,
      headers,
    })) as any;

    const sent: any[] = [];
    const manager = createUpdateManager({
      platform: 'win32',
      app: createAppStub(rootDir),
      fs,
      path,
      execPath: path.join(rootDir, 'app.exe'),
      relaunchArgs: [],
      sendToWindow(msg: any) { sent.push(msg); },
      launchHelper: async () => {},
    });

    const result = await manager.startDownload({ version: 'v1', url: 'https://example.test/Update.exe' });
    expect(fs.existsSync(result.stagedFilePath)).toBe(true);
    expect(fs.readFileSync(result.stagedFilePath, 'utf8')).toBe('hello world');
    const downloadingMsgs = sent.filter((m: any) => m.state.status === 'downloading');
    expect(downloadingMsgs.length).toBeGreaterThan(0);
    expect(sent.at(-1).state.status).toBe('downloaded');
  });

  it('skips onProgress when content-length is zero', async () => {
    const chunks = [Buffer.from('data')];
    const body = (async function* () { for (const c of chunks) yield c; })();
    const headers = new Map([['content-length', '0']]);

    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      body,
      headers,
    })) as any;

    const sent: any[] = [];
    const manager = createUpdateManager({
      platform: 'win32',
      app: createAppStub(rootDir),
      fs,
      path,
      execPath: path.join(rootDir, 'app.exe'),
      relaunchArgs: [],
      sendToWindow(msg: any) { sent.push(msg); },
      launchHelper: async () => {},
    });

    const result = await manager.startDownload({ version: 'v1', url: 'https://example.test/Update.exe' });
    expect(fs.existsSync(result.stagedFilePath)).toBe(true);
    const downloadingWithProgress = sent.filter((m: any) => m.state.status === 'downloading' && m.state.progressPercent > 0);
    expect(downloadingWithProgress.length).toBe(0);
  });
});

describe('constructor auto-restore paths', () => {
  let rootDir: string;

  beforeEach(() => {
    rootDir = makeTempDir('um-auto-');
  });

  afterEach(() => {
    fs.rmSync(rootDir, { recursive: true, force: true });
  });

  it('restores scheduled state from manifest on creation', () => {
    const app = createAppStub(rootDir);
    const userDataDir = app.getPath('userData');
    fs.mkdirSync(path.join(userDataDir, 'updates'), { recursive: true });
    const staged = path.join(rootDir, 'staged.exe');
    fs.writeFileSync(staged, 'data');
    const manifestPath = path.join(userDataDir, 'updates', 'pending-update.json');
    fs.writeFileSync(manifestPath, JSON.stringify({
      version: 'v2.0',
      stagedFilePath: staged,
      downloadUrl: 'https://example.test/Update.exe',
    }));

    const manager = createUpdateManager({
      platform: 'win32',
      app,
      fs,
      path,
      execPath: path.join(rootDir, 'app.exe'),
      relaunchArgs: [],
      sendToWindow() {},
      downloadUpdateFile: async () => {},
      launchHelper: async () => {},
    });

    expect(manager.getState().status).toBe('scheduled-on-exit');
  });

  it('restores error result code on creation', () => {
    const app = createAppStub(rootDir);
    const userDataDir = app.getPath('userData');
    fs.mkdirSync(path.join(userDataDir, 'updates'), { recursive: true });
    const resultPath = path.join(userDataDir, 'updates', 'last-update-result.txt');
    fs.writeFileSync(resultPath, 'install-failed');

    const manager = createUpdateManager({
      platform: 'win32',
      app,
      fs,
      path,
      execPath: path.join(rootDir, 'app.exe'),
      relaunchArgs: [],
      sendToWindow() {},
      downloadUpdateFile: async () => {},
      launchHelper: async () => {},
    });

    expect(manager.getState().status).toBe('error');
    expect(manager.getState().error).toBe('install-failed');
  });

  it('starts with idle when no persisted data exists', () => {
    const manager = createUpdateManager({
      platform: 'win32',
      app: createAppStub(rootDir),
      fs,
      path,
      execPath: path.join(rootDir, 'app.exe'),
      relaunchArgs: [],
      sendToWindow() {},
      downloadUpdateFile: async () => {},
      launchHelper: async () => {},
    });

    expect(manager.getState().status).toBe('idle');
  });
});
