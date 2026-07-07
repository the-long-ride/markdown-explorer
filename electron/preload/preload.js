function createPreloadApi({ ipcRenderer, webUtils }) {
  return {
    postMessage: (msg) => ipcRenderer.send('webview-message', msg),
    onMessage: (callback) => {
      const subscription = (event, ...args) => callback(...args);
      ipcRenderer.on('host-message', subscription);
      return () => {
        ipcRenderer.removeListener('host-message', subscription);
      };
    },
    getPathForFile: (file) => {
      try {
        return webUtils.getPathForFile(file);
      } catch {
        return file && file.path;
      }
    },
  };
}

function exposePreloadApi({ contextBridgeInstance, ipcRendererInstance, webUtilsInstance } = {}) {
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
} catch (err) {
  console.error('[preload] Failed to expose electronAPI:', err);
}

module.exports = { exposePreloadApi };
