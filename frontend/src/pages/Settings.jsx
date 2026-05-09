import { useState, useEffect } from 'react';
import { configApi } from '../lib/api';
import toast from 'react-hot-toast';
import { Settings2, Key, Cpu, Shield, Info, CheckCircle, XCircle } from 'lucide-react';

export default function Settings() {
  const [envConfig, setEnvConfig] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    configApi.env().then(r => {
      setEnvConfig(r.data.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const CONFIG_ITEMS = [
    {
      section: 'API Configuration',
      icon: Key,
      color: 'brand',
      items: [
        {
          label: 'OpenAI API Key',
          status: envConfig?.openaiConfigured,
          desc: envConfig?.openaiConfigured
            ? 'Configured — AI extraction and cleaning enabled'
            : 'Not configured — Add OPENAI_API_KEY to config/.env',
        },
      ],
    },
    {
      section: 'Scraping Settings',
      icon: Cpu,
      color: 'emerald',
      items: [
        { label: 'Max Concurrency', value: envConfig?.maxConcurrency, desc: 'Parallel scrapers' },
        { label: 'Crawl Depth', value: envConfig?.crawlDepth, desc: 'How deep to follow links' },
        { label: 'AI Extraction', status: envConfig?.aiExtraction, desc: 'Use AI to extract from complex pages' },
      ],
    },
    {
      section: 'Anti-Detection',
      icon: Shield,
      color: 'accent',
      items: [
        { label: 'User Agent Rotation', status: true, desc: 'Rotate user agents on every request' },
        { label: 'Random Delays', status: true, desc: '1-3 second randomized delays' },
        { label: 'Proxy Support', status: envConfig?.useProxy, desc: 'Optional proxy rotation' },
      ],
    },
  ];

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold gradient-text">Settings</h1>
        <p className="text-slate-400 text-sm mt-0.5">System configuration and status overview</p>
      </div>

      {/* ── .env notice ─────────────────────────────────────── */}
      <div className="glass-card p-4 flex items-start gap-3 border border-amber-500/20 bg-amber-500/5">
        <Info className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm text-amber-300 font-medium">Configuration via .env file</p>
          <p className="text-xs text-slate-400 mt-1">
            All settings are managed in <code className="bg-white/10 px-1 rounded text-slate-300">config/.env</code>.
            Copy from <code className="bg-white/10 px-1 rounded text-slate-300">config/.env.example</code> and add your keys.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        CONFIG_ITEMS.map(({ section, icon: Icon, color, items }) => (
          <div key={section} className="glass-card p-5">
            <h2 className="font-semibold text-slate-200 mb-4 flex items-center gap-2">
              <Icon className={`w-4 h-4 text-${color}-400`} />
              {section}
            </h2>
            <div className="space-y-3">
              {items.map(({ label, status, value, desc }) => (
                <div key={label} className="flex items-center justify-between py-2 border-b border-white/[0.05] last:border-0">
                  <div>
                    <p className="text-sm font-medium text-slate-200">{label}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
                  </div>
                  <div className="shrink-0 ml-4">
                    {value !== undefined ? (
                      <span className="badge-blue font-mono">{value}</span>
                    ) : status !== undefined ? (
                      status ? (
                        <span className="flex items-center gap-1.5 text-emerald-400 text-xs font-medium">
                          <CheckCircle className="w-4 h-4" /> Enabled
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-red-400 text-xs font-medium">
                          <XCircle className="w-4 h-4" /> Disabled
                        </span>
                      )
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {/* ── Setup Guide ─────────────────────────────────────── */}
      <div className="glass-card p-5">
        <h2 className="font-semibold text-slate-200 mb-4 flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-slate-400" />
          Quick Setup Guide
        </h2>
        <ol className="space-y-2.5 text-sm text-slate-400">
          {[
            ['1', 'Copy config/.env.example to config/.env'],
            ['2', 'Add your OPENAI_API_KEY (optional but recommended)'],
            ['3', 'Run: node scripts/setup.js (installs all dependencies)'],
            ['4', 'Start backend: cd backend && npm run dev'],
            ['5', 'Start frontend: cd frontend && npm run dev'],
            ['6', 'Open http://localhost:5173 and start scraping!'],
          ].map(([step, text]) => (
            <li key={step} className="flex items-start gap-3">
              <span className="w-5 h-5 rounded-full bg-brand-500/20 text-brand-400 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                {step}
              </span>
              <span>{text}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
