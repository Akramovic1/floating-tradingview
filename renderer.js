// Preload script for the renderer process
const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Settings
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  
  // Window operations
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  closeWindow: () => ipcRenderer.invoke('close-window'),
  
  // Event listeners
  onShowSettings: (callback) => ipcRenderer.on('show-settings', callback),
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
});

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('Floating TradingView Desktop App loaded');
});