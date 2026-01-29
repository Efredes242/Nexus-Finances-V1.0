const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

// --- DATA PORTABILITY LOGIC ---
const isDev = !app.isPackaged;
const exeDir = path.dirname(process.execPath);
let finalDataPath;

if (!isDev) {
  const localDataDir = path.join(exeDir, 'data');
  try {
    if (!fs.existsSync(localDataDir)) {
      fs.mkdirSync(localDataDir, { recursive: true });
    }
    const testFile = path.join(localDataDir, '.test');
    fs.writeFileSync(testFile, 'ok');
    fs.unlinkSync(testFile);
    finalDataPath = localDataDir;
  } catch (e) {
    const appDataPath = app.getPath('appData');
    finalDataPath = path.join(appDataPath, 'Nexus Finances');
  }
} else {
  const appDataPath = app.getPath('appData');
  finalDataPath = path.join(appDataPath, 'Nexus Finances Dev');
}

app.setPath('userData', finalDataPath);

let mainWindow = null;
let splashWindow = null;
let serverProcess = null;
const PORT = 3001;

function createSplashScreen() {
  splashWindow = new BrowserWindow({
    width: 600,
    height: 400,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    center: true,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  splashWindow.loadFile(path.join(__dirname, 'loading.html'));
  splashWindow.once('ready-to-show', () => {
    if (splashWindow) splashWindow.show();
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  const loadURL = () => {
    if (!mainWindow) return;

    const devPort = 3000;
    const url = isDev ? `http://localhost:${devPort}` : `http://localhost:${PORT}`;
    mainWindow.loadURL(url).then(() => {
      if (!mainWindow) return;

      if (splashWindow) {
        splashWindow.close();
        splashWindow = null;
      }
      mainWindow.maximize();
      mainWindow.show();
      mainWindow.focus();
    }).catch(err => {
      if (!mainWindow) return;
      console.log('Server not ready, retrying...', err.message);
      setTimeout(loadURL, 1000);
    });
  };

  // Safe startup delay
  setTimeout(loadURL, 2000);

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

function startServer() {
  const userDataPath = app.getPath('userData');
  const dbPath = path.join(userDataPath, 'finanzas.db');
  const logFile = path.join(userDataPath, 'server.log');

  // No-ASAR strategy: server is in resources/app/server/index.js
  let serverPath = path.join(app.getAppPath(), 'server', 'index.js');
  if (app.isPackaged) {
    serverPath = serverPath.replace('app.asar', 'app.asar.unpacked');
  }

  console.log('[Main] Starting server at:', serverPath);

  if (!fs.existsSync(serverPath)) {
    const errorMsg = `CRITICAL: Backend not found at ${serverPath}.`;
    console.error(errorMsg);
    fs.appendFileSync(logFile, `[Main Error] ${errorMsg}\n`);

    app.whenReady().then(() => {
      dialog.showErrorBox('Error de Archivos', 'Faltan componentes críticos de la aplicación. Reinstale el programa.');
    });
    return;
  }

  const out = fs.openSync(logFile, 'a');
  const err = fs.openSync(logFile, 'a');

  serverProcess = spawn(process.execPath, [serverPath], {
    env: {
      ...process.env,
      PORT: PORT,
      DB_PATH: dbPath,
      ELECTRON_RUN_AS_NODE: 1
    },
    stdio: ['ignore', out, err]
  });

  serverProcess.on('error', (err) => {
    fs.appendFileSync(logFile, `[Main Error] Server spawn error: ${err}\n`);
  });
}

app.whenReady().then(() => {
  if (!isDev) createSplashScreen();
  startServer();
  createWindow();

  app.on('activate', function () {
    if (mainWindow === null) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  if (serverProcess) {
    serverProcess.kill();
  }
});
