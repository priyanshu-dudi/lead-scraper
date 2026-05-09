import { useState, useEffect, useRef } from 'react';
import { useSocket } from '../context/SocketContext';
import { scraperApi, configApi } from '../lib/api';
import toast from 'react-hot-toast';
import {
  Play, Square, Pause, RotateCcw, ChevronDown, ChevronUp,
  MapPin, Tag, Layers, Settings2, Zap, Globe, Plus, X,
} from 'lucide-react';
import clsx from 'clsx';

export default function ScrapeConfig({ onNavigate }) {
  const { socket } = useSocket();
  const [niches, setNiches] = useState([]);
  const [sources, setSources] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [liveStats, setLiveStats] = useState({ leads: 0, pages: 0, errors: 0, queue: 0 });
  const [logs, setLogs] = useState([]);
  const logsRef = useRef(null);

  // Form state
  const [selectedNiches, setSelectedNiches] = useState([]);
  const [customNiche, setCustomNiche] = useState('');
  const [locations, setLocations] = useState({
    countries: ['India'],
    states: [],
    cities: [],
    pinCodes: [],
  });
  const [cityInput, setCityInput] = useState('');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [advancedConfig, setAdvancedConfig] = useState({
    maxLeads: 5000,
    crawlDepth: 3,
    concurrency: 5,
    useAI: true,
    includeSocial: true,
  });

  useEffect(() => {
    configApi.niches().then(r => setNiches(r.data.data)).catch(() => {});
    configApi.sources().then(r => setSources(r.data.data)).catch(() => {});
    scraperApi.status().then(r => {
      setIsRunning(r.data.data.isRunning);
      setIsPaused(r.data.data.isPaused);
      setLiveStats(r.data.data.stats || {});
    }).catch(() => {});

    // Load recent logs
    scraperApi.logs({ limit: 50 }).then(r => setLogs(r.data.data)).catch(() => {});
  }, []);

  // Socket events
  useEffect(() => {
    if (!socket) return;

    socket.on('session_started', () => { setIsRunning(true); setIsPaused(false); });
    socket.on('session_stopped', () => { setIsRunning(false); });
    socket.on('session_paused', () => setIsPaused(true));
    socket.on('session_resumed', () => setIsPaused(false));
    socket.on('session_completed', () => { setIsRunning(false); toast.success('Scraping session completed!'); });
    socket.on('stats_update', (s) => setLiveStats(s));
    socket.on('log', (log) => {
      setLogs(prev => [...prev.slice(-199), log]);
      if (logsRef.current) {
        logsRef.current.scrollTop = logsRef.current.scrollHeight;
      }
    });

    return () => {
      socket.off('session_started');
      socket.off('session_stopped');
      socket.off('session_paused');
      socket.off('session_resumed');
      socket.off('session_completed');
      socket.off('stats_update');
      socket.off('log');
    };
  }, [socket]);

  const toggleNiche = (niche) => {
    setSelectedNiches(prev =>
      prev.find(n => n.id === niche.id)
        ? prev.filter(n => n.id !== niche.id)
        : [...prev, niche]
    );
  };

  const addCity = () => {
    const city = cityInput.trim();
    if (city && !locations.cities.includes(city)) {
      setLocations(prev => ({ ...prev, cities: [...prev.cities, city] }));
    }
    setCityInput('');
  };

  const removeCity = (city) => {
    setLocations(prev => ({ ...prev, cities: prev.cities.filter(c => c !== city) }));
  };

  const handleStart = async () => {
    const nichesToScrape = [
      ...selectedNiches,
      ...(customNiche.trim()
        ? [{ id: 'custom', label: customNiche, keywords: [customNiche], searchTerms: [customNiche] }]
        : []),
    ];

    if (nichesToScrape.length === 0) {
      toast.error('Please select at least one niche');
      return;
    }

    const config = {
      niches: nichesToScrape,
      locations,
      ...advancedConfig,
    };

    try {
      socket.emit('start_scraping', config);
      toast.success('Scraping session started!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to start scraper');
    }
  };

  const handleStop = () => {
    socket.emit('stop_scraping');
    toast('Stopping scraper...', { icon: '⏹️' });
  };

  const handlePause = () => {
    if (isPaused) {
      socket.emit('resume_scraping');
    } else {
      socket.emit('pause_scraping');
    }
  };

  const COMMON_NICHES = niches.filter(n => n.id !== 'custom').slice(0, 12);

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold gradient-text">Scrape Configuration</h1>
        <p className="text-slate-400 text-sm mt-0.5">Configure and launch your AI-powered lead scraping session</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* ── Main Config ────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-4">
          {/* Niche Selection */}
          <div className="glass-card p-5">
            <h2 className="font-semibold text-slate-200 mb-4 flex items-center gap-2">
              <Tag className="w-4 h-4 text-brand-400" />
              Target Niches
              {selectedNiches.length > 0 && (
                <span className="badge-blue ml-auto">{selectedNiches.length} selected</span>
              )}
            </h2>
            <div className="flex flex-wrap gap-2">
              {COMMON_NICHES.map(niche => (
                <button
                  key={niche.id}
                  id={`niche-${niche.id}`}
                  onClick={() => toggleNiche(niche)}
                  className={clsx('niche-tag', selectedNiches.find(n => n.id === niche.id) ? 'selected' : '')}
                >
                  {niche.label}
                </button>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <input
                id="input-custom-niche"
                className="input-field flex-1 text-sm"
                placeholder="Custom niche (e.g. Vegan restaurants, SaaS startups)"
                value={customNiche}
                onChange={e => setCustomNiche(e.target.value)}
              />
            </div>
          </div>

          {/* Location */}
          <div className="glass-card p-5">
            <h2 className="font-semibold text-slate-200 mb-4 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-emerald-400" />
              Geographic Targeting
            </h2>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">Country</label>
                <input
                  id="input-country"
                  className="input-field w-full text-sm"
                  placeholder="India, USA, UK..."
                  defaultValue="India"
                  onChange={e => setLocations(prev => ({ ...prev, countries: [e.target.value] }))}
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">State/Region</label>
                <input
                  id="input-state"
                  className="input-field w-full text-sm"
                  placeholder="Rajasthan, California..."
                  onChange={e => setLocations(prev => ({ ...prev, states: [e.target.value].filter(Boolean) }))}
                />
              </div>
            </div>
            <label className="text-xs text-slate-400 mb-1.5 block">Cities</label>
            <div className="flex gap-2 mb-2">
              <input
                id="input-city"
                className="input-field flex-1 text-sm"
                placeholder="Add city..."
                value={cityInput}
                onChange={e => setCityInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addCity()}
              />
              <button onClick={addCity} className="btn-ghost p-2.5 border border-white/10 rounded-xl">
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {locations.cities.map(city => (
                <span key={city} className="badge-blue flex items-center gap-1.5">
                  {city}
                  <button onClick={() => removeCity(city)}><X className="w-3 h-3" /></button>
                </span>
              ))}
            </div>
          </div>

          {/* Advanced Config */}
          <div className="glass-card overflow-hidden">
            <button
              id="btn-toggle-advanced"
              className="w-full p-5 flex items-center justify-between text-left"
              onClick={() => setAdvancedOpen(prev => !prev)}
            >
              <span className="font-semibold text-slate-200 flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-accent-400" />
                Advanced Settings
              </span>
              {advancedOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </button>

            {advancedOpen && (
              <div className="px-5 pb-5 border-t border-white/[0.06] pt-4 grid grid-cols-2 gap-4">
                {[
                  { id: 'max-leads', label: 'Max Leads', key: 'maxLeads', type: 'number' },
                  { id: 'crawl-depth', label: 'Crawl Depth', key: 'crawlDepth', type: 'number' },
                  { id: 'concurrency', label: 'Concurrency', key: 'concurrency', type: 'number' },
                ].map(({ id, label, key, type }) => (
                  <div key={key}>
                    <label className="text-xs text-slate-400 mb-1.5 block">{label}</label>
                    <input
                      id={`input-${id}`}
                      className="input-field w-full text-sm"
                      type={type}
                      value={advancedConfig[key]}
                      onChange={e => setAdvancedConfig(prev => ({ ...prev, [key]: parseInt(e.target.value) || 0 }))}
                    />
                  </div>
                ))}
                <div className="col-span-2 space-y-2">
                  {[
                    { key: 'useAI', label: '🧠 Use AI extraction (requires OpenAI API key)' },
                    { key: 'includeSocial', label: '📱 Extract social media profiles' },
                  ].map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-2.5 cursor-pointer">
                      <div
                        className={clsx(
                          'w-10 h-5 rounded-full transition-colors relative cursor-pointer',
                          advancedConfig[key] ? 'bg-brand-500' : 'bg-white/10'
                        )}
                        onClick={() => setAdvancedConfig(prev => ({ ...prev, [key]: !prev[key] }))}
                      >
                        <div className={clsx(
                          'absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform',
                          advancedConfig[key] ? 'left-5' : 'left-0.5'
                        )} />
                      </div>
                      <span className="text-sm text-slate-300">{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Control Panel ──────────────────────────────────── */}
        <div className="space-y-4">
          {/* Status Card */}
          <div className="glass-card p-5">
            <h2 className="font-semibold text-slate-200 mb-4">Session Status</h2>
            <div className={clsx(
              'flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium mb-4',
              isRunning
                ? isPaused
                  ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                  : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'bg-white/5 text-slate-400 border border-white/10'
            )}>
              <span className={clsx(
                'w-2 h-2 rounded-full',
                isRunning
                  ? isPaused ? 'bg-yellow-400' : 'bg-emerald-400 animate-pulse'
                  : 'bg-slate-600'
              )} />
              {isRunning ? (isPaused ? 'Paused' : 'Running') : 'Idle'}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-2 mb-4 text-xs">
              {[
                { label: 'Leads', value: liveStats.leads || 0 },
                { label: 'Pages', value: liveStats.pages || 0 },
                { label: 'Queue', value: liveStats.queue || 0 },
                { label: 'Errors', value: liveStats.errors || 0 },
              ].map(({ label, value }) => (
                <div key={label} className="bg-white/[0.03] rounded-lg p-2 text-center">
                  <div className="text-slate-200 font-bold tabular-nums">{value}</div>
                  <div className="text-slate-500">{label}</div>
                </div>
              ))}
            </div>

            {/* Controls */}
            <div className="space-y-2">
              {!isRunning ? (
                <button
                  id="btn-start-scraping"
                  onClick={handleStart}
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  <Play className="w-4 h-4" />
                  Start Scraping
                </button>
              ) : (
                <>
                  <button
                    id="btn-pause-scraping"
                    onClick={handlePause}
                    className="w-full py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 transition-all"
                  >
                    <Pause className="w-4 h-4" />
                    {isPaused ? 'Resume' : 'Pause'}
                  </button>
                  <button
                    id="btn-stop-scraping"
                    onClick={handleStop}
                    className="btn-danger w-full flex items-center justify-center gap-2"
                  >
                    <Square className="w-4 h-4" />
                    Stop Scraping
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Source list */}
          <div className="glass-card p-5">
            <h2 className="font-semibold text-slate-200 mb-3 flex items-center gap-2">
              <Globe className="w-4 h-4 text-brand-400" />
              Active Sources
            </h2>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {sources.filter(s => s.enabled).slice(0, 10).map(source => (
                <div key={source.id} className="flex items-center gap-2 text-xs">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                  <span className="text-slate-400 flex-1 truncate">{source.name}</span>
                  <span className="text-slate-600 text-[10px] uppercase">{source.engine}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Live Logs ──────────────────────────────────────────── */}
      <div className="glass-card p-5">
        <h2 className="font-semibold text-slate-200 mb-3 flex items-center gap-2">
          <Layers className="w-4 h-4 text-accent-400" />
          Live Logs
        </h2>
        <div
          id="scrape-logs-container"
          ref={logsRef}
          className="bg-dark-950 rounded-xl p-3 h-48 overflow-y-auto font-mono text-xs space-y-1"
        >
          {logs.length === 0 ? (
            <p className="text-slate-600 py-4 text-center">Logs will appear here during scraping...</p>
          ) : (
            logs.map((log, i) => (
              <div
                key={i}
                className={clsx(
                  'flex gap-2',
                  log.level === 'error' ? 'text-red-400'
                  : log.level === 'warn' ? 'text-yellow-400'
                  : 'text-slate-400'
                )}
              >
                <span className="text-slate-600 shrink-0">{log.timestamp?.split('T')[1]?.split('.')[0] || ''}</span>
                <span>{log.message}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
