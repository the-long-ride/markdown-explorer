import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HostMessage } from '../../../../ui/src/types/hostMessages';
import type { WebviewMessage } from '../../../../ui/src/types/webviewMessages';
import type { MdFile } from '../../../../ui/src/types/files';
import { handleChromeHostUtilityCommand } from '../../../../chromium-xtension/src/chrome-host-search';
import { handleWebFileUtilityMessage } from '../../../../website-app/src/web-file-utility-router';

let listeners: ((message: HostMessage) => void)[] = [];
let postedMessages: WebviewMessage[] = [];
let onPostMessageHook: ((msg: WebviewMessage) => Promise<void>) | null = null;

const mocks = vi.hoisted(() => ({
  appState: {
    theme: 'light',
    themeStyle: 'default',
    defaultExpanded: true,
    settings: {
      language: 'en',
      keybindings: { back: 'Alt+Left', forward: 'Alt+Right' },
      disabledKeybindings: {},
      activeCustomThemeId: null,
      customThemes: [],
      fontBindings: {},
    },
  },
  postMessage: vi.fn((message: WebviewMessage) => {
    postedMessages.push(message);
    if (onPostMessageHook) {
      void onPostMessageHook(message);
    }
  }),
  onMessage: vi.fn((listener: (message: HostMessage) => void) => {
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  }),
}));

vi.mock('../../../../ui/src/contexts/AppStateContext', () => ({
  useAppState: () => ({ state: mocks.appState }),
}));

vi.mock('../../../../ui/src/contexts/PlatformContext', () => ({
  usePlatform: () => ({
    postMessage: mocks.postMessage,
    onMessage: mocks.onMessage,
    getState: () => undefined,
    setState: () => {},
    copyToClipboard: async () => {},
  }),
}));

vi.mock('../../../../ui/src/components/Content/scheduleContentEnhancements', () => ({
  scheduleContentEnhancements: () => () => {},
}));

vi.mock('../../../../ui/src/components/Content/enhancements/mermaidAppearance', () => ({
  syncMermaidAppearance: () => ({ key: 'light', changed: false }),
  subscribeToAutoMermaidTheme: () => () => {},
}));

vi.mock('../../../../ui/src/components/Content/enhancements/mermaidRerenderLifecycle', () => ({
  createMermaidRerenderLifecycle: () => ({ schedule: vi.fn(), dispose: vi.fn() }),
}));

import { ScopeViewModal } from '../../../../ui/src/components/Modal/ScopeViewModal';

const targetFile: MdFile = {
  fsPath: '/workspace/subfolder/guide.md',
  relativePath: 'subfolder/guide.md',
  parts: ['subfolder', 'guide.md'],
  fileName: 'guide.md',
  title: 'User Guide',
  extension: '.md',
  documentKind: 'markdown',
};

const nestedFile: MdFile = {
  fsPath: '/workspace/subfolder/api.md',
  relativePath: 'subfolder/api.md',
  parts: ['subfolder', 'api.md'],
  fileName: 'api.md',
  title: 'API Reference',
  extension: '.md',
  documentKind: 'markdown',
};

describe('Scope View across Chromium Extension and Web Demo runtimes', () => {
  beforeEach(() => {
    listeners = [];
    postedMessages = [];
    onPostMessageHook = null;
    mocks.postMessage.mockClear();
    mocks.onMessage.mockClear();
  });

  it('loads document snapshot and renders scope view via Chromium extension host router', async () => {
    const mockSearchIndex = {
      read: vi.fn(async (relativePath: string) => {
        if (relativePath === 'subfolder/guide.md') {
          return '# Guide Header\n\nWelcome to the guide. See [API](api.md).';
        }
        return null;
      }),
      search: vi.fn(async () => []),
      prime: vi.fn(),
    };

    const chromeContext = {
      searchIndex: mockSearchIndex as any,
      flatList: [targetFile, nestedFile],
      workspaceTree: null,
      activeWorkspacePath: '/workspace',
      activeHandle: null,
      send: (message: HostMessage) => {
        listeners.forEach((listener) => listener(message));
      },
      readText: vi.fn(async () => ''),
    };

    onPostMessageHook = async (msg: WebviewMessage) => {
      if (msg.command === 'loadSearchPreview') {
        await handleChromeHostUtilityCommand(msg, chromeContext);
      }
    };

    const onClose = vi.fn();
    render(
      <ScopeViewModal
        initialFile={targetFile}
        files={[targetFile, nestedFile]}
        onClose={onClose}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Guide Header')).toBeDefined();
    });

    expect(mockSearchIndex.read).toHaveBeenCalledWith('subfolder/guide.md');
    expect(postedMessages.some((msg) => msg.command === 'loadSearchPreview' && msg.filePath === targetFile.fsPath)).toBe(true);
  });

  it('loads document snapshot and renders scope view via Web Demo utility router', async () => {
    const mockSearchIndex = {
      read: vi.fn(async (relativePath: string) => {
        if (relativePath === 'subfolder/guide.md') {
          return '# Web Demo Guide\n\nRendered in web demo mode.';
        }
        return null;
      }),
      search: vi.fn(async () => []),
      prime: vi.fn(),
    };

    const webDeps = {
      getSearchIndex: () => mockSearchIndex as any,
      getSingleFileHandle: () => null,
      getFlatList: () => [targetFile, nestedFile],
      getActiveWorkspacePath: () => '/workspace',
      getWorkspaceTree: () => null,
      getActiveHandle: () => null,
      send: (message: unknown) => {
        listeners.forEach((listener) => listener(message as HostMessage));
      },
    };

    onPostMessageHook = async (msg: WebviewMessage) => {
      if (msg.command === 'loadSearchPreview') {
        await handleWebFileUtilityMessage(msg, webDeps, [targetFile, nestedFile]);
      }
    };

    const onClose = vi.fn();
    render(
      <ScopeViewModal
        initialFile={targetFile}
        files={[targetFile, nestedFile]}
        onClose={onClose}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Web Demo Guide')).toBeDefined();
    });

    expect(mockSearchIndex.read).toHaveBeenCalledWith('subfolder/guide.md');
  });

  it('handles missing file cleanly with localized error message', async () => {
    const mockSearchIndex = {
      read: vi.fn(async () => null),
      search: vi.fn(async () => []),
      prime: vi.fn(),
    };

    const webDeps = {
      getSearchIndex: () => mockSearchIndex as any,
      getSingleFileHandle: () => null,
      getFlatList: () => [targetFile],
      getActiveWorkspacePath: () => '/workspace',
      getWorkspaceTree: () => null,
      getActiveHandle: () => null,
      send: (message: unknown) => {
        listeners.forEach((listener) => listener(message as HostMessage));
      },
    };

    onPostMessageHook = async (msg: WebviewMessage) => {
      if (msg.command === 'loadSearchPreview') {
        await handleWebFileUtilityMessage(msg, webDeps, [targetFile]);
      }
    };

    render(
      <ScopeViewModal
        initialFile={targetFile}
        files={[targetFile]}
        onClose={() => {}}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeDefined();
    });
  });

  it('Open file action navigates via bridge and closes modal in browser runtimes', async () => {
    const mockSearchIndex = {
      read: vi.fn(async () => '# Document Content'),
      search: vi.fn(async () => []),
      prime: vi.fn(),
    };

    const chromeContext = {
      searchIndex: mockSearchIndex as any,
      flatList: [targetFile],
      workspaceTree: null,
      activeWorkspacePath: '/workspace',
      activeHandle: null,
      send: (message: HostMessage) => {
        listeners.forEach((listener) => listener(message));
      },
      readText: vi.fn(async () => ''),
    };

    onPostMessageHook = async (msg: WebviewMessage) => {
      if (msg.command === 'loadSearchPreview') {
        await handleChromeHostUtilityCommand(msg, chromeContext);
      }
    };

    const onClose = vi.fn();
    render(
      <ScopeViewModal
        initialFile={targetFile}
        files={[targetFile]}
        onClose={onClose}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Document Content')).toBeDefined();
    });

    const openFileBtn = screen.getByRole('button', { name: 'Open file' });
    fireEvent.click(openFileBtn);

    expect(postedMessages.some((msg) => msg.command === 'navigate' && msg.path === targetFile.fsPath)).toBe(true);
    expect(onClose).toHaveBeenCalled();
  });
});
