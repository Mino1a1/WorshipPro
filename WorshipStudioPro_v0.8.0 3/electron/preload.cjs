const { contextBridge, ipcRenderer, webUtils } = require('electron');
contextBridge.exposeInMainWorld('wspDesktop', Object.freeze({
  getInfo: () => ipcRenderer.invoke('desktop:get-info'),
  getStreamDeckInfo: () => ipcRenderer.invoke('streamdeck:get-info'),
  extractPdfText: (filePath, forceOcr = false) => ipcRenderer.invoke('pdf:extract-text', filePath, forceOcr),
  openOutput: displayId => ipcRenderer.invoke('desktop:open-output', displayId),
  closeOutput: () => ipcRenderer.invoke('desktop:close-output'),
  toggleMainFullscreen: () => ipcRenderer.invoke('desktop:fullscreen-main'),
  getPathForFile: file => webUtils.getPathForFile(file),
  saveMediaFile: payload => ipcRenderer.invoke('media:save-file', payload),
  saveMediaBytes: payload => ipcRenderer.invoke('media:save-bytes', payload),
  deleteMedia: id => ipcRenderer.invoke('media:delete', id),
  readEasyWorshipDatabase: payload => ipcRenderer.invoke('easyworship:read-database', payload)
}));
