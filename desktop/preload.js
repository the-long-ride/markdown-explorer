const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
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
});
