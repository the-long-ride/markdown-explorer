function exposePreloadApi({ contextBridgeInstance, ipcRendererInstance, webUtilsInstance } = {}) {
  const { createPreloadApi } = require('./preload-api');
  const api = createPreloadApi({
    ipcRenderer: ipcRendererInstance,
    webUtils: webUtilsInstance,
  });
  contextBridgeInstance.exposeInMainWorld('electronAPI', api);
}

/* v8 ignore next 7 */
try {
  const { contextBridge, ipcRenderer, webUtils } = require('electron');
  exposePreloadApi({
    contextBridgeInstance: contextBridge,
    ipcRendererInstance: ipcRenderer,
    webUtilsInstance: webUtils,
  });
} catch (_) {}

module.exports = { exposePreloadApi };
