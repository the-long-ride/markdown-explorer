function isElectronDebug() {
  try {
    const isPackaged = Boolean(process.resourcesPath && !process.defaultApp);
    const isTruthy = (v) => /^(1|true|yes|on)$/i.test(String(v || ''));
    return (
      !isPackaged ||
      Boolean(process.defaultApp) ||
      isTruthy(process.env?.MARKDOWN_EXPLORER_DEBUG) ||
      Boolean(process.argv?.includes('--debug') || process.argv?.includes('--devtools')) ||
      process.env?.NODE_ENV === 'development'
    );
  } catch {
    return false;
  }
}

function createPreloadApi({ ipcRenderer, webUtils, isDebug = isElectronDebug() } = {}) {
  // One ipc listener fans out to every UI subscriber; one listener per
  // subscriber tripped Node's MaxListenersExceededWarning.
  const subscribers = new Set();
  const dispatch = (_event, ...args) => {
    for (const subscriber of [...subscribers]) {
      try {
        subscriber.callback(...args);
      } catch (error) {
        console.error('[preload] host-message subscriber failed:', error);
      }
    }
  };
  return {
    isDebug: Boolean(isDebug),
    postMessage: (msg) => ipcRenderer.send('webview-message', msg),
    onMessage: (callback) => {
      if (subscribers.size === 0) ipcRenderer.on('host-message', dispatch);
      const subscriber = { callback };
      subscribers.add(subscriber);
      return () => {
        if (!subscribers.delete(subscriber)) return;
        if (subscribers.size === 0) ipcRenderer.removeListener('host-message', dispatch);
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

module.exports = { createPreloadApi, exposePreloadApi };
