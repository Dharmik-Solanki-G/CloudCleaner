import { useEffect, useState, useRef, useCallback } from 'react'
import { useAppStore } from '../stores/appStore'
import { formatBytes } from '../utils/formatters'
import { format } from 'date-fns'
import { History, Trash2, Calendar, HardDrive, RefreshCw, Scan } from 'lucide-react'

interface CleanupEntry {
    id: number
    timestamp: string
    items_deleted: number
    bytes_freed: number
}

interface ScanEntry {
    id: number
    timestamp: string
    scan_type: string
    total_items: number
    total_size_bytes: number
    status: string
}

interface Stats {
    total_scans: number
    total_cleanups: number
    total_bytes_freed: number
    total_items_cleaned: number
}

export default function HistoryPage() {
    const { scanHistory } = useAppStore()
    const [dbHistory, setDbHistory] = useState<{ scans: ScanEntry[], cleanups: CleanupEntry[] }>({ scans: [], cleanups: [] })
    const [stats, setStats] = useState<Stats>({ total_scans: 0, total_cleanups: 0, total_bytes_freed: 0, total_items_cleaned: 0 })
    const [loading, setLoading] = useState(true)
    const isMounted = useRef(true)

    useEffect(() => {
        return () => { isMounted.current = false }
    }, [])

    const loadHistory = useCallback(async () => {
        if (!window.electronAPI) {
            setLoading(false)
            return
        }

        setLoading(true)
        try {
            // Ensure stats fetch doesn't fail the whole promise.all
            const historyPromise = window.electronAPI.getHistory().catch(e => {
                console.error("History fetch failed", e)
                return { scans: [], cleanups: [] }
            })
            const statsPromise = window.electronAPI.getStats().catch(e => {
                console.error("Stats fetch failed", e)
                return { total_scans: 0, total_cleanups: 0, total_bytes_freed: 0, total_items_cleaned: 0 }
            })

            const [historyData, statsData] = await Promise.all([historyPromise, statsPromise])

            if (isMounted.current) {
                setDbHistory(historyData)
                setStats(statsData)
                setLoading(false)
            }
        } catch (error) {
            console.error('Failed to load history:', error)
            if (isMounted.current) setLoading(false)
        }
    }, [])

    // Load initial data
    useEffect(() => {
        loadHistory()
    }, [loadHistory])

    // We display DB scans directly. For cleanups, we combine:
    // 1. Current session cleanups (from global store)
    // 2. Persisted cleanups (from DB)
    // Note: In a real app, you'd probably just refresh DB data after cleanup instead of mixing sources.
    const allCleanups = [
        ...scanHistory.map((h, i) => ({
            id: -i - 1,
            timestamp: h.timestamp,
            items_deleted: h.items_cleaned,
            bytes_freed: h.space_freed
        })),
        ...dbHistory.cleanups
    ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    // Calculate totals from stats (database) + current session
    const sessionCleaned = scanHistory.reduce((acc, h) => acc + h.space_freed, 0)
    const sessionItems = scanHistory.reduce((acc, h) => acc + h.items_cleaned, 0)
    const totalCleaned = stats.total_bytes_freed + sessionCleaned
    const totalItems = stats.total_items_cleaned + sessionItems

    return (
        <div className="p-8">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-gray-800">Cleanup History</h1>
                <button
                    onClick={loadHistory}
                    className="btn-secondary"
                    disabled={loading}
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </button>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-4 mb-8">
                <div className="card text-center">
                    <HardDrive className="w-8 h-8 text-primary mx-auto mb-2" />
                    <p className="text-2xl font-bold text-gray-800">{formatBytes(totalCleaned)}</p>
                    <p className="text-sm text-gray-500">Total Space Freed</p>
                </div>
                <div className="card text-center">
                    <Trash2 className="w-8 h-8 text-danger mx-auto mb-2" />
                    <p className="text-2xl font-bold text-gray-800">{totalItems}</p>
                    <p className="text-sm text-gray-500">Items Cleaned</p>
                </div>
                <div className="card text-center">
                    <Calendar className="w-8 h-8 text-success mx-auto mb-2" />
                    <p className="text-2xl font-bold text-gray-800">{stats.total_scans}</p>
                    <p className="text-sm text-gray-500">Scans Performed</p>
                </div>
            </div>

            {/* Scan History from Database */}
            {dbHistory.scans.length > 0 && (
                <div className="mb-8">
                    <h2 className="text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2">
                        <Scan className="w-5 h-5" />
                        Recent Scans
                    </h2>
                    <div className="space-y-3">
                        {dbHistory.scans.map((scan) => (
                            <div
                                key={scan.id}
                                className="card flex items-center justify-between hover:shadow-lg transition-shadow"
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                                        <Scan className="w-6 h-6 text-blue-600" />
                                    </div>
                                    <div>
                                        <p className="font-semibold text-gray-800">
                                            {scan.scan_type === 'quick' ? 'Quick Scan' : 'Full Scan'}
                                        </p>
                                        <p className="text-sm text-gray-500">
                                            {format(new Date(scan.timestamp), 'MMM d, yyyy h:mm a')}
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-lg font-bold text-blue-600">
                                        {scan.total_items} items
                                    </p>
                                    <p className="text-sm text-gray-500">{formatBytes(scan.total_size_bytes)} found</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Cleanup History */}
            <h2 className="text-lg font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <Trash2 className="w-5 h-5" />
                Cleanup History
            </h2>
            {allCleanups.length === 0 ? (
                <div className="card text-center py-12">
                    <History className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h2 className="text-xl font-semibold text-gray-600">No Cleanups Yet</h2>
                    <p className="text-gray-500 mt-2">
                        Your cleanup history will appear here after your first cleanup.
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {allCleanups.map((entry) => (
                        <div
                            key={entry.id}
                            className="card flex items-center justify-between hover:shadow-lg transition-shadow"
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                                    <Trash2 className="w-6 h-6 text-green-600" />
                                </div>
                                <div>
                                    <p className="font-semibold text-gray-800">
                                        Cleaned {entry.items_deleted} items
                                    </p>
                                    <p className="text-sm text-gray-500">
                                        {format(new Date(entry.timestamp), 'MMM d, yyyy h:mm a')}
                                    </p>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-lg font-bold text-green-600">
                                    +{formatBytes(entry.bytes_freed)}
                                </p>
                                <p className="text-sm text-gray-500">freed</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
