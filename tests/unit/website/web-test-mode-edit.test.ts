import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  virtualFiles,
  virtualTree,
  getVirtualContent,
  setVirtualContent,
  refreshVirtualWorkspace,
} from '../../../website-app/src/virtual-workspace';
import { handleWebTestMessage } from '../../../website-app/src/web-test-message-router';

describe('Web Demo Test Mode - Edit and documentWrite support', () => {
  beforeEach(() => {
    refreshVirtualWorkspace();
  });

  it('updates virtualContent and re-scans tree and files when setVirtualContent is called', () => {
    const testFile = virtualFiles[0]?.relativePath ?? 'test-sample.md';
    const modifiedText = '# Modified Virtual Document\n\nNew test content.';

    setVirtualContent(testFile, modifiedText);

    expect(getVirtualContent(testFile)).toBe(modifiedText);
    const updatedFile = virtualFiles.find((f) => f.relativePath === testFile);
    expect(updatedFile).toBeDefined();
    expect(updatedFile?.title).toBe('Modified Virtual Document');
  });

  it('preserves user modifications during refreshVirtualWorkspace', () => {
    const testFile = virtualFiles[0]?.relativePath ?? 'test-sample.md';
    const modifiedText = '# Preserved Modification\n\nContent persists.';

    setVirtualContent(testFile, modifiedText);
    refreshVirtualWorkspace();

    expect(getVirtualContent(testFile)).toBe(modifiedText);
  });

  it('handles saveDocument message and acknowledges saveDocumentResult', async () => {
    const sentMessages: any[] = [];
    let refreshed = false;
    let currentFile = virtualFiles[0]?.relativePath ?? 'test-sample.md';

    const deps = {
      getReadyHandled: () => true,
      setReadyHandled: vi.fn(),
      setCurrentFile: (path: string | null) => { currentFile = path ?? ''; },
      getCurrentFile: () => currentFile,
      getFlatList: () => virtualFiles,
      send: (msg: unknown) => { sentMessages.push(msg); },
      sendTestReady: vi.fn(async () => {}),
      sendTestContent: vi.fn(async () => {}),
      refreshTestWorkspace: vi.fn(async () => { refreshed = true; }),
    };

    const targetPath = currentFile;
    const saveSource = '# Saved via saveDocument message';

    await handleWebTestMessage(
      {
        command: 'saveDocument',
        requestId: 'req-save-123',
        filePath: targetPath,
        source: saveSource,
      },
      deps
    );

    expect(refreshed).toBe(true);
    expect(getVirtualContent(targetPath)).toBe(saveSource);

    const saveResult = sentMessages.find((m) => m.command === 'saveDocumentResult');
    expect(saveResult).toEqual({
      command: 'saveDocumentResult',
      requestId: 'req-save-123',
      filePath: targetPath,
      ok: true,
      revision: String(saveSource.length),
    });
  });

  it('handles activateWorkspace command by updating currentFile and sending test ready', async () => {
    let currentFile: string | null = null;
    let testReadySent = false;

    const deps = {
      getReadyHandled: () => true,
      setReadyHandled: vi.fn(),
      setCurrentFile: (path: string | null) => { currentFile = path; },
      getCurrentFile: () => currentFile,
      getFlatList: () => virtualFiles,
      send: vi.fn(),
      sendTestReady: vi.fn(async () => { testReadySent = true; }),
      sendTestContent: vi.fn(async () => {}),
      refreshTestWorkspace: vi.fn(async () => {}),
    };

    await handleWebTestMessage(
      {
        command: 'activateWorkspace',
        filePath: 'custom-file.md',
      },
      deps
    );

    expect(currentFile).toBe('custom-file.md');
    expect(testReadySent).toBe(true);
  });

  it('sendTestReady sends readyAck containing appVersion without demo marker and appRuntime web', async () => {
    const sentMessages: any[] = [];
    const testState = {
      flatList: virtualFiles,
      workspaceTree: virtualTree,
      currentFile: null,
    };
    const { version } = await import('../../../website-app/package.json');
    const { createTestModeHandlers } = await import('../../../website-app/src/web-test-host');
    const handlers = createTestModeHandlers({
      send: (msg) => sentMessages.push(msg),
      state: testState,
      hostInfo: () => ({ appVersion: version, appRuntime: 'web', hostPlatform: 'unknown', hostArch: 'unknown' }),
      findFileInfo: (list, rel) => ({ relativePath: rel, title: rel }),
    });

    await handlers.sendTestReady();
    const readyAck = sentMessages.find((m) => m.command === 'readyAck');
    expect(readyAck).toBeDefined();
    expect(readyAck.appVersion).toBe(version);
    expect(readyAck.appRuntime).toBe('web');
  });
});
