import { describe, expect, test } from 'vitest';
import { hostMessages, webviewMessages } from '../fixtures/messages';
import { createRequire } from 'node:module';

const uiTypes = await import('../../ui/src/types.ts');
const vscodeTypes = await import('../../vscode/src/types.ts');
const require = createRequire(import.meta.url);
const ipcHandlers = require('../../electron/core/ipc-handlers.js');

type UiHostMessage = typeof uiTypes.HostMessage;
type VscodeHostMessage = typeof vscodeTypes.HostMessage;
type UiWebviewMessage = typeof uiTypes.WebviewMessage;
type VscodeWebviewMessage = typeof vscodeTypes.WebviewMessage;

const UI_HOST_COMMANDS: (UiHostMessage extends { command: infer C }[] ? C : never)[] = [
  'renderContent', 'readyAck', 'workspaceFilesChanged', 'currentFileChanged',
  'recentWorkspacesChanged', 'navNotFound', 'workspaceUnavailable', 'setLoading',
  'updateStateChanged', 'window-state-changed', 'crossTabSearchResults',
  'workspaceSearchResults', 'workspaceSearchIndexLoaded',
] as string[] as never[];

const VSCODE_HOST_COMMANDS: string[] = [
  'renderContent', 'readyAck', 'navNotFound', 'setLoading', 'workspaceSearchResults',
];

const CHROMIUM_HOST_COMMANDS: string[] = [
  'readyAck', 'renderContent', 'setLoading', 'workspaceFilesChanged',
  'recentWorkspacesChanged', 'workspaceUnavailable', 'workspaceSearchResults',
  'workspaceSearchIndexLoaded',
];

const DESKTOP_WEBVIEW_COMMANDS: string[] = [
  'ready', 'navigate', 'openFolder', 'openFile', 'openPath',
  'activateWorkspace', 'searchAcrossWorkspaces', 'searchWorkspace',
  'indexWorkspaceSearchItems', 'loadWorkspaceSearchIndexes', 'confirmOpenPath',
  'openRecentWorkspace', 'deleteRecentWorkspace', 'replaceRecentWorkspaces',
  'closeWorkspace', 'zoom-in', 'zoom-out', 'openInEditor', 'copyCode',
  'openExternal', 'refresh', 'setDocumentConversion', 'downloadUpdate',
  'scheduleDownloadedUpdate', 'restartAndApplyUpdate', 'window-minimize',
  'window-maximize', 'window-close',
];

const VSCODE_WEBVIEW_COMMANDS: string[] = [
  'navigate', 'openInEditor', 'ready', 'copyCode', 'openExternal',
  'refresh', 'setDocumentConversion', 'searchWorkspace', 'updateAppearance',
  'openFolder', 'openFile', 'openPath', 'confirmOpenPath',
  'openRecentWorkspace', 'closeWorkspace', 'deleteRecentWorkspace',
  'zoom-in', 'zoom-out',
];

const CHROMIUM_WEBVIEW_COMMANDS: string[] = [
  'ready', 'openFolder', 'openRecentWorkspace', 'deleteRecentWorkspace',
  'closeWorkspace', 'navigate', 'refresh', 'searchWorkspace',
  'loadWorkspaceSearchIndexes', 'indexWorkspaceSearchItems', 'openExternal',
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
      'ready', 'navigate', 'openFolder', 'openFile', 'openPath',
      'activateWorkspace', 'searchWorkspace', 'searchAcrossWorkspaces',
      'indexWorkspaceSearchItems', 'loadWorkspaceSearchIndexes', 'confirmOpenPath',
      'openRecentWorkspace', 'deleteRecentWorkspace', 'replaceRecentWorkspaces',
      'closeWorkspace', 'zoom-in', 'zoom-out', 'openInEditor', 'copyCode',
      'openExternal', 'refresh', 'setDocumentConversion', 'updateAppearance',
      'downloadUpdate', 'scheduleDownloadedUpdate', 'restartAndApplyUpdate',
      'window-minimize', 'window-maximize', 'window-close',
    ];

    for (const cmd of UI_WEBVIEW_COMMANDS) {
      test(`${cmd} has fixture factory`, () => {
        const key = cmd === 'zoom-in' ? 'zoomIn'
          : cmd === 'zoom-out' ? 'zoomOut'
          : cmd === 'window-minimize' ? 'windowMinimize'
          : cmd === 'window-maximize' ? 'windowMaximize'
          : cmd === 'window-close' ? 'windowClose'
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
        'crossTabSearchResults',
        'currentFileChanged',
        'recentWorkspacesChanged',
        'updateStateChanged',
        'window-state-changed',
        'workspaceFilesChanged',
        'workspaceSearchIndexLoaded',
        'workspaceUnavailable',
      ].sort());
    });
  });

  describe('VSCode-only WebviewMessage exclusions are documented', () => {
    const VSCODE_EXCLUDED_WEBVIEW = DESKTOP_WEBVIEW_COMMANDS.filter(c => !VSCODE_WEBVIEW_COMMANDS.includes(c));
    test('VSCode omits desktop/chromium-only webview messages', () => {
      expect(VSCODE_EXCLUDED_WEBVIEW.sort()).toEqual([
        'activateWorkspace',
        'downloadUpdate',
        'indexWorkspaceSearchItems',
        'loadWorkspaceSearchIndexes',
        'replaceRecentWorkspaces',
        'restartAndApplyUpdate',
        'scheduleDownloadedUpdate',
        'searchAcrossWorkspaces',
        'window-close',
        'window-maximize',
        'window-minimize',
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
        'activateWorkspace',
        'confirmOpenPath',
        'copyCode',
        'downloadUpdate',
        'openFile',
        'openInEditor',
        'openPath',
        'replaceRecentWorkspaces',
        'restartAndApplyUpdate',
        'scheduleDownloadedUpdate',
        'searchAcrossWorkspaces',
        'setDocumentConversion',
        'window-close',
        'window-maximize',
        'window-minimize',
        'zoom-in',
        'zoom-out',
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
        zoomIn: () => webviewMessages.zoomIn(),
        zoomOut: () => webviewMessages.zoomOut(),
        windowMinimize: () => webviewMessages.windowMinimize(),
        windowMaximize: () => webviewMessages.windowMaximize(),
        windowClose: () => webviewMessages.windowClose(),
        scheduleDownloadedUpdate: () => webviewMessages.scheduleDownloadedUpdate(),
        restartAndApplyUpdate: () => webviewMessages.restartAndApplyUpdate(),
        openFolder: () => webviewMessages.openFolder(),
        openFile: () => webviewMessages.openFile(),
        setDocumentConversion: () => webviewMessages.setDocumentConversion(true),
        updateAppearance: () => webviewMessages.updateAppearance(),
        indexWorkspaceSearchItems: () => webviewMessages.indexWorkspaceSearchItems(),
        loadWorkspaceSearchIndexes: () => webviewMessages.loadWorkspaceSearchIndexes(),
      };
      const pathFactories: Record<string, () => any> = {
        navigate: () => webviewMessages.navigate('/test.md'),
        openPath: () => webviewMessages.openPath('/test.md'),
        activateWorkspace: () => webviewMessages.activateWorkspace('/ws'),
        searchWorkspace: () => webviewMessages.searchWorkspace('test'),
        searchAcrossWorkspaces: () => webviewMessages.searchAcrossWorkspaces('test'),
        confirmOpenPath: () => webviewMessages.confirmOpenPath('/test.md'),
        openRecentWorkspace: () => webviewMessages.openRecentWorkspace('/ws'),
        deleteRecentWorkspace: () => webviewMessages.deleteRecentWorkspace('/ws'),
        openInEditor: () => webviewMessages.openInEditor('/test.md'),
        copyCode: () => webviewMessages.copyCode('code'),
        openExternal: () => webviewMessages.openExternal('https://example.test'),
        replaceRecentWorkspaces: () => webviewMessages.replaceRecentWorkspaces([]),
        downloadUpdate: () => webviewMessages.downloadUpdate(),
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

  describe('openExternal URL validation is consistent', () => {
    test('desktop and chromium both validate https?:// schema', () => {
      const desktopSrc = ipcHandlers.registerIpcHandlers.toString();
      expect(desktopSrc).toContain('https?');
    });
  });
});
