import { useState, useEffect, useCallback } from 'react';
import { leadsApi, exportApi } from '../lib/api';
import toast from 'react-hot-toast';
import {
  Search, Filter, Download, Trash2, Mail, Phone,
  Globe, Linkedin, Instagram, Facebook, ChevronLeft, ChevronRight,
  SortAsc, SortDesc, Star, RefreshCw,
} from 'lucide-react';
import clsx from 'clsx';

const PAGE_SIZE = 50;

export default function LeadsTable() {
  const [leads, setLeads] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    search: '',
    niche: '',
    city: '',
    minScore: 0,
    sortBy: 'lead_score',
    sortDir: 'DESC',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [selectedLeads, setSelectedLeads] = useState(new Set());

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const res = await leadsApi.list({
        ...filters,
        page,
        limit: PAGE_SIZE,
      });
      setLeads(res.data.data);
      setTotal(res.data.pagination.total);
    } catch (err) {
      toast.error('Failed to load leads');
    }
    setLoading(false);
  }, [filters, page]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const toggleSort = (col) => {
    setFilters(prev => ({
      ...prev,
      sortBy: col,
      sortDir: prev.sortBy === col && prev.sortDir === 'DESC' ? 'ASC' : 'DESC',
    }));
  };

  const handleExport = async () => {
    try {
      const res = await exportApi.csv({
        niche: filters.niche || undefined,
        city: filters.city || undefined,
        minScore: filters.minScore || undefined,
        excludeDuplicates: true,
      });
      const { filename } = res.data.data;
      window.open(exportApi.downloadUrl(filename), '_blank');
      toast.success(`Exported ${res.data.data.count} leads!`);
    } catch {
      toast.error('Export failed');
    }
  };

  const toggleSelect = (id) => {
    setSelectedLeads(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const deleteSelected = async () => {
    if (!window.confirm(`Delete ${selectedLeads.size} leads?`)) return;
    try {
      await Promise.all([...selectedLeads].map(id => leadsApi.delete(id)));
      setSelectedLeads(new Set());
      fetchLeads();
      toast.success(`Deleted ${selectedLeads.size} leads`);
    } catch {
      toast.error('Delete failed');
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const SortIcon = ({ col }) => {
    if (filters.sortBy !== col) return null;
    return filters.sortDir === 'DESC' ? <SortDesc className="w-3 h-3" /> : <SortAsc className="w-3 h-3" />;
  };

  return (
    <div className="space-y-4 max-w-full">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold gradient-text">Leads Database</h1>
          <p className="text-slate-400 text-sm">{total.toLocaleString()} total leads</p>
        </div>
        <div className="flex gap-2">
          <button
            id="btn-refresh-leads"
            onClick={fetchLeads}
            className="btn-ghost border border-white/10 p-2.5 rounded-xl"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          {selectedLeads.size > 0 && (
            <button
              id="btn-delete-selected"
              onClick={deleteSelected}
              className="btn-danger flex items-center gap-2 text-sm px-4"
            >
              <Trash2 className="w-4 h-4" />
              Delete ({selectedLeads.size})
            </button>
          )}
          <button
            id="btn-export-leads"
            onClick={handleExport}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* ── Search & Filters ─────────────────────────────────── */}
      <div className="glass-card p-4 space-y-3">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              id="input-search-leads"
              className="input-field w-full pl-9 text-sm"
              placeholder="Search business name, email, phone, city..."
              value={filters.search}
              onChange={e => handleFilterChange('search', e.target.value)}
            />
          </div>
          <button
            id="btn-toggle-filters"
            onClick={() => setShowFilters(prev => !prev)}
            className={clsx('btn-ghost border border-white/10 rounded-xl px-3.5 flex items-center gap-2 text-sm',
              showFilters && 'bg-brand-500/10 border-brand-500/30 text-brand-300'
            )}
          >
            <Filter className="w-4 h-4" />
            Filters
          </button>
        </div>

        {showFilters && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-white/[0.06]">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Niche</label>
              <input
                id="filter-niche"
                className="input-field w-full text-sm"
                placeholder="e.g. dentist"
                value={filters.niche}
                onChange={e => handleFilterChange('niche', e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">City</label>
              <input
                id="filter-city"
                className="input-field w-full text-sm"
                placeholder="e.g. Mumbai"
                value={filters.city}
                onChange={e => handleFilterChange('city', e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Min Score</label>
              <input
                id="filter-min-score"
                className="input-field w-full text-sm"
                type="number"
                min="0"
                max="100"
                value={filters.minScore}
                onChange={e => handleFilterChange('minScore', e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <button
                id="btn-clear-filters"
                onClick={() => setFilters({ search: '', niche: '', city: '', minScore: 0, sortBy: 'lead_score', sortDir: 'DESC' })}
                className="btn-ghost border border-white/10 rounded-xl text-sm w-full py-2.5"
              >
                Clear All
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Table ─────────────────────────────────────────────── */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="lead-table">
            <thead>
              <tr>
                <th className="w-10">
                  <input
                    type="checkbox"
                    className="rounded border-white/20 bg-transparent"
                    onChange={e => setSelectedLeads(e.target.checked ? new Set(leads.map(l => l.id)) : new Set())}
                  />
                </th>
                {[
                  { col: 'business_name', label: 'Business' },
                  { col: 'niche', label: 'Niche' },
                  { col: null, label: 'Contact' },
                  { col: null, label: 'Social' },
                  { col: 'city', label: 'Location' },
                  { col: 'lead_score', label: 'Score' },
                ].map(({ col, label }) => (
                  <th
                    key={label}
                    onClick={() => col && toggleSort(col)}
                    className={clsx(col && 'cursor-pointer hover:text-slate-200')}
                  >
                    <span className="flex items-center gap-1">
                      {label}
                      {col && <SortIcon col={col} />}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-500">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                      Loading leads...
                    </div>
                  </td>
                </tr>
              ) : leads.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-500">
                    No leads found. Try adjusting your filters or run a scraping session.
                  </td>
                </tr>
              ) : (
                leads.map(lead => (
                  <tr key={lead.id} className={selectedLeads.has(lead.id) ? 'bg-brand-500/5' : ''}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedLeads.has(lead.id)}
                        onChange={() => toggleSelect(lead.id)}
                        className="rounded border-white/20 bg-transparent"
                      />
                    </td>
                    <td>
                      <div className="font-medium text-slate-200 text-sm max-w-[180px] truncate">
                        {lead.business_name || '—'}
                      </div>
                      {lead.owner_name && (
                        <div className="text-xs text-slate-500 truncate">{lead.owner_name}</div>
                      )}
                    </td>
                    <td>
                      <span className="badge-purple capitalize text-xs">
                        {lead.niche || '—'}
                      </span>
                    </td>
                    <td>
                      <div className="space-y-0.5">
                        {lead.email && (
                          <div className="flex items-center gap-1.5 text-xs text-slate-400">
                            <Mail className="w-3 h-3 text-brand-400 shrink-0" />
                            <span className="truncate max-w-[160px]">{lead.email}</span>
                          </div>
                        )}
                        {lead.phone && (
                          <div className="flex items-center gap-1.5 text-xs text-slate-400">
                            <Phone className="w-3 h-3 text-emerald-400 shrink-0" />
                            <span>{lead.phone}</span>
                          </div>
                        )}
                        {lead.website_url && (
                          <a
                            href={lead.website_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-xs text-brand-400 hover:text-brand-300"
                          >
                            <Globe className="w-3 h-3 shrink-0" />
                            <span className="truncate max-w-[140px]">Website</span>
                          </a>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="flex gap-2 items-center">
                        {lead.linkedin_url && (
                          <a href={lead.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">
                            <Linkedin className="w-4 h-4" />
                          </a>
                        )}
                        {lead.instagram_url && (
                          <a href={lead.instagram_url} target="_blank" rel="noopener noreferrer" className="text-pink-400 hover:text-pink-300">
                            <Instagram className="w-4 h-4" />
                          </a>
                        )}
                        {lead.facebook_url && (
                          <a href={lead.facebook_url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-400">
                            <Facebook className="w-4 h-4" />
                          </a>
                        )}
                        {!lead.linkedin_url && !lead.instagram_url && !lead.facebook_url && (
                          <span className="text-slate-600 text-xs">—</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="text-sm text-slate-300">
                        {[lead.city, lead.state, lead.country].filter(Boolean).join(', ') || '—'}
                      </div>
                      {lead.pin_code && <div className="text-xs text-slate-500">{lead.pin_code}</div>}
                    </td>
                    <td>
                      <ScoreBadge score={lead.lead_score} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.06]">
            <p className="text-xs text-slate-500">
              Showing {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, total)} of {total.toLocaleString()} leads
            </p>
            <div className="flex items-center gap-1">
              <button
                id="btn-prev-page"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg hover:bg-white/5 disabled:opacity-30 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs text-slate-400 px-2">
                {page} / {totalPages}
              </span>
              <button
                id="btn-next-page"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg hover:bg-white/5 disabled:opacity-30 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ScoreBadge({ score }) {
  const color = score >= 70 ? 'text-emerald-400 bg-emerald-500/15'
    : score >= 40 ? 'text-amber-400 bg-amber-500/15'
    : 'text-slate-500 bg-white/5';
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${color}`}>
      {score || 0}
    </span>
  );
}
