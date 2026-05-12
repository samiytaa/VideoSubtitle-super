const { app, BrowserWindow, Menu } = require('electron');
const { spawn } = require('child_process');
const path = require('path');

let web2apiProcess = null;

function startWeb2ApiServer() {
  if (web2apiProcess) return;
  const web2apiDir = path.join(__dirname, '../integrated/web2api');
  const serverPath = path.join(web2apiDir, 'src/server.js');

  web2apiProcess = spawn(process.execPath, [serverPath], {
    cwd: web2apiDir,
    windowsHide: true,
    stdio: 'ignore',
    env: {
      ...process.env,
      VITE_DEV: '0',
      PORT: process.env.PORT || '3000'
    }
  });

  web2apiProcess.on('exit', () => {
    web2apiProcess = null;
  });
}

function stopWeb2ApiServer() {
  if (!web2apiProcess) return;
  web2apiProcess.kill();
  web2apiProcess = null;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    icon: path.join(__dirname, '../dist/favicon.ico'),
    title: '视频字幕截取工具',
  });

  win.loadFile(path.join(__dirname, '../dist/index.html'));
}

app.whenReady().then(() => {
  startWeb2ApiServer();
  Menu.setApplicationMenu(null);
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  stopWeb2ApiServer();
  if (process.platform !== 'darwin') app.quit();
});
