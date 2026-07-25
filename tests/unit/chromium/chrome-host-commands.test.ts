import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resetWorkspaceState, sendToWebview } from '../../../chromium-xtension/src/chrome-host';

function sendWebviewMessage(msg: any) {
  (window as any).__chromeExtBus.dispatchEvent(
    new CustomEvent('webview-message', { detail: msg }),
  );
}

describe('chrome-host bus command handlers', () => {
  const sentMessages: any[] = [];

  beforeEach(() => {
    sentMessages.length = 0;
    (window as any).__chromeExtBus = (window as any).__chromeExtBus || new EventTarget();
    (window as any).__chromeExtBus.addEventListener(
      'host-message',
      ((e: Event) => {
        sentMessages.push((e as CustomEvent).detail);
      }) as EventListener,
    );
    (globalThis as any).chrome = { runtime: { getManifest: () => ({ version: '1.0.0' }) } };
  });

  afterEach(() => {
    resetWorkspaceState();
    delete (globalThis as any).chrome;
  });

  describe('ready command', () => {
    it('sends readyAck with empty workspace when no handle is active', async () => {
      sendWebviewMessage({ command: 'ready' });
      await new Promise((r) => setTimeout(r, 100));

      const readyAck = sentMessages.find((m) => m.command === 'readyAck');
      expect(readyAck).toBeDefined();
      expect(readyAck.fileList).toEqual([]);
      expect(readyAck.tree).toBeNull();
      expect(readyAck.workspaceName).toBe('');
      expect(readyAck.appVersion).toBe('1.0.0');
      expect(readyAck.appRuntime).toBe('chrome');
    });

    it('only handles ready once (second ready is ignored)', async () => {
      sendWebviewMessage({ command: 'ready' });
      await new Promise((r) => setTimeout(r, 50));
      const countBefore = sentMessages.filter((m) => m.command === 'readyAck').length;
      sendWebviewMessage({ command: 'ready' });
      await new Promise((r) => setTimeout(r, 50));
      const countAfter = sentMessages.filter((m) => m.command === 'readyAck').length;
      expect(countAfter).toBe(countBefore);
    });
  });

  describe('navigate command', () => {
    it('sends welcome when path is null', async () => {
      sendWebviewMessage({ command: 'navigate', path: null });
      await new Promise((r) => setTimeout(r, 100));

      const renderMsg = sentMessages.find((m) => m.command === 'renderContent' && m.relativePath === 'Welcome Page');
      expect(renderMsg).toBeDefined();
    });

    it('sends welcome when path is empty string', async () => {
      sendWebviewMessage({ command: 'navigate', path: '' });
      await new Promise((r) => setTimeout(r, 100));

      const renderMsg = sentMessages.find((m) => m.command === 'renderContent' && m.relativePath === 'Welcome Page');
      expect(renderMsg).toBeDefined();
    });
  });

  describe('refresh command', () => {
    it('does nothing when no active handle', async () => {
      const msgCountBefore = sentMessages.length;
      sendWebviewMessage({ command: 'refresh' });
      await new Promise((r) => setTimeout(r, 100));
      expect(sentMessages.length).toBe(msgCountBefore);
    });
  });

  describe('openFolder command', () => {
    function createMockHandle(name: string) {
      const asyncIterator = {
        next: () => Promise.resolve({ done: true, value: undefined }),
      };
      return {
        name,
        isPermissionGranted: true,
        values: () => ({
          [Symbol.asyncIterator]: () => asyncIterator,
          next: () => Promise.resolve({ done: true, value: undefined }),
        }),
        keys: () => ({
          [Symbol.asyncIterator]: () => asyncIterator,
          next: () => Promise.resolve({ done: true, value: undefined }),
        }),
        getDirectoryHandle: vi.fn().mockRejectedValue(new Error('not found')),
        getFileHandle: vi.fn().mockRejectedValue(new Error('not found')),
      };
    }

    it('sends loading and readyAck when handle provided', async () => {
      const mockHandle = createMockHandle('test-workspace');

      sendWebviewMessage({ command: 'openFolder', handle: mockHandle, openFirstFile: false });
      await new Promise((r) => setTimeout(r, 300));

      const loadingMsg = sentMessages.find((m) => m.command === 'setLoading');
      expect(loadingMsg).toBeDefined();
      expect(loadingMsg.label).toBe('Loading workspace...');

      const readyAck = sentMessages.find((m) => m.command === 'readyAck' && m.workspaceName === 'test-workspace');
      expect(readyAck).toBeDefined();
      expect(readyAck.workspaceName).toBe('test-workspace');
    });

    it('sends readyAck with workspace path after scan', async () => {
      const mockHandle = createMockHandle('docs-project');

      sendWebviewMessage({ command: 'openFolder', handle: mockHandle, openFirstFile: false });
      await new Promise((r) => setTimeout(r, 300));

      const readyAck = sentMessages.find((m) => m.command === 'readyAck' && m.workspacePath === 'docs-project');
      expect(readyAck).toBeDefined();
    });
  });

  describe('openExternal command', () => {
    it('does not open invalid URL (javascript:)', async () => {
      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

      sendWebviewMessage({ command: 'openExternal', url: 'javascript:alert(1)' });
      await new Promise((r) => setTimeout(r, 50));

      expect(openSpy).not.toHaveBeenCalled();
      openSpy.mockRestore();
    });

    it('does not open non-string URL', async () => {
      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

      sendWebviewMessage({ command: 'openExternal', url: 123 });
      await new Promise((r) => setTimeout(r, 50));

      expect(openSpy).not.toHaveBeenCalled();
      openSpy.mockRestore();
    });

    it('does not open undefined URL', async () => {
      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

      sendWebviewMessage({ command: 'openExternal', url: undefined });
      await new Promise((r) => setTimeout(r, 50));

      expect(openSpy).not.toHaveBeenCalled();
      openSpy.mockRestore();
    });

    it('does not open ftp URL', async () => {
      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

      sendWebviewMessage({ command: 'openExternal', url: 'ftp://example.com' });
      await new Promise((r) => setTimeout(r, 50));

      expect(openSpy).not.toHaveBeenCalled();
      openSpy.mockRestore();
    });

    it('does not open data URL', async () => {
      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

      sendWebviewMessage({ command: 'openExternal', url: 'data:text/html,test' });
      await new Promise((r) => setTimeout(r, 50));

      expect(openSpy).not.toHaveBeenCalled();
      openSpy.mockRestore();
    });

    it('opens valid https URL in new tab', async () => {
      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

      sendWebviewMessage({ command: 'openExternal', url: 'https://example.com' });
      await new Promise((r) => setTimeout(r, 50));

      expect(openSpy).toHaveBeenCalledWith('https://example.com', '_blank');
      openSpy.mockRestore();
    });

    it('opens valid http URL in new tab', async () => {
      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

      sendWebviewMessage({ command: 'openExternal', url: 'http://example.com' });
      await new Promise((r) => setTimeout(r, 50));

      expect(openSpy).toHaveBeenCalledWith('http://example.com', '_blank');
      openSpy.mockRestore();
    });


    it('opens valid file URL in a new tab', async () => {
      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

      sendWebviewMessage({ command: 'openExternal', url: 'file:///tmp/readme.md' });
      await new Promise((r) => setTimeout(r, 50));

      expect(openSpy).toHaveBeenCalledWith('file:///tmp/readme.md', '_blank');
      openSpy.mockRestore();
    });

    it('opens valid uppercase HTTPS URL', async () => {
      const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

      sendWebviewMessage({ command: 'openExternal', url: 'HTTPS://EXAMPLE.COM' });
      await new Promise((r) => setTimeout(r, 50));

      expect(openSpy).toHaveBeenCalledWith('HTTPS://EXAMPLE.COM', '_blank');
      openSpy.mockRestore();
    });
  });

  describe('searchWorkspace command', () => {
    it('returns empty results when no search index', async () => {
      sendWebviewMessage({ command: 'searchWorkspace', query: 'test', requestId: 'r1' });
      await new Promise((r) => setTimeout(r, 100));

      const result = sentMessages.find((m) => m.command === 'workspaceSearchResults');
      expect(result).toBeDefined();
      expect(result.requestId).toBe('r1');
      expect(result.results).toEqual([]);
    });

    it('handles empty query normalization', async () => {
      sendWebviewMessage({ command: 'searchWorkspace', query: '   ', requestId: 'r2' });
      await new Promise((r) => setTimeout(r, 100));

      const result = sentMessages.find((m) => m.command === 'workspaceSearchResults');
      expect(result).toBeDefined();
      expect(result.requestId).toBe('r2');
      expect(result.results).toEqual([]);
    });

    it('handles undefined query', async () => {
      sendWebviewMessage({ command: 'searchWorkspace', query: undefined, requestId: 'r3' });
      await new Promise((r) => setTimeout(r, 100));

      const result = sentMessages.find((m) => m.command === 'workspaceSearchResults');
      expect(result).toBeDefined();
      expect(result.results).toEqual([]);
    });

    it('handles null query', async () => {
      sendWebviewMessage({ command: 'searchWorkspace', query: null, requestId: 'r4' });
      await new Promise((r) => setTimeout(r, 100));

      const result = sentMessages.find((m) => m.command === 'workspaceSearchResults');
      expect(result).toBeDefined();
    });
  });

  describe('closeWorkspace command', () => {
    it('sends readyAck with empty state and resets workspace', async () => {
      sendWebviewMessage({ command: 'closeWorkspace' });
      await new Promise((r) => setTimeout(r, 200));

      const readyAck = sentMessages.find(
        (m) => m.command === 'readyAck' && m.workspaceName === '',
      );
      expect(readyAck).toBeDefined();
      expect(readyAck.fileList).toEqual([]);
      expect(readyAck.tree).toBeNull();
      expect(readyAck.workspaceName).toBe('');
      expect(readyAck.appVersion).toBe('1.0.0');
    });

    it('allows ready to be handled again after closeWorkspace', async () => {
      sendWebviewMessage({ command: 'ready' });
      await new Promise((r) => setTimeout(r, 100));

      const firstAckCount = sentMessages.filter((m) => m.command === 'readyAck').length;
      expect(firstAckCount).toBeGreaterThanOrEqual(1);

      sendWebviewMessage({ command: 'closeWorkspace' });
      await new Promise((r) => setTimeout(r, 100));

      sendWebviewMessage({ command: 'ready' });
      await new Promise((r) => setTimeout(r, 100));

      const totalAcks = sentMessages.filter((m) => m.command === 'readyAck').length;
      expect(totalAcks).toBeGreaterThan(firstAckCount);
    });
  });

  describe('message without detail', () => {
    it('is ignored gracefully without error', async () => {
      const msgCountBefore = sentMessages.length;
      (window as any).__chromeExtBus.dispatchEvent(
        new CustomEvent('webview-message', { detail: undefined }),
      );
      await new Promise((r) => setTimeout(r, 50));
      expect(sentMessages.length).toBe(msgCountBefore);
    });
  });

  describe('unknown command', () => {
    it('is ignored without error', async () => {
      const msgCountBefore = sentMessages.length;
      sendWebviewMessage({ command: 'unknownCommand' });
      await new Promise((r) => setTimeout(r, 50));
      expect(sentMessages.length).toBe(msgCountBefore);
    });
  });

  describe('deleteRecentWorkspace command', () => {
    it('dispatches recentWorkspacesChanged after deletion', async () => {
      sendWebviewMessage({ command: 'deleteRecentWorkspace', path: '/some/path' });
      await new Promise((r) => setTimeout(r, 200));

      const changed = sentMessages.find((m) => m.command === 'recentWorkspacesChanged');
      expect(changed).toBeDefined();
      expect(changed.recentWorkspaces).toBeDefined();
    });
  });

  describe('loadWorkspaceSearchIndexes command', () => {
    it('sends no workspaceSearchIndexLoaded when no tabs match', async () => {
      sendWebviewMessage({
        command: 'loadWorkspaceSearchIndexes',
        tabs: [
          { tabId: '1', workspacePath: '' },
          { tabId: '2', workspacePath: '/other' },
        ],
      });
      await new Promise((r) => setTimeout(r, 50));

      const loaded = sentMessages.find((m) => m.command === 'workspaceSearchIndexLoaded');
      expect(loaded).toBeUndefined();
    });

    it('handles undefined tabs gracefully', async () => {
      sendWebviewMessage({ command: 'loadWorkspaceSearchIndexes' });
      await new Promise((r) => setTimeout(r, 50));

      expect(sentMessages.find((m) => m.command === 'workspaceSearchIndexLoaded')).toBeUndefined();
    });

    it('handles empty tabs array', async () => {
      sendWebviewMessage({ command: 'loadWorkspaceSearchIndexes', tabs: [] });
      await new Promise((r) => setTimeout(r, 50));

      expect(sentMessages.find((m) => m.command === 'workspaceSearchIndexLoaded')).toBeUndefined();
    });
  });

  describe('indexWorkspaceSearchItems command', () => {
    it('is handled without error when no search index exists', async () => {
      const msgCountBefore = sentMessages.length;
      sendWebviewMessage({ command: 'indexWorkspaceSearchItems', items: [] });
      await new Promise((r) => setTimeout(r, 50));
      expect(sentMessages.length).toBe(msgCountBefore);
    });
  });

  describe('sendToWebview', () => {
    it('dispatches host-message via bus', () => {
      sendToWebview({ command: 'test-cmd', value: 42 });
      const msg = sentMessages.find((m) => m.command === 'test-cmd');
      expect(msg).toBeDefined();
      expect(msg.value).toBe(42);
    });
  });
});
