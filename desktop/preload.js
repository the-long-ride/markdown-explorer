const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  postMessage: (msg) => ipcRenderer.send('webview-message', msg),
  onMessage: (callback) => {
    const subscription = (event, ...args) => callback(...args);
    ipcRenderer.on('host-message', subscription);
    return () => {
      ipcRenderer.removeListener('host-message', subscription);
    };
  }
});
