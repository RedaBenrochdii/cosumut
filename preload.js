const { contextBridge, ipcRenderer } = require('electron');

// Expose des fonctions sécurisées de l'IPC (Inter-Process Communication) pour React
contextBridge.exposeInMainWorld('electron', {
  onExcelFileLoaded: (callback) => ipcRenderer.on('load-excel', callback),
});
