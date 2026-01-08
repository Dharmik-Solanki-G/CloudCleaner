// Type declarations for Window.electronAPI
// This file extends the global Window interface for Electron IPC

export { }

declare global {
    interface Window {
        electronAPI?: {
            // Scanner operations
            runScan: (options: { quick: boolean }) => Promise<any>
            executeCleanup: (items: string[]) => Promise<any>

            // System info
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

            // History and stats
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

            // Preferences
            getPrefs: () => Promise<Record<string, any>>
            setPref: (key: string, value: any) => Promise<{ success: boolean }>

            // Exclusions
            getExclusions: () => Promise<{ exclusions: string[] }>
            addExclusion: (path: string) => Promise<{ success: boolean }>
            removeExclusion: (path: string) => Promise<{ success: boolean }>

            // Auto-update functionality
            checkForUpdates: () => Promise<{ available: boolean; message?: string; error?: string }>
            installUpdate: () => Promise<void>
            getAppVersion: () => Promise<string>

            // Update event listeners (return unsubscribe function)
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
