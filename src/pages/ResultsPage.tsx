import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Trash2, CheckSquare, Square, AlertTriangle, FileText, Download } from 'lucide-react'
import { useAppStore } from '../stores/appStore'
import { formatBytes } from '../utils/formatters'
import CleanupConfirmModal from '../components/CleanupConfirmModal'

const categoryLabels: Record<string, string> = {
    browser_cache: '🌐 Browser Cache',
    temp_files: '📁 Temporary Files',
    thumbnails: '🖼️ Thumbnail Cache',
    crash_dumps: '💥 Crash Dumps',
    logs: '📝 Log Files',
    recycle_bin: '🗑️ Recycle Bin',
    update_cache: '⬇️ Update Cache',
}

const riskColors = {
    low: 'text-green-600 bg-green-100',
    medium: 'text-yellow-600 bg-yellow-100',
    high: 'text-red-600 bg-red-100',
}

export default function ResultsPage() {
    const navigate = useNavigate()
    const {
        scanResult,
        selectedItems,
        toggleItemSelection,
        selectAllItems,
        deselectAllItems,
        isCleaningUp,
        startCleanup,
        completeCleanup,
        preferences
    } = useAppStore()

    const [showConfirmModal, setShowConfirmModal] = useState(false)

    if (!scanResult) {
        return (
            <div className="p-8 flex flex-col items-center justify-center h-full">
                <FileText className="w-16 h-16 text-gray-300 mb-4" />
                <h2 className="text-xl font-semibold text-gray-600">No Scan Results</h2>
                <p className="text-gray-500 mt-2">Run a scan first to see results</p>
                <button onClick={() => navigate('/scan')} className="btn-primary mt-6">
                    Run Scan
                </button>
            </div>
        )
    }

    const selectedItemsData = scanResult.items.filter(item => selectedItems.includes(item.path))
    const selectedSize = selectedItemsData.reduce((acc, item) => acc + item.size_bytes, 0)

    const handleCleanup = async () => {
        if (selectedItems.length === 0) return

        startCleanup()

        try {
            if (window.electronAPI) {
                await window.electronAPI.executeCleanup(selectedItems)
            } else {
                // Simulate cleanup for development
                await new Promise(resolve => setTimeout(resolve, 2000))
            }
            completeCleanup({ success: true, freed_bytes: selectedSize })
        } catch (error) {
            completeCleanup({ success: false, freed_bytes: 0 })
            throw error
        }
    }

    // Group items by category
    const groupedItems = scanResult.items.reduce((acc, item) => {
        if (!acc[item.category]) acc[item.category] = []
        acc[item.category].push(item)
        return acc
    }, {} as Record<string, typeof scanResult.items>)

    return (
        <div className="p-8">
            {/* Cleanup Confirmation Modal */}
            <CleanupConfirmModal
                isOpen={showConfirmModal}
                items={selectedItemsData}
                totalSize={selectedSize}
                onConfirm={handleCleanup}
                onCancel={() => setShowConfirmModal(false)}
            />

            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Scan Results</h1>
                    <p className="text-gray-500 mt-1">
                        Found {scanResult.total_items} items · {formatBytes(scanResult.total_size_bytes)} recoverable
                    </p>
                </div>
                <button className="btn-secondary">
                    <Download className="w-4 h-4" />
                    Export Report
                </button>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="card text-center">
                    <p className="text-3xl font-bold text-primary">{formatBytes(scanResult.total_size_bytes)}</p>
                    <p className="text-sm text-gray-500">Total Cleanable</p>
                </div>
                <div className="card text-center">
                    <p className="text-3xl font-bold text-green-600">{formatBytes(selectedSize)}</p>
                    <p className="text-sm text-gray-500">Selected to Clean</p>
                </div>
                <div className="card text-center">
                    <p className="text-3xl font-bold text-gray-600">{selectedItems.length}</p>
                    <p className="text-sm text-gray-500">Items Selected</p>
                </div>
            </div>

            {/* Selection controls */}
            <div className="flex gap-4 mb-4">
                <button
                    onClick={selectAllItems}
                    className="text-sm text-primary hover:underline flex items-center gap-1"
                >
                    <CheckSquare className="w-4 h-4" />
                    Select All Safe Items
                </button>
                <button
                    onClick={deselectAllItems}
                    className="text-sm text-gray-500 hover:underline flex items-center gap-1"
                >
                    <Square className="w-4 h-4" />
                    Deselect All
                </button>
            </div>

            {/* Categories */}
            <div className="space-y-4 mb-8">
                {Object.entries(groupedItems).map(([category, items]) => {
                    const categorySize = items.reduce((acc, item) => acc + item.size_bytes, 0)
                    const selectedInCategory = items.filter(item => selectedItems.includes(item.path)).length

                    return (
                        <div key={category} className="card">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <span className="text-xl">{categoryLabels[category]?.split(' ')[0] || '📁'}</span>
                                    <div>
                                        <h3 className="font-semibold text-gray-800">
                                            {categoryLabels[category]?.split(' ').slice(1).join(' ') || category}
                                        </h3>
                                        <p className="text-sm text-gray-500">
                                            {items.length} items · {formatBytes(categorySize)}
                                        </p>
                                    </div>
                                </div>
                                <span className="text-sm text-gray-500">
                                    {selectedInCategory}/{items.length} selected
                                </span>
                            </div>

                            <div className="space-y-2">
                                {items.map(item => (
                                    <label
                                        key={item.path}
                                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${selectedItems.includes(item.path)
                                            ? 'border-primary bg-blue-50'
                                            : 'border-gray-200 hover:bg-gray-50'
                                            }`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selectedItems.includes(item.path)}
                                            onChange={() => toggleItemSelection(item.path)}
                                            className="w-5 h-5 text-primary rounded"
                                            disabled={!item.safe_to_delete}
                                        />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm text-gray-700 truncate">{item.path}</p>
                                            <p className="text-xs text-gray-500">{item.reason}</p>
                                        </div>
                                        <span className={`text-xs px-2 py-1 rounded-full ${riskColors[item.risk_level]}`}>
                                            {item.risk_level}
                                        </span>
                                        <span className="text-sm font-medium text-gray-600">
                                            {formatBytes(item.size_bytes)}
                                        </span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Medium/High risk warning */}
            {scanResult.items.some(i => i.risk_level !== 'low' && selectedItems.includes(i.path)) && (
                <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="font-medium text-yellow-800">Some selected items have medium or high risk</p>
                        <p className="text-sm text-yellow-700 mt-1">
                            These files may be needed by applications. Deleting them could cause temporary issues.
                        </p>
                    </div>
                </div>
            )}

            {/* Clean button - opens modal */}
            <button
                onClick={() => {
                    if (preferences.confirmBeforeDelete) {
                        setShowConfirmModal(true)
                    } else {
                        handleCleanup()
                    }
                }}
                disabled={selectedItems.length === 0 || isCleaningUp}
                className={`btn-danger w-full text-lg py-4 ${selectedItems.length === 0 ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
            >
                <Trash2 className="w-5 h-5" />
                Clean Selected ({formatBytes(selectedSize)})
            </button>
        </div>
    )
}
