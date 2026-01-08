import { app, BrowserWindow, ipcMain } from 'electron'
import { autoUpdater } from 'electron-updater'
import path from 'path'
import { spawn, ChildProcess } from 'child_process'

let mainWindow: BrowserWindow | null = null

// Configure auto-updater logging
autoUpdater.logger = console
autoUpdater.autoDownload = true
autoUpdater.autoInstallOnAppQuit = true

/**
 * Helper to spawn python process
 * Handles difference between dev (python script) and prod (bundled exe)
 */
function spawnPython(args: string[]): ChildProcess {
    if (app.isPackaged) {
        // Production: Use bundled engine.exe
        // In extraResources, we mapped python/dist/engine.exe to bin/engine.exe
        const exePath = path.join(process.resourcesPath, 'bin', 'engine.exe')
        console.log(`Spawning: ${exePath} ${args.join(' ')}`)
        return spawn(exePath, args)
    } else {
        // Development: Use system python + script
        const pythonPath = process.platform === 'win32' ? 'python' : 'python3'
        const scriptPath = path.join(__dirname, '../python/main.py')
        console.log(`Spawning: ${pythonPath} ${scriptPath} ${args.join(' ')}`)
        return spawn(pythonPath, [scriptPath, ...args])
    }
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 900,
        minHeight: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        },
        titleBarStyle: 'hiddenInset',
        frame: true,
        backgroundColor: '#F5F7FA',
        show: false,
        title: 'CloudCleaner',
        autoHideMenuBar: true
    })

    // Show window when ready to prevent visual flash
    mainWindow.once('ready-to-show', () => {
        mainWindow?.show()
    })

    // Load the app - VITE_DEV_SERVER_URL is set by vite-plugin-electron during dev
    const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL
    if (VITE_DEV_SERVER_URL) {
        mainWindow.loadURL(VITE_DEV_SERVER_URL)
        mainWindow.webContents.openDevTools()
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
        // Open DevTools in production for debugging
        mainWindow.webContents.openDevTools()
    }

    mainWindow.on('closed', () => {
        mainWindow = null
    })
}

/**
 * Setup auto-updater events
 */
function setupAutoUpdater() {
    // Only check for updates in production
    if (!app.isPackaged) {
        console.log('Skipping auto-update check in development mode')
        return
    }

    autoUpdater.on('checking-for-update', () => {
        console.log('Checking for update...')
        mainWindow?.webContents.send('update-checking')
    })

    autoUpdater.on('update-available', (info) => {
        console.log('Update available:', info.version)
        mainWindow?.webContents.send('update-available', {
            version: info.version,
            releaseNotes: info.releaseNotes
        })
    })

    autoUpdater.on('update-not-available', () => {
        console.log('No update available')
        mainWindow?.webContents.send('update-not-available')
    })

    autoUpdater.on('download-progress', (progress) => {
        mainWindow?.webContents.send('update-progress', {
            percent: progress.percent,
            bytesPerSecond: progress.bytesPerSecond,
            transferred: progress.transferred,
            total: progress.total
        })
    })

    autoUpdater.on('update-downloaded', (info) => {
        console.log('Update downloaded:', info.version)
        mainWindow?.webContents.send('update-downloaded', {
            version: info.version
        })
    })

    autoUpdater.on('error', (err) => {
        console.error('Auto-updater error:', err)
        mainWindow?.webContents.send('update-error', err.message)
    })

    // Check for updates after a short delay
    setTimeout(() => {
        autoUpdater.checkForUpdatesAndNotify()
    }, 3000)
}

app.whenReady().then(() => {
    createWindow()
    setupAutoUpdater()
    // Remove the default menu completely
    const { Menu } = require('electron')
    Menu.setApplicationMenu(null)
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
    }
})

// IPC Handlers for Python scanner communication
ipcMain.handle('run-scan', async (_event, options: { quick: boolean }) => {
    return new Promise((resolve, reject) => {
        const args = ['--scan', '--output', 'json']
        if (options.quick) {
            args.push('--quick')
        }

        const pythonProcess = spawnPython(args)

        let stdout = ''
        let stderr = ''

        pythonProcess.stdout?.on('data', (data) => {
            stdout += data.toString()
        })

        pythonProcess.stderr?.on('data', (data) => {
            stderr += data.toString()
        })

        pythonProcess.on('close', (code) => {
            if (code === 0) {
                try {
                    const result = JSON.parse(stdout)
                    resolve(result)
                } catch (e) {
                    resolve({ error: 'Failed to parse scan results', raw: stdout })
                }
            } else {
                reject({ error: stderr || 'Scan failed', code })
            }
        })

        pythonProcess.on('error', (err) => {
            reject({ error: `Failed to start Python: ${err.message}. Make sure Python is installed and in your PATH.` })
        })
    })
})

ipcMain.handle('execute-cleanup', async (_event, items: string[]) => {
    return new Promise((resolve, reject) => {
        const args = [
            '--clean',
            '--items',
            JSON.stringify(items),
            '--output',
            'json'
        ]

        const pythonProcess = spawnPython(args)

        let stdout = ''
        let stderr = ''

        pythonProcess.stdout?.on('data', (data) => {
            stdout += data.toString()
        })

        pythonProcess.stderr?.on('data', (data) => {
            stderr += data.toString()
        })

        pythonProcess.on('close', (code) => {
            if (code === 0) {
                try {
                    const result = JSON.parse(stdout)
                    resolve(result)
                } catch (e) {
                    resolve({ success: true, raw: stdout })
                }
            } else {
                reject({ error: stderr || 'Cleanup failed', code })
            }
        })

        pythonProcess.on('error', (err) => {
            reject({ error: `Failed to start Python: ${err.message}` })
        })
    })
})

ipcMain.handle('get-system-info', async () => {
    const os = await import('os')
    return {
        platform: process.platform,
        arch: process.arch,
        hostname: os.hostname(),
        totalMemory: os.totalmem(),
        freeMemory: os.freemem(),
        cpus: os.cpus().length,
        homeDir: os.homedir(),
        tempDir: os.tmpdir()
    }
})

ipcMain.handle('get-disk-usage', async () => {
    return new Promise((resolve, reject) => {
        const pythonProcess = spawnPython(['--disk-usage', '--output', 'json'])

        let stdout = ''
        let stderr = ''

        pythonProcess.stdout?.on('data', (data) => {
            stdout += data.toString()
        })

        pythonProcess.stderr?.on('data', (data) => {
            stderr += data.toString()
        })

        pythonProcess.on('close', (code) => {
            if (code === 0) {
                try {
                    const result = JSON.parse(stdout)
                    resolve(result)
                } catch (e) {
                    resolve({ total: 0, used: 0, free: 0 })
                }
            } else {
                // Fallback to minimal info if python fails
                resolve({ total: 0, used: 0, free: 0, error: stderr })
            }
        })

        pythonProcess.on('error', () => {
            resolve({ total: 0, used: 0, free: 0 })
        })
    })
})

// Get scan/cleanup history from database
ipcMain.handle('get-history', async () => {
    return new Promise((resolve, reject) => {
        const pythonProcess = spawnPython(['--history', '--output', 'json'])

        let stdout = ''
        let stderr = ''

        pythonProcess.stdout?.on('data', (data) => {
            stdout += data.toString()
        })

        pythonProcess.stderr?.on('data', (data) => {
            stderr += data.toString()
        })

        pythonProcess.on('close', (code) => {
            if (code === 0) {
                try {
                    const result = JSON.parse(stdout)
                    resolve(result)
                } catch (e) {
                    resolve({ scans: [], cleanups: [] })
                }
            } else {
                reject({ error: stderr || 'Failed to get history', code })
            }
        })

        pythonProcess.on('error', (err) => {
            resolve({ scans: [], cleanups: [] })
        })
    })
})

// Get aggregate statistics from database
ipcMain.handle('get-stats', async () => {
    return new Promise((resolve, reject) => {
        const pythonProcess = spawnPython(['--stats', '--output', 'json'])

        let stdout = ''
        let stderr = ''


        pythonProcess.stdout?.on('data', (data) => {
            stdout += data.toString()
        })

        pythonProcess.stderr?.on('data', (data) => {
            stderr += data.toString()
        })

        pythonProcess.on('close', (code) => {
            if (code === 0) {
                try {
                    const result = JSON.parse(stdout)
                    resolve(result)
                } catch (e) {
                    resolve({ total_scans: 0, total_cleanups: 0, total_bytes_freed: 0, total_items_cleaned: 0 })
                }
            } else {
                reject({ error: stderr || 'Failed to get stats', code })
            }
        })

        pythonProcess.on('error', (err) => {
            resolve({ total_scans: 0, total_cleanups: 0, total_bytes_freed: 0, total_items_cleaned: 0 })
        })
    })
})



// Get all preferences
ipcMain.handle('get-prefs', async () => {
    return new Promise((resolve, reject) => {
        const pythonProcess = spawnPython(['--get-prefs', '--output', 'json'])

        let stdout = ''
        pythonProcess.stdout?.on('data', (data) => stdout += data.toString())
        pythonProcess.on('close', (code) => {
            if (code === 0) {
                try { resolve(JSON.parse(stdout)) }
                catch (e) { resolve({}) }
            } else { resolve({}) }
        })
        pythonProcess.on('error', () => resolve({}))
    })
})

// Set a preference
ipcMain.handle('set-pref', async (_event, key: string, value: any) => {
    return new Promise((resolve) => {
        const valueStr = typeof value === 'boolean' ? value.toString() : JSON.stringify(value)
        const pythonProcess = spawnPython(['--set-pref', key, valueStr, '--output', 'json'])

        let stdout = ''
        pythonProcess.stdout?.on('data', (data) => stdout += data.toString())
        pythonProcess.on('close', (code) => {
            if (code === 0) {
                try { resolve(JSON.parse(stdout)) }
                catch (e) { resolve({ success: true }) }
            } else { resolve({ success: false }) }
        })
        pythonProcess.on('error', () => resolve({ success: false }))
    })
})

// Get exclusions
ipcMain.handle('get-exclusions', async () => {
    return new Promise((resolve) => {
        const pythonProcess = spawnPython(['--get-exclusions', '--output', 'json'])

        let stdout = ''
        pythonProcess.stdout?.on('data', (data) => stdout += data.toString())
        pythonProcess.on('close', (code) => {
            if (code === 0) {
                try { resolve(JSON.parse(stdout)) }
                catch (e) { resolve({ exclusions: [] }) }
            } else { resolve({ exclusions: [] }) }
        })
        pythonProcess.on('error', () => resolve({ exclusions: [] }))
    })
})

// Add exclusion
ipcMain.handle('add-exclusion', async (_event, exclusionPath: string) => {
    return new Promise((resolve) => {
        const pythonProcess = spawnPython(['--add-exclusion', exclusionPath, '--output', 'json'])

        let stdout = ''
        pythonProcess.stdout?.on('data', (data) => stdout += data.toString())
        pythonProcess.on('close', (code) => {
            if (code === 0) {
                try { resolve(JSON.parse(stdout)) }
                catch (e) { resolve({ success: true }) }
            } else { resolve({ success: false }) }
        })
        pythonProcess.on('error', () => resolve({ success: false }))
    })
})

// Remove exclusion
ipcMain.handle('remove-exclusion', async (_event, exclusionPath: string) => {
    return new Promise((resolve) => {
        const pythonProcess = spawnPython(['--remove-exclusion', exclusionPath, '--output', 'json'])

        let stdout = ''
        pythonProcess.stdout?.on('data', (data) => stdout += data.toString())
        pythonProcess.on('close', (code) => {
            if (code === 0) {
                try { resolve(JSON.parse(stdout)) }
                catch (e) { resolve({ success: true }) }
            } else { resolve({ success: false }) }
        })
        pythonProcess.on('error', () => resolve({ success: false }))
    })
})

// Auto-update IPC handlers (same)
ipcMain.handle('check-for-updates', async () => {
    if (!app.isPackaged) {
        return { available: false, message: 'Updates disabled in development mode' }
    }
    try {
        const result = await autoUpdater.checkForUpdates()
        return { available: result?.updateInfo?.version !== app.getVersion() }
    } catch (error) {
        return { available: false, error: String(error) }
    }
})

ipcMain.handle('install-update', async () => {
    autoUpdater.quitAndInstall(false, true)
})

ipcMain.handle('get-app-version', async () => {
    return app.getVersion()
})
