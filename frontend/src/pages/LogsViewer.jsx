import { useState, useEffect, useRef } from 'react';
import { scraperApi } from '../lib/api';
import { useSocket } from '../context/SocketContext';
import { ScrollText, Download, Trash2, Filter } from 'lucide-react';
import clsx from 'clsx';

export default function LogsViewer() {
  const { socket } = useSocket();
  const [logs, setLogs] = useState([]);
  const [filter, setFilter] = useState('all');
  const [autoScroll, setAutoScroll] = useState(true);
  const logsRef = useRef(null);

  useEffect(() => {
    scraperApi.logs({ limit: 500 }).then(r => setLogs(r.data.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!socket) return;
    socket.on('log', (log) => {
      setLogs(prev => [...prev.slice(-499), log]);
      if (autoScroll && logsRef.current) {
        logsRef.current.scrollTop = logsRef.current.scrollHeight;
      }
    });
    return () => socket.off('log');
  }, [socket, autoScroll]);

  const filteredLogs = logs.filter(log =>
    filter === 'all' || log.level === filter
  );

  const downloadLogs = () => {
    const text = logs.map(l => `[${l.created_at || l.timestamp}] [${l.level?.toUpperCase()}] ${l.message}`).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `leadforge-logs-${Date.now()}.txt`;
    a.click();
  };

  const levelColor = {
    info: 'text-slate-400',
    warn: 'text-amber-400',
    error: 'text-red-400',
    debug: 'text-slate-600',
  };
  const levelBg = {
    info: '',
    warn: 'bg-amber-500/5',
    error: 'bg-red-500/5',
    debug: '',
  };

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold gradient-text">Scraping Logs</h1>
          <p className="text-slate-400 text-sm">{filteredLogs.length} entries</p>
        </div>
        <div className="flex gap-2">
          <button
            id="btn-download-logs"
            onClick={downloadLogs}
            className="btn-ghost border border-white/10 rounded-xl flex items-center gap-2 text-sm px-3.5 py-2.5"
          >
            <Download className="w-4 h-4" />
            Download
          </button>
          <button
            id="btn-clear-logs"
            onClick={() => setLogs([])}
            className="btn-ghost border border-white/10 rounded-xl flex items-center gap-2 text-sm px-3.5 py-2.5 text-red-400 hover:text-red-300"
          >
            <Trash2 className="w-4 h-4" />
            Clear
          </button>
        </div>
      </div>

      {/* ── Filter Tabs ─────────────────────────────────────── */}
      <div className="glass-card p-4 flex items-center gap-3 flex-wrap">
        <Filter className="w-4 h-4 text-slate-500" />
        {['all', 'info', 'warn', 'error'].map(level => (
          <button
            key={level}
            id={`log-filter-${level}`}
            onClick={() => setFilter(level)}
            className={clsx(
              'px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all',
              filter === level
                ? 'bg-brand-500/20 text-brand-300 border border-brand-500/30'
                : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
            )}
          >
            {level}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <div
              className={clsx(
                'w-8 h-4 rounded-full transition-colors relative cursor-pointer',
                autoScroll ? 'bg-brand-500' : 'bg-white/10'
              )}
              onClick={() => setAutoScroll(prev => !prev)}
            >
              <div className={clsx('absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform',
                autoScroll ? 'left-4' : 'left-0.5'
              )} />
            </div>
            <span className="text-xs text-slate-400">Auto-scroll</span>
          </label>
        </div>
      </div>

      {/* ── Log Output ───────────────────────────────────────── */}
      <div
        id="logs-container"
        ref={logsRef}
        className="glass-card p-4 h-[60vh] overflow-y-auto font-mono text-xs space-y-0.5"
      >
        {filteredLogs.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <ScrollText className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-slate-500">No logs yet. Start a scraping session.</p>
            </div>
          </div>
        ) : (
          filteredLogs.map((log, i) => (
            <div
              key={i}
              className={clsx(
                'flex gap-3 py-1 px-2 rounded',
                levelBg[log.level] || ''
              )}
            >
              <span className="text-slate-600 shrink-0 tabular-nums">
                {(log.created_at || log.timestamp || '').toString().split('T')[1]?.replace(/\..+/, '') || ''}
              </span>
              <span className={clsx(
                'uppercase text-[10px] font-bold shrink-0 w-12',
                levelColor[log.level] || 'text-slate-400'
              )}>
                {log.level}
              </span>
              <span className={levelColor[log.level] || 'text-slate-400'}>
                {log.message}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
