import { app, Tray, Menu, nativeImage, shell } from 'electron';
import path from 'path';
import { fork } from 'child_process';
import fs from 'fs';

let tray = null;
let serverProcess = null;

// Paths
const isPackaged = app.isPackaged;
const basePath = process.env.PORTABLE_EXECUTABLE_DIR || (isPackaged ? path.dirname(app.getPath('exe')) : process.cwd());
const logPath = path.join(app.getPath('userData'), 'server-logs.txt');

function logToFile(data) {
    const message = `[${new Date().toISOString()}] ${data}\n`;
    try {
        fs.appendFileSync(logPath, message);
    } catch (e) {
        console.error('Failed to write to log file', e);
    }
}

function startServer() {
    // In a packaged app, files are in the resources/app.asar folder
    // Determine the base path based on whether the app is packaged
    // For portable apps, electron-builder sets PORTABLE_EXECUTABLE_DIR
    const basePath = isPackaged ? (process.env.PORTABLE_EXECUTABLE_DIR || path.dirname(app.getPath('exe'))) : process.cwd();
    const userDataPath = app.getPath('userData');
    
    // Ensure user data config files exist by copying from installation if missing
    const envDest = path.join(userDataPath, '.env');
    const devicesDest = path.join(userDataPath, 'devices.json');
    
    const envSrc = path.join(basePath, '.env.example');
    const devicesSrc = path.join(basePath, 'devices.json');

    try {
        if (!fs.existsSync(envDest) && fs.existsSync(envSrc)) {
            fs.copyFileSync(envSrc, envDest);
            logToFile(`Created initial .env at ${envDest}`);
        }
        if (!fs.existsSync(devicesDest) && fs.existsSync(devicesSrc)) {
            fs.copyFileSync(devicesSrc, devicesDest);
            logToFile(`Created initial devices.json at ${devicesDest}`);
        }
    } catch (e) {
        logToFile(`Error copying initial config files: ${e.message}`);
    }

    // app.getAppPath() points to that root
    const serverPath = path.join(app.getAppPath(), 'server.js');

    logToFile(`Starting server process...`);
    logToFile(`Server Path: ${serverPath}`);
    logToFile(`Config Base Path: ${basePath}`);

    const tempExtractPath = isPackaged ? path.dirname(app.getPath('exe')) : process.cwd();

    serverProcess = fork(serverPath, [], {
        env: {
            ...process.env,
            NODE_ENV: 'production',
            APP_BASE_PATH: basePath,
            TEMP_EXTRACT_PATH: tempExtractPath,
            USER_DATA_PATH: app.getPath('userData'),
            IS_ELECTRON: 'true'
        },
        // We capture output to write to our log file
        silent: true
    });

    if (serverProcess.stdout) {
        serverProcess.stdout.on('data', (data) => logToFile(`STDOUT: ${data}`));
    }
    if (serverProcess.stderr) {
        serverProcess.stderr.on('data', (data) => logToFile(`STDERR: ${data}`));
    }

    serverProcess.on('error', (err) => {
        logToFile(`CRITICAL ERROR: ${err.message}`);
    });

    serverProcess.on('exit', (code) => {
        logToFile(`Server process exited with code ${code}`);
    });
}

app.whenReady().then(() => {
    // Clear logs on fresh start
    if (fs.existsSync(logPath)) {
        try { fs.unlinkSync(logPath); } catch (e) { }
    }
    logToFile('Application initialized.');

    startServer();

    // Icon handling
    let iconPath = path.join(app.getAppPath(), 'public', 'icon.png');
    if (!fs.existsSync(iconPath)) {
        iconPath = path.join(app.getAppPath(), 'dist', 'icon.png');
    }

    const icon = nativeImage.createFromPath(iconPath);
    tray = new Tray(icon.resize({ width: 16, height: 16 }));

    const contextMenu = Menu.buildFromTemplate([
        { label: 'Switch Control Dashboard', enabled: false },
        { type: 'separator' },
        {
            label: 'Open Dashboard (Browser)', click: () => {
                shell.openExternal('http://localhost:3002');
            }
        },
        {
            label: 'Open Configuration Folder', click: () => {
                shell.openPath(app.getPath('userData'));
            }
        },
        {
            label: 'View Logs', click: () => {
                shell.openPath(logPath);
            }
        },
        { type: 'separator' },
        {
            label: 'Quit', click: () => {
                if (serverProcess) serverProcess.kill();
                app.quit();
            }
        }
    ]);

    tray.setToolTip('Switch Control Dashboard');
    tray.setContextMenu(contextMenu);

    if (process.platform === 'darwin') {
        app.dock.hide();
    }

    logToFile('Tray icon created and active.');
});

app.on('window-all-closed', (e) => {
    e.preventDefault();
});

app.on('before-quit', () => {
    if (serverProcess) serverProcess.kill();
});
