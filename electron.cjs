const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let backendProcess;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(__dirname, 'logo_cosumar.ico'),
    webPreferences: {
      contextIsolation: true,
    },
  });

  const indexPath = path.join(__dirname, 'dist', 'index.html');
  mainWindow.loadFile(indexPath);
}

function startBackend() {
  if (!backendProcess) {
    // 📦 backend compilé avec pkg
    const backendScript = path.join(__dirname, 'backend', 'CosuMutuel.exe');
    const backendDir = path.join(__dirname, 'backend');

    console.log('Lancement backend:', backendScript, 'cwd:', backendDir);

    backendProcess = spawn(backendScript, [], {
      cwd: backendDir,
      stdio: 'inherit',
      shell: false,
      detached: false,
    });

    backendProcess.on('error', (err) => {
      console.error('Erreur backend:', err);
      dialog.showErrorBox('Erreur Backend', `Impossible de démarrer le backend.\nErreur: ${err.message}`);
    });

    backendProcess.on('close', (code) => {
      if (code !== 0) {
        dialog.showErrorBox('Backend arrêté', `Le backend s'est arrêté avec le code ${code}.\nVérifiez que tous les fichiers et modules sont présents.`);
      } else {
        console.log('Backend arrêté proprement.');
      }
      backendProcess = null;
    });

    console.log('>>> BACKEND SPAWN demandé !');
  }
}

function stopBackend() {
  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
  }
}

app.whenReady().then(() => {
  startBackend();
  setTimeout(() => {
    createWindow();
  }, 1500);

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  stopBackend();
  if (process.platform !== 'darwin') app.quit();
});
