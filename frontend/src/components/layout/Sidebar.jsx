import { useSocket } from '../../context/SocketContext';
import {
  LayoutDashboard, Radar, Table2, Download,
  ScrollText, Settings, Zap, Wifi, WifiOff,
} from 'lucide-react';
import clsx from 'clsx';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'scrape', label: 'Scrape', icon: Radar },
  { id: 'leads', label: 'Leads', icon: Table2 },
  { id: 'export', label: 'Export', icon: Download },
  { id: 'logs', label: 'Logs', icon: ScrollText },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export default function Sidebar({ activePage, onNavigate }) {
  const { connected } = useSocket();

  return (
    <aside className="w-64 flex flex-col border-r border-white/[0.07] bg-dark-950/80 backdrop-blur-xl shrink-0">
      {/* ── Logo ──────────────────────────────────────────── */}
      <div className="p-5 border-b border-white/[0.07]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-accent-500 flex items-center justify-center shadow-lg animate-glow">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-base gradient-text leading-tight">LeadForge</h1>
            <p className="text-[10px] text-slate-500 font-medium tracking-widest uppercase">Ultimate</p>
          </div>
        </div>
      </div>

      {/* ── Navigation ────────────────────────────────────── */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            id={`nav-${id}`}
            onClick={() => onNavigate(id)}
            className={clsx(
              'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
              activePage === id
                ? 'bg-gradient-to-r from-brand-600/30 to-accent-600/20 text-brand-300 border border-brand-500/30 shadow-lg'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            )}
          >
            <Icon className={clsx('w-4 h-4', activePage === id ? 'text-brand-400' : '')} />
            {label}
            {activePage === id && (
              <span className="ml-auto w-1.5 h-1.5 rounded-full bg-brand-400" />
            )}
          </button>
        ))}
      </nav>

      {/* ── Connection Status ──────────────────────────────── */}
      <div className="p-4 border-t border-white/[0.07]">
        <div className={clsx(
          'flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium',
          connected ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
        )}>
          {connected
            ? <><Wifi className="w-3.5 h-3.5" /> Backend Connected</>
            : <><WifiOff className="w-3.5 h-3.5" /> Backend Offline</>
          }
          <span className={clsx(
            'ml-auto w-2 h-2 rounded-full',
            connected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'
          )} />
        </div>
        <p className="text-slate-600 text-[10px] text-center mt-2">
          LeadForge Ultimate v1.0.0
        </p>
      </div>
    </aside>
  );
}
