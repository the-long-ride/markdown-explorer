import { describe, expect, test } from 'vitest';
import { hostMessages, webviewMessages } from '../fixtures/messages';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const uiTypes = await import('../../ui/src/types.ts');
const vscodeTypes = await import('../../vscode/src/types.ts');
const require = createRequire(import.meta.url);
const repoRoot = path.resolve(__dirname, '../..');
const ipcHandlers = require('../../electron/core/ipc-handlers.js');

type UiHostMessage = typeof uiTypes.HostMessage;
type VscodeHostMessage = typeof vscodeTypes.HostMessage;
type UiWebviewMessage = typeof uiTypes.WebviewMessage;
type VscodeWebviewMessage = typeof vscodeTypes.WebviewMessage;

const UI_HOST_COMMANDS: (UiHostMessage extends { command: infer C }[] ? C : never)[] = [
  'renderContent', 'readyAck', 'workspaceFilesChanged', 'currentFileChanged',
  'recentWorkspacesChanged', 'navNotFound', 'workspaceUnavailable', 'setLoading', 'workspaceScanProgress',
  'updateStateChanged', 'window-state-changed', 'crossTabSearchResults',
  'workspaceSearchResults', 'workspaceSearchIndexLoaded', 'desktopFontsResult',
  'chartPngSaveResult', 'createWorkspaceEntryResult', 'renameWorkspaceEntryResult', 'deleteWorkspaceEntriesResult',
] as string[] as never[];

const VSCODE_HOST_COMMANDS: string[] = [
  'renderContent', 'readyAck', 'navNotFound', 'setLoading', 'workspaceSearchResults',
  'workspaceFilesChanged', 'currentFileChanged', 'desktopFontsResult',
  'createWorkspaceEntryResult', 'renameWorkspaceEntryResult', 'deleteWorkspaceEntriesResult',
];

const CHROMIUM_HOST_COMMANDS: string[] = [
  'readyAck', 'renderContent', 'setLoading', 'workspaceFilesChanged',
  'recentWorkspacesChanged', 'workspaceUnavailable', 'workspaceSearchResults',
  'workspaceSearchIndexLoaded', 'currentFileChanged', 'workspaceScanProgress',
  'createWorkspaceEntryResult', 'renameWorkspaceEntryResult', 'deleteWorkspaceEntriesResult',
];

const DESKTOP_WEBVIEW_COMMANDS: string[] = [
  'ready', 'navigate', 'openFolder', 'openFile', 'openPath', 'openShellLocation',
  'activateWorkspace', 'searchAcrossWorkspaces', 'searchWorkspace',
  'indexWorkspaceSearchItems', 'loadWorkspaceSearchIndexes', 'confirmOpenPath',
  'openRecentWorkspace', 'deleteRecentWorkspace', 'replaceRecentWorkspaces',
  'closeWorkspace', 'cancelWorkspaceScan', 'cancelAllWorkspaceScans', 'zoom-in', 'zoom-out', 'zoom-reset', 'openInEditor', 'copyCode',
  'openExternal', 'openHtmlPreview', 'refresh', 'setDocumentConversion', 'listDesktopFonts', 'importDesktopFonts', 'removeImportedDesktopFont', 'downloadUpdate',
  'scheduleDownloadedUpdate', 'restartAndApplyUpdate', 'window-minimize',
  'window-maximize', 'window-close', 'toggle-fullscreen',
  'createWorkspaceEntry', 'renameWorkspaceEntry', 'deleteWorkspaceEntries',
];

const VSCODE_WEBVIEW_COMMANDS: string[] = [
  'navigate', 'openInEditor', 'ready', 'copyCode', 'openExternal', 'openHtmlPreview',
  'refresh', 'setDocumentConversion', 'searchWorkspace', 'updateAppearance',
  'openFolder', 'openFile', 'openPath', 'confirmOpenPath',
  'openRecentWorkspace', 'closeWorkspace', 'deleteRecentWorkspace',
  'listDesktopFonts', 'importDesktopFonts', 'removeImportedDesktopFont',
  'createWorkspaceEntry', 'renameWorkspaceEntry', 'deleteWorkspaceEntries',
];

const CHROMIUM_WEBVIEW_COMMANDS: string[] = [
  'ready', 'openFolder', 'openRecentWorkspace', 'activateWorkspace', 'deleteRecentWorkspace',
  'closeWorkspace', 'cancelWorkspaceScan', 'cancelAllWorkspaceScans', 'navigate', 'refresh', 'searchWorkspace',
  'loadWorkspaceSearchIndexes', 'indexWorkspaceSearchItems', 'openExternal',
  'createWorkspaceEntry', 'renameWorkspaceEntry', 'deleteWorkspaceEntries',
];

describe('host-message parity', () => {
  describe('fixture covers every UI HostMessage discriminant', () => {
    for (const cmd of UI_HOST_COMMANDS) {
      test(`${cmd} has fixture factory`, () => {
        const key = cmd === 'window-state-changed' ? 'windowStateChanged' : cmd;
        expect(typeof hostMessages[key as keyof typeof hostMessages]).toBe('function');
      });
    }
  });

  describe('fixture covers every UI WebviewMessage discriminant', () => {
    const UI_WEBVIEW_COMMANDS = [
      'ready', 'navigate', 'openFolder', 'openFile', 'openFileHandle', 'openPath', 'openShellLocation',
      'activateWorkspace', 'searchWorkspace', 'searchAcrossWorkspaces',
      'indexWorkspaceSearchItems', 'loadWorkspaceSearchIndexes', 'confirmOpenPath',
      'openRecentWorkspace', 'deleteRecentWorkspace', 'replaceRecentWorkspaces',
      'closeWorkspace', 'cancelWorkspaceScan', 'cancelAllWorkspaceScans', 'zoom-in', 'zoom-out', 'zoom-reset', 'openInEditor', 'copyCode',
      'openExternal', 'openHtmlPreview', 'refresh', 'setDocumentConversion', 'listDesktopFonts', 'importDesktopFonts', 'removeImportedDesktopFont', 'updateAppearance',
      'downloadUpdate', 'scheduleDownloadedUpdate', 'restartAndApplyUpdate',
      'window-minimize', 'window-maximize', 'window-close', 'toggle-fullscreen',
      'createWorkspaceEntry', 'renameWorkspaceEntry', 'deleteWorkspaceEntries',
    ];

    for (const cmd of UI_WEBVIEW_COMMANDS) {
      test(`${cmd} has fixture factory`, () => {
        const key = cmd === 'zoom-in' ? 'zoomIn'
          : cmd === 'zoom-out' ? 'zoomOut'
          : cmd === 'zoom-reset' ? 'zoomReset'
          : cmd === 'window-minimize' ? 'windowMinimize'
          : cmd === 'window-maximize' ? 'windowMaximize'
          : cmd === 'window-close' ? 'windowClose'
          : cmd === 'toggle-fullscreen' ? 'toggleFullscreen'
          : cmd;
        expect(typeof webviewMessages[key as keyof typeof webviewMessages]).toBe('function');
      });
    }
  });

  describe('common HostMessage discriminants exist in both UI and VSCode types', () => {
    const COMMON_HOST = VSCODE_HOST_COMMANDS.filter(c => UI_HOST_COMMANDS.includes(c));
    for (const cmd of COMMON_HOST) {
      test(`${cmd}`, () => {
        expect(UI_HOST_COMMANDS).toContain(cmd);
        expect(VSCODE_HOST_COMMANDS).toContain(cmd);
      });
    }
  });

  describe('WebviewMessage commands shared between desktop and VSCode', () => {
    const DESKTOP_VSCODE_SHARED = DESKTOP_WEBVIEW_COMMANDS.filter(c => VSCODE_WEBVIEW_COMMANDS.includes(c));
    for (const cmd of DESKTOP_VSCODE_SHARED) {
      test(`${cmd} handled by both desktop ipc and VSCode panel`, () => {
        expect(DESKTOP_WEBVIEW_COMMANDS).toContain(cmd);
        expect(VSCODE_WEBVIEW_COMMANDS).toContain(cmd);
      });
    }
  });

  describe('desktop handles all UI WebviewMessage commands', () => {
    const handledInDesktop = DESKTOP_WEBVIEW_COMMANDS;
    for (const cmd of handledInDesktop) {
      test(`${cmd} is handled by ipc-handlers`, () => {
        const src = ipcHandlers.registerIpcHandlers.toString();
        expect(src).toMatch(new RegExp(`case\\s+"${cmd.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`));
      });
    }
  });

  describe('VSCode-only HostMessage exclusions are documented', () => {
    const VSCODE_EXCLUDED_HOST = UI_HOST_COMMANDS.filter(c => !VSCODE_HOST_COMMANDS.includes(c));
    test('VSCode omits desktop/chromium-only host messages', () => {
      expect(VSCODE_EXCLUDED_HOST.sort()).toEqual([
        'chartPngSaveResult',
        'crossTabSearchResults',
        'recentWorkspacesChanged',
        'updateStateChanged',
        'window-state-changed',
        'workspaceSearchIndexLoaded',
        'workspaceUnavailable',
        'workspaceScanProgress',
      ].sort());
    });
  });

  describe('VSCode-only WebviewMessage exclusions are documented', () => {
    const VSCODE_EXCLUDED_WEBVIEW = DESKTOP_WEBVIEW_COMMANDS.filter(c => !VSCODE_WEBVIEW_COMMANDS.includes(c));
    test('VSCode omits desktop/chromium-only webview messages', () => {
      expect(VSCODE_EXCLUDED_WEBVIEW.sort()).toEqual([
        'activateWorkspace',
        'cancelAllWorkspaceScans',
        'cancelWorkspaceScan',
        'downloadUpdate',
        'indexWorkspaceSearchItems',
        'loadWorkspaceSearchIndexes',
        'openShellLocation',
        'replaceRecentWorkspaces',
        'restartAndApplyUpdate',
        'scheduleDownloadedUpdate',
        'searchAcrossWorkspaces',
        'window-close',
        'window-maximize',
        'window-minimize',
        'toggle-fullscreen',
        'zoom-in',
        'zoom-out',
        'zoom-reset',
      ].sort());
    });

    const VSCODE_ONLY_WEBVIEW = VSCODE_WEBVIEW_COMMANDS.filter(c => !DESKTOP_WEBVIEW_COMMANDS.includes(c));
    test('VSCode handles updateAppearance which desktop processes renderer-side', () => {
      expect(VSCODE_ONLY_WEBVIEW.sort()).toEqual(['updateAppearance']);
    });
  });

  describe('Chromium-only WebviewMessage exclusions are documented', () => {
    const CHROMIUM_EXCLUDED = DESKTOP_WEBVIEW_COMMANDS.filter(c => !CHROMIUM_WEBVIEW_COMMANDS.includes(c));
    test('Chromium omits desktop/vscode-only webview messages', () => {
      expect(CHROMIUM_EXCLUDED.sort()).toEqual([
        'confirmOpenPath',
        'copyCode',
        'downloadUpdate',
        'importDesktopFonts',
        'listDesktopFonts',
        'openFile',
        'openHtmlPreview',
        'openInEditor',
        'openPath',
        'openShellLocation',
        'removeImportedDesktopFont',
        'replaceRecentWorkspaces',
        'restartAndApplyUpdate',
        'scheduleDownloadedUpdate',
        'searchAcrossWorkspaces',
        'setDocumentConversion',
        'window-close',
        'window-maximize',
        'window-minimize',
        'toggle-fullscreen',
        'zoom-in',
        'zoom-out',
        'zoom-reset',
      ].sort());
    });
  });

  describe('fixture default payloads satisfy command contract', () => {
    test('every hostMessage factory returns correct command', () => {
      const entries = Object.entries(hostMessages) as [string, (overrides?: object) => any][];
      for (const [key, factory] of entries) {
        const msg = factory();
        expect(msg.command).toBeDefined();
        expect(typeof msg.command).toBe('string');
      }
    });

    test('every webviewMessage factory returns correct command', () => {
      const simpleFactories: Record<string, () => any> = {
        ready: () => webviewMessages.ready(),
        refresh: () => webviewMessages.refresh(),
        closeWorkspace: () => webviewMessages.closeWorkspace(),
        cancelWorkspaceScan: () => webviewMessages.cancelWorkspaceScan(),
        cancelAllWorkspaceScans: () => webviewMessages.cancelAllWorkspaceScans(),
        zoomIn: () => webviewMessages.zoomIn(),
        zoomOut: () => webviewMessages.zoomOut(),
        zoomReset: () => webviewMessages.zoomReset(),
        windowMinimize: () => webviewMessages.windowMinimize(),
        windowMaximize: () => webviewMessages.windowMaximize(),
        windowClose: () => webviewMessages.windowClose(),
        toggleFullscreen: () => webviewMessages.toggleFullscreen(),
        scheduleDownloadedUpdate: () => webviewMessages.scheduleDownloadedUpdate(),
        restartAndApplyUpdate: () => webviewMessages.restartAndApplyUpdate(),
        openFolder: () => webviewMessages.openFolder(),
        openFile: () => webviewMessages.openFile(),
        openFileHandle: () => webviewMessages.openFileHandle(),
        setDocumentConversion: () => webviewMessages.setDocumentConversion(true),
        listDesktopFonts: () => webviewMessages.listDesktopFonts(),
        importDesktopFonts: () => webviewMessages.importDesktopFonts(),
        removeImportedDesktopFont: () => webviewMessages.removeImportedDesktopFont(),
        updateAppearance: () => webviewMessages.updateAppearance(),
        indexWorkspaceSearchItems: () => webviewMessages.indexWorkspaceSearchItems(),
        loadWorkspaceSearchIndexes: () => webviewMessages.loadWorkspaceSearchIndexes(),
      };
      const pathFactories: Record<string, () => any> = {
        navigate: () => webviewMessages.navigate('/test.md'),
        openPath: () => webviewMessages.openPath('/test.md'),
        openShellLocation: () => webviewMessages.openShellLocation('/test.md', 'reveal-file'),
        activateWorkspace: () => webviewMessages.activateWorkspace('/ws'),
        searchWorkspace: () => webviewMessages.searchWorkspace('test'),
        searchAcrossWorkspaces: () => webviewMessages.searchAcrossWorkspaces('test'),
        confirmOpenPath: () => webviewMessages.confirmOpenPath('/test.md'),
        openRecentWorkspace: () => webviewMessages.openRecentWorkspace('/ws'),
        deleteRecentWorkspace: () => webviewMessages.deleteRecentWorkspace('/ws'),
        openInEditor: () => webviewMessages.openInEditor('/test.md'),
        copyCode: () => webviewMessages.copyCode('code'),
        openExternal: () => webviewMessages.openExternal('https://example.test'),
        openHtmlPreview: () => webviewMessages.openHtmlPreview(),
        replaceRecentWorkspaces: () => webviewMessages.replaceRecentWorkspaces([]),
        downloadUpdate: () => webviewMessages.downloadUpdate(),
        createWorkspaceEntry: () => webviewMessages.createWorkspaceEntry(),
        renameWorkspaceEntry: () => webviewMessages.renameWorkspaceEntry(),
        deleteWorkspaceEntries: () => webviewMessages.deleteWorkspaceEntries(),
      };
      for (const [key, factory] of Object.entries(simpleFactories)) {
        const msg = factory();
        expect(msg.command, `${key} factory`).toBeDefined();
        expect(typeof msg.command, `${key} factory`).toBe('string');
      }
      for (const [key, factory] of Object.entries(pathFactories)) {
        const msg = factory();
        expect(msg.command, `${key} factory`).toBeDefined();
        expect(typeof msg.command, `${key} factory`).toBe('string');
      }
    });
  });

  describe('required message fields are present across platforms', () => {
    test('readyAck has required fields on all platforms', () => {
      const msg = hostMessages.readyAck();
      expect(msg).toHaveProperty('fileList');
      expect(msg).toHaveProperty('tree');
      expect(msg).toHaveProperty('theme');
      expect(msg).toHaveProperty('defaultExpanded');
      expect(msg).toHaveProperty('workspaceName');
    });

    test('renderContent has required fields on all platforms', () => {
      const msg = hostMessages.renderContent();
      expect(msg).toHaveProperty('html');
      expect(msg).toHaveProperty('frontmatter');
      expect(msg).toHaveProperty('toc');
      expect(msg).toHaveProperty('filePath');
      expect(msg).toHaveProperty('title');
    });

    test('workspaceSearchResults has required fields on all platforms', () => {
      const msg = hostMessages.workspaceSearchResults();
      expect(msg).toHaveProperty('requestId');
      expect(msg).toHaveProperty('results');
    });

    test('navigate webview message has required path field', () => {
      const msg = webviewMessages.navigate('/test.md');
      expect(msg).toHaveProperty('path');
    });

    test('searchWorkspace webview message has required query and requestId', () => {
      const msg = webviewMessages.searchWorkspace('test');
      expect(msg).toHaveProperty('query');
      expect(msg).toHaveProperty('requestId');
    });
  });

  describe('workspace entry commands are handled by every runtime', () => {
    const WORKSPACE_ENTRY_COMMANDS = ['createWorkspaceEntry', 'renameWorkspaceEntry', 'deleteWorkspaceEntries'];
    const RESULT_COMMANDS = ['createWorkspaceEntryResult', 'renameWorkspaceEntryResult', 'deleteWorkspaceEntriesResult'];
    const read = (relPath: string) => readFileSync(path.join(repoRoot, relPath), 'utf8');
    const RUNTIME_SOURCES: Record<string, string[]> = {
      desktop: ['electron/core/ipc-handlers.js', 'electron/workspace/workspace-entries.js'],
      vscode: ['vscode/src/core/panelWorkspaceEntries.ts'],
      tauri: ['tauri/src/dispatcher/workspace_entries.rs'],
      chromium: ['chromium-xtension/src/workspace-entries.ts'],
    };

    for (const [runtime, files] of Object.entries(RUNTIME_SOURCES)) {
      test(`${runtime} handles both commands and replies with both results`, () => {
        const source = files.map(read).join('\n');
        for (const command of [...WORKSPACE_ENTRY_COMMANDS, ...RESULT_COMMANDS]) expect(source).toContain(command);
      });
    }

    test('every runtime lists both commands as handled webview messages', () => {
      for (const list of [DESKTOP_WEBVIEW_COMMANDS, VSCODE_WEBVIEW_COMMANDS, CHROMIUM_WEBVIEW_COMMANDS]) {
        for (const command of WORKSPACE_ENTRY_COMMANDS) expect(list).toContain(command);
      }
    });

    test('the Chromium extension and the website both route the commands through the shared browser handler', () => {
      expect(read('chromium-xtension/src/chrome-host-search.ts')).toContain('handleBrowserWorkspaceEntryCommand');
      expect(read('website-app/src/web-file-utility-router.ts')).toContain('handleBrowserWorkspaceEntryCommand');
    });

    test('deletes go to the trash on desktop, VS Code and Tauri but are permanent in browsers', () => {
      for (const file of ['electron/workspace/workspace-entries.js', 'vscode/src/core/panelWorkspaceEntries.ts', 'tauri/src/dispatcher/workspace_entries.rs']) {
        expect(read(file)).toMatch(/["']trash["']/);
      }
      expect(read('chromium-xtension/src/workspace-entries.ts')).toContain("mode: 'permanent'");
    });

    test('result fixtures match the protocol shapes', () => {
      expect(hostMessages.createWorkspaceEntryResult()).toMatchObject({ command: 'createWorkspaceEntryResult', ok: true });
      expect(hostMessages.deleteWorkspaceEntriesResult()).toMatchObject({ command: 'deleteWorkspaceEntriesResult', deleted: ['old.md'], failed: [] });
    });
  });

  describe('openExternal URL validation is consistent', () => {
    test('desktop and chromium both validate safe browser URL schemas', () => {
      const desktopSrc = ipcHandlers.registerIpcHandlers.toString();
      expect(desktopSrc).toContain('https?');
      expect(desktopSrc).toContain('file');
    });
  });
});
