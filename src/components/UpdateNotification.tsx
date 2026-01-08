import { useEffect, useState } from 'react'
import { Download, X, RefreshCw, CheckCircle } from 'lucide-react'

interface UpdateInfo {
    version: string
    releaseNotes?: string
}

interface UpdateProgress {
    percent: number
    bytesPerSecond: number
    transferred: number
    total: number
}

type UpdateState = 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'error'

export function UpdateNotification() {
    const [state, setState] = useState<UpdateState>('idle')
    const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)
    const [progress, setProgress] = useState<UpdateProgress | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [dismissed, setDismissed] = useState(false)

    useEffect(() => {
        if (!window.electronAPI) return

        const unsubChecking = window.electronAPI.onUpdateChecking(() => {
            setState('checking')
        })

        const unsubAvailable = window.electronAPI.onUpdateAvailable((info) => {
            setState('available')
            setUpdateInfo(info)
        })

        const unsubNotAvailable = window.electronAPI.onUpdateNotAvailable(() => {
            setState('idle')
        })

        const unsubProgress = window.electronAPI.onUpdateProgress((prog) => {
            setState('downloading')
            setProgress(prog)
        })

        const unsubDownloaded = window.electronAPI.onUpdateDownloaded((info) => {
            setState('ready')
            setUpdateInfo(info)
        })

        const unsubError = window.electronAPI.onUpdateError((err) => {
            setState('error')
            setError(err)
        })

        return () => {
            unsubChecking()
            unsubAvailable()
            unsubNotAvailable()
            unsubProgress()
            unsubDownloaded()
            unsubError()
        }
    }, [])

    const handleInstall = () => {
        window.electronAPI?.installUpdate()
    }

    const handleDismiss = () => {
        setDismissed(true)
    }

    // Don't show anything if idle, checking, or dismissed
    if (state === 'idle' || state === 'checking' || dismissed) {
        return null
    }

    return (
        <div className="fixed bottom-4 right-4 z-50 max-w-sm">
            <div className="bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white">
                    <div className="flex items-center gap-2">
                        {state === 'downloading' ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : state === 'ready' ? (
                            <CheckCircle className="w-4 h-4" />
                        ) : (
                            <Download className="w-4 h-4" />
                        )}
                        <span className="font-medium text-sm">
                            {state === 'available' && 'Update Available'}
                            {state === 'downloading' && 'Downloading Update'}
                            {state === 'ready' && 'Update Ready'}
                            {state === 'error' && 'Update Error'}
                        </span>
                    </div>
                    <button
                        onClick={handleDismiss}
                        className="p-1 hover:bg-white/20 rounded transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Content */}
                <div className="px-4 py-3">
                    {state === 'available' && updateInfo && (
                        <div>
                            <p className="text-sm text-gray-600 mb-3">
                                Version <span className="font-semibold text-gray-900">{updateInfo.version}</span> is available.
                            </p>
                            <p className="text-xs text-gray-500 mb-3">
                                The update will download automatically.
                            </p>
                        </div>
                    )}

                    {state === 'downloading' && progress && (
                        <div>
                            <div className="flex justify-between text-xs text-gray-500 mb-1">
                                <span>Downloading...</span>
                                <span>{Math.round(progress.percent)}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                                <div
                                    className="bg-gradient-to-r from-cyan-500 to-blue-500 h-2 rounded-full transition-all duration-300"
                                    style={{ width: `${progress.percent}%` }}
                                />
                            </div>
                            <p className="text-xs text-gray-400 mt-1">
                                {formatBytes(progress.bytesPerSecond)}/s
                            </p>
                        </div>
                    )}

                    {state === 'ready' && (
                        <div>
                            <p className="text-sm text-gray-600 mb-3">
                                Update downloaded. Restart to install.
                            </p>
                            <button
                                onClick={handleInstall}
                                className="w-full py-2 px-4 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-lg font-medium text-sm hover:from-cyan-600 hover:to-blue-600 transition-all"
                            >
                                Restart & Install
                            </button>
                        </div>
                    )}

                    {state === 'error' && (
                        <p className="text-sm text-red-600">
                            {error || 'Failed to check for updates'}
                        </p>
                    )}
                </div>
            </div>
        </div>
    )
}

function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}
