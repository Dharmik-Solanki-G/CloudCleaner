import { useState } from 'react'
import { Trash2, AlertTriangle, X, Loader2, CheckCircle } from 'lucide-react'
import { formatBytes } from '../utils/formatters'

interface CleanupItem {
    path: string
    size_bytes: number
    category: string
    risk_level: 'low' | 'medium' | 'high'
}

interface Props {
    isOpen: boolean
    items: CleanupItem[]
    totalSize: number
    onConfirm: () => Promise<void>
    onCancel: () => void
}

export default function CleanupConfirmModal({ isOpen, items, totalSize, onConfirm, onCancel }: Props) {
    const [isProcessing, setIsProcessing] = useState(false)
    const [isDone, setIsDone] = useState(false)
    const [error, setError] = useState<string | null>(null)

    if (!isOpen) return null

    const lowRiskCount = items.filter(i => i.risk_level === 'low').length
    const mediumRiskCount = items.filter(i => i.risk_level === 'medium').length
    const highRiskCount = items.filter(i => i.risk_level === 'high').length

    const handleConfirm = async () => {
        setIsProcessing(true)
        setError(null)
        try {
            await onConfirm()
            setIsDone(true)
        } catch (err: any) {
            setError(err.message || 'Cleanup failed')
        }
        setIsProcessing(false)
    }

    const handleClose = () => {
        setIsDone(false)
        setError(null)
        onCancel()
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden">
                {/* Header */}
                <div className={`p-6 ${isDone ? 'bg-green-500' : 'bg-gradient-to-r from-red-500 to-orange-500'} text-white`}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            {isDone ? (
                                <CheckCircle className="w-8 h-8" />
                            ) : (
                                <Trash2 className="w-8 h-8" />
                            )}
                            <div>
                                <h2 className="text-xl font-bold">
                                    {isDone ? 'Cleanup Complete!' : 'Confirm Cleanup'}
                                </h2>
                                <p className="text-white/80 text-sm">
                                    {isDone
                                        ? `Successfully freed ${formatBytes(totalSize)}`
                                        : `${items.length} items • ${formatBytes(totalSize)}`
                                    }
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={handleClose}
                            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6">
                    {isDone ? (
                        <div className="text-center py-4">
                            <p className="text-gray-600">
                                Your selected files have been moved to the trash.
                            </p>
                            <p className="text-sm text-gray-500 mt-2">
                                You can restore them from the Recycle Bin if needed.
                            </p>
                        </div>
                    ) : (
                        <>
                            {/* Risk Summary */}
                            <div className="flex gap-4 mb-6">
                                {lowRiskCount > 0 && (
                                    <div className="flex-1 text-center p-3 bg-green-50 rounded-lg">
                                        <p className="text-2xl font-bold text-green-600">{lowRiskCount}</p>
                                        <p className="text-xs text-green-700">Low Risk</p>
                                    </div>
                                )}
                                {mediumRiskCount > 0 && (
                                    <div className="flex-1 text-center p-3 bg-yellow-50 rounded-lg">
                                        <p className="text-2xl font-bold text-yellow-600">{mediumRiskCount}</p>
                                        <p className="text-xs text-yellow-700">Medium Risk</p>
                                    </div>
                                )}
                                {highRiskCount > 0 && (
                                    <div className="flex-1 text-center p-3 bg-red-50 rounded-lg">
                                        <p className="text-2xl font-bold text-red-600">{highRiskCount}</p>
                                        <p className="text-xs text-red-700">High Risk</p>
                                    </div>
                                )}
                            </div>

                            {/* Warning for risky items */}
                            {(mediumRiskCount > 0 || highRiskCount > 0) && (
                                <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-3">
                                    <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <p className="font-medium text-yellow-800">Warning</p>
                                        <p className="text-sm text-yellow-700">
                                            Some selected items may be needed by applications.
                                            Deleting them could cause temporary issues.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Item preview */}
                            <div className="mb-6">
                                <p className="text-sm font-medium text-gray-500 mb-2">Items to delete:</p>
                                <div className="max-h-40 overflow-y-auto space-y-2">
                                    {items.slice(0, 5).map((item, i) => (
                                        <div key={i} className="flex justify-between text-sm p-2 bg-gray-50 rounded">
                                            <span className="text-gray-700 truncate flex-1 mr-2">{item.path}</span>
                                            <span className="text-gray-500">{formatBytes(item.size_bytes)}</span>
                                        </div>
                                    ))}
                                    {items.length > 5 && (
                                        <p className="text-sm text-gray-500 text-center">
                                            ... and {items.length - 5} more items
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Error message */}
                            {error && (
                                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                                    {error}
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Actions */}
                <div className="p-6 pt-0 flex gap-3">
                    {isDone ? (
                        <button onClick={handleClose} className="btn-primary flex-1">
                            Done
                        </button>
                    ) : (
                        <>
                            <button
                                onClick={handleClose}
                                className="btn-secondary flex-1"
                                disabled={isProcessing}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirm}
                                className="btn-danger flex-1"
                                disabled={isProcessing}
                            >
                                {isProcessing ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Cleaning...
                                    </>
                                ) : (
                                    <>
                                        <Trash2 className="w-4 h-4" />
                                        Delete {items.length} Items
                                    </>
                                )}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
