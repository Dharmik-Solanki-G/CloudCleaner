import { contextBridge, ipcRenderer } from 'electron'

// Expose protected methods to the renderer process
contextBridge.exposeInMainWorld('electronAPI', {
    // Scanner operations
    runScan: (options: { quick: boolean }) => ipcRenderer.invoke('run-scan', options),
    executeCleanup: (items: string[]) => ipcRenderer.invoke('execute-cleanup', items),

    // System info
    getSystemInfo: () => ipcRenderer.invoke('get-system-info'),

    // History and stats from database
    getHistory: () => ipcRenderer.invoke('get-history'),
    getStats: () => ipcRenderer.invoke('get-stats'), // Returns DB stats
    getDiskUsage: () => ipcRenderer.invoke('get-disk-usage'), // Returns disk stats

    // Preferences
    getPrefs: () => ipcRenderer.invoke('get-prefs'),
    setPref: (key: string, value: any) => ipcRenderer.invoke('set-pref', key, value),

    // Exclusions
    getExclusions: () => ipcRenderer.invoke('get-exclusions'),
    addExclusion: (path: string) => ipcRenderer.invoke('add-exclusion', path),
    removeExclusion: (path: string) => ipcRenderer.invoke('remove-exclusion', path),

    // Auto-update functionality
    checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
    installUpdate: () => ipcRenderer.invoke('install-update'),
    getAppVersion: () => ipcRenderer.invoke('get-app-version'),

    // Update event listeners
    onUpdateChecking: (callback: () => void) => {
        ipcRenderer.on('update-checking', callback)
        return () => ipcRenderer.removeListener('update-checking', callback)
    },
    onUpdateAvailable: (callback: (info: { version: string; releaseNotes?: string }) => void) => {
        const handler = (_event: any, info: any) => callback(info)
        ipcRenderer.on('update-available', handler)
        return () => ipcRenderer.removeListener('update-available', handler)
    },
    onUpdateNotAvailable: (callback: () => void) => {
        ipcRenderer.on('update-not-available', callback)
        return () => ipcRenderer.removeListener('update-not-available', callback)
    },
    onUpdateProgress: (callback: (progress: { percent: number; bytesPerSecond: number; transferred: number; total: number }) => void) => {
        const handler = (_event: any, progress: any) => callback(progress)
        ipcRenderer.on('update-progress', handler)
        return () => ipcRenderer.removeListener('update-progress', handler)
    },
    onUpdateDownloaded: (callback: (info: { version: string }) => void) => {
        const handler = (_event: any, info: any) => callback(info)
        ipcRenderer.on('update-downloaded', handler)
        return () => ipcRenderer.removeListener('update-downloaded', handler)
    },
    onUpdateError: (callback: (error: string) => void) => {
        const handler = (_event: any, error: any) => callback(error)
        ipcRenderer.on('update-error', handler)
        return () => ipcRenderer.removeListener('update-error', handler)
    },

    // Platform detection
    platform: process.platform
})

// Type declarations for TypeScript
declare global {
    interface Window {
        electronAPI: {
            runScan: (options: { quick: boolean }) => Promise<any>
            executeCleanup: (items: string[]) => Promise<any>
            getSystemInfo: () => Promise<{
                platform: string
                arch: string
                hostname: string
                totalMemory: number
                freeMemory: number
                cpus: number
                homeDir: string
                tempDir: string
            }>
            getHistory: () => Promise<{
                scans: Array<{
                    id: number
                    timestamp: string
                    scan_type: string
                    total_items: number
                    total_size_bytes: number
                    duration_seconds: number
                    status: string
                }>
                cleanups: Array<{
                    id: number
                    scan_id: number | null
                    timestamp: string
                    items_deleted: number
                    items_failed: number
                    bytes_freed: number
                }>
            }>
            getStats: () => Promise<{
                total_scans: number
                total_cleanups: number
                total_bytes_freed: number
                total_items_cleaned: number
            }>
            getDiskUsage: () => Promise<{
                total: number
                used: number
                free: number
                percent: number
            }>
            getPrefs: () => Promise<Record<string, any>>
            setPref: (key: string, value: any) => Promise<{ success: boolean }>
            getExclusions: () => Promise<{ exclusions: string[] }>
            addExclusion: (path: string) => Promise<{ success: boolean }>
            removeExclusion: (path: string) => Promise<{ success: boolean }>

            // Auto-update
            checkForUpdates: () => Promise<{ available: boolean; message?: string; error?: string }>
            installUpdate: () => Promise<void>
            getAppVersion: () => Promise<string>
            onUpdateChecking: (callback: () => void) => () => void
            onUpdateAvailable: (callback: (info: { version: string; releaseNotes?: string }) => void) => () => void
            onUpdateNotAvailable: (callback: () => void) => () => void
            onUpdateProgress: (callback: (progress: { percent: number; bytesPerSecond: number; transferred: number; total: number }) => void) => () => void
            onUpdateDownloaded: (callback: (info: { version: string }) => void) => () => void
            onUpdateError: (callback: (error: string) => void) => () => void

            platform: string
        }
    }
}
