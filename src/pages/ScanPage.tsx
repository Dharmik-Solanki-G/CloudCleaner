import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, X, CheckCircle, AlertCircle } from 'lucide-react'
import { useAppStore } from '../stores/appStore'

// Simulated scan for demo (replace with actual Python scanner call)
const simulateScan = async (
    onProgress: (progress: number, status: string) => void
): Promise<any> => {
    const stages = [
        { progress: 10, status: 'Scanning system temp files...' },
        { progress: 25, status: 'Analyzing browser caches...' },
        { progress: 40, status: 'Checking application data...' },
        { progress: 55, status: 'Scanning log files...' },
        { progress: 70, status: 'Analyzing crash dumps...' },
        { progress: 85, status: 'Calculating disk usage...' },
        { progress: 95, status: 'Generating report...' },
        { progress: 100, status: 'Scan complete!' },
    ]

    for (const stage of stages) {
        await new Promise(resolve => setTimeout(resolve, 600 + Math.random() * 400))
        onProgress(stage.progress, stage.status)
    }

    // Return mock scan results
    return {
        total_items: 1247,
        total_size_bytes: 4.7 * 1024 * 1024 * 1024, // 4.7 GB
        items: [
            { path: 'C:\\Users\\User\\AppData\\Local\\Google\\Chrome\\User Data\\Default\\Cache', size_bytes: 1.2 * 1024 * 1024 * 1024, category: 'browser_cache', risk_level: 'low', safe_to_delete: true, reason: 'Browser cache - safe to delete' },
            { path: 'C:\\Users\\User\\AppData\\Local\\Temp', size_bytes: 890 * 1024 * 1024, category: 'temp_files', risk_level: 'low', safe_to_delete: true, reason: 'Temporary files - safe to delete' },
            { path: 'C:\\Windows\\Temp', size_bytes: 650 * 1024 * 1024, category: 'temp_files', risk_level: 'low', safe_to_delete: true, reason: 'System temp files' },
            { path: 'C:\\Users\\User\\AppData\\Local\\Microsoft\\Windows\\Explorer', size_bytes: 245 * 1024 * 1024, category: 'thumbnails', risk_level: 'low', safe_to_delete: true, reason: 'Thumbnail cache' },
            { path: 'C:\\Users\\User\\AppData\\Local\\CrashDumps', size_bytes: 512 * 1024 * 1024, category: 'crash_dumps', risk_level: 'low', safe_to_delete: true, reason: 'Old crash dumps' },
            { path: 'C:\\Windows\\Logs', size_bytes: 180 * 1024 * 1024, category: 'logs', risk_level: 'medium', safe_to_delete: true, reason: 'System logs - optional' },
        ],
        categories: {
            browser_cache: 1.2 * 1024 * 1024 * 1024,
            temp_files: 1.54 * 1024 * 1024 * 1024,
            thumbnails: 245 * 1024 * 1024,
            crash_dumps: 512 * 1024 * 1024,
            logs: 180 * 1024 * 1024,
        },
        scan_duration_seconds: 12.5,
        timestamp: new Date().toISOString()
    }
}

export default function ScanPage() {
    const navigate = useNavigate()
    const {
        isScanning,
        scanProgress,
        scanStatus,
        startScan,
        updateScanProgress,
        completeScan,
        cancelScan,
        setHealthScore
    } = useAppStore()

    const [discoveries, setDiscoveries] = useState<string[]>([])
    const [error, setError] = useState<string | null>(null)

    const runScan = async () => {
        setError(null)
        setDiscoveries([])
        startScan()

        try {
            // Try to use Electron API first
            if (window.electronAPI) {
                const { quickScanByDefault } = useAppStore.getState().preferences
                const result = await window.electronAPI.runScan({ quick: quickScanByDefault })
                completeScan(result)
                // Calculate health score based on results
                const junkGB = result.total_size_bytes / (1024 * 1024 * 1024)
                const healthPenalty = Math.min(junkGB * 5, 30) // -5 points per GB, max -30
                setHealthScore(Math.max(70, 100 - healthPenalty))
                navigate('/results')
            } else {
                // Fallback to simulated scan for development
                const result = await simulateScan((progress, status) => {
                    updateScanProgress(progress, status)

                    // Add discoveries
                    if (progress === 25) setDiscoveries(d => [...d, '✓ Found 1.2 GB in Chrome cache'])
                    if (progress === 40) setDiscoveries(d => [...d, '✓ Found 890 MB in temp files'])
                    if (progress === 55) setDiscoveries(d => [...d, '✓ Found 180 MB in log files'])
                    if (progress === 70) setDiscoveries(d => [...d, '✓ Found 512 MB in crash dumps'])
                })

                completeScan(result)
                const junkGB = result.total_size_bytes / (1024 * 1024 * 1024)
                const healthPenalty = Math.min(junkGB * 5, 30)
                setHealthScore(Math.max(70, 100 - Math.round(healthPenalty)))

                // Navigate to results after short delay
                setTimeout(() => navigate('/results'), 1000)
            }
        } catch (err: any) {
            setError(err.message || 'Scan failed')
            cancelScan()
        }
    }

    useEffect(() => {
        if (!isScanning && scanProgress === 0) {
            runScan()
        }
    }, [])

    const handleCancel = () => {
        cancelScan()
        navigate('/')
    }

    return (
        <div className="p-8 h-full flex flex-col">
            <div className="flex-1 flex flex-col items-center justify-center max-w-2xl mx-auto w-full">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-2xl font-bold text-gray-800">
                        {isScanning ? 'Scanning Your PC...' : error ? 'Scan Failed' : 'Scan Complete!'}
                    </h1>
                    <p className="text-gray-500 mt-2">
                        {isScanning ? 'Please wait while we analyze your system' :
                            error ? error : 'Your scan results are ready'}
                    </p>
                </div>

                {/* Progress */}
                <div className="w-full mb-8">
                    <div className="flex justify-between text-sm text-gray-600 mb-2">
                        <span>{scanStatus}</span>
                        <span>{scanProgress}%</span>
                    </div>
                    <div className="w-full h-4 bg-gray-200 rounded-full overflow-hidden">
                        <div
                            className={`h-full bg-gradient-to-r from-primary to-blue-400 transition-all duration-300 ${isScanning ? 'progress-animated' : ''
                                }`}
                            style={{ width: `${scanProgress}%` }}
                        />
                    </div>
                </div>

                {/* Scanning animation or result icon */}
                <div className="mb-8">
                    {isScanning ? (
                        <Loader2 className="w-16 h-16 text-primary animate-spin" />
                    ) : error ? (
                        <AlertCircle className="w-16 h-16 text-danger" />
                    ) : (
                        <CheckCircle className="w-16 h-16 text-success" />
                    )}
                </div>

                {/* Discoveries */}
                {discoveries.length > 0 && (
                    <div className="w-full card mb-8">
                        <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">Real-time Discoveries</h3>
                        <ul className="space-y-2">
                            {discoveries.map((discovery, index) => (
                                <li
                                    key={index}
                                    className="text-gray-700 animate-fade-in"
                                    style={{ animationDelay: `${index * 100}ms` }}
                                >
                                    {discovery}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Actions */}
                <div className="flex gap-4">
                    {isScanning && (
                        <button onClick={handleCancel} className="btn-secondary">
                            <X className="w-4 h-4" />
                            Cancel
                        </button>
                    )}
                    {!isScanning && !error && (
                        <button onClick={() => navigate('/results')} className="btn-primary">
                            View Results
                        </button>
                    )}
                    {error && (
                        <button onClick={runScan} className="btn-primary">
                            Try Again
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
