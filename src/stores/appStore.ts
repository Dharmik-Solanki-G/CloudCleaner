import { create } from 'zustand'

export interface FileItem {
    path: string
    size_bytes: number
    category: string
    last_modified: number
    risk_level: 'low' | 'medium' | 'high'
    safe_to_delete: boolean
    reason: string
    selected?: boolean
}

export interface ScanResult {
    total_items: number
    total_size_bytes: number
    items: FileItem[]
    categories: Record<string, number>
    scan_duration_seconds: number
    timestamp: string
}

export interface PerformanceIssue {
    category: string
    severity: 'critical' | 'major' | 'minor'
    title: string
    description: string
    impact: string
    recommendation: string
    estimated_improvement: string
}

interface AppState {
    // Scan state
    isScanning: boolean
    scanProgress: number
    scanStatus: string
    scanResult: ScanResult | null

    // Performance state
    healthScore: number
    performanceIssues: PerformanceIssue[]

    // Cleanup state
    selectedItems: string[]
    isCleaningUp: boolean
    cleanupResult: { success: boolean; freed_bytes: number } | null

    // Scan history
    scanHistory: { timestamp: string; items_cleaned: number; space_freed: number }[]

    // Preferences
    preferences: {
        quickScanByDefault: boolean
        autoSelectLowRisk: boolean
        confirmBeforeDelete: boolean
        [key: string]: any
    }
    setPreferences: (prefs: Record<string, any>) => void

    // Actions
    startScan: () => void
    updateScanProgress: (progress: number, status: string) => void
    completeScan: (result: ScanResult) => void
    cancelScan: () => void

    toggleItemSelection: (path: string) => void
    selectAllItems: () => void
    deselectAllItems: () => void

    startCleanup: () => void
    completeCleanup: (result: { success: boolean; freed_bytes: number }) => void

    setHealthScore: (score: number) => void
    setPerformanceIssues: (issues: PerformanceIssue[]) => void

    addToHistory: (entry: { timestamp: string; items_cleaned: number; space_freed: number }) => void
    reset: () => void
}

const initialState = {
    isScanning: false,
    scanProgress: 0,
    scanStatus: '',
    scanResult: null,
    healthScore: 100,
    performanceIssues: [],
    selectedItems: [],
    isCleaningUp: false,
    cleanupResult: null,
    scanHistory: [],
    preferences: {
        quickScanByDefault: true,
        autoSelectLowRisk: true,
        confirmBeforeDelete: true
    }
}

export const useAppStore = create<AppState>((set, get) => ({
    ...initialState,

    setPreferences: (prefs) => set(state => ({
        preferences: { ...state.preferences, ...prefs }
    })),

    startScan: () => set({
        isScanning: true,
        scanProgress: 0,
        scanStatus: 'Initializing scan...',
        scanResult: null,
        cleanupResult: null
    }),

    updateScanProgress: (progress, status) => set({
        scanProgress: progress,
        scanStatus: status
    }),

    completeScan: (result) => {
        const { autoSelectLowRisk } = get().preferences
        set({
            isScanning: false,
            scanProgress: 100,
            scanStatus: 'Scan complete',
            scanResult: result,
            // Auto-select low-risk items if preference is enabled
            selectedItems: autoSelectLowRisk
                ? result.items
                    .filter(item => item.safe_to_delete && item.risk_level === 'low')
                    .map(item => item.path)
                : []
        })
    },

    cancelScan: () => set({
        isScanning: false,
        scanProgress: 0,
        scanStatus: 'Scan cancelled'
    }),

    toggleItemSelection: (path) => {
        const { selectedItems } = get()
        if (selectedItems.includes(path)) {
            set({ selectedItems: selectedItems.filter(p => p !== path) })
        } else {
            set({ selectedItems: [...selectedItems, path] })
        }
    },

    selectAllItems: () => {
        const { scanResult } = get()
        if (scanResult) {
            set({
                selectedItems: scanResult.items
                    .filter(item => item.safe_to_delete)
                    .map(item => item.path)
            })
        }
    },

    deselectAllItems: () => set({ selectedItems: [] }),

    startCleanup: () => set({ isCleaningUp: true }),

    completeCleanup: (result) => {
        const { selectedItems, scanResult } = get()
        set({
            isCleaningUp: false,
            cleanupResult: result,
            selectedItems: [],
            // Remove cleaned items from scan result
            scanResult: scanResult ? {
                ...scanResult,
                items: scanResult.items.filter(item => !selectedItems.includes(item.path)),
                total_items: scanResult.total_items - selectedItems.length,
                total_size_bytes: scanResult.total_size_bytes - result.freed_bytes
            } : null
        })

        // Add to history
        if (result.success) {
            get().addToHistory({
                timestamp: new Date().toISOString(),
                items_cleaned: selectedItems.length,
                space_freed: result.freed_bytes
            })
        }
    },

    setHealthScore: (score) => set({ healthScore: score }),

    setPerformanceIssues: (issues) => set({ performanceIssues: issues }),

    addToHistory: (entry) => set(state => ({
        scanHistory: [entry, ...state.scanHistory].slice(0, 50) // Keep last 50 entries
    })),

    reset: () => set(initialState)
}))
