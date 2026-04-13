const { app, BrowserWindow, Menu, Tray, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const Store = require('electron-store');

// Initialize electron store for settings persistence
const store = new Store();

class FloatingTradingViewApp {
  constructor() {
    this.mainWindow = null;
    this.tray = null;
    this.isQuiting = false;
    
    // Default settings
    this.settings = {
      symbol: 'BTCUSD',
      interval: 'D',
      theme: 'dark',
      style: '1',
      width: 600,
      height: 400,
      x: 100,
      y: 100,
      opacity: 1,
      alwaysOnTop: true,
      ...store.get('settings', {})
    };
  }

  init() {
    // Handle app ready
    app.whenReady().then(() => {
      this.createWindow();
      this.createTray();
      this.setupIPC();
    });

    // Handle all windows closed
    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });

    // Handle app activate (macOS)
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        this.createWindow();
      }
    });

    // Handle before quit
    app.on('before-quit', () => {
      this.isQuiting = true;
    });
  }

  createWindow() {
    // Create the browser window
    this.mainWindow = new BrowserWindow({
      width: this.settings.width,
      height: this.settings.height,
      x: this.settings.x,
      y: this.settings.y,
      minWidth: 300,
      minHeight: 200,
      frame: true,
      transparent: false,
      alwaysOnTop: this.settings.alwaysOnTop,
      opacity: this.settings.opacity,
      show: false, // Don't show until ready
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        enableRemoteModule: false,
        preload: path.join(__dirname, 'renderer.js'),
        webSecurity: false // Allow loading external content
      },
      icon: this.getIconPath()
    });

    // Load the app
    this.mainWindow.loadFile('index.html');

    // Show window when ready
    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow.show();
      
      // Focus on the window
      this.mainWindow.focus();
    });

    // Handle window closed
    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });

    // Handle window close (minimize to tray on close)
    this.mainWindow.on('close', (event) => {
      if (!this.isQuiting && this.tray) {
        event.preventDefault();
        this.mainWindow.hide();
        
        // Show notification on first minimize
        if (process.platform === 'win32') {
          this.tray.displayBalloon({
            iconType: 'info',
            title: 'Floating TradingView',
            content: 'App was minimized to tray'
          });
        }
      }
    });

    // Save window position and size when moved/resized
    this.mainWindow.on('moved', () => {
      this.saveWindowBounds();
    });

    this.mainWindow.on('resized', () => {
      this.saveWindowBounds();
    });

    // Create context menu
    this.createMenu();
  }

  createTray() {
    const iconPath = this.getIconPath();
    this.tray = new Tray(iconPath);
    
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Show/Hide',
        click: () => {
          if (this.mainWindow.isVisible()) {
            this.mainWindow.hide();
          } else {
            this.mainWindow.show();
            this.mainWindow.focus();
          }
        }
      },
      {
        label: 'Always on Top',
        type: 'checkbox',
        checked: this.settings.alwaysOnTop,
        click: (menuItem) => {
          this.settings.alwaysOnTop = menuItem.checked;
          this.mainWindow.setAlwaysOnTop(menuItem.checked);
          this.saveSettings();
        }
      },
      { type: 'separator' },
      {
        label: 'Settings',
        click: () => {
          this.showSettings();
        }
      },
      {
        label: 'About',
        click: () => {
          dialog.showMessageBox(this.mainWindow, {
            type: 'info',
            title: 'About Floating TradingView',
            message: 'Floating TradingView Desktop v1.0.0',
            detail: 'A cross-platform floating TradingView chart application\\n\\nBuilt with Electron'
          });
        }
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          this.isQuiting = true;
          app.quit();
        }
      }
    ]);

    this.tray.setContextMenu(contextMenu);
    this.tray.setToolTip('Floating TradingView');

    // Handle tray click
    this.tray.on('click', () => {
      if (this.mainWindow.isVisible()) {
        this.mainWindow.hide();
      } else {
        this.mainWindow.show();
        this.mainWindow.focus();
      }
    });
  }

  createMenu() {
    const template = [
      {
        label: 'File',
        submenu: [
          {
            label: 'Settings',
            accelerator: 'CmdOrCtrl+,',
            click: () => {
              this.showSettings();
            }
          },
          { type: 'separator' },
          {
            label: 'Quit',
            accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
            click: () => {
              this.isQuiting = true;
              app.quit();
            }
          }
        ]
      },
      {
        label: 'View',
        submenu: [
          {
            label: 'Always on Top',
            type: 'checkbox',
            checked: this.settings.alwaysOnTop,
            accelerator: 'CmdOrCtrl+T',
            click: (menuItem) => {
              this.settings.alwaysOnTop = menuItem.checked;
              this.mainWindow.setAlwaysOnTop(menuItem.checked);
              this.saveSettings();
            }
          },
          { type: 'separator' },
          { role: 'reload' },
          { role: 'forceReload' },
          { role: 'toggleDevTools' },
          { type: 'separator' },
          { role: 'resetZoom' },
          { role: 'zoomIn' },
          { role: 'zoomOut' }
        ]
      },
      {
        label: 'Window',
        submenu: [
          { role: 'minimize' },
          { role: 'close' }
        ]
      },
      {
        label: 'Help',
        submenu: [
          {
            label: 'About',
            click: () => {
              dialog.showMessageBox(this.mainWindow, {
                type: 'info',
                title: 'About Floating TradingView',
                message: 'Floating TradingView Desktop v1.0.0',
                detail: 'A cross-platform floating TradingView chart application\\n\\nBuilt with Electron'
              });
            }
          },
          {
            label: 'Open TradingView Website',
            click: () => {
              shell.openExternal('https://www.tradingview.com');
            }
          }
        ]
      }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
  }

  setupIPC() {
    // Handle settings requests
    ipcMain.handle('get-settings', () => {
      return this.settings;
    });

    ipcMain.handle('save-settings', (event, newSettings) => {
      this.settings = { ...this.settings, ...newSettings };
      this.saveSettings();
      return this.settings;
    });

    // Handle window operations
    ipcMain.handle('minimize-window', () => {
      if (this.mainWindow) {
        this.mainWindow.minimize();
      }
    });

    ipcMain.handle('close-window', () => {
      if (this.mainWindow) {
        this.mainWindow.close();
      }
    });
  }

  showSettings() {
    // Focus main window and send show settings event
    if (this.mainWindow) {
      this.mainWindow.show();
      this.mainWindow.focus();
      this.mainWindow.webContents.send('show-settings');
    }
  }

  saveWindowBounds() {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      const bounds = this.mainWindow.getBounds();
      this.settings.x = bounds.x;
      this.settings.y = bounds.y;
      this.settings.width = bounds.width;
      this.settings.height = bounds.height;
      this.saveSettings();
    }
  }

  saveSettings() {
    store.set('settings', this.settings);
  }

  getIconPath() {
    if (process.platform === 'win32') {
      return path.join(__dirname, 'icons', 'icon.ico');
    } else if (process.platform === 'darwin') {
      return path.join(__dirname, 'icons', 'icon.icns');
    } else {
      return path.join(__dirname, 'icons', 'icon.png');
    }
  }
}

// Create and initialize the app
const floatingApp = new FloatingTradingViewApp();
floatingApp.init();