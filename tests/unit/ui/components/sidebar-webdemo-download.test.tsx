import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createZipArchive, createZipBlob, crc32 } from '../../../../ui/src/utils/zipBuilder';
import {
  shouldShowWorkspaceZipButton,
  downloadWebDemoFile,
  downloadWebDemoFolderZip,
  downloadWebDemoWorkspaceZip,
  resolveFileContent,
} from '../../../../ui/src/utils/webDemoDownload';
import {
  loadSupportPromptState,
  saveSupportPromptState,
  resetSupportPromptCountersToBeginning,
  triggerSupportModalAndResetCounters,
} from '../../../../ui/src/utils/supportPromptStore';
import { buildSidebarItemMenuItems } from '../../../../ui/src/components/Sidebar/sidebarItemMenuItems';
import { getTranslations } from '../../../../ui/src/contexts/translations';
import { Sidebar } from '../../../../ui/src/components/Sidebar/Sidebar';

const mockDispatch = vi.fn();
const mockUpdateSettings = vi.fn();
const mockNavigate = vi.fn();

let mockState: any = {
  sidebarActiveTab: 'files',
  sidebarCollapsed: false,
  workspacePath: '/virtual://ws-1',
  workspaceName: 'Test Workspace',
  settings: { language: 'en', scopeFocus: {}, keybindings: {}, defaultHtmlPreview: true },
  currentFile: null,
  contentTabs: [],
  appRuntime: 'web',
  hostPlatform: 'unknown',
  fileList: [],
  tree: {
    name: 'Test Workspace',
    path: '/virtual://ws-1',
    files: [],
    children: [],
  },
};

vi.mock('../../../../ui/src/contexts/PlatformContext', () => ({
  usePlatform: () => ({
    postMessage: vi.fn(),
    onMessage: vi.fn(() => () => {}),
  }),
}));

vi.mock('../../../../ui/src/contexts/AppStateContext', () => ({
  useAppState: () => ({
    state: mockState,
    dispatch: mockDispatch,
    updateSettings: mockUpdateSettings,
    navigate: mockNavigate,
  }),
}));

vi.mock('../../../../ui/src/components/Sidebar/SidebarSearch', () => ({
  SidebarSearch: () => <div data-testid="sidebar-search" />,
}));

vi.mock('../../../../ui/src/components/Sidebar/TreeNode', () => ({
  FileNode: ({ file }: any) => <div data-testid="file-node">{file.fileName}</div>,
  FolderNodeView: ({ node }: any) => <div data-testid="folder-node">{node.name}</div>,
}));

describe('Web Demo Download, ZIP Archive & Donate Modal', () => {
  let createdAnchors: HTMLAnchorElement[] = [];
  let clickedAnchors: HTMLAnchorElement[] = [];

  beforeEach(() => {
    vi.clearAllMocks();
    createdAnchors = [];
    clickedAnchors = [];

    // Mock document.createElement('a') to observe downloads
    const origCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const el = origCreateElement(tagName);
      if (tagName === 'a') {
        const anchor = el as HTMLAnchorElement;
        createdAnchors.push(anchor);
        anchor.click = () => {
          clickedAnchors.push(anchor);
        };
      }
      return el;
    });

    // Mock URL.createObjectURL & URL.revokeObjectURL
    if (!globalThis.URL.createObjectURL) {
      globalThis.URL.createObjectURL = vi.fn((blob: Blob) => `blob:mock-url-${Math.random()}`);
    } else {
      vi.spyOn(globalThis.URL, 'createObjectURL').mockImplementation(() => `blob:mock-url-${Math.random()}`);
    }
    if (!globalThis.URL.revokeObjectURL) {
      globalThis.URL.revokeObjectURL = vi.fn();
    } else {
      vi.spyOn(globalThis.URL, 'revokeObjectURL').mockImplementation(() => {});
    }

    localStorage.clear();
  });

  afterEach(() => {
    delete (window as any).__webBus;
    delete (window as any).__openSupportModal;
    vi.restoreAllMocks();
  });

  describe('1. createZipArchive & createZipBlob', () => {
    it('calculates IEEE 802.3 CRC-32 correctly', () => {
      const data = new TextEncoder().encode('Hello World');
      const sum = crc32(data);
      expect(sum).toBe(0x4a17b156);
    });

    it('generates a valid ZIP binary with local headers, data, central directory and EOCD', () => {
      const zipBytes = createZipArchive([
        { path: 'hello.md', content: '# Hello' },
        { path: 'nested/doc.md', content: 'Nested content' },
      ]);

      expect(zipBytes.length).toBeGreaterThan(0);
      const view = new DataView(zipBytes.buffer, zipBytes.byteOffset, zipBytes.byteLength);

      // 1st Local header signature: 0x04034b50
      expect(view.getUint32(0, true)).toBe(0x04034b50);

      // Check UTF-8 flag (0x0800)
      expect(view.getUint16(6, true)).toBe(0x0800);

      // Check that central directory signature 0x02014b50 is present
      let foundCentralDir = false;
      let foundEOCD = false;
      for (let offset = 0; offset <= zipBytes.length - 4; offset++) {
        const sig = view.getUint32(offset, true);
        if (sig === 0x02014b50) foundCentralDir = true;
        if (sig === 0x06054b50) foundEOCD = true;
      }

      expect(foundCentralDir).toBe(true);
      expect(foundEOCD).toBe(true);

      const blob = createZipBlob([{ path: 'test.md', content: 'test' }]);
      expect(blob.type).toBe('application/zip');
    });
  });

  describe('2. File download & 3-dot menu in Web Demo', () => {
    it('shows "Download .md" in file 3-dot menu when in Web Demo', async () => {
      (window as any).__webBus = new EventTarget();

      const testState: any = {
        settings: { language: 'en' },
        fileList: [{ fsPath: '/test/notes.md', relativePath: 'notes.md', fileName: 'notes.md' }],
        documentSessions: {
          '/test/notes.md': { draftText: '# My Draft Notes' },
        },
      };

      const items = buildSidebarItemMenuItems({
        state: testState,
        target: { kind: 'file', path: '/test/notes.md', anchor: null as any },
        canOpenHtmlInBrowser: false,
        canOpenItemLocations: false,
        translations: getTranslations('en'),
        bridge: {} as any,
        navigate: vi.fn(),
        isPinned: false,
        pinLimitReached: false,
        onTogglePin: vi.fn(),
      });

      const downloadItem = items.find((item) => item.id === 'download-file');
      expect(downloadItem).toBeDefined();
      expect(downloadItem?.label).toBe('Download .md');

      downloadItem?.onSelect();

      await waitFor(() => {
        expect(clickedAnchors.length).toBe(1);
      });
      expect(clickedAnchors[0].download).toBe('notes.md');
    });

    it('disables history menu item with (Web unavailable) label when in Web Demo', () => {
      (window as any).__webBus = new EventTarget();

      const items = buildSidebarItemMenuItems({
        state: { settings: { language: 'en' }, fileList: [] } as any,
        target: { kind: 'file', path: '/test/notes.md', anchor: null as any },
        canOpenHtmlInBrowser: false,
        canOpenItemLocations: false,
        translations: getTranslations('en'),
        bridge: {} as any,
        navigate: vi.fn(),
        isPinned: false,
        pinLimitReached: false,
        onTogglePin: vi.fn(),
      });

      const historyItem = items.find((item) => item.id === 'history');
      expect(historyItem).toBeDefined();
      expect(historyItem?.disabled).toBe(true);
      expect(historyItem?.label).toContain('(Web unavailable)');
    });

    it('does NOT show download menu items when not in Web Demo', () => {
      delete (window as any).__webBus;

      const items = buildSidebarItemMenuItems({
        state: { settings: { language: 'en' }, fileList: [] } as any,
        target: { kind: 'file', path: '/test/notes.md', anchor: null as any },
        canOpenHtmlInBrowser: false,
        canOpenItemLocations: false,
        translations: getTranslations('en'),
        bridge: {} as any,
        navigate: vi.fn(),
        isPinned: false,
        pinLimitReached: false,
        onTogglePin: vi.fn(),
      });

      expect(items.find((item) => item.id === 'download-file')).toBeUndefined();
      expect(items.find((item) => item.id === 'download-folder-zip')).toBeUndefined();
    });
  });

  describe('3. Folder ZIP download & Donate modal counter reset', () => {
    it('shows "Download ZIP" in folder 3-dot menu and triggers ZIP download & donate modal', async () => {
      (window as any).__webBus = new EventTarget();

      // Set some initial counters in support store
      const initialStore = loadSupportPromptState();
      initialStore.totalUsageMs = 500000;
      initialStore.webFilesOpenedSinceReset = 5;
      initialStore.webUsageMsSinceReset = 100000;
      saveSupportPromptState(initialStore);

      const modalOpenSpy = vi.fn();
      window.addEventListener('open-support-prompt-modal', modalOpenSpy);

      const testState: any = {
        settings: { language: 'en' },
        fileList: [
          { fsPath: '/test/docs/intro.md', relativePath: 'docs/intro.md', fileName: 'intro.md' },
          { fsPath: '/test/docs/guide.md', relativePath: 'docs/guide.md', fileName: 'guide.md' },
        ],
        documentSessions: {
          '/test/docs/intro.md': { draftText: '# Intro' },
          '/test/docs/guide.md': { draftText: '# Guide' },
        },
      };

      const items = buildSidebarItemMenuItems({
        state: testState,
        target: { kind: 'folder', path: 'docs', anchor: null as any },
        canOpenHtmlInBrowser: false,
        canOpenItemLocations: false,
        translations: getTranslations('en'),
        bridge: {} as any,
        navigate: vi.fn(),
        isPinned: false,
        pinLimitReached: false,
        onTogglePin: vi.fn(),
      });

      const zipItem = items.find((item) => item.id === 'download-folder-zip');
      expect(zipItem).toBeDefined();
      expect(zipItem?.label).toBe('Download ZIP');

      zipItem?.onSelect();

      await waitFor(() => {
        expect(clickedAnchors.length).toBe(1);
      });
      expect(clickedAnchors[0].download).toBe('docs.zip');

      // Modal open event should have been dispatched
      expect(modalOpenSpy).toHaveBeenCalled();

      // Support prompt counters should be reset to beginning
      const updatedStore = loadSupportPromptState();
      expect(updatedStore.totalUsageMs).toBe(0);
      expect(updatedStore.lastPromptUsageMs).toBe(0);
      expect(updatedStore.webFilesOpenedSinceReset).toBe(0);
      expect(updatedStore.webUsageMsSinceReset).toBe(0);
      expect(updatedStore.webPromptCount).toBe(0);
      expect(updatedStore.webLastResetTimestampMs).toBeGreaterThan(0);

      window.removeEventListener('open-support-prompt-modal', modalOpenSpy);
    });
  });

  describe('4. shouldShowWorkspaceZipButton & Sidebar Header button', () => {
    it('shouldShowWorkspaceZipButton returns false when not web demo or only single Welcome.md', () => {
      expect(shouldShowWorkspaceZipButton(false, [{ fileName: 'Welcome.md', relativePath: 'Welcome.md' } as any])).toBe(false);
      expect(shouldShowWorkspaceZipButton(true, [])).toBe(false);
      expect(shouldShowWorkspaceZipButton(true, [{ fileName: 'Welcome.md', relativePath: 'Welcome.md' } as any])).toBe(false);
    });

    it('shouldShowWorkspaceZipButton returns true when multiple files or non-Welcome file exists', () => {
      expect(
        shouldShowWorkspaceZipButton(true, [
          { fileName: 'Welcome.md', relativePath: 'Welcome.md' } as any,
          { fileName: 'doc.md', relativePath: 'doc.md' } as any,
        ]),
      ).toBe(true);

      expect(
        shouldShowWorkspaceZipButton(true, [
          { fileName: 'my-custom-doc.md', relativePath: 'my-custom-doc.md' } as any,
        ]),
      ).toBe(true);
    });

    it('does NOT render sidebar-download-workspace-zip button when only Welcome.md is present', () => {
      (window as any).__webBus = new EventTarget();
      mockState = {
        ...mockState,
        fileList: [{ fsPath: '/test/Welcome.md', relativePath: 'Welcome.md', fileName: 'Welcome.md', title: 'Welcome' }],
        tree: {
          name: 'Test Workspace',
          path: '/virtual://ws-1',
          files: [{ fsPath: '/test/Welcome.md', relativePath: 'Welcome.md', fileName: 'Welcome.md', title: 'Welcome' }],
          children: [],
        },
      };

      render(<Sidebar />);
      expect(screen.queryByTestId('sidebar-download-workspace-zip')).toBeNull();
    });

    it('renders sidebar-download-workspace-zip button when user has other files, and clicking triggers ZIP download & donate modal', async () => {
      (window as any).__webBus = new EventTarget();
      mockState = {
        ...mockState,
        fileList: [
          { fsPath: '/test/Welcome.md', relativePath: 'Welcome.md', fileName: 'Welcome.md', title: 'Welcome' },
          { fsPath: '/test/guide.md', relativePath: 'guide.md', fileName: 'guide.md', title: 'Guide' },
        ],
        documentSessions: {
          '/test/guide.md': { draftText: '# Guide Content' },
        },
        tree: {
          name: 'Test Workspace',
          path: '/virtual://ws-1',
          files: [
            { fsPath: '/test/Welcome.md', relativePath: 'Welcome.md', fileName: 'Welcome.md', title: 'Welcome' },
            { fsPath: '/test/guide.md', relativePath: 'guide.md', fileName: 'guide.md', title: 'Guide' },
          ],
          children: [],
        },
      };

      const modalOpenSpy = vi.fn();
      window.addEventListener('open-support-prompt-modal', modalOpenSpy);

      render(<Sidebar />);
      const zipBtn = screen.getByTestId('sidebar-download-workspace-zip');
      expect(zipBtn).toBeDefined();

      fireEvent.click(zipBtn);

      await waitFor(() => {
        expect(clickedAnchors.length).toBe(1);
      });
      expect(clickedAnchors[0].download).toBe('Test Workspace.zip');
      expect(modalOpenSpy).toHaveBeenCalled();

      window.removeEventListener('open-support-prompt-modal', modalOpenSpy);
    });
  });

  describe('5. resolveFileContent fallback to Web Demo Bus', () => {
    it('requests content via bus with loadSearchPreview when not available in sessions/storage', async () => {
      const bus = new EventTarget();
      (window as any).__webBus = bus;

      bus.addEventListener('webview-message', (e: Event) => {
        const detail = (e as CustomEvent).detail;
        if (detail.command === 'loadSearchPreview') {
          bus.dispatchEvent(
            new CustomEvent('host-message', {
              detail: {
                command: 'searchPreviewResult',
                requestId: detail.requestId,
                ok: true,
                markdownSource: '# Content from bus host',
              },
            }),
          );
        }
      });

      const content = await resolveFileContent(
        { fsPath: '/ws/remote.md', relativePath: 'remote.md', fileName: 'remote.md' } as any,
        { settings: {}, fileList: [] } as any,
      );

      expect(content).toBe('# Content from bus host');
    });
  });
});
