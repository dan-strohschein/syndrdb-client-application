import { app, BrowserWindow, Menu, ipcMain, screen, nativeImage, dialog } from 'electron';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
// Note: SyndrDBMainService will be required at runtime to avoid module conflicts

//const __filename = fileURLToPath(import.meta.url);

//const __dirname = __filename ? dirname(__filename) : process.cwd();


// __dirname is automatically available in CommonJS/Node.js

let mainWindow: BrowserWindow | null = null;
let syndrdbService: import('./src/electron/syndrdb-main-service').SyndrDBMainService | null = null;
let connectionStorage: { loadConnections: () => Promise<unknown[]>; saveConnection: (c: unknown) => Promise<unknown>; overwriteConnection: (c: unknown) => Promise<unknown>; deleteConnection: (n: string) => Promise<unknown> } | null = null;

// More robust development detection
const isDev = process.env.NODE_ENV === 'development' || 
             process.env.ELECTRON_IS_DEV === '1' ||
             !app.isPackaged;

function createWindow(): void {
  // Get the primary display's work area (excludes taskbar/dock)
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
  
  const appIcon = getAppIcon();
  
  // Create the browser window at full screen size
  mainWindow = new BrowserWindow({
    width: screenWidth,
    height: screenHeight,
    minWidth: 1000,
    minHeight: 600,
    icon: appIcon,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      preload: join(__dirname, 'electron/preload.cjs') // Add preload script
    },
    titleBarStyle: 'default',
    show: false
  });

  // Set the dock icon on macOS (additional method)
  if (process.platform === 'darwin') {
    if (typeof appIcon === 'string') {
      // If it's a string path, create nativeImage for dock
      const dockIcon = nativeImage.createFromPath(appIcon);
      app.dock.setIcon(dockIcon);
      console.log(`Set dock icon from path: ${appIcon}`);
    } else {
      // If it's already a nativeImage, use it directly
      app.dock.setIcon(appIcon);
      console.log(`Set dock icon from nativeImage`);
    }
  }

  // Load the app
  const devServerUrl = 'http://localhost:5173';
  const fallbackPath = join(__dirname, 'index.html');

  if (isDev) {
    console.log('Development mode: Loading from', devServerUrl);
    mainWindow.loadURL(devServerUrl);
    mainWindow.webContents.openDevTools();

    // If dev server isn't running (e.g. user ran `npm run electron` instead of `npm run electron:dev`),
    // fall back to built files so the app still loads after `npm run build`.
    mainWindow.webContents.once('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
      const isDevServerFailure = validatedURL && (validatedURL === devServerUrl || validatedURL === devServerUrl + '/' || validatedURL.startsWith(devServerUrl + '/'));
      if (isDevServerFailure) {
        if (existsSync(fallbackPath)) {
          console.warn('Dev server unreachable. Loading built app from', fallbackPath);
          console.warn('For live reload, use: npm run electron:dev');
          mainWindow!.loadFile(fallbackPath);
        } else {
          console.warn('Dev server unreachable and no built files found.');
          console.warn('Run "npm run build" then "npm run electron", or use "npm run electron:dev" to start the dev server.');
        }
      }
    });
  } else {
    console.log('Production mode: Loading from file system');
    mainWindow.loadFile(join(__dirname, 'index.html'));
  }

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow!.show();
  });

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function getAppIcon(): Electron.NativeImage | string {
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  
  let iconPath: string;
  
  if (isDev) {
    // In development, use icons from src/public folder
    if (process.platform === 'win32') {
      iconPath = join(process.cwd(), 'src', 'public', 'favicon.ico');
    } else if (process.platform === 'darwin') {
      // Try PNG first as it works better with nativeImage than .icns
      iconPath = join(process.cwd(), 'src', 'public', 'android-chrome-512x512.png');
    } else {
      iconPath = join(process.cwd(), 'src', 'public', 'favicon.png');
    }
  } else {
    // In production, use icons from dist folder (copied from src/public)
    if (process.platform === 'win32') {
      iconPath = join(__dirname, 'favicon.ico');
    } else if (process.platform === 'darwin') {
      iconPath = join(__dirname, 'android-chrome-512x512.png');
    } else {
      iconPath = join(__dirname, 'favicon.png');
    }
  }
  
  console.log(`Setting app icon to: ${iconPath}`);
  console.log(`Platform: ${process.platform}, isDev: ${isDev}`);
  
  // Check if file exists
  if (existsSync(iconPath)) {
    console.log('✅ Icon file exists');
    
    // Create and return a nativeImage for better Electron icon handling
    try {
      const icon = nativeImage.createFromPath(iconPath);
      if (icon.isEmpty()) {
        console.log('❌ NativeImage is empty, falling back to path');
        return iconPath;
      } else {
        console.log('✅ NativeImage created successfully');
        return icon;
      }
    } catch (error) {
      console.log('❌ Error creating nativeImage:', error);
      return iconPath;
    }
  } else {
    console.log('❌ Icon file does not exist');
    return iconPath;
  }
}

// This method will be called when Electron has finished initialization
app.whenReady().then(() => {
  createWindow();
  setupSyndrDBService();
  
  // Additional icon setting for macOS after app is ready
  if (process.platform === 'darwin') {
    const appIcon = getAppIcon();
    if (typeof appIcon === 'string') {
      const macIcon = nativeImage.createFromPath(appIcon);
      if (!macIcon.isEmpty()) {
        app.dock.setIcon(macIcon);
        console.log('✅ macOS dock icon set after app ready');
      }
    } else {
      app.dock.setIcon(appIcon);
      console.log('✅ macOS dock icon set after app ready (nativeImage)');
    }
  }
  
  // Set application menu (minimal for database tool)
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New Connection',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            // TODO: Implement new connection dialog
            console.log('New Connection clicked');
          }
        },
        { type: 'separator' },
        {
          label: 'Exit',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    }
  ];

  // @ts-ignore
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // Cleanup SyndrDB connections before quitting
    if (syndrdbService) {
      syndrdbService.cleanup();
    }
    app.quit();
  }
});

// Security: Prevent new window creation
app.on('web-contents-created', (event, contents) => {
  contents.setWindowOpenHandler(({ url }) => {
    // Block all external navigation
    return { action: 'deny' };
  });
});

/**
 * Setup SyndrDB service and IPC handlers
 */
function setupSyndrDBService(): void {
  console.log('🔧 Setting up SyndrDB service...');
  
  // Dynamically require the services to avoid ES module conflicts
  const { SyndrDBMainService } = require('./electron/syndrdb-main-service.cjs');
  const { ConnectionStorageService } = require('./electron/connection-storage-service.cjs');
  
  syndrdbService = new SyndrDBMainService();
  connectionStorage = new ConnectionStorageService();
  
  console.log('✅ SyndrDB service initialized:', !!syndrdbService);
  console.log('✅ Connection storage initialized:', !!connectionStorage);

  // Listen for connection status changes and forward to renderer
  syndrdbService!.on('connection-status', (data: { connectionId: string; status: string; error?: string }) => {
    console.log('🔄 Main process received connection status event:', data);
    if (mainWindow && !mainWindow.isDestroyed()) {
      console.log('📤 Forwarding to renderer via IPC');
      mainWindow.webContents.send('syndrdb:connection-status', data);
    } else {
      console.log('❌ Cannot forward to renderer - mainWindow not available');
    }
  });

  // Forward monitor streaming events to renderer
  syndrdbService!.on('monitor-snapshot', (data: { connectionId: string; timestamp: number; data: unknown }) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('syndrdb:monitor-snapshot', data);
    }
  });

  syndrdbService!.on('monitor-stopped', (data: { connectionId: string }) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('syndrdb:monitor-stopped', data);
    }
  });

  console.log('🔌 Setting up IPC handlers...');
  ipcMain.handle('syndrdb:connect', async (event, config) => {
    try {
      return await syndrdbService!.connect(config);
    } catch (error) {
      console.error('IPC syndrdb:connect error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  });

  ipcMain.handle('syndrdb:disconnect', async (event, connectionId) => {
    try {
      await syndrdbService!.disconnect(connectionId);
      return { success: true };
    } catch (error) {
      console.error('IPC syndrdb:disconnect error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  });

  ipcMain.handle('syndrdb:test-connection', async (event, config) => {
    try {
      return await syndrdbService!.testConnection(config);
    } catch (error) {
      console.error('IPC syndrdb:test-connection error:', error);
      return false;
    }
  });

  ipcMain.handle('syndrdb:execute-query', async (event, connectionId, query) => {
    console.log('🚨 MAIN PROCESS: execute-query IPC handler called!');
    console.log('🚨 MAIN PROCESS: Arguments received:', { 
      connectionId, 
      query, 
      eventType: typeof event,
      argumentCount: arguments.length 
    });
    try {
      console.log('🔥 Main process received execute-query IPC:', { connectionId, query });
      const result = await syndrdbService!.executeQuery(connectionId, query);
      console.log('🔥 Main process execute-query result:', result);
      return result;
    } catch (error) {
      console.error('IPC syndrdb:execute-query error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime: 0
      };
    }
  });

  console.log('✅ execute-query IPC handler registered');

  // Monitor streaming IPC handlers
  ipcMain.handle('syndrdb:start-monitor', async (event, connectionId, command) => {
    try {
      return await syndrdbService!.startMonitor(connectionId, command);
    } catch (error) {
      console.error('IPC syndrdb:start-monitor error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle('syndrdb:stop-monitor', async (event, connectionId) => {
    try {
      return await syndrdbService!.stopMonitor(connectionId);
    } catch (error) {
      console.error('IPC syndrdb:stop-monitor error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Connection Storage IPC Handlers
  ipcMain.handle('connection-storage:load', async () => {
    try {
      return await connectionStorage!.loadConnections();
    } catch (error) {
      console.error('IPC connection-storage:load error:', error);
      return [];
    }
  });

  ipcMain.handle('connection-storage:save', async (_, connection) => {
    try {
      return await connectionStorage!.saveConnection(connection);
    } catch (error) {
      console.error('IPC connection-storage:save error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle('connection-storage:overwrite', async (_, connection) => {
    try {
      return await connectionStorage!.overwriteConnection(connection);
    } catch (error) {
      console.error('IPC connection-storage:overwrite error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  ipcMain.handle('connection-storage:delete', async (_, name) => {
    try {
      return await connectionStorage!.deleteConnection(name);
    } catch (error) {
      console.error('IPC connection-storage:delete error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // File Dialog IPC Handlers
  ipcMain.handle('file-dialog:show-open', async (_, options) => {
    try {
      const result = await dialog.showOpenDialog(BrowserWindow.getFocusedWindow()!, {
        title: options?.title || 'Open File',
        filters: options?.filters || [
          { name: 'SQL Files', extensions: ['sql'] },
          { name: 'Text Files', extensions: ['txt'] },
          { name: 'All Files', extensions: ['*'] }
        ],
        properties: ['openFile']
      });
      return result;
    } catch (error) {
      console.error('IPC file-dialog:show-open error:', error);
      return { canceled: true, filePaths: [] };
    }
  });

  ipcMain.handle('file-dialog:show-save', async (_, options) => {
    try {
      const result = await dialog.showSaveDialog(BrowserWindow.getFocusedWindow()!, {
        title: options?.title || 'Save File',
        filters: options?.filters || [
          { name: 'SQL Files', extensions: ['sql'] },
          { name: 'Text Files', extensions: ['txt'] },
          { name: 'CSV Files', extensions: ['csv'] },
          { name: 'JSON Files', extensions: ['json'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });
      return result;
    } catch (error) {
      console.error('IPC file-dialog:show-save error:', error);
      return { canceled: true, filePath: '' };
    }
  });

  // AI Assistant IPC handlers (stub: check-subscription returns premium true; generate uses main service)
  const { generateQuery: aiAssistantGenerateQuery } = require('./electron/ai-assistant-main-service.cjs');
  ipcMain.handle('ai-assistant:generate-query', async (_, request) => {
    try {
      return await aiAssistantGenerateQuery(request);
    } catch (error) {
      console.error('IPC ai-assistant:generate-query error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });
  ipcMain.handle('ai-assistant:check-subscription', async () => {
    return { premium: true };
  });

  console.log('SyndrDB service initialized with IPC handlers');
}
