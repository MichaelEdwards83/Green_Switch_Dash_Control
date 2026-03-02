import { app, Tray, Menu, nativeImage, shell } from 'electron';
import path from 'path';
import { fork } from 'child_process';
import fs from 'fs';

let tray = null;
let serverProcess = null;

// Paths
const isPackaged = app.isPackaged;
const basePath = isPackaged ? path.dirname(app.getPath('exe')) : process.cwd();
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
    // app.getAppPath() points to that root
    const serverPath = path.join(app.getAppPath(), 'server.js');

    logToFile(`Starting server process...`);
    logToFile(`Server Path: ${serverPath}`);
    logToFile(`Config Base Path: ${basePath}`);

    serverProcess = fork(serverPath, [], {
        env: {
            ...process.env,
            NODE_ENV: 'production',
            APP_BASE_PATH: basePath,
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
                shell.openPath(basePath);
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
