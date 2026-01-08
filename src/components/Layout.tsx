import { useEffect } from 'react'
import { Outlet, NavLink } from 'react-router-dom'
import { Home, Scan, FileText, Settings, History, Cloud } from 'lucide-react'
import { useAppStore } from '../stores/appStore'

const navItems = [
    { path: '/', icon: Home, label: 'Dashboard' },
    { path: '/scan', icon: Scan, label: 'Scan' },
    { path: '/results', icon: FileText, label: 'Results' },
    { path: '/history', icon: History, label: 'History' },
    { path: '/settings', icon: Settings, label: 'Settings' },
]

export default function Layout() {
    const setPreferences = useAppStore(state => state.setPreferences)

    useEffect(() => {
        const syncPrefs = async () => {
            if (window.electronAPI) {
                try {
                    const prefs = await window.electronAPI.getPrefs()
                    setPreferences(prefs)

                    // Apply dark mode immediately
                    if (prefs.darkMode) {
                        document.documentElement.classList.add('dark')
                    } else {
                        document.documentElement.classList.remove('dark')
                    }
                } catch (e) {
                    console.error("Failed to sync prefs", e)
                }
            }
        }
        syncPrefs()
    }, [setPreferences])

    return (
        <div className="flex h-screen bg-background dark:bg-gray-900 transition-colors duration-200">
            {/* Sidebar */}
            <aside className="w-64 bg-white dark:bg-gray-800 dark:border-gray-700 shadow-lg flex flex-col transition-colors duration-200">
                {/* Logo */}
                <div className="p-6 border-b border-gray-100 dark:border-gray-700">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary-dark rounded-xl flex items-center justify-center">
                            <Cloud className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h1 className="font-bold text-lg text-gray-800 dark:text-white">CloudCleaner</h1>
                            <p className="text-xs text-gray-500 dark:text-gray-400">PC Optimization</p>
                        </div>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-4">
                    <ul className="space-y-2">
                        {navItems.map(({ path, icon: Icon, label }) => (
                            <li key={path}>
                                <NavLink
                                    to={path}
                                    className={({ isActive }) =>
                                        `flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${isActive
                                            ? 'bg-primary text-white shadow-md'
                                            : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                                        }`
                                    }
                                >
                                    <Icon className="w-5 h-5" />
                                    <span className="font-medium">{label}</span>
                                </NavLink>
                            </li>
                        ))}
                    </ul>
                </nav>

                {/* Footer */}
                <div className="p-4 border-t border-gray-100 dark:border-gray-700">
                    <div className="text-center text-xs text-gray-400 dark:text-gray-500">
                        <p>CloudCleaner v0.1.0</p>
                        <p className="mt-1">Built with ❤️ for clean PCs</p>
                    </div>
                </div>
            </aside>

            {/* Main content */}
            <main className="flex-1 overflow-auto">
                <Outlet />
            </main>
        </div>
    )
}
