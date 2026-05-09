import { useState, useEffect } from 'react';
import { exportApi } from '../lib/api';
import toast from 'react-hot-toast';
import {
  Download, FileText, Folder, Trash2,
  RefreshCw, Filter, FileDown, HardDrive,
} from 'lucide-react';
import clsx from 'clsx';

export default function ExportCenter() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportConfig, setExportConfig] = useState({
    niche: '',
    city: '',
    country: '',
    minScore: 0,
    excludeDuplicates: true,
  });

  const fetchFiles = async () => {
    setLoading(true);
    try {
      const res = await exportApi.files();
      setFiles(res.data.data);
    } catch {
      toast.error('Failed to load export files');
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchFiles();
    const interval = setInterval(fetchFiles, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const res = await exportApi.csv(exportConfig);
      const { filename, count } = res.data.data;
      toast.success(`Exported ${count.toLocaleString()} leads!`);
      fetchFiles();
      window.open(exportApi.downloadUrl(filename), '_blank');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Export failed');
    }
    setExporting(false);
  };

  const handleExportJSON = async () => {
    setExporting(true);
    try {
      const res = await exportApi.json(exportConfig);
      const { filename, count } = res.data.data;
      toast.success(`Exported ${count.toLocaleString()} leads as JSON!`);
      fetchFiles();
    } catch {
      toast.error('JSON export failed');
    }
    setExporting(false);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold gradient-text">Export Center</h1>
        <p className="text-slate-400 text-sm mt-0.5">Export your leads as CSV or JSON files</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ── Export Config ─────────────────────────────────── */}
        <div className="glass-card p-5 space-y-4">
          <h2 className="font-semibold text-slate-200 flex items-center gap-2">
            <Filter className="w-4 h-4 text-brand-400" />
            Export Filters
          </h2>

          <div className="space-y-3">
            {[
              { id: 'export-niche', label: 'Niche', key: 'niche', placeholder: 'e.g. dentist (leave blank for all)' },
              { id: 'export-city', label: 'City', key: 'city', placeholder: 'e.g. Mumbai' },
              { id: 'export-country', label: 'Country', key: 'country', placeholder: 'e.g. India' },
            ].map(({ id, label, key, placeholder }) => (
              <div key={key}>
                <label className="text-xs text-slate-400 mb-1.5 block">{label}</label>
                <input
                  id={id}
                  className="input-field w-full text-sm"
                  placeholder={placeholder}
                  value={exportConfig[key]}
                  onChange={e => setExportConfig(prev => ({ ...prev, [key]: e.target.value }))}
                />
              </div>
            ))}

            <div>
              <label className="text-xs text-slate-400 mb-1.5 block">Min Lead Score: {exportConfig.minScore}</label>
              <input
                id="export-min-score"
                type="range"
                min="0"
                max="100"
                step="5"
                value={exportConfig.minScore}
                onChange={e => setExportConfig(prev => ({ ...prev, minScore: parseInt(e.target.value) }))}
                className="w-full accent-brand-500"
              />
            </div>

            <label className="flex items-center gap-2.5 cursor-pointer">
              <div
                className={clsx(
                  'w-10 h-5 rounded-full transition-colors relative cursor-pointer',
                  exportConfig.excludeDuplicates ? 'bg-brand-500' : 'bg-white/10'
                )}
                onClick={() => setExportConfig(prev => ({ ...prev, excludeDuplicates: !prev.excludeDuplicates }))}
              >
                <div className={clsx(
                  'absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform',
                  exportConfig.excludeDuplicates ? 'left-5' : 'left-0.5'
                )} />
              </div>
              <span className="text-sm text-slate-300">Exclude duplicates</span>
            </label>
          </div>

          <div className="space-y-2 pt-2">
            <button
              id="btn-export-csv"
              onClick={handleExportCSV}
              disabled={exporting}
              className="btn-primary w-full flex items-center justify-center gap-2 text-sm"
            >
              {exporting ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <FileDown className="w-4 h-4" />
              )}
              Export as CSV
            </button>
            <button
              id="btn-export-json"
              onClick={handleExportJSON}
              disabled={exporting}
              className="w-full py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 bg-accent-500/15 text-accent-400 border border-accent-500/30 hover:bg-accent-500/25 transition-all"
            >
              <FileText className="w-4 h-4" />
              Export as JSON
            </button>
          </div>
        </div>

        {/* ── File List ────────────────────────────────────── */}
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-slate-200 flex items-center gap-2">
              <Folder className="w-4 h-4 text-amber-400" />
              Exported Files
            </h2>
            <button
              id="btn-refresh-files"
              onClick={fetchFiles}
              className="btn-ghost p-1.5 rounded-lg"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          {loading ? (
            <div className="h-40 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : files.length === 0 ? (
            <div className="h-40 flex items-center justify-center">
              <div className="text-center">
                <HardDrive className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-slate-500 text-sm">No exports yet</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {files.map((file) => (
                <div key={file.filename} className="flex items-center gap-3 p-3 bg-white/[0.03] rounded-xl hover:bg-white/[0.05] transition-colors group">
                  <FileText className={clsx(
                    'w-5 h-5 shrink-0',
                    file.filename.endsWith('.csv') ? 'text-emerald-400' : 'text-accent-400'
                  )} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-200 truncate">{file.filename}</p>
                    <p className="text-[10px] text-slate-500">
                      {file.sizeFormatted} · {new Date(file.modified).toLocaleDateString()}
                    </p>
                  </div>
                  <a
                    id={`btn-download-${file.filename.replace(/[^a-zA-Z0-9]/g, '-')}`}
                    href={exportApi.downloadUrl(file.filename)}
                    download
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg bg-brand-500/20 text-brand-400 hover:bg-brand-500/30"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Tips ─────────────────────────────────────────────── */}
      <div className="glass-card p-5">
        <h2 className="font-semibold text-slate-200 mb-3">Export Tips</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm text-slate-400">
          <div className="flex gap-2">
            <span className="text-brand-400">💡</span>
            <span>Leave niche/city blank to export <strong className="text-slate-300">all leads</strong></span>
          </div>
          <div className="flex gap-2">
            <span className="text-emerald-400">⭐</span>
            <span>Use Min Score filter to get only <strong className="text-slate-300">high-quality leads</strong></span>
          </div>
          <div className="flex gap-2">
            <span className="text-accent-400">🗂️</span>
            <span>Exports are saved in the <strong className="text-slate-300">/exports</strong> folder</span>
          </div>
        </div>
      </div>
    </div>
  );
}
