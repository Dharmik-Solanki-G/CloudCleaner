import { HashRouter, Routes, Route } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import ScanPage from './pages/ScanPage'
import ResultsPage from './pages/ResultsPage'
import SettingsPage from './pages/SettingsPage'
import HistoryPage from './pages/HistoryPage'
import Layout from './components/Layout'
import { UpdateNotification } from './components/UpdateNotification'

function App() {
    return (
        <HashRouter>
            <Routes>
                <Route path="/" element={<Layout />}>
                    <Route index element={<Dashboard />} />
                    <Route path="scan" element={<ScanPage />} />
                    <Route path="results" element={<ResultsPage />} />
                    <Route path="settings" element={<SettingsPage />} />
                    <Route path="history" element={<HistoryPage />} />
                </Route>
            </Routes>
            <UpdateNotification />
        </HashRouter>
    )
}

export default App

