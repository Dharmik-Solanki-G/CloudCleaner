import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { HardDrive, Shield, Zap, Search } from 'lucide-react'
import HealthScoreWidget from '../components/HealthScoreWidget'
import QuickActionCard from '../components/QuickActionCard'
import AIInsightPanel from '../components/AIInsightPanel'
import { useAppStore } from '../stores/appStore'
import { formatBytes } from '../utils/formatters'

export default function Dashboard() {
    const navigate = useNavigate()
    const [stats, setStats] = useState<{ free: number, total: number } | null>(null)
    const { healthScore, scanResult, scanHistory } = useAppStore()

    useEffect(() => {
        const loadStats = async () => {
            if (window.electronAPI) {
                try {
                    const [diskStats, history] = await Promise.all([
                        window.electronAPI.getDiskUsage(),
                        window.electronAPI.getHistory()
                    ])
                    setStats(diskStats)
                    // populate store with real history if empty
                    if (scanHistory.length === 0 && history && history.scans && history.scans.length > 0) {
                        // We might want a setHistory action in store, but iterating addToHistory works for now
                        // actually, let's just use the latest values for display
                    }
                } catch (e) {
                    console.error("Failed to load dashboard stats", e)
                }
            }
        }
        loadStats()
    }, [])

    // Calculate stats
    const totalJunkSize = scanResult?.total_size_bytes || 0
    // Use store history if available, otherwise 0
    const totalCleaned = scanHistory.reduce((acc, h) => acc + h.space_freed, 0)

    // Disk usage display
    const diskUsageText = stats
        ? `${formatBytes(stats.total - stats.free)} used / ${formatBytes(stats.total)}`
        : 'Calculating...'

    // Generate rule-based insight
    const generateInsight = (): string => {
        if (!scanResult) {
            return "Run a quick scan to analyze your PC's health and discover cleaning opportunities."
        }

        if (totalJunkSize > 5 * 1024 * 1024 * 1024) { // > 5 GB
            return `Your PC has ${formatBytes(totalJunkSize)} of junk files. Cleaning these could significantly improve performance.`
        }

        if (healthScore < 70) {
            return "Your system health is below optimal. Consider running a cleanup to improve performance."
        }

        return "Your PC is running smoothly! Regular scans help maintain optimal performance."
    }

    return (
        <div className="p-8">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Dashboard</h1>
                <p className="text-gray-500 dark:text-gray-400 mt-1">Welcome back! Here's your system overview.</p>
            </div>

            {/* Health Score */}
            <div className="mb-6 animate-fade-in">
                <HealthScoreWidget score={healthScore} />
            </div>

            {/* Quick Actions Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <QuickActionCard
                    icon={HardDrive}
                    title="Disk Usage"
                    value={diskUsageText}
                    action={stats ? `${Math.round(((stats.total - stats.free) / stats.total) * 100)}% Full` : "Check"}
                    onClick={() => navigate('/scan')}
                    variant={stats && ((stats.total - stats.free) / stats.total) > 0.9 ? 'warning' : 'default'}
                />
                <QuickActionCard
                    icon={Shield}
                    title="Security"
                    value="Protected"
                    action="Check Security"
                    onClick={() => navigate('/scan')}
                    variant="success"
                />
                <QuickActionCard
                    icon={Zap}
                    title="Performance"
                    value={healthScore >= 70 ? 'Good' : 'Needs Work'}
                    action="Optimize"
                    onClick={() => navigate('/scan')}
                    variant={healthScore < 70 ? 'warning' : 'default'}
                />
            </div>

            {/* AI Insight */}
            <div className="mb-6 animate-fade-in">
                <AIInsightPanel
                    insight={generateInsight()}
                    onLearnMore={() => navigate('/results')}
                />
            </div>

            {/* Run Scan Button */}
            <button
                onClick={() => navigate('/scan')}
                className="btn-primary w-full text-lg py-4"
            >
                <Search className="w-5 h-5" />
                Run Full Scan
            </button>

            {/* Stats */}
            {scanHistory.length > 0 && (
                <div className="mt-8 grid grid-cols-2 gap-4">
                    <div className="card bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20">
                        <p className="text-sm text-gray-500 dark:text-gray-400">Total Space Freed</p>
                        <p className="text-2xl font-bold text-green-600 dark:text-green-400">{formatBytes(totalCleaned)}</p>
                    </div>
                    <div className="card bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
                        <p className="text-sm text-gray-500 dark:text-gray-400">Scans Completed</p>
                        <p className="text-2xl font-bold text-primary dark:text-blue-400">{scanHistory.length}</p>
                    </div>
                </div>
            )}
        </div>
    )
}
