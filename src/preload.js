const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('stockDisplay', {
  getInitialState: () => ipcRenderer.invoke('app:get-initial-state'),
  fetchAsset: (assetId) => ipcRenderer.invoke('market:fetch-asset', assetId)
});
