import { describe, expect, test, vi } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

describe('preload.js exposePreloadApi', () => {
  test('calls contextBridgeInstance.exposeInMainWorld with electronAPI key', () => {
    const contextBridgeInstance = { exposeInMainWorld: vi.fn() };
    const ipcRendererInstance = { send: vi.fn(), on: vi.fn(), removeListener: vi.fn() };
    const webUtilsInstance = { getPathForFile: vi.fn() };

    const { exposePreloadApi } = require('../../../desktop/preload.js');
    exposePreloadApi({ contextBridgeInstance, ipcRendererInstance, webUtilsInstance });

    expect(contextBridgeInstance.exposeInMainWorld).toHaveBeenCalledTimes(1);
    expect(contextBridgeInstance.exposeInMainWorld).toHaveBeenCalledWith(
      'electronAPI',
      expect.objectContaining({
        postMessage: expect.any(Function),
        onMessage: expect.any(Function),
        getPathForFile: expect.any(Function),
      }),
    );
  });

  test('exposed API has expected shape', () => {
    const contextBridgeInstance = { exposeInMainWorld: vi.fn() };
    const ipcRendererInstance = { send: vi.fn(), on: vi.fn(), removeListener: vi.fn() };
    const webUtilsInstance = { getPathForFile: vi.fn(() => '/test') };

    const { exposePreloadApi } = require('../../../desktop/preload.js');
    exposePreloadApi({ contextBridgeInstance, ipcRendererInstance, webUtilsInstance });

    const api = contextBridgeInstance.exposeInMainWorld.mock.calls[0][1];
    expect(typeof api.postMessage).toBe('function');
    expect(typeof api.onMessage).toBe('function');
    expect(typeof api.getPathForFile).toBe('function');
  });
});