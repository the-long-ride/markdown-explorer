const { contextBridge, ipcRenderer, webUtils } = require('electron');
const { createPreloadApi } = require('./preload-api');

contextBridge.exposeInMainWorld('electronAPI', createPreloadApi({ ipcRenderer, webUtils }));
