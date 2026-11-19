import { createElement } from 'react';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { detectMode } from '../../../website-app/src/main-web';
import { PlatformProvider } from '../../../ui/src/contexts/PlatformContext';
import { AppStateContext } from '../../../ui/src/contexts/AppStateContext';
import { WorkspaceSelection } from '../../../ui/src/components/Workspace/WorkspaceSelection';
import { SwitchWorkspaceModal } from '../../../ui/src/components/Modal/SwitchWorkspaceModal';
import {
  createUserVirtualWorkspace,
  createVirtualWorkspaceFromDroppedFiles,
  listUserVirtualWorkspaces,
  removeUserVirtualWorkspace,
  isVirtualWorkspacePath,
  getVirtualWorkspaceSnapshot,
  getVirtualWorkspaceEntryStore,
  getVirtualWorkspaceFileContent,
  setVirtualWorkspaceFileContent,
  renameVirtualWorkspaceContent,
  deleteVirtualWorkspaceContent,
  USER_VIRTUAL_WORKSPACES_STORAGE_KEY,
} from '../../../website-app/src/user-virtual-workspaces';
import { createFileModeHandlers } from '../../../website-app/src/web-file-mode';
import { initWebHost, getWebBus } from '../../../website-app/src/web-host';

describe('user-virtual-workspaces', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('detectMode', () => {
    it('defaults to web mode when no mode query parameter is provided', () => {
      expect(detectMode('')).toBe('web');
      expect(detectMode('?')).toBe('web');
      expect(detectMode('?other=123')).toBe('web');
    });

    it('returns web mode when explicitly set to mode=web or legacy mode=file', () => {
      expect(detectMode('?mode=web')).toBe('web');
      expect(detectMode('?foo=bar&mode=web')).toBe('web');
      expect(detectMode('?mode=file')).toBe('web');
      expect(detectMode('?foo=bar&mode=file')).toBe('web');
    });

    it('returns test mode only when mode=test is specified', () => {
      expect(detectMode('?mode=test')).toBe('test');
      expect(detectMode('?foo=bar&mode=test')).toBe('test');
    });
  });

  describe('isVirtualWorkspacePath', () => {
    it('identifies virtual workspace paths starting with virtual://', () => {
      expect(isVirtualWorkspacePath('virtual://ws-123')).toBe(true);
      expect(isVirtualWorkspacePath('virtual://test')).toBe(true);
    });

    it('rejects non-virtual paths and falsy inputs', () => {
      expect(isVirtualWorkspacePath('/Users/test/workspace')).toBe(false);
      expect(isVirtualWorkspacePath('test-workspace')).toBe(false);
      expect(isVirtualWorkspacePath('')).toBe(false);
      expect(isVirtualWorkspacePath(null)).toBe(false);
      expect(isVirtualWorkspacePath(undefined)).toBe(false);
    });
  });

  describe('workspace creation and fallback naming', () => {
    it('creates named virtual workspace with metadata and starter Welcome.md', () => {
      const ws = createUserVirtualWorkspace('Personal Notes');
      expect(ws.name).toBe('Personal Notes');
      expect(ws.path).toBe(`virtual://${ws.id}`);
      expect(ws.createdAt).toBeGreaterThan(0);
      expect(ws.updatedAt).toBeGreaterThan(0);

      const all = listUserVirtualWorkspaces();
      expect(all).toHaveLength(1);
      expect(all[0].id).toBe(ws.id);
      expect(all[0].name).toBe('Personal Notes');

      const store = getVirtualWorkspaceEntryStore(ws.path);
      expect(store.entries.some((e) => e.path === 'Welcome.md' && e.kind === 'file')).toBe(true);

      const content = getVirtualWorkspaceFileContent(ws.path, 'Welcome.md');
      expect(content).toContain('Welcome');
    });

    it('falls back to numbered names when name is empty or whitespace', () => {
      const ws1 = createUserVirtualWorkspace('');
      expect(ws1.name).toBe('Virtual Workspace 1');

      const ws2 = createUserVirtualWorkspace('   ');
      expect(ws2.name).toBe('Virtual Workspace 2');

      const ws3 = createUserVirtualWorkspace();
      expect(ws3.name).toBe('Virtual Workspace 3');
    });

    it('handles corrupt JSON in localStorage without throwing', () => {
      localStorage.setItem(USER_VIRTUAL_WORKSPACES_STORAGE_KEY, '{invalid json');
      expect(listUserVirtualWorkspaces()).toEqual([]);

      localStorage.setItem(USER_VIRTUAL_WORKSPACES_STORAGE_KEY, 'null');
      expect(listUserVirtualWorkspaces()).toEqual([]);

      localStorage.setItem(USER_VIRTUAL_WORKSPACES_STORAGE_KEY, '{"not":"an array"}');
      expect(listUserVirtualWorkspaces()).toEqual([]);
    });
  });

  describe('getVirtualWorkspaceSnapshot', () => {
    it('returns workspace tree and files snapshot including starter file', () => {
      const ws = createUserVirtualWorkspace('Snapshot Test');
      const snapshot = getVirtualWorkspaceSnapshot(ws.path);

      expect(snapshot.workspacePath).toBe(ws.path);
      expect(snapshot.workspaceName).toBe('Snapshot Test');
      expect(snapshot.files.length).toBeGreaterThanOrEqual(1);
      const welcome = snapshot.files.find((f) => f.fileName === 'Welcome.md');
      expect(welcome).toBeDefined();
      expect(welcome?.title).toBeTruthy();
      expect(snapshot.tree.name).toBe('Snapshot Test');
    });
  });

  describe('virtual file and folder CRUD', () => {
    it('supports creating, writing, reading, renaming, and deleting virtual files and folders', () => {
      const ws = createUserVirtualWorkspace('CRUD Test');
      const store = getVirtualWorkspaceEntryStore(ws.path);

      // Create folder
      const folderPath = store.create('', 'Notes', 'folder');
      expect(folderPath).toBe('Notes');

      // Create file in folder
      const filePath = store.create('Notes', 'Daily.md', 'file');
      expect(filePath).toBe('Notes/Daily.md');

      // Write and read content
      setVirtualWorkspaceFileContent(ws.path, filePath, '# Daily Note\n\nToday is good.');
      expect(getVirtualWorkspaceFileContent(ws.path, filePath)).toBe('# Daily Note\n\nToday is good.');

      // Rename file
      const renamedPath = store.rename('Notes/Daily.md', 'Today.md', 'file');
      expect(renamedPath).toBe('Notes/Today.md');
      renameVirtualWorkspaceContent(ws.path, 'Notes/Daily.md', renamedPath);
      expect(getVirtualWorkspaceFileContent(ws.path, renamedPath)).toBe('# Daily Note\n\nToday is good.');

      // Rename folder updates nested entry contents
      const renamedFolder = store.rename('Notes', 'Journal', 'folder');
      expect(renamedFolder).toBe('Journal');
      renameVirtualWorkspaceContent(ws.path, 'Notes', renamedFolder);
      expect(getVirtualWorkspaceFileContent(ws.path, 'Journal/Today.md')).toBe('# Daily Note\n\nToday is good.');

      // Snapshot reflects changes
      const snapshot = getVirtualWorkspaceSnapshot(ws.path);
      expect(snapshot.files.some((f) => f.relativePath === 'Journal/Today.md')).toBe(true);

      // Delete file
      store.delete('Journal/Today.md');
      deleteVirtualWorkspaceContent(ws.path, ['Journal/Today.md']);
      expect(getVirtualWorkspaceFileContent(ws.path, 'Journal/Today.md')).toBeNull();

      // Delete folder
      store.delete('Journal');
      const finalSnapshot = getVirtualWorkspaceSnapshot(ws.path);
      expect(finalSnapshot.files.some((f) => f.relativePath.startsWith('Journal'))).toBe(false);
    });
  });

  describe('removeUserVirtualWorkspace', () => {
    it('removes workspace and cleans up associated storage entries', () => {
      const ws = createUserVirtualWorkspace('To Delete');
      expect(listUserVirtualWorkspaces()).toHaveLength(1);

      const removed = removeUserVirtualWorkspace(ws.path);
      expect(removed).toBe(true);
      expect(listUserVirtualWorkspaces()).toHaveLength(0);

      const removedAgain = removeUserVirtualWorkspace(ws.path);
      expect(removedAgain).toBe(false);
    });
  });

  describe('UI virtual workspace buttons', () => {
    const mockAppState: any = {
      state: {
        theme: 'light',
        isMaximized: false,
        recentWorkspaces: [],
        settings: { language: 'en', keybindings: {} },
        hostPlatform: 'windows',
        sidebarCollapsed: false,
        tocCollapsed: true,
        focusMode: false,
        currentFile: null,
        toc: [],
        workspaceName: 'TestWorkspace',
      },
      dispatch: vi.fn(),
      toggleTheme: vi.fn(),
      openInEditor: vi.fn(),
      toggleToc: vi.fn(),
      toggleFocusMode: vi.fn(),
    };

    it('renders "New Virtual Workspace" button in SwitchWorkspaceModal when running in web', () => {
      (window as any).__webBus = new EventTarget();
      const mockBridge = {
        postMessage: vi.fn(),
        onMessage: vi.fn(() => () => {}),
        getState: vi.fn(),
        setState: vi.fn(),
      };
      const onClose = vi.fn();
      render(
        createElement(
          AppStateContext.Provider,
          { value: mockAppState },
          createElement(
            PlatformProvider,
            { bridge: mockBridge as any },
            createElement(SwitchWorkspaceModal, { isOpen: true, onClose, onConfirm: () => {}, targetPath: '/new/path' }),
          ),
        ),
      );

      const btn = screen.getByTestId('create-virtual-workspace-btn');
      expect(btn).toBeInTheDocument();
      fireEvent.click(btn);

      expect(mockBridge.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'createVirtualWorkspace' }),
      );
      expect(onClose).toHaveBeenCalled();
      delete (window as any).__webBus;
    });

    it('does not render "New Virtual Workspace" button in SwitchWorkspaceModal when not in web', () => {
      delete (window as any).__webBus;
      render(
        createElement(
          AppStateContext.Provider,
          { value: mockAppState },
          createElement(SwitchWorkspaceModal, { isOpen: true, onClose: () => {}, onConfirm: () => {}, targetPath: '/new/path' }),
        ),
      );
      expect(screen.queryByTestId('create-virtual-workspace-btn')).toBeNull();
    });

    it('renders "New Virtual Workspace" button in WorkspaceSelection when running in web', () => {
      (window as any).__webBus = new EventTarget();
      const mockBridge = {
        postMessage: vi.fn(),
        onMessage: vi.fn(() => () => {}),
        getState: vi.fn(),
        setState: vi.fn(),
      };
      render(
        createElement(
          AppStateContext.Provider,
          { value: mockAppState },
          createElement(
            PlatformProvider,
            { bridge: mockBridge as any },
            createElement(WorkspaceSelection),
          ),
        ),
      );

      const btn = screen.getByTestId('create-virtual-workspace-btn');
      expect(btn).toBeInTheDocument();
      fireEvent.click(btn);

      expect(mockBridge.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'createVirtualWorkspace' }),
      );
      delete (window as any).__webBus;
    });
  });

  describe('createFileModeHandlers loadVirtualWorkspace', () => {
    it('completes loading and sends readyAck and renderContent instead of hanging on setLoading', async () => {
      const ws = createUserVirtualWorkspace('Handlers Test');
      const messages: any[] = [];
      const testState: any = {
        activeHandle: null,
        activeWorkspacePath: '',
        activeWorkspaceName: '',
        currentFile: null,
        flatList: [],
        workspaceTree: null,
        searchIndex: null,
        singleFileHandle: null,
      };

      const handlers = createFileModeHandlers({
        state: testState,
        send: (msg) => messages.push(msg),
        sendLoading: (label) => messages.push({ command: 'setLoading', label }),
        hostInfo: () => ({ appVersion: '1.7.1' }),
        findFileInfo: (list, rel) => ({ relativePath: rel, title: rel }),
        extractWorkspaceName: (p) => p.split('/').pop() || 'Workspace',
        getWorkspaceOperationMetadata: () => ({}),
      });

      const result = await handlers.loadVirtualWorkspace(ws.path, true);
      expect(result).toBe(true);

      const commands = messages.map((m) => m.command);
      expect(commands).toContain('setLoading');
      expect(commands).toContain('readyAck');
      expect(commands).toContain('renderContent');

      const readyAck = messages.find((m) => m.command === 'readyAck');
      expect(readyAck.workspacePath).toBe(ws.path);
      expect(readyAck.workspaceName).toBe('Handlers Test');

      const renderContent = messages.find((m) => m.command === 'renderContent');
      expect(renderContent.filePath).toBe('Welcome.md');
    });
  });

  describe('createVirtualWorkspaceFromDroppedFiles', () => {
    it('creates virtual workspace with dropped files and removes default Welcome.md if not in dropped files', () => {
      const files = [
        { name: 'Notes.md', content: '# My Dropped Notes\n\nHello!' },
        { name: 'Summary.md', content: '# Summary\n\nDone.' },
      ];
      const meta = createVirtualWorkspaceFromDroppedFiles(files, 'Imported');
      expect(meta.name).toBe('Imported');
      expect(isVirtualWorkspacePath(meta.path)).toBe(true);

      const store = getVirtualWorkspaceEntryStore(meta.id);
      expect(store.entries.find((e) => e.path === 'Welcome.md')).toBeUndefined();
      expect(store.entries.find((e) => e.path === 'Notes.md')).toBeDefined();
      expect(store.entries.find((e) => e.path === 'Summary.md')).toBeDefined();

      expect(getVirtualWorkspaceFileContent(meta.id, 'Notes.md')).toBe('# My Dropped Notes\n\nHello!');
      expect(getVirtualWorkspaceFileContent(meta.id, 'Summary.md')).toBe('# Summary\n\nDone.');
    });

    it('keeps Welcome.md if Welcome.md is among the dropped files', () => {
      const files = [{ name: 'Welcome.md', content: '# Custom Welcome' }];
      const meta = createVirtualWorkspaceFromDroppedFiles(files);
      const content = getVirtualWorkspaceFileContent(meta.id, 'Welcome.md');
      expect(content).toBe('# Custom Welcome');
    });
  });

  describe('openDroppedFiles via web-host', () => {
    it('creates and opens a new virtual workspace when dropped files are received', async () => {
      initWebHost('file');
      const bus = getWebBus();
      (window as any).__webBus = bus;
      const hostMessages: any[] = [];
      const listener = (e: any) => hostMessages.push(e.detail);
      bus.addEventListener('host-message', listener);

      try {
        bus.dispatchEvent(
          new CustomEvent('webview-message', {
            detail: {
              command: 'openDroppedFiles',
              files: [{ name: 'DropDoc.md', content: '# Dropped Content' }],
            },
          }),
        );

        await new Promise((resolve) => setTimeout(resolve, 80));

        const readyAck = hostMessages.find((m) => m.command === 'readyAck');
        expect(readyAck).toBeDefined();
        expect(isVirtualWorkspacePath(readyAck.workspacePath)).toBe(true);

        const renderContent = hostMessages.find((m) => m.command === 'renderContent');
        expect(renderContent).toBeDefined();
        expect(renderContent.filePath).toBe('DropDoc.md');
        expect(renderContent.markdownSource).toBe('# Dropped Content');
      } finally {
        bus.removeEventListener('host-message', listener);
      }
    });

    it('automatically creates and loads Virtual Workspace 1 on ready when no workspace exists', async () => {
      initWebHost('file');
      const bus = getWebBus();
      (window as any).__webBus = bus;
      const hostMessages: any[] = [];
      const listener = (e: any) => hostMessages.push(e.detail);
      bus.addEventListener('host-message', listener);

      try {
        bus.dispatchEvent(
          new CustomEvent('webview-message', {
            detail: { command: 'ready' },
          }),
        );

        await new Promise((resolve) => setTimeout(resolve, 80));

        const readyAck = hostMessages.find((m) => m.command === 'readyAck');
        expect(readyAck).toBeDefined();
        expect(readyAck.workspaceName).toBe('Virtual Workspace 1');
        expect(isVirtualWorkspacePath(readyAck.workspacePath)).toBe(true);

        const renderContent = hostMessages.find((m) => m.command === 'renderContent');
        expect(renderContent).toBeDefined();
        expect(renderContent.filePath).toBe('Welcome.md');
      } finally {
        bus.removeEventListener('host-message', listener);
      }
    });

    it('emits empty workspaceName on readyAck after closeWorkspace and does not re-open', async () => {
      initWebHost('file');
      const bus = getWebBus();
      (window as any).__webBus = bus;
      const hostMessages: any[] = [];
      const listener = (e: any) => hostMessages.push(e.detail);
      bus.addEventListener('host-message', listener);

      try {
        bus.dispatchEvent(
          new CustomEvent('webview-message', {
            detail: { command: 'closeWorkspace' },
          }),
        );

        await new Promise((resolve) => setTimeout(resolve, 50));

        const closeAck = hostMessages.find((m) => m.command === 'readyAck');
        expect(closeAck).toBeDefined();
        expect(closeAck.workspaceName).toBe('');

        hostMessages.length = 0;
        bus.dispatchEvent(
          new CustomEvent('webview-message', {
            detail: { command: 'ready' },
          }),
        );

        await new Promise((resolve) => setTimeout(resolve, 50));

        const readyAck = hostMessages.find((m) => m.command === 'readyAck');
        expect(readyAck).toBeDefined();
        expect(readyAck.workspaceName).toBe('');
      } finally {
        bus.removeEventListener('host-message', listener);
      }
    });
  });
});
