const { app, BrowserWindow, Menu } = require('electron');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { resolveAppPaths } = require('./paths.cjs');

let web2apiProcess = null;
let startupLogPath = null;

function writeStartupLog(message, error) {
  if (!startupLogPath) return;
  const details = error instanceof Error
    ? `${error.stack || error.message}`
    : error
      ? String(error)
      : '';
  fs.appendFileSync(startupLogPath, `[${new Date().toISOString()}] ${message}${details ? `\n${details}` : ''}\n`);
}

function startWeb2ApiServer() {
  if (web2apiProcess) return;
  const appPaths = resolveAppPaths(app);
  const serverPath = path.join(appPaths.web2apiBaseDir, 'src/server.js');
  const ffmpegBinaryPath = path.join(
    appPaths.web2apiBaseDir,
    'node_modules',
    'ffmpeg-static',
    process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'
  );

  web2apiProcess = spawn(process.execPath, [serverPath], {
    cwd: appPaths.web2apiBaseDir,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      VITE_DEV: '0',
      PORT: process.env.PORT || '3000',
      APP_BASE_DIR: appPaths.web2apiBaseDir,
      APP_DATA_DIR: appPaths.userDataDir,
      FFMPEG_PATH: process.env.FFMPEG_PATH || ffmpegBinaryPath
    }
  });

  web2apiProcess.stdout?.on('data', (chunk) => {
    const message = String(chunk).trim();
    console.log(`[web2api] ${message}`);
    writeStartupLog(`[web2api] ${message}`);
  });
  web2apiProcess.stderr?.on('data', (chunk) => {
    const message = String(chunk).trim();
    console.error(`[web2api:error] ${message}`);
    writeStartupLog(`[web2api:error] ${message}`);
  });
  web2apiProcess.on('error', (error) => {
    console.error('[web2api] failed to start:', error);
    writeStartupLog('[web2api] failed to start', error);
  });
  web2apiProcess.on('exit', () => {
    writeStartupLog('[web2api] exited');
    web2apiProcess = null;
  });
}

function stopWeb2ApiServer() {
  if (!web2apiProcess) return;
  web2apiProcess.kill();
  web2apiProcess = null;
}

function createWindow() {
  const appPaths = resolveAppPaths(app);
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
    icon: appPaths.iconPath,
    title: '视频字幕截取工具',
  });

  win.webContents.on('did-fail-load', (_event, code, description, validatedUrl) => {
    writeStartupLog(`renderer failed to load (${code}) ${description} ${validatedUrl}`);
  });
  win.on('unresponsive', () => {
    writeStartupLog('window became unresponsive');
  });
  win.loadFile(path.join(appPaths.rendererDist, 'index.html'));
}

app.whenReady().then(() => {
  startupLogPath = path.join(app.getPath('userData'), 'startup.log');
  writeStartupLog('app ready');
  startWeb2ApiServer();
  Menu.setApplicationMenu(null);
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('render-process-gone', (_event, _webContents, details) => {
  writeStartupLog(`render process gone: ${JSON.stringify(details)}`);
});

app.on('child-process-gone', (_event, details) => {
  writeStartupLog(`child process gone: ${JSON.stringify(details)}`);
});

app.on('window-all-closed', () => {
  writeStartupLog('window-all-closed');
  stopWeb2ApiServer();
  if (process.platform !== 'darwin') app.quit();
});

process.on('uncaughtException', (error) => {
  writeStartupLog('uncaughtException', error);
});

process.on('unhandledRejection', (reason) => {
  writeStartupLog('unhandledRejection', reason);
});
