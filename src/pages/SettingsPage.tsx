import { useState, useEffect } from 'react'
import { RotateCcw, Shield, Trash2, Bell, Moon, Sun, Monitor, Info, FolderX } from 'lucide-react'

// Define the shape of our settings
interface AppSettings {
    quickScanByDefault: boolean
    autoSelectLowRisk: boolean
    confirmBeforeDelete: boolean
    enableNotifications: boolean
    darkMode: boolean
    scanOnStartup: boolean
    keepLogs: boolean
    [key: string]: any
}

const DEFAULT_SETTINGS: AppSettings = {
    quickScanByDefault: true,
    autoSelectLowRisk: true,
    confirmBeforeDelete: true,
    enableNotifications: true,
    darkMode: false,
    scanOnStartup: false,
    keepLogs: true,
}

export default function SettingsPage() {
    const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
    const [exclusions, setExclusions] = useState<string[]>([])
    const [newExclusion, setNewExclusion] = useState('')
    const [appVersion, setAppVersion] = useState<string>('')
    const [loading, setLoading] = useState(true)
    const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' } | null>(null)

    // Load initial data
    useEffect(() => {
        const loadData = async () => {
            if (!window.electronAPI) return
            try {
                setLoading(true)
                const [prefs, excl, ver] = await Promise.all([
                    window.electronAPI.getPrefs(),
                    window.electronAPI.getExclusions(),
                    window.electronAPI.getAppVersion()
                ])

                // Merge loaded prefs with defaults (handles potential missing keys)
                const mergedSettings = { ...DEFAULT_SETTINGS, ...prefs }
                setSettings(mergedSettings)
                setExclusions(excl.exclusions || [])
                setAppVersion(ver)
            } catch (error) {
                console.error("Failed to load settings:", error)
                showNotification("Failed to load settings", 'error')
            } finally {
                setLoading(false)
            }
        }
        loadData()
    }, [])

    const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
        setNotification({ message, type })
        setTimeout(() => setNotification(null), 3000)
    }

    const handleToggle = async (key: keyof AppSettings) => {
        const newValue = !settings[key]
        setSettings(prev => ({ ...prev, [key]: newValue }))

        // Instant visual feedback for dark mode
        if (key === 'darkMode') {
            if (newValue) {
                document.documentElement.classList.add('dark')
            } else {
                document.documentElement.classList.remove('dark')
            }
        }

        if (window.electronAPI) {
            try {
                await window.electronAPI.setPref(key as string, newValue)
            } catch (error) {
                console.error(`Failed to save ${key}:`, error)
                // Revert on failure
                setSettings(prev => ({ ...prev, [key]: !newValue }))
                if (key === 'darkMode') {
                    // Revert visual change
                    if (!newValue) {
                        document.documentElement.classList.add('dark')
                    } else {
                        document.documentElement.classList.remove('dark')
                    }
                }
                showNotification("Failed to save setting", 'error')
            }
        }
    }

    const addExclusion = async () => {
        const path = newExclusion.trim()
        if (!path) return
        if (exclusions.includes(path)) {
            showNotification("Exclusion already exists", 'error')
            return
        }

        // Optimistic update
        setExclusions([...exclusions, path])
        setNewExclusion('')

        if (window.electronAPI) {
            try {
                const result = await window.electronAPI.addExclusion(path)
                if (!result.success) {
                    throw new Error("Backend failed to add exclusion")
                }
                showNotification("Exclusion added")
            } catch (error) {
                console.error("Failed to add exclusion:", error)
                setExclusions(prev => prev.filter(p => p !== path))
                showNotification("Failed to add exclusion", 'error')
            }
        }
    }

    const removeExclusion = async (path: string) => {
        if (!confirm(`Are you sure you want to remove "${path}" from exclusions?`)) return

        setExclusions(exclusions.filter(e => e !== path))

        if (window.electronAPI) {
            try {
                const result = await window.electronAPI.removeExclusion(path)
                if (!result.success) {
                    throw new Error("Backend failed to remove exclusion")
                }
                showNotification("Exclusion removed")
            } catch (error) {
                console.error("Failed to remove exclusion:", error)
                setExclusions(prev => [...prev, path])
                showNotification("Failed to remove exclusion", 'error')
            }
        }
    }

    const handleReset = async () => {
        if (!confirm("Reset all settings to default values?")) return
        setSettings(DEFAULT_SETTINGS)
        if (window.electronAPI) {
            // Save each default setting
            for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
                await window.electronAPI.setPref(key, value)
            }
            showNotification("Settings reset to defaults")
        }
    }

    if (loading) {
        return (
            <div className="p-8 max-w-3xl flex justify-center items-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        )
    }

    return (
        <div className="p-8 max-w-3xl pb-20">
            <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6 flex items-center gap-3">
                Settings
                <span className="text-xs font-normal px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-gray-500 dark:text-gray-400">v{appVersion}</span>
            </h1>

            {notification && (
                <div className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-lg shadow-lg text-white ${notification.type === 'error' ? 'bg-red-500' : 'bg-green-500'
                    } transition-all transform animate-in fade-in slide-in-from-top-2`}>
                    {notification.message}
                </div>
            )}

            {/* Scan Preferences */}
            <div className="card mb-6">
                <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">
                    <Shield className="w-5 h-5 text-primary" />
                    Scan Configuration
                </h2>

                <div className="space-y-4">
                    <ToggleSetting
                        label="Quick scan by default"
                        description="Start with a quick scan instead of full scan"
                        checked={settings.quickScanByDefault}
                        onChange={() => handleToggle('quickScanByDefault')}
                    />
                    <ToggleSetting
                        label="Auto-select low risk items"
                        description="Automatically select safe-to-delete items after scanning"
                        checked={settings.autoSelectLowRisk}
                        onChange={() => handleToggle('autoSelectLowRisk')}
                    />
                    <ToggleSetting
                        label="Scan on startup"
                        description="Run a quick background scan when application starts"
                        checked={settings.scanOnStartup}
                        onChange={() => handleToggle('scanOnStartup')}
                    />
                </div>
            </div>

            {/* Safety & Logs */}
            <div className="card mb-6">
                <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">
                    <Trash2 className="w-5 h-5 text-danger" />
                    Safety & History
                </h2>

                <div className="space-y-4">
                    <ToggleSetting
                        label="Confirm before deletion"
                        description="Show a confirmation dialog before permanently deleting files"
                        checked={settings.confirmBeforeDelete}
                        onChange={() => handleToggle('confirmBeforeDelete')}
                    />
                    <ToggleSetting
                        label="Keep cleanup logs"
                        description="Maintain a history of deleted files and space freed"
                        checked={settings.keepLogs}
                        onChange={() => handleToggle('keepLogs')}
                    />
                </div>
            </div>

            {/* Exclusions */}
            <div className="card mb-6">
                <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">
                    <FolderX className="w-5 h-5 text-orange-500" />
                    Exclusion Paths
                </h2>
                <div className="bg-orange-50 dark:bg-orange-900/20 text-orange-800 dark:text-orange-200 text-sm p-3 rounded-lg mb-4 flex gap-2">
                    <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <p>Files in these folders will be completely ignored during scans and cleanups.</p>
                </div>

                <div className="flex gap-2 mb-4">
                    <input
                        type="text"
                        value={newExclusion}
                        onChange={(e) => setNewExclusion(e.target.value)}
                        placeholder="Paste full directory path (e.g. C:\Work\DoNotDelete)"
                        className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-mono text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        onKeyDown={(e) => e.key === 'Enter' && addExclusion()}
                    />
                    <button onClick={addExclusion} className="btn-primary px-4 whitespace-nowrap">
                        Add Path
                    </button>
                </div>

                <ul className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                    {exclusions.length === 0 && (
                        <div className="text-center text-gray-400 py-4 italic">No exclusions added</div>
                    )}
                    {exclusions.map(path => (
                        <li
                            key={path}
                            className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg group hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                            <code className="text-sm text-gray-700 dark:text-gray-300 font-mono break-all">{path}</code>
                            <button
                                onClick={() => removeExclusion(path)}
                                className="text-gray-400 hover:text-danger hover:bg-red-50 p-1 rounded transition-colors"
                                title="Remove exclusion"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </li>
                    ))}
                </ul>
            </div>

            {/* Appearance */}
            <div className="card mb-6">
                <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">
                    <Monitor className="w-5 h-5 text-indigo-500" />
                    Appearance & System
                </h2>

                <div className="space-y-4">
                    <ToggleSetting
                        label="Dark mode"
                        description="Enable dark color scheme"
                        checked={settings.darkMode}
                        onChange={() => handleToggle('darkMode')}
                        icon={settings.darkMode ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4 text-orange-400" />}
                    />
                    <ToggleSetting
                        label="Enable notifications"
                        description="Show desktop notifications when scans complete"
                        checked={settings.enableNotifications}
                        onChange={() => handleToggle('enableNotifications')}
                        icon={<Bell className="w-4 h-4" />}
                    />
                </div>
            </div>

            <div className="flex justify-between items-center mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                <div className="text-xs text-gray-400 dark:text-gray-500">
                    CloudCleaner v{appVersion} • © 2026
                </div>
                <button
                    onClick={handleReset}
                    className="px-4 py-2 text-sm text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-2"
                >
                    <RotateCcw className="w-3 h-3" />
                    Reset Defaults
                </button>
            </div>
        </div>
    )
}

// Toggle setting component
function ToggleSetting({
    label,
    description,
    checked,
    onChange,
    icon
}: {
    label: string
    description: string
    checked: boolean
    onChange: () => void
    icon?: React.ReactNode
}) {
    return (
        <div className="flex items-center justify-between py-1 group">
            <div className="pr-4">
                <div className="flex items-center gap-2">
                    {icon && <span className="text-gray-500 dark:text-gray-400">{icon}</span>}
                    <p className="font-medium text-gray-800 dark:text-gray-200">{label}</p>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 ml-6">{description}</p>
            </div>
            <button
                onClick={onChange}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 dark:focus:ring-offset-gray-800 ${checked ? 'bg-primary' : 'bg-gray-200 dark:bg-gray-700'
                    }`}
            >
                <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'
                        }`}
                />
            </button>
        </div>
    )
}
