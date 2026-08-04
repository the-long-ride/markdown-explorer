import { describe, expect, test, vi, beforeEach } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  createDesktopRuntime,
  isSupportedFilePathLite,
  isExtraDocumentFilePathLite,
  getFileTypeLabelLite,
  getOpenDialogFiltersLite,
  stripKnownExtensionLite,
  isAccessDeniedError,
  clampZoomLevel,
  normalizeZoomStep,
  stripNavigationFragment,
  decodeNavigationPath,
  isRootRelativeWorkspaceHref,
  isSameOrInsidePath,
} = require('../../../electron/core/main-runtime.js');
const {
  WORKSPACE_SCAN_BATCH_SIZE,
  WORKSPACE_SCAN_REVEAL_DELAY_MS,
} = require('../../../electron/core/runtime-workspace-handlers.js');

function createMockDeps(overrides: Record<string, any> = {}) {
  const sentMessages: any[] = [];

  const mockWindow = {
    webContents: {
      send: vi.fn(),
      getZoomLevel: vi.fn(() => 0),
      setZoomLevel: vi.fn(),
    },
    isDestroyed: vi.fn(() => false),
    isMaximized: vi.fn(() => false),
  };

  const mockSearchIndex = {
    prime: vi.fn(),
    search: vi.fn(() => []),
  };

  const mockSearchWorker = {
    search: vi.fn(),
    setItems: vi.fn(),
    dispose: vi.fn(),
  };

  const mockWorkspaceWatch = {
    watchWorkspace: vi.fn(),
    dispose: vi.fn(),
  };

  const mockDocumentConverter = {
    readMarkdown: vi.fn(() => Promise.resolve({ markdown: '# content', previewInfo: null })),
    createFailureMarkdown: vi.fn(() => '# error'),
  };

  const mockUpdateManager = {
    sendCurrentState: vi.fn(),
    startDownload: vi.fn(() => Promise.resolve()),
    schedulePendingUpdate: vi.fn(() => Promise.resolve()),
    restartAndApplyUpdate: vi.fn(() => Promise.resolve()),
  };

  const mockRecentWorkspacesStore = {
    load: vi.fn(() => []),
    save: vi.fn(),
    remove: vi.fn(),
    replace: vi.fn(),
  };

  const pathApi = require('path');

  const deps = {
    path: pathApi,
    fs: {
      accessSync: vi.fn(),
      statSync: vi.fn(() => ({ isFile: () => false })),
      existsSync: vi.fn(() => true),
      constants: { R_OK: 4 },
    },
    dialog: {
      showOpenDialogSync: vi.fn(() => null),
      showMessageBoxSync: vi.fn(() => 0),
      showMessageBox: vi.fn(() => Promise.resolve({ response: 0 })),
    },
    getMainWindow: vi.fn(() => mockWindow),
    sendHostMessage: vi.fn((msg) => sentMessages.push(msg)),
    getHostInfo: vi.fn(() => ({
      appVersion: '1.5.5',
      appRuntime: 'desktop',
      hostPlatform: 'windows',
      hostArch: 'x64',
      isMaximized: false,
    })),
    sendLoading: vi.fn(),
    sendRecentWorkspacesChanged: vi.fn(),
    recentWorkspacesStore: mockRecentWorkspacesStore,
    createStartupReadyAck: vi.fn((opts) => ({
      command: 'readyAck',
      fileList: [],
      tree: null,
      theme: 'dark',
      themeStyle: 'default',
      defaultExpanded: true,
      workspaceName: opts.workspacePath ? pathApi.basename(opts.workspacePath) : '',
      workspacePath: opts.workspacePath || undefined,
      recentWorkspaces: opts.recentWorkspaces,
      documentConversionEnabled: opts.documentConversionEnabled,
      ...opts.hostInfo,
    })),
    deferWorkspaceLoad: vi.fn(),
    ensureHeavyModules: vi.fn(),
    scanWorkspaceData: vi.fn(() => Promise.resolve({ tree: null, flat: [] })),
    createSearchIndex: vi.fn(() => mockSearchIndex),
    createSearchWorkerController: vi.fn(() => mockSearchWorker),
    createWorkspaceWatchController: vi.fn(() => mockWorkspaceWatch),
    documentConverter: mockDocumentConverter,
    perf: {
      mark: vi.fn(),
      measure: vi.fn(),
      printSummary: vi.fn(),
    },
    updateManager: mockUpdateManager,
    DesktopScanner: {},
    isWatchChangeRelevant: vi.fn(() => true),
    shouldNotifyCurrentFileChanged: vi.fn(() => false),
    appQuit: vi.fn(),
    ...overrides,
  };

  return { deps, sentMessages, mockWindow, mockSearchIndex, mockSearchWorker, mockWorkspaceWatch, mockDocumentConverter, mockUpdateManager, mockRecentWorkspacesStore };
}

describe('pure helpers', () => {
  test('isSupportedFilePathLite recognizes markdown extensions', () => {
    expect(isSupportedFilePathLite('readme.md', false)).toBe(true);
    expect(isSupportedFilePathLite('doc.mdx', false)).toBe(true);
    expect(isSupportedFilePathLite('notes.markdown', false)).toBe(true);
    expect(isSupportedFilePathLite('data.txt', false)).toBe(true);
  });

  test('isSupportedFilePathLite rejects non-markdown when docConv disabled', () => {
    expect(isSupportedFilePathLite('file.docx', false)).toBe(false);
    expect(isSupportedFilePathLite('file.pdf', false)).toBe(false);
  });

  test('isSupportedFilePathLite recognizes doc extensions when enabled', () => {
    expect(isSupportedFilePathLite('file.docx', true)).toBe(true);
    expect(isSupportedFilePathLite('file.pdf', true)).toBe(true);
    expect(isSupportedFilePathLite('file.xls', true)).toBe(true);
  });

  test('isSupportedFilePathLite returns false for empty/null', () => {
    expect(isSupportedFilePathLite('', false)).toBe(false);
    expect(isSupportedFilePathLite(null as any, false)).toBe(false);
    expect(isSupportedFilePathLite(undefined as any, false)).toBe(false);
  });

  test('isExtraDocumentFilePathLite identifies doc types', () => {
    expect(isExtraDocumentFilePathLite('file.docx')).toBe(true);
    expect(isExtraDocumentFilePathLite('file.pdf')).toBe(true);
    expect(isExtraDocumentFilePathLite('readme.md')).toBe(false);
    expect(isExtraDocumentFilePathLite('notes.txt')).toBe(false);
  });

  test('getFileTypeLabelLite returns correct labels', () => {
    expect(getFileTypeLabelLite('file.docx')).toBe('Word');
    expect(getFileTypeLabelLite('file.pdf')).toBe('PDF');
    expect(getFileTypeLabelLite('file.xlsx')).toBe('Excel');
    expect(getFileTypeLabelLite('file.pptx')).toBe('PowerPoint');
    expect(getFileTypeLabelLite('file.xyz')).toBe('XYZ');
  });

  test('getOpenDialogFiltersLite without doc conversion', () => {
    const filters = getOpenDialogFiltersLite(false);
    expect(filters).toHaveLength(1);
    expect(filters[0].name).toBe('Markdown');
  });

  test('getOpenDialogFiltersLite with doc conversion', () => {
    const filters = getOpenDialogFiltersLite(true);
    expect(filters).toHaveLength(3);
    expect(filters[0].name).toBe('Markdown');
    expect(filters[1].name).toBe('Documents');
    expect(filters[2].name).toBe('All Files');
  });

  test('stripKnownExtensionLite removes known extensions', () => {
    expect(stripKnownExtensionLite('readme.md')).toBe('readme');
    expect(stripKnownExtensionLite('file.docx')).toBe('file');
    expect(stripKnownExtensionLite('file.unknown')).toBe('file.unknown');
  });

  test('isAccessDeniedError detects EACCES and EPERM', () => {
    expect(isAccessDeniedError({ code: 'EACCES' })).toBe(true);
    expect(isAccessDeniedError({ code: 'EPERM' })).toBe(true);
    expect(isAccessDeniedError({ code: 'ENOENT' })).toBe(false);
    expect(isAccessDeniedError(null)).toBeFalsy();
  });

  test('clampZoomLevel clamps within min/max', () => {
    expect(clampZoomLevel(0, -2.5, 2)).toBe(0);
    expect(clampZoomLevel(3, -2.5, 2)).toBe(2);
    expect(clampZoomLevel(-3, -2.5, 2)).toBe(-2.5);
  });

  test('normalizeZoomStep rounds to nearest step', () => {
    expect(normalizeZoomStep(0.4, 0.2)).toBeCloseTo(0.4);
    expect(normalizeZoomStep(0, 0.2)).toBe(0);
    expect(normalizeZoomStep(0.6, 0.2)).toBeCloseTo(0.6);
  });

  test('stripNavigationFragment strips hash fragment', () => {
    expect(stripNavigationFragment('path/to/file.md#section')).toBe('path/to/file.md');
    expect(stripNavigationFragment('path/to/file.md')).toBe('path/to/file.md');
  });

  test('decodeNavigationPath decodes URI components', () => {
    expect(decodeNavigationPath('path%20to%20file')).toBe('path to file');
  });

  test('decodeNavigationPath returns original on decode failure', () => {
    expect(decodeNavigationPath('%E0%A4%A')).toBe('%E0%A4%A');
  });

  test('isRootRelativeWorkspaceHref identifies root-relative hrefs', () => {
    expect(isRootRelativeWorkspaceHref('/docs/readme.md')).toBe(true);
    expect(isRootRelativeWorkspaceHref('//example.com')).toBe(false);
    expect(isRootRelativeWorkspaceHref('https://example.com')).toBe(false);
    expect(isRootRelativeWorkspaceHref('relative/path')).toBe(false);
    expect(isRootRelativeWorkspaceHref('C:/path')).toBe(false);
  });

  test('isSameOrInsidePath detects containment', () => {
    const pathApi = require('path');
    expect(isSameOrInsidePath('/parent', '/parent', pathApi)).toBe(true);
    expect(isSameOrInsidePath('/parent', '/parent/child', pathApi)).toBe(true);
    expect(isSameOrInsidePath('/parent', '/other', pathApi)).toBe(false);
  });
});

describe('createDesktopRuntime', () => {
  let ctx: ReturnType<typeof createMockDeps>;
  let runtime: ReturnType<typeof createDesktopRuntime>;

  beforeEach(() => {
    ctx = createMockDeps();
    runtime = createDesktopRuntime(ctx.deps);
  });

  function setWorkspaceActive(wsPath: string, flat: any[] = []) {
    ctx.deps.fs.accessSync.mockImplementation(() => {});
    ctx.deps.fs.statSync.mockImplementation((p: string) => {
      if (p === wsPath) return { isFile: () => false };
      return { isFile: () => false };
    });
    ctx.deps.scanWorkspaceData.mockResolvedValue({ tree: null, flat });
    runtime.state.workspacePath = wsPath;
    runtime.state.flatList = flat;
  }

  test('uses the shared 3-second reveal and 32-file refresh batch', () => {
    expect(WORKSPACE_SCAN_REVEAL_DELAY_MS).toBe(3000);
    expect(WORKSPACE_SCAN_BATCH_SIZE).toBe(32);
  });

  describe('handleReady', () => {
    test('sends readyAck on first call', async () => {
      await runtime.handleReady({ documentConversionEnabled: true });
      expect(ctx.deps.createStartupReadyAck).toHaveBeenCalled();
      expect(ctx.deps.sendHostMessage).toHaveBeenCalled();
      const msg = ctx.sentMessages.find((m: any) => m.command === 'readyAck');
      expect(msg).toBeDefined();
    });

    test('ignores second call (idempotent)', async () => {
      await runtime.handleReady({});
      ctx.sentMessages.length = 0;
      await runtime.handleReady({});
      expect(ctx.sentMessages.length).toBe(0);
    });

    test('sets documentConversionEnabled from message', async () => {
      await runtime.handleReady({ documentConversionEnabled: true });
      expect(runtime.state.documentConversionEnabled).toBe(true);
    });

    test('does not override documentConversionEnabled when message omits it', async () => {
      await runtime.handleReady({});
      expect(runtime.state.documentConversionEnabled).toBe(false);
    });

    test('defers workspace load when workspace is active', async () => {
      runtime.state.workspacePath = '/some/path';
      await runtime.handleReady({});
      expect(ctx.deps.deferWorkspaceLoad).toHaveBeenCalled();
    });

    test('does not defer workspace load when no workspace', async () => {
      await runtime.handleReady({});
      expect(ctx.deps.deferWorkspaceLoad).not.toHaveBeenCalled();
    });
  });

  describe('handleOpenFolder', () => {
    test('opens folder and sets workspace', () => {
      ctx.deps.dialog.showOpenDialogSync.mockReturnValue(['/my/project']);
      runtime.handleOpenFolder(true);
      expect(runtime.state.workspacePath).toBe('/my/project');
      expect(runtime.state.currentFile).toBeNull();
      expect(ctx.deps.recentWorkspacesStore.save).toHaveBeenCalledWith('/my/project');
      expect(ctx.deps.sendRecentWorkspacesChanged).toHaveBeenCalled();
      expect(ctx.deps.sendLoading).toHaveBeenCalledWith('Loading workspace...', undefined, {});
    });

    test('reports a tab-scoped cancellation and clears stale operation state when dialog is cancelled', () => {
      ctx.deps.dialog.showOpenDialogSync.mockReturnValue(null);
      runtime.handleOpenFolder(false, {
        workspaceOperationId: 'operation-1',
        workspaceTabId: 'tab-1',
      });

      expect(runtime.state.workspacePath).toBeNull();
      expect(runtime.state.workspaceOperationId).toBeNull();
      expect(runtime.state.workspaceTabId).toBeNull();
      expect(ctx.sentMessages).toContainEqual({
        command: 'workspaceOpenCancelled',
        workspaceOperationId: 'operation-1',
        workspaceTabId: 'tab-1',
      });
    });

    test('reports cancellation when dialog returns an empty array', () => {
      ctx.deps.dialog.showOpenDialogSync.mockReturnValue([]);
      runtime.handleOpenFolder(false, {
        workspaceOperationId: 'operation-2',
        workspaceTabId: 'tab-2',
      });

      expect(runtime.state.workspacePath).toBeNull();
      expect(ctx.sentMessages).toContainEqual({
        command: 'workspaceOpenCancelled',
        workspaceOperationId: 'operation-2',
        workspaceTabId: 'tab-2',
      });
    });

    test('replaces the missing recent workspace only after a new folder is selected', () => {
      ctx.deps.dialog.showOpenDialogSync.mockReturnValue(['/replacement/project']);
      runtime.handleOpenFolder(true, {
        workspaceOperationId: 'operation-3',
        workspaceTabId: 'tab-3',
        replaceRecentWorkspacePath: '/missing/project',
      });

      expect(ctx.deps.recentWorkspacesStore.remove).toHaveBeenCalledWith('/missing/project');
      expect(ctx.deps.recentWorkspacesStore.save).toHaveBeenCalledWith('/replacement/project');
      expect(runtime.state.workspacePath).toBe('/replacement/project');
    });

    test('keeps the missing recent workspace when replacement selection is cancelled', () => {
      ctx.deps.dialog.showOpenDialogSync.mockReturnValue(null);
      runtime.handleOpenFolder(true, {
        workspaceOperationId: 'operation-4',
        workspaceTabId: 'tab-4',
        replaceRecentWorkspacePath: '/missing/project',
      });

      expect(ctx.deps.recentWorkspacesStore.remove).not.toHaveBeenCalled();
      expect(ctx.deps.recentWorkspacesStore.save).not.toHaveBeenCalled();
    });

    test('keeps loading with no files, then reveals discovered files and refreshes at 32', async () => {
      vi.useFakeTimers();
      try {
        ctx.deps.dialog.showOpenDialogSync.mockReturnValue(['/my/project']);
        let resolveScan!: (value: { tree: null; flat: any[] }) => void;
        let onFile!: (file: any, count: number) => void;
        ctx.deps.scanWorkspaceData.mockImplementation((_path: string, options: any) => {
          onFile = options.onFile;
          return new Promise(resolve => { resolveScan = resolve; });
        });

        runtime.handleOpenFolder();
        await vi.advanceTimersByTimeAsync(WORKSPACE_SCAN_REVEAL_DELAY_MS);
        expect(ctx.sentMessages.some((message: any) => message.command === 'readyAck')).toBe(false);

        const files = Array.from({ length: WORKSPACE_SCAN_BATCH_SIZE }, (_, index) => ({
          fsPath: `/my/project/f${index}.md`, relativePath: `f${index}.md`,
          parts: [`f${index}.md`], fileName: `f${index}.md`, title: `File ${index}`,
          extension: '.md', documentKind: 'markdown',
        }));
        onFile(files[0], 1);
        expect(ctx.sentMessages.find((message: any) => message.command === 'readyAck')?.fileList).toHaveLength(1);

        for (let index = 1; index < files.length; index += 1) onFile(files[index], index + 1);
        const refreshes = ctx.sentMessages.filter((message: any) => message.command === 'workspaceFilesChanged');
        expect(refreshes.at(-1)?.fileList).toHaveLength(WORKSPACE_SCAN_BATCH_SIZE);

        resolveScan({ tree: null, flat: files });
        await Promise.resolve();
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('handleOpenFile', () => {
    test('opens file and sets workspace to parent folder', () => {
      ctx.deps.dialog.showOpenDialogSync.mockReturnValue(['/my/project/readme.md']);
      runtime.handleOpenFile();
      expect(runtime.state.workspacePath).toContain('project');
      expect(runtime.state.currentFile).toBe('/my/project/readme.md');
      expect(ctx.deps.recentWorkspacesStore.save).toHaveBeenCalled();
      expect(ctx.deps.sendRecentWorkspacesChanged).toHaveBeenCalled();
    });

    test('shows preparing document message for extra doc types', () => {
      ctx.deps.dialog.showOpenDialogSync.mockReturnValue(['/my/project/report.docx']);
      runtime.handleOpenFile();
      expect(ctx.deps.sendLoading).toHaveBeenCalledWith('Preparing document preview...', undefined, {});
    });

    test('shows loading docs message for markdown files', () => {
      ctx.deps.dialog.showOpenDialogSync.mockReturnValue(['/my/project/readme.md']);
      runtime.handleOpenFile();
      expect(ctx.deps.sendLoading).toHaveBeenCalledWith('Loading docs...', undefined, {});
    });

    test('does nothing when dialog cancelled', () => {
      ctx.deps.dialog.showOpenDialogSync.mockReturnValue(null);
      runtime.handleOpenFile();
      expect(runtime.state.currentFile).toBeNull();
    });
  });

  describe('handleOpenPath', () => {
    test('opens directory path', () => {
      ctx.deps.fs.accessSync.mockImplementation(() => {});
      ctx.deps.fs.statSync.mockReturnValue({ isFile: () => false });
      runtime.handleOpenPath('/my/project', true);
      expect(runtime.state.workspacePath).toBe('/my/project');
      expect(runtime.state.currentFile).toBeNull();
      expect(ctx.deps.recentWorkspacesStore.save).toHaveBeenCalledWith('/my/project');
    });

    test('opens supported file path', () => {
      ctx.deps.fs.accessSync.mockImplementation(() => {});
      ctx.deps.fs.statSync.mockReturnValue({ isFile: () => true });
      runtime.handleOpenPath('/my/project/readme.md', false);
      expect(runtime.state.workspacePath).toContain('project');
      expect(runtime.state.currentFile).toBe('/my/project/readme.md');
    });

    test('shows warning for unsupported file type when doc conv enabled', () => {
      ctx.deps.fs.accessSync.mockImplementation(() => {});
      ctx.deps.fs.statSync.mockReturnValue({ isFile: () => true });
      runtime.handleOpenPath('/my/project/image.png', false);
      expect(ctx.deps.dialog.showMessageBoxSync).toHaveBeenCalled();
    });

    test('sends workspace unavailable when path missing', () => {
      ctx.deps.fs.accessSync.mockImplementation(() => { throw new Error('ENOENT'); });
      runtime.handleOpenPath('/missing/path');
      const unavailable = ctx.sentMessages.find((m: any) => m.command === 'workspaceUnavailable');
      expect(unavailable).toBeDefined();
    });

    test('sends locked reason for EACCES error', () => {
      const err: any = new Error('EACCES');
      err.code = 'EACCES';
      ctx.deps.fs.accessSync.mockImplementation(() => { throw err; });
      runtime.handleOpenPath('/locked/path');
      const unavailable = ctx.sentMessages.find((m: any) => m.command === 'workspaceUnavailable');
      expect(unavailable.reason).toBe('locked');
    });
  });

  describe('handleActivateWorkspace', () => {
    test('activates existing workspace', () => {
      ctx.deps.fs.accessSync.mockImplementation(() => {});
      ctx.deps.fs.statSync.mockReturnValue({ isFile: () => false });
      ctx.deps.fs.existsSync.mockReturnValue(true);
      runtime.handleActivateWorkspace('/my/project', '/my/project/readme.md', true);
      expect(runtime.state.workspacePath).toBe('/my/project');
      expect(ctx.deps.deferWorkspaceLoad).toHaveBeenCalled();
    });

    test('sends unavailable when path missing', () => {
      ctx.deps.fs.accessSync.mockImplementation(() => { throw new Error('ENOENT'); });
      runtime.handleActivateWorkspace('/missing');
      const unavailable = ctx.sentMessages.find((m: any) => m.command === 'workspaceUnavailable');
      expect(unavailable).toBeDefined();
    });

    test('sets currentFile to null when file not supported', () => {
      ctx.deps.fs.accessSync.mockImplementation(() => {});
      ctx.deps.fs.statSync.mockReturnValue({ isFile: () => false });
      ctx.deps.fs.existsSync.mockReturnValue(true);
      runtime.handleActivateWorkspace('/my/project', '/my/project/image.png', false);
      expect(runtime.state.currentFile).toBeNull();
    });

    test('sets currentFile when file is supported', () => {
      ctx.deps.fs.accessSync.mockImplementation(() => {});
      ctx.deps.fs.statSync.mockReturnValue({ isFile: () => false });
      ctx.deps.fs.existsSync.mockReturnValue(true);
      runtime.handleActivateWorkspace('/my/project', '/my/project/readme.md', false);
      expect(runtime.state.currentFile).toBe('/my/project/readme.md');
    });
  });

  describe('handleSearchAcrossWorkspaces', () => {
    test('delegates to search worker', () => {
      runtime.handleSearchAcrossWorkspaces({ requestId: 'r1', query: 'test' });
      expect(ctx.mockSearchWorker.search).toHaveBeenCalledWith(
        expect.objectContaining({ requestId: 'r1', query: 'test' }),
      );
    });

    test('trims query and passes matchCase', () => {
      runtime.handleSearchAcrossWorkspaces({ requestId: 'r1', query: '  TEST  ' });
      expect(ctx.mockSearchWorker.search).toHaveBeenCalledWith(
        expect.objectContaining({ query: 'TEST', matchCase: false }),
      );
    });

    test('handles missing query gracefully', () => {
      runtime.handleSearchAcrossWorkspaces({ requestId: 'r1' });
      expect(ctx.mockSearchWorker.search).toHaveBeenCalledWith(
        expect.objectContaining({ query: '' }),
      );
    });
  });

  describe('handleSearchWorkspace', () => {
    test('sends workspace search results', () => {
      ctx.mockSearchIndex.search.mockReturnValue([{ fsPath: '/file.md', score: 1 }]);
      runtime.handleSearchWorkspace({ requestId: 'r1', query: 'test', items: [] });
      const msg = ctx.sentMessages.find((m: any) => m.command === 'workspaceSearchResults');
      expect(msg).toBeDefined();
      expect(msg.requestId).toBe('r1');
    });

    test('keeps an explicit empty items scope empty', () => {
      runtime.state.flatList = [{ fsPath: '/a.md' }];
      ctx.mockSearchIndex.search.mockReturnValue([]);
      runtime.handleSearchWorkspace({ requestId: 'r1', query: 'test', items: [] });
      expect(ctx.mockSearchIndex.search).toHaveBeenCalledWith('test', [], 10000, { matchCase: false });
    });

    test('uses flatList when items are omitted', () => {
      runtime.state.flatList = [{ fsPath: '/a.md' }];
      ctx.mockSearchIndex.search.mockReturnValue([]);
      runtime.handleSearchWorkspace({ requestId: 'r1', query: 'test' });
      expect(ctx.mockSearchIndex.search).toHaveBeenCalledWith('test', [{ fsPath: '/a.md' }], 10000, { matchCase: false });
    });

    test('uses provided items when non-empty', () => {
      const items = [{ fsPath: '/b.md' }];
      ctx.mockSearchIndex.search.mockReturnValue([]);
      runtime.handleSearchWorkspace({ requestId: 'r1', query: 'test', items });
      expect(ctx.mockSearchIndex.search).toHaveBeenCalledWith('test', items, 10000, { matchCase: false });
    });
  });

  describe('handleIndexWorkspaceSearchItems', () => {
    test('delegates to search worker setItems', () => {
      runtime.handleIndexWorkspaceSearchItems({ items: [{ fsPath: '/a.md' }] });
      expect(ctx.mockSearchWorker.setItems).toHaveBeenCalledWith([{ fsPath: '/a.md' }]);
    });

    test('normalizes bad items to empty array', () => {
      runtime.handleIndexWorkspaceSearchItems({ items: null });
      expect(ctx.mockSearchWorker.setItems).toHaveBeenCalledWith([]);
    });
  });

  describe('handleLoadWorkspaceSearchIndexes', () => {
    test('does nothing when tabs empty', () => {
      runtime.handleLoadWorkspaceSearchIndexes({ tabs: [] });
      expect(ctx.deps.scanWorkspaceData).not.toHaveBeenCalled();
    });

    test('does nothing when tabs missing', () => {
      runtime.handleLoadWorkspaceSearchIndexes({});
      expect(ctx.deps.scanWorkspaceData).not.toHaveBeenCalled();
    });
  });

  describe('handleConfirmOpenPath', () => {
    test('returns early when file does not exist', async () => {
      ctx.deps.fs.existsSync.mockReturnValue(false);
      await runtime.handleConfirmOpenPath('/nonexistent');
      expect(ctx.deps.dialog.showMessageBox).not.toHaveBeenCalled();
    });

    test('delegates to handleOpenPath when no active workspace', async () => {
      ctx.deps.fs.existsSync.mockReturnValue(true);
      ctx.deps.fs.statSync.mockReturnValue({ isFile: () => true });
      ctx.deps.fs.accessSync.mockImplementation(() => {});
      await runtime.handleConfirmOpenPath('/my/project/readme.md');
      expect(runtime.state.workspacePath).toContain('project');
    });

    test('shows unsupported warning for unsupported file type', async () => {
      runtime.state.workspacePath = '/current';
      ctx.deps.fs.existsSync.mockReturnValue(true);
      ctx.deps.fs.statSync.mockReturnValue({ isFile: () => true });
      await runtime.handleConfirmOpenPath('/my/project/image.png');
      expect(ctx.deps.dialog.showMessageBoxSync).toHaveBeenCalled();
    });

    test('shows switch dialog for supported file', async () => {
      runtime.state.workspacePath = '/current';
      ctx.deps.fs.existsSync.mockReturnValue(true);
      ctx.deps.fs.statSync.mockReturnValue({ isFile: () => true });
      await runtime.handleConfirmOpenPath('/my/project/readme.md');
      expect(ctx.deps.dialog.showMessageBox).toHaveBeenCalled();
    });

    test('does not switch when user cancels', async () => {
      runtime.state.workspacePath = '/current';
      ctx.deps.fs.existsSync.mockReturnValue(true);
      ctx.deps.fs.statSync.mockReturnValue({ isFile: () => true });
      ctx.deps.dialog.showMessageBox.mockResolvedValue({ response: 1 });
      await runtime.handleConfirmOpenPath('/my/project/readme.md');
      expect(runtime.state.workspacePath).toBe('/current');
    });
  });

  describe('handleOpenRecent', () => {
    test('opens recent folder', () => {
      ctx.deps.fs.accessSync.mockImplementation(() => {});
      ctx.deps.fs.statSync.mockReturnValue({ isFile: () => false });
      runtime.handleOpenRecent('/recent/project', true);
      expect(runtime.state.workspacePath).toBe('/recent/project');
      expect(runtime.state.currentFile).toBeNull();
    });

    test('sends unavailable when folder missing', () => {
      ctx.deps.fs.accessSync.mockImplementation(() => { throw new Error('ENOENT'); });
      runtime.handleOpenRecent('/missing');
      const unavailable = ctx.sentMessages.find((m: any) => m.command === 'workspaceUnavailable');
      expect(unavailable).toBeDefined();
    });

    test('sets currentFile when recent path is a file', () => {
      ctx.deps.fs.accessSync.mockImplementation(() => {});
      ctx.deps.fs.statSync.mockReturnValue({ isFile: () => true });
      runtime.handleOpenRecent('/recent/file.md', false);
      expect(runtime.state.currentFile).toBe('/recent/file.md');
    });
  });

  describe('handleDeleteRecentWorkspace', () => {
    test('removes from recent workspaces store', () => {
      runtime.handleDeleteRecentWorkspace('/old/project');
      expect(ctx.deps.recentWorkspacesStore.remove).toHaveBeenCalledWith('/old/project');
      expect(ctx.deps.sendRecentWorkspacesChanged).toHaveBeenCalled();
    });

    test('still sends changed notification on remove error', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      ctx.deps.recentWorkspacesStore.remove.mockImplementation(() => { throw new Error('fail'); });
      runtime.handleDeleteRecentWorkspace('/old/project');
      expect(ctx.deps.sendRecentWorkspacesChanged).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('handleReplaceRecentWorkspaces', () => {
    test('replaces recent workspaces', () => {
      const workspaces = [{ name: 'A', path: '/a' }];
      runtime.handleReplaceRecentWorkspaces(workspaces);
      expect(ctx.deps.recentWorkspacesStore.replace).toHaveBeenCalledWith(workspaces);
      expect(ctx.deps.sendRecentWorkspacesChanged).toHaveBeenCalled();
    });

    test('still sends changed notification on replace error', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      ctx.deps.recentWorkspacesStore.replace.mockImplementation(() => { throw new Error('fail'); });
      runtime.handleReplaceRecentWorkspaces([]);
      expect(ctx.deps.sendRecentWorkspacesChanged).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('handleZoomIn', () => {
    test('increases zoom level', () => {
      ctx.mockWindow.webContents.getZoomLevel.mockReturnValue(0);
      runtime.handleZoomIn();
      expect(ctx.mockWindow.webContents.setZoomLevel).toHaveBeenCalled();
    });

    test('does nothing when no main window', () => {
      ctx.deps.getMainWindow.mockReturnValue(null);
      runtime.handleZoomIn();
      expect(ctx.mockWindow.webContents.setZoomLevel).not.toHaveBeenCalled();
    });
  });

  describe('handleZoomOut', () => {
    test('decreases zoom level', () => {
      ctx.mockWindow.webContents.getZoomLevel.mockReturnValue(0);
      runtime.handleZoomOut();
      expect(ctx.mockWindow.webContents.setZoomLevel).toHaveBeenCalled();
    });

    test('does nothing when no main window', () => {
      ctx.deps.getMainWindow.mockReturnValue(null);
      runtime.handleZoomOut();
      expect(ctx.mockWindow.webContents.setZoomLevel).not.toHaveBeenCalled();
    });
  });

  describe('handleNavigate', () => {
    test('shows welcome when filePath is empty', async () => {
      await runtime.handleNavigate('');
      const msg = ctx.sentMessages.find((m: any) => m.command === 'renderContent' && m.title === 'Welcome');
      expect(msg).toBeDefined();
      expect(runtime.state.currentFile).toBeNull();
    });

    test('sets current file and sends content for existing supported file', async () => {
      ctx.deps.fs.existsSync.mockReturnValue(true);
      ctx.deps.fs.statSync.mockReturnValue({ isFile: () => true });
      runtime.state.workspacePath = '/my/project';
      const flat = [{ fsPath: '/my/project/readme.md', relativePath: 'readme.md', title: 'readme' }];
      runtime.state.flatList = flat;
      await runtime.handleNavigate('/my/project/readme.md');
      expect(runtime.state.currentFile).toBe('/my/project/readme.md');
      const msg = ctx.sentMessages.find((m: any) => m.command === 'renderContent' && m.markdownSource);
      expect(msg).toBeDefined();
    });

    test('sends navNotFound for non-existent file', async () => {
      ctx.deps.fs.existsSync.mockReturnValue(false);
      runtime.state.workspacePath = '/my/project';
      runtime.state.flatList = [];
      await runtime.handleNavigate('/my/project/missing.md');
      const msg = ctx.sentMessages.find((m: any) => m.command === 'navNotFound');
      expect(msg).toBeDefined();
    });

    test('sends navNotFound for unsupported file type', async () => {
      ctx.deps.fs.existsSync.mockReturnValue(true);
      ctx.deps.fs.statSync.mockReturnValue({ isFile: () => true });
      runtime.state.workspacePath = '/my/project';
      runtime.state.flatList = [];
      await runtime.handleNavigate('/my/project/image.png');
      const msg = ctx.sentMessages.find((m: any) => m.command === 'navNotFound');
      expect(msg).toBeDefined();
    });
  });

  describe('handleRefresh', () => {
    test('does nothing when no workspace', async () => {
      await runtime.handleRefresh();
      expect(ctx.deps.scanWorkspaceData).not.toHaveBeenCalled();
    });

    test('refreshes with loading indicator', async () => {
      runtime.state.workspacePath = '/my/project';
      runtime.state.flatList = [];
      ctx.deps.fs.accessSync.mockImplementation(() => {});
      ctx.deps.fs.statSync.mockReturnValue({ isFile: () => false });
      ctx.deps.scanWorkspaceData.mockResolvedValue({ tree: null, flat: [] });
      await runtime.handleRefresh();
      expect(ctx.deps.sendLoading).toHaveBeenCalledWith('Refreshing workspace...', undefined, {});
    });
  });

  describe('handleSetDocumentConversion', () => {
    test('enables document conversion and refreshes', async () => {
      runtime.state.workspacePath = '/my/project';
      runtime.state.flatList = [];
      ctx.deps.fs.accessSync.mockImplementation(() => {});
      ctx.deps.fs.statSync.mockReturnValue({ isFile: () => false });
      ctx.deps.scanWorkspaceData.mockResolvedValue({ tree: null, flat: [] });
      await runtime.handleSetDocumentConversion(true);
      expect(runtime.state.documentConversionEnabled).toBe(true);
    });

    test('does nothing when already in requested state', async () => {
      await runtime.handleSetDocumentConversion(false);
      expect(ctx.deps.scanWorkspaceData).not.toHaveBeenCalled();
    });

    test('sends welcome when current file becomes unsupported', async () => {
      runtime.state.workspacePath = '/my/project';
      runtime.state.flatList = [{ fsPath: '/my/project/report.docx', relativePath: 'report.docx', title: 'report' }];
      runtime.state.currentFile = '/my/project/report.docx';
      runtime.state.documentConversionEnabled = true;
      ctx.deps.fs.accessSync.mockImplementation(() => {});
      ctx.deps.fs.statSync.mockReturnValue({ isFile: () => false });
      ctx.deps.scanWorkspaceData.mockResolvedValue({ tree: null, flat: [] });
      await runtime.handleSetDocumentConversion(false);
      expect(runtime.state.currentFile).toBeNull();
    });
  });

  describe('handleDownloadUpdate', () => {
    test('starts download via update manager', async () => {
      await runtime.handleDownloadUpdate({ version: '2.0', url: 'https://example.com/update' });
      expect(ctx.mockUpdateManager.startDownload).toHaveBeenCalledWith({
        version: '2.0',
        url: 'https://example.com/update',
      });
    });

    test('does nothing when no update manager', async () => {
      const localCtx = createMockDeps();
      (localCtx.deps as any).updateManager = null;
      const localRuntime = createDesktopRuntime(localCtx.deps);
      await localRuntime.handleDownloadUpdate({ version: '2.0', url: 'https://example.com/update' });
    });

    test('handles missing version/url', async () => {
      await runtime.handleDownloadUpdate({});
      expect(ctx.mockUpdateManager.startDownload).toHaveBeenCalledWith({ version: '', url: '' });
    });
  });

  describe('handleScheduleDownloadedUpdate', () => {
    test('schedules via update manager', async () => {
      await runtime.handleScheduleDownloadedUpdate();
      expect(ctx.mockUpdateManager.schedulePendingUpdate).toHaveBeenCalled();
    });

    test('does nothing when no update manager', async () => {
      const localCtx = createMockDeps();
      (localCtx.deps as any).updateManager = null;
      const localRuntime = createDesktopRuntime(localCtx.deps);
      await localRuntime.handleScheduleDownloadedUpdate();
    });
  });

  describe('handleRestartAndApplyUpdate', () => {
    test('restarts and calls appQuit', async () => {
      await runtime.handleRestartAndApplyUpdate();
      expect(ctx.mockUpdateManager.restartAndApplyUpdate).toHaveBeenCalled();
      expect(ctx.deps.appQuit).toHaveBeenCalled();
    });

    test('does nothing when no update manager', async () => {
      const localCtx = createMockDeps();
      (localCtx.deps as any).updateManager = null;
      const localRuntime = createDesktopRuntime(localCtx.deps);
      await localRuntime.handleRestartAndApplyUpdate();
    });
  });

  describe('handleCloseWorkspace', () => {
    test('resets workspace and currentFile state', () => {
      runtime.state.workspacePath = '/my/project';
      runtime.state.currentFile = '/my/project/readme.md';
      runtime.state.readyHandled = true;
      runtime.handleCloseWorkspace();
      expect(runtime.state.workspacePath).toBeNull();
      expect(runtime.state.currentFile).toBeNull();
    });

    test('resets readyHandled to false', () => {
      runtime.state.readyHandled = true;
      runtime.handleCloseWorkspace();
      expect(runtime.state.readyHandled).toBe(true);
    });
  });

  describe('clampAppZoom', () => {
    test('clamps current zoom level', () => {
      ctx.mockWindow.webContents.getZoomLevel.mockReturnValue(5);
      runtime.clampAppZoom();
      expect(ctx.mockWindow.webContents.setZoomLevel).toHaveBeenCalledWith(2);
    });

    test('does nothing when no main window', () => {
      ctx.deps.getMainWindow.mockReturnValue(null);
      runtime.clampAppZoom();
      expect(ctx.mockWindow.webContents.setZoomLevel).not.toHaveBeenCalled();
    });
  });

  describe('refreshActiveWorkspace', () => {
    test('does nothing when no workspace', async () => {
      await runtime.refreshActiveWorkspace({ showLoading: true });
      expect(ctx.deps.scanWorkspaceData).not.toHaveBeenCalled();
    });

    test('sends unavailable when workspace no longer accessible', async () => {
      runtime.state.workspacePath = '/gone';
      ctx.deps.fs.accessSync.mockImplementation(() => { throw new Error('ENOENT'); });
      await runtime.refreshActiveWorkspace({ showLoading: true });
      const unavailable = ctx.sentMessages.find((m: any) => m.command === 'workspaceUnavailable');
      expect(unavailable).toBeDefined();
    });

    test('preserves content when preserveCurrentContent is true', async () => {
      runtime.state.workspacePath = '/my/project';
      runtime.state.flatList = [];
      runtime.state.currentFile = '/my/project/readme.md';
      ctx.deps.fs.accessSync.mockImplementation(() => {});
      ctx.deps.fs.statSync.mockReturnValue({ isFile: () => false });
      ctx.deps.scanWorkspaceData.mockResolvedValue({ tree: null, flat: [] });
      ctx.deps.shouldNotifyCurrentFileChanged.mockReturnValue(true);
      await runtime.refreshActiveWorkspace({ preserveCurrentContent: true, changedPath: '/my/project/readme.md' });
      const msg = ctx.sentMessages.find((m: any) => m.command === 'currentFileChanged');
      expect(msg).toBeDefined();
    });
  });

  describe('dispose', () => {
    test('disposes workspace watch and search worker', () => {
      runtime.state.workspaceWatch = ctx.mockWorkspaceWatch;
      runtime.state.crossTabSearchWorker = ctx.mockSearchWorker;
      runtime.dispose();
      expect(ctx.mockWorkspaceWatch.dispose).toHaveBeenCalled();
      expect(ctx.mockSearchWorker.dispose).toHaveBeenCalled();
    });

    test('does not throw when watchers are null', () => {
      expect(() => runtime.dispose()).not.toThrow();
    });
  });

  describe('state', () => {
    test('exposes readonly state', () => {
      expect(runtime.state.workspacePath).toBeNull();
      expect(runtime.state.currentFile).toBeNull();
      expect(runtime.state.flatList).toEqual([]);
      expect(runtime.state.readyHandled).toBe(false);
      expect(runtime.state.documentConversionEnabled).toBe(false);
    });

    test('handleLoadWorkspaceSearchIndexes processes tab requests sequentially', async () => {
      ctx.deps.fs.existsSync.mockReturnValue(true);
      ctx.deps.scanWorkspaceData.mockResolvedValue({ tree: null, flat: [{ fsPath: '/t1/a.md' }] });
      runtime.handleLoadWorkspaceSearchIndexes({
        tabs: [
          { tabId: 't1', workspacePath: '/ws1' },
          { tabId: 't2', workspacePath: '/ws2' },
        ],
      });
      await new Promise((r) => setTimeout(r, 500));
      const messages = ctx.sentMessages.filter((m: any) => m.command === 'workspaceSearchIndexLoaded');
      expect(messages.length).toBeGreaterThanOrEqual(2);
    });

    test('handleLoadWorkspaceSearchIndexes sends empty list when workspacePath missing', async () => {
      ctx.deps.fs.existsSync.mockReturnValue(false);
      runtime.handleLoadWorkspaceSearchIndexes({
        tabs: [{ tabId: 't1', workspacePath: '/missing-ws' }],
      });
      await new Promise((r) => setTimeout(r, 400));
      const msg = ctx.sentMessages.find((m: any) => m.command === 'workspaceSearchIndexLoaded');
      expect(msg).toBeDefined();
      expect(msg.tabs[0].fileList).toEqual([]);
    });

    test('handleLoadWorkspaceSearchIndexes sends empty when scan fails', async () => {
      ctx.deps.fs.existsSync.mockReturnValue(true);
      ctx.deps.scanWorkspaceData.mockRejectedValue(new Error('scan fail'));
      runtime.handleLoadWorkspaceSearchIndexes({
        tabs: [{ tabId: 't1', workspacePath: '/ws1' }],
      });
      await new Promise((r) => setTimeout(r, 400));
      const msg = ctx.sentMessages.find((m: any) => m.command === 'workspaceSearchIndexLoaded');
      expect(msg).toBeDefined();
      expect(msg.tabs[0].fileList).toEqual([]);
    });

    test('handleLoadWorkspaceSearchIndexes skips tab with empty tabId', async () => {
      ctx.deps.fs.existsSync.mockReturnValue(true);
      runtime.handleLoadWorkspaceSearchIndexes({
        tabs: [{ tabId: '', workspacePath: '/ws1' }],
      });
      await new Promise((r) => setTimeout(r, 400));
      const msg = ctx.sentMessages.find((m: any) => m.command === 'workspaceSearchIndexLoaded');
      expect(msg).toBeUndefined();
    });
  });

  describe('handleOpenFolder (openFirstFile=true)', () => {
    test('sets openFirstFile=true and opens folder', () => {
      ctx.deps.dialog.showOpenDialogSync.mockReturnValue(['/my/project']);
      runtime.handleOpenFolder(true);
      expect(runtime.state.workspacePath).toBe('/my/project');
    });

    test('sets openFirstFile=true and handles dialog cancel', () => {
      ctx.deps.dialog.showOpenDialogSync.mockReturnValue(null);
      runtime.handleOpenFolder(true);
      expect(runtime.state.workspacePath).toBeNull();
    });
  });

  describe('handleOpenPath edge cases', () => {
    test('opens directory with openFirstFile flag', () => {
      ctx.deps.fs.accessSync.mockImplementation(() => {});
      ctx.deps.fs.statSync.mockReturnValue({ isFile: () => false });
      runtime.handleOpenPath('/my/project', true);
      expect(runtime.state.workspacePath).toBe('/my/project');
      expect(runtime.state.currentFile).toBeNull();
    });

    test('sends locked reason for EACCES on access', () => {
      const err: any = new Error('EACCES');
      err.code = 'EACCES';
      ctx.deps.fs.accessSync.mockImplementation(() => { throw err; });
      runtime.handleOpenPath('/locked');
      const unavailable = ctx.sentMessages.find((m: any) => m.command === 'workspaceUnavailable');
      expect(unavailable).toBeDefined();
      expect(unavailable.reason).toBe('locked');
    });

    test('sends locked reason for EPERM on access', () => {
      const err: any = new Error('EPERM');
      err.code = 'EPERM';
      ctx.deps.fs.accessSync.mockImplementation(() => { throw err; });
      runtime.handleOpenPath('/restricted');
      const unavailable = ctx.sentMessages.find((m: any) => m.command === 'workspaceUnavailable');
      expect(unavailable).toBeDefined();
      expect(unavailable.reason).toBe('locked');
    });
  });

  describe('handleActivateWorkspace edge cases', () => {
    test('null filePath should not set currentFile', () => {
      ctx.deps.fs.accessSync.mockImplementation(() => {});
      ctx.deps.fs.statSync.mockReturnValue({ isFile: () => false });
      runtime.handleActivateWorkspace('/my/project', null, false);
      expect(runtime.state.workspacePath).toBe('/my/project');
      expect(runtime.state.currentFile).toBeNull();
    });

    test('missing filePath skips', () => {
      ctx.deps.fs.accessSync.mockImplementation(() => { throw new Error('ENOENT'); });
      runtime.handleActivateWorkspace('/ws');
      const msg = ctx.sentMessages.find((m: any) => m.command === 'workspaceUnavailable');
      expect(msg).toBeDefined();
    });
  });

  describe('handleConfirmOpenPath edge cases', () => {
    test('returns early when file does not exist', async () => {
      ctx.deps.fs.existsSync.mockReturnValue(false);
      await runtime.handleConfirmOpenPath('/nonexistent');
      expect(ctx.deps.dialog.showMessageBox).not.toHaveBeenCalled();
    });

    test('directory path delegates to handleOpenPath without workspace', async () => {
      ctx.deps.fs.existsSync.mockReturnValue(true);
      ctx.deps.fs.statSync.mockReturnValue({ isFile: () => false });
      ctx.deps.fs.accessSync.mockImplementation(() => {});
      await runtime.handleConfirmOpenPath('/my/project');
      expect(runtime.state.workspacePath).toContain('project');
    });
  });

  describe('handleOpenRecent edge cases', () => {
    test('sets currentFile null when recent is directory with openFirstFile', () => {
      ctx.deps.fs.accessSync.mockImplementation(() => {});
      ctx.deps.fs.statSync.mockReturnValue({ isFile: () => false });
      runtime.handleOpenRecent('/recent/folder', true);
      expect(runtime.state.currentFile).toBeNull();
      expect(runtime.state.workspacePath).toBe('/recent/folder');
    });

    test('non-string workspace path fallback', () => {
      runtime.handleOpenRecent(null, false);
      const unavailable = ctx.sentMessages.find((m: any) => m.command === 'workspaceUnavailable');
      expect(unavailable).toBeDefined();
    });
  });

  describe('sendWorkspaceFilesChanged via refreshActiveWorkspace', () => {
    test('refresh sends workspaceFilesChanged when preserveCurrentContent true', async () => {
      runtime.state.workspacePath = '/my/project';
      runtime.state.flatList = [];
      ctx.deps.fs.accessSync.mockImplementation(() => {});
      ctx.deps.fs.statSync.mockReturnValue({ isFile: () => false });
      ctx.deps.scanWorkspaceData.mockResolvedValue({ tree: null, flat: [] });
      await runtime.refreshActiveWorkspace({ preserveCurrentContent: true });
      const msg = ctx.sentMessages.find((m: any) => m.command === 'workspaceFilesChanged');
      expect(msg).toBeDefined();
      expect(msg.fileList).toBeDefined();
      expect(msg.documentConversionEnabled).toBeDefined();
    });
  });

  describe('sendCurrentFileChanged via refreshActiveWorkspace', () => {
    test('preserveCurrentContent with non-matching changedPath sends currentFileChanged', async () => {
      runtime.state.workspacePath = '/my/project';
      runtime.state.flatList = [];
      runtime.state.currentFile = '/my/project/readme.md';
      ctx.deps.fs.accessSync.mockImplementation(() => {});
      ctx.deps.fs.statSync.mockReturnValue({ isFile: () => false });
      ctx.deps.scanWorkspaceData.mockResolvedValue({ tree: null, flat: [] });
      ctx.deps.shouldNotifyCurrentFileChanged.mockReturnValue(true);
      await runtime.refreshActiveWorkspace({ preserveCurrentContent: true, changedPath: '' });
      const msg = ctx.sentMessages.find((m: any) => m.command === 'currentFileChanged');
      expect(msg).toBeDefined();
    });
  });

  describe('isCurrentFileStillAvailable via refreshActiveWorkspace', () => {
    test('refresh with preserveCurrentContent=false clears unsupported file', async () => {
      runtime.state.workspacePath = '/my/project';
      runtime.state.flatList = [];
      runtime.state.currentFile = '/my/project/unsupported.zzz';
      runtime.state.documentConversionEnabled = false;
      ctx.deps.fs.accessSync.mockImplementation(() => {});
      ctx.deps.fs.statSync.mockReturnValue({ isFile: () => false });
      ctx.deps.scanWorkspaceData.mockResolvedValue({ tree: null, flat: [] });
      await runtime.refreshActiveWorkspace({ showLoading: false });
      expect(runtime.state.currentFile).toBeNull();
    });
  });

  describe('sendContent edge cases', () => {
    test('sendContent sends failure markdown when converter fails (not extra doc)', async () => {
      runtime.state.workspacePath = '/my/project';
      runtime.state.currentFile = '/my/project/readme.md';
      runtime.state.flatList = [];
      runtime.state.documentConversionEnabled = false;
      ctx.deps.fs.statSync.mockReturnValue({ isFile: () => true });
      ctx.deps.documentConverter.readMarkdown.mockRejectedValue(new Error('conversion failed'));
      ctx.deps.documentConverter.createFailureMarkdown.mockReturnValue('# error');
      await runtime.handleNavigate('/my/project/readme.md');
      const failures = ctx.sentMessages.filter((m: any) => m.command === 'renderContent' && m.markdownSource !== '');
      expect(failures.length).toBeGreaterThan(0);
    });

    test('sendContent sets previewInfo in catch for extra doc type', async () => {
      runtime.state.workspacePath = '/my/project';
      runtime.state.currentFile = '/my/project/report.docx';
      runtime.state.flatList = [];
      runtime.state.documentConversionEnabled = true;
      ctx.deps.fs.statSync.mockReturnValue({ isFile: () => true });
      ctx.deps.documentConverter.readMarkdown.mockRejectedValue(new Error('fail'));
      ctx.deps.documentConverter.createFailureMarkdown.mockReturnValue('# fail');
      await runtime.handleNavigate('/my/project/report.docx');
      const msg = ctx.sentMessages.find((m: any) => m.command === 'renderContent' && m.previewInfo);
      expect(msg).toBeDefined();
      expect(msg.previewInfo.kind).toBe('converted');
    });

    test('sendContent skips when currentFile becomes unsupported', async () => {
      runtime.state.workspacePath = '/my/project';
      runtime.state.currentFile = '/my/project/image.png';
      runtime.state.flatList = [];
      runtime.state.documentConversionEnabled = false;
      ctx.deps.fs.statSync.mockReturnValue({ isFile: () => false });
      await runtime.handleNavigate('/my/project/image.png');
      const notFound = ctx.sentMessages.find((m: any) => m.command === 'navNotFound');
      expect(notFound).toBeDefined();
    });
  });

  describe('refreshActiveWorkspaceFromWatch via handleRefresh', () => {
    test('refresh with irrelevant watch change skips', async () => {
      runtime.state.workspacePath = '/my/project';
      runtime.state.flatList = [];
      ctx.deps.isWatchChangeRelevant.mockReturnValue(false);
      ctx.deps.fs.accessSync.mockImplementation(() => {});
      ctx.deps.fs.statSync.mockReturnValue({ isFile: () => false });
      ctx.deps.scanWorkspaceData.mockResolvedValue({ tree: null, flat: [] });
      await runtime.handleRefresh();
    });

    test('refresh with relevant watch change processes', async () => {
      runtime.state.workspacePath = '/my/project';
      runtime.state.flatList = [];
      ctx.deps.isWatchChangeRelevant.mockReturnValue(true);
      ctx.deps.shouldNotifyCurrentFileChanged.mockReturnValue(false);
      ctx.deps.fs.accessSync.mockImplementation(() => {});
      ctx.deps.fs.statSync.mockReturnValue({ isFile: () => false });
      ctx.deps.scanWorkspaceData.mockResolvedValue({ tree: null, flat: [] });
      await runtime.handleRefresh();
      expect(ctx.deps.scanWorkspaceData).toHaveBeenCalled();
    });
  });

  describe('ensureCrossTabSearchWorker', () => {
    test('creates worker with batch message handler', async () => {
      const mockWorkerSetup = vi.fn();
      ctx.deps.createSearchWorkerController = mockWorkerSetup.mockReturnValue(
        ctx.mockSearchWorker,
      );
      const freshRuntime = createDesktopRuntime(ctx.deps);
      freshRuntime.handleSearchAcrossWorkspaces({ requestId: 'r1', query: 'test' });
      expect(mockWorkerSetup).toHaveBeenCalled();
      const handlerConfig = mockWorkerSetup.mock.calls[0][0];
      expect(handlerConfig.onMessage).toBeDefined();
      handlerConfig.onMessage({ type: 'batch', requestId: 'r1', results: [{ fsPath: '/a.md' }] });
      const batchMsg = ctx.sentMessages.find((m: any) => m.command === 'crossTabSearchResults' && m.done === false);
      expect(batchMsg).toBeDefined();
    });

    test('crossTab worker handler sends done for error type', async () => {
      const mockWorkerSetup = vi.fn();
      ctx.deps.createSearchWorkerController = mockWorkerSetup.mockReturnValue(
        ctx.mockSearchWorker,
      );
      ctx.deps.getMainWindow = vi.fn(() => ctx.mockWindow);
      const freshRuntime = createDesktopRuntime(ctx.deps);
      freshRuntime.handleSearchAcrossWorkspaces({ requestId: 'r1', query: 'test' });
      const handlerConfig = mockWorkerSetup.mock.calls[0][0];
      handlerConfig.onMessage({ type: 'error', requestId: 'r1', message: 'search failed' });
      const errMsg = ctx.sentMessages.find(
        (m: any) => m.command === 'crossTabSearchResults' && m.done === true && m.error === 'search failed',
      );
      expect(errMsg).toBeDefined();
    });

    test('crossTab worker handler does nothing when window is destroyed', async () => {
      const mockWorkerSetup = vi.fn();
      ctx.deps.createSearchWorkerController = mockWorkerSetup.mockReturnValue(
        ctx.mockSearchWorker,
      );
      ctx.deps.getMainWindow = vi.fn(() => ctx.mockWindow);
      ctx.mockWindow.isDestroyed = vi.fn(() => true);
      const sentBefore = ctx.sentMessages.length;
      const freshRuntime = createDesktopRuntime(ctx.deps);
      freshRuntime.handleSearchAcrossWorkspaces({ requestId: 'r1', query: 'test' });
      const handlerConfig = mockWorkerSetup.mock.calls[0][0];
      handlerConfig.onMessage({ type: 'batch', requestId: 'r1', results: [{ fsPath: '/a.md' }] });
      expect(ctx.sentMessages.length).toBe(sentBefore);
    });
  });

  describe('edge case helpers', () => {
    test('getFileTypeLabelLite returns empty string for empty path', () => {
      expect(getFileTypeLabelLite('')).toBe('');
    });

    test('isSupportedFilePathLite handles file with no extension', () => {
      expect(isSupportedFilePathLite('Makefile', false)).toBe(false);
    });

    test('stripKnownExtensionLite returns same for empty string', () => {
      expect(stripKnownExtensionLite('')).toBe('');
    });
  });

  describe('closeWorkspace edge cases', () => {
    test('handles re-closing with null workspace', () => {
      runtime.handleCloseWorkspace();
      expect(runtime.state.workspacePath).toBeNull();
      expect(runtime.state.currentFile).toBeNull();
    });
  });

  describe('refresh edge cases', () => {
    test('refresh sends unavailable when workspace missing', async () => {
      runtime.state.workspacePath = '/gone';
      ctx.deps.fs.accessSync.mockImplementation(() => { throw new Error('ENOENT'); });
      await runtime.refreshActiveWorkspace({ showLoading: true });
      const msg = ctx.sentMessages.find((m: any) => m.command === 'workspaceUnavailable');
      expect(msg).toBeDefined();
    });

    test('refreshActiveWorkspace does nothing when no workspace', async () => {
      await runtime.refreshActiveWorkspace({ showLoading: false });
      expect(ctx.deps.scanWorkspaceData).not.toHaveBeenCalled();
    });
  });
});
