import { useEffect, useState, useCallback } from 'react';
import { useSocket } from '../context/SocketContext';
import { leadsApi, scraperApi, healthApi } from '../lib/api';
import {
  Users, Mail, Phone, Globe, TrendingUp, Activity,
  Zap, Target, Star, AlertCircle, Clock, ArrowRight,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar,
} from 'recharts';
import clsx from 'clsx';

const CHART_COLORS = ['#0ea5e9', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

export default function Dashboard({ onNavigate }) {
  const { socket } = useSocket();
  const [stats, setStats] = useState(null);
  const [scraperStatus, setScraperStatus] = useState(null);
  const [recentLeads, setRecentLeads] = useState([]);
  const [liveLeads, setLiveLeads] = useState(0);
  const [leadHistory, setLeadHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [statsRes, statusRes, leadsRes] = await Promise.all([
        leadsApi.stats(),
        scraperApi.status(),
        leadsApi.list({ limit: 5, sortBy: 'created_at', sortDir: 'DESC' }),
      ]);
      setStats(statsRes.data.data);
      setScraperStatus(statusRes.data.data);
      setRecentLeads(leadsRes.data.data);
      setLiveLeads(statsRes.data.data?.stats?.unique_leads || 0);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Listen for live scraping events
  useEffect(() => {
    if (!socket) return;

    socket.on('new_lead', ({ stats: s }) => {
      setLiveLeads(prev => prev + 1);
      setLeadHistory(prev => {
        const now = new Date().toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' });
        const last = prev[prev.length - 1];
        if (last?.time === now) {
          return [...prev.slice(0, -1), { ...last, count: last.count + 1 }];
        }
        return [...prev.slice(-19), { time: now, count: 1 }];
      });
    });

    socket.on('stats_update', (s) => {
      setScraperStatus(prev => ({ ...prev, stats: s }));
    });

    return () => {
      socket.off('new_lead');
      socket.off('stats_update');
    };
  }, [socket]);

  const STAT_CARDS = [
    {
      id: 'stat-total-leads',
      label: 'Total Leads',
      value: stats?.stats?.unique_leads || liveLeads,
      icon: Users,
      color: 'brand',
      glow: 'rgba(14,165,233,0.3)',
      suffix: '',
    },
    {
      id: 'stat-with-email',
      label: 'With Email',
      value: stats?.stats?.with_email || 0,
      icon: Mail,
      color: 'emerald',
      glow: 'rgba(16,185,129,0.3)',
    },
    {
      id: 'stat-with-phone',
      label: 'With Phone',
      value: stats?.stats?.with_phone || 0,
      icon: Phone,
      color: 'violet',
      glow: 'rgba(139,92,246,0.3)',
    },
    {
      id: 'stat-avg-score',
      label: 'Avg Score',
      value: Math.round(stats?.stats?.avg_score || 0),
      icon: Star,
      color: 'amber',
      glow: 'rgba(245,158,11,0.3)',
      suffix: '/100',
    },
  ];

  const nicheData = (stats?.byNiche || []).map((n, i) => ({
    name: n.niche || 'Unknown',
    value: n.count,
    color: CHART_COLORS[i % CHART_COLORS.length],
  }));

  const cityData = (stats?.byCity || []).slice(0, 6);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400 text-sm">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl">
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold gradient-text">Overview</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            {scraperStatus?.isRunning
              ? '🟢 Scraper is running — collecting leads in real-time'
              : 'Configure a scraping session to start collecting leads'}
          </p>
        </div>
        {scraperStatus?.isRunning && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm font-medium">
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
            Live Scraping
          </div>
        )}
      </div>

      {/* ── Stat Cards ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {STAT_CARDS.map(({ id, label, value, icon: Icon, color, glow, suffix }) => (
          <div
            key={id}
            id={id}
            className="glass-card p-5 transition-all duration-300 hover:-translate-y-1"
            style={{ '--glow': glow }}
          >
            <div className="flex items-start justify-between mb-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-${color}-500/15`}>
                <Icon className={`w-5 h-5 text-${color}-400`} />
              </div>
              <TrendingUp className="w-4 h-4 text-slate-600" />
            </div>
            <div className="text-3xl font-bold text-slate-100 tabular-nums">
              {value.toLocaleString()}
              {suffix && <span className="text-base text-slate-500 ml-1">{suffix}</span>}
            </div>
            <p className="text-slate-400 text-xs mt-1 font-medium">{label}</p>
          </div>
        ))}
      </div>

      {/* ── Live chart + Niche breakdown ─────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Lead discovery chart */}
        <div className="glass-card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-200">Live Lead Discovery</h2>
            <span className="badge-blue">Real-time</span>
          </div>
          {leadHistory.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={leadHistory}>
                <defs>
                  <linearGradient id="leadGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', fontSize: '12px' }}
                  labelStyle={{ color: '#94a3b8' }}
                />
                <Area type="monotone" dataKey="count" stroke="#0ea5e9" fill="url(#leadGrad)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[180px] flex items-center justify-center">
              <div className="text-center">
                <Activity className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-slate-500 text-sm">Chart updates during scraping</p>
              </div>
            </div>
          )}
        </div>

        {/* Niche breakdown */}
        <div className="glass-card p-5">
          <h2 className="font-semibold text-slate-200 mb-4">Leads by Niche</h2>
          {nicheData.length > 0 ? (
            <div className="space-y-2.5">
              {nicheData.slice(0, 6).map((n) => (
                <div key={n.name} className="flex items-center gap-2.5">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: n.color }} />
                  <span className="text-xs text-slate-400 flex-1 truncate capitalize">{n.name}</span>
                  <span className="text-xs font-semibold text-slate-300 tabular-nums">{n.value}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-[150px] flex items-center justify-center">
              <p className="text-slate-500 text-sm text-center">No data yet</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Scraper Status + Recent Leads ────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Scraper Stats */}
        <div className="glass-card p-5">
          <h2 className="font-semibold text-slate-200 mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-brand-400" />
            Scraper Activity
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Pages Crawled', value: scraperStatus?.stats?.pages || 0 },
              { label: 'Leads Found', value: scraperStatus?.stats?.leads || 0 },
              { label: 'Queue Size', value: scraperStatus?.stats?.queue || 0 },
              { label: 'Errors', value: scraperStatus?.stats?.errors || 0 },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white/[0.03] rounded-xl p-3">
                <div className="text-xl font-bold text-slate-100 tabular-nums">{value.toLocaleString()}</div>
                <div className="text-xs text-slate-500 mt-0.5">{label}</div>
              </div>
            ))}
          </div>
          <button
            id="btn-go-scrape"
            onClick={() => onNavigate('scrape')}
            className="mt-4 w-full btn-primary py-2 flex items-center justify-center gap-2 text-sm"
          >
            <Zap className="w-4 h-4" />
            {scraperStatus?.isRunning ? 'Manage Scraper' : 'Start Scraping'}
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Recent Leads */}
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-200 flex items-center gap-2">
              <Target className="w-4 h-4 text-accent-400" />
              Recent Leads
            </h2>
            <button onClick={() => onNavigate('leads')} className="text-xs text-brand-400 hover:text-brand-300">
              View All →
            </button>
          </div>
          {recentLeads.length > 0 ? (
            <div className="space-y-2.5">
              {recentLeads.map((lead) => (
                <div key={lead.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/[0.03] transition-colors">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-600/30 to-accent-600/30 flex items-center justify-center text-brand-300 text-xs font-bold shrink-0">
                    {(lead.business_name || lead.email || '?')[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-200 truncate">
                      {lead.business_name || lead.email || 'Unknown Business'}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {lead.city || lead.niche || lead.source_url || '—'}
                    </p>
                  </div>
                  <ScoreBadge score={lead.lead_score} />
                </div>
              ))}
            </div>
          ) : (
            <div className="h-[150px] flex items-center justify-center">
              <div className="text-center">
                <Users className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-slate-500 text-sm">No leads yet</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ScoreBadge({ score }) {
  const color = score >= 70 ? 'text-emerald-400 bg-emerald-500/15'
    : score >= 40 ? 'text-amber-400 bg-amber-500/15'
    : 'text-slate-400 bg-white/5';
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${color}`}>
      {score || 0}
    </span>
  );
}
