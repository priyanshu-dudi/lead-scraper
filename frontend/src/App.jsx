import { useState } from 'react';
import { Toaster } from 'react-hot-toast';
import { SocketProvider } from './context/SocketContext';
import Sidebar from './components/layout/Sidebar';
import Dashboard from './pages/Dashboard';
import ScrapeConfig from './pages/ScrapeConfig';
import LeadsTable from './pages/LeadsTable';
import ExportCenter from './pages/ExportCenter';
import LogsViewer from './pages/LogsViewer';
import Settings from './pages/Settings';

const PAGES = {
  dashboard: Dashboard,
  scrape: ScrapeConfig,
  leads: LeadsTable,
  export: ExportCenter,
  logs: LogsViewer,
  settings: Settings,
};

export default function App() {
  const [activePage, setActivePage] = useState('dashboard');
  const PageComponent = PAGES[activePage] || Dashboard;

  return (
    <SocketProvider>
      <div className="flex h-screen overflow-hidden">
        <Sidebar activePage={activePage} onNavigate={setActivePage} />
        <main className="flex-1 overflow-y-auto grid-bg">
          <div className="min-h-full p-6 animate-fade-in">
            <PageComponent onNavigate={setActivePage} />
          </div>
        </main>
      </div>
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: '#1e293b',
            color: '#f1f5f9',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '12px',
            fontSize: '14px',
          },
          success: { iconTheme: { primary: '#10b981', secondary: '#f1f5f9' } },
          error: { iconTheme: { primary: '#ef4444', secondary: '#f1f5f9' } },
        }}
      />
    </SocketProvider>
  );
}
