import { describe, expect, test, vi } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createPreloadApi, exposePreloadApi } = require('../../../electron/preload/preload.js');

describe('createPreloadApi', () => {
  test('postMessage calls ipcRenderer.send with webview-message channel', () => {
    const ipcRenderer = { send: vi.fn(), on: vi.fn(), removeListener: vi.fn() };
    const webUtils = { getPathForFile: vi.fn() };
    const api = createPreloadApi({ ipcRenderer, webUtils });

    api.postMessage({ command: 'test' });
    expect(ipcRenderer.send).toHaveBeenCalledWith('webview-message', { command: 'test' });
  });

  test('onMessage subscribes via ipcRenderer.on and returns unsubscribe function', () => {
    const listeners: Map<string, Function[]> = new Map();
    const ipcRenderer = {
      send: vi.fn(),
      on: vi.fn((channel: string, handler: Function) => {
        if (!listeners.has(channel)) listeners.set(channel, []);
        listeners.get(channel)!.push(handler);
      }),
      removeListener: vi.fn((channel: string, handler: Function) => {
        const list = listeners.get(channel);
        if (list) {
          const idx = list.indexOf(handler);
          if (idx >= 0) list.splice(idx, 1);
        }
      }),
    };
    const webUtils = { getPathForFile: vi.fn() };
    const api = createPreloadApi({ ipcRenderer, webUtils });

    const callback = vi.fn();
    const unsubscribe = api.onMessage(callback);

    expect(ipcRenderer.on).toHaveBeenCalledWith('host-message', expect.any(Function));

    const hostHandlers = listeners.get('host-message')!;
    expect(hostHandlers).toHaveLength(1);

    hostHandlers[0]({}, 'arg1', 'arg2');
    expect(callback).toHaveBeenCalledWith('arg1', 'arg2');
    callback.mockClear();

    unsubscribe();
    expect(ipcRenderer.removeListener).toHaveBeenCalledWith('host-message', expect.any(Function));
  });

  test('getPathForFile uses webUtils.getPathForFile when available', () => {
    const ipcRenderer = { send: vi.fn(), on: vi.fn(), removeListener: vi.fn() };
    const webUtils = { getPathForFile: vi.fn((file: any) => '/resolved/path') };
    const api = createPreloadApi({ ipcRenderer, webUtils });

    const result = api.getPathForFile({ path: '/original/path' });
    expect(webUtils.getPathForFile).toHaveBeenCalledWith({ path: '/original/path' });
    expect(result).toBe('/resolved/path');
  });

  test('getPathForFile falls back to file.path when webUtils throws', () => {
    const ipcRenderer = { send: vi.fn(), on: vi.fn(), removeListener: vi.fn() };
    const webUtils = { getPathForFile: vi.fn(() => { throw new Error('not available'); }) };
    const api = createPreloadApi({ ipcRenderer, webUtils });

    const result = api.getPathForFile({ path: '/fallback/path' });
    expect(result).toBe('/fallback/path');
  });

  test('getPathForFile returns undefined when file is undefined', () => {
    const ipcRenderer = { send: vi.fn(), on: vi.fn(), removeListener: vi.fn() };
    const webUtils = { getPathForFile: vi.fn(() => { throw new Error('not available'); }) };
    const api = createPreloadApi({ ipcRenderer, webUtils });

    const result = api.getPathForFile(undefined);
    expect(result).toBeUndefined();
  });

  test('exposes the same API created by createPreloadApi', () => {
    const exposeInMainWorld = vi.fn();
    const ipcRenderer = { send: vi.fn(), on: vi.fn(), removeListener: vi.fn() };
    const webUtils = { getPathForFile: vi.fn() };

    exposePreloadApi({
      contextBridgeInstance: { exposeInMainWorld },
      ipcRendererInstance: ipcRenderer,
      webUtilsInstance: webUtils,
    });

    expect(exposeInMainWorld).toHaveBeenCalledWith(
      'electronAPI',
      expect.objectContaining({
        isDebug: expect.any(Boolean),
        postMessage: expect.any(Function),
        onMessage: expect.any(Function),
        getPathForFile: expect.any(Function),
      }),
    );
  });

  test('createPreloadApi accepts explicit isDebug option', () => {
    const ipcRenderer = { send: vi.fn(), on: vi.fn(), removeListener: vi.fn() };
    const webUtils = { getPathForFile: vi.fn() };
    const apiTrue = createPreloadApi({ ipcRenderer, webUtils, isDebug: true });
    expect(apiTrue.isDebug).toBe(true);

    const apiFalse = createPreloadApi({ ipcRenderer, webUtils, isDebug: false });
    expect(apiFalse.isDebug).toBe(false);
  });
});
