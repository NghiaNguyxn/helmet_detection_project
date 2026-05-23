import React, { useCallback, useEffect, useState } from 'react';
import {
  Clock,
  FileClock,
  Filter,
  RefreshCw,
  Search,
  Shield,
  Target,
  User,
  X,
} from 'lucide-react';
import api from '../services/api';
import EmptyState from '../components/EmptyState';
import Skeleton from '../components/Skeleton';
import DatePickerField from '../components/violations/DatePickerField';
import ViolationPagination from '../components/violations/ViolationPagination';

const DEFAULT_LIMIT = 10;

const formatDateTime = (value) => {
  if (!value) return 'N/A';
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'medium',
  }).format(new Date(value));
};

const formatMetadata = (metadata) => {
  if (!metadata || Object.keys(metadata).length === 0) return '';
  return JSON.stringify(metadata, null, 2);
};

const formatTargetId = (targetId) => {
  if (!targetId) return '';
  const value = String(targetId);
  if (value.length <= 12) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
};

const DetailField = ({ label, children }) => (
  <div className="space-y-1.5">
    <div className="text-[9px] font-mono uppercase tracking-widest text-on-surface-variant">{label}</div>
    <div className="text-sm text-on-surface break-words">{children || 'N/A'}</div>
  </div>
);

const AuditLogDetailModal = ({ log, onClose }) => {
  if (!log) return null;

  const metadata = formatMetadata(log.metadata_json);

  return (
    <div className="fixed inset-0 w-screen h-screen z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/90 backdrop-blur-md" onClick={onClose}></div>
      <div className="relative w-full max-w-3xl max-h-[90vh] overflow-hidden surface-1 border border-on-surface/10 rounded-lg tech-glow animate-in zoom-in-95 duration-200">
        <div className="flex items-start justify-between gap-4 border-b border-on-surface/10 p-6 bg-surface-low">
          <div>
            <h2 className="text-lg font-bold text-on-surface uppercase font-mono tracking-widest">Audit Log Detail</h2>
            <p className="text-[10px] text-on-surface-variant font-mono uppercase tracking-widest mt-1">
              Record ID: {log.id}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface rounded-md transition-all"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-96px)] space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <DetailField label="Time">{formatDateTime(log.created_at)}</DetailField>
            <DetailField label="Action">
              <span className="inline-flex px-2.5 py-1 rounded-sm bg-primary/10 border border-primary/20 text-primary text-[10px] font-bold font-mono">
                {log.action}
              </span>
            </DetailField>
            <DetailField label="Actor">
              {log.actor_username || 'System'}
              <span className="block text-[10px] font-mono uppercase tracking-widest text-on-surface-variant mt-1">
                {log.actor_role || 'system'} {log.actor_id ? `#${log.actor_id}` : ''}
              </span>
            </DetailField>
            <DetailField label="Target">
              {log.target_type || 'N/A'}
              {log.target_id && (
                <span className="block text-[11px] font-mono text-on-surface-variant mt-1 break-all">
                  #{log.target_id}
                </span>
              )}
            </DetailField>
            <DetailField label="IP Address">{log.ip_address}</DetailField>
            <DetailField label="Description">{log.description}</DetailField>
          </div>

          <div className="space-y-2">
            <div className="text-[9px] font-mono uppercase tracking-widest text-on-surface-variant">Metadata</div>
            {metadata ? (
              <pre className="max-h-80 overflow-auto rounded-md bg-background/60 border border-on-surface/10 p-4 text-[11px] leading-relaxed text-on-surface-variant font-mono whitespace-pre-wrap">
                {metadata}
              </pre>
            ) : (
              <div className="rounded-md bg-background/40 border border-on-surface/10 p-4 text-[10px] font-mono uppercase tracking-widest text-on-surface-variant opacity-60">
                Empty
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const AuditLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    actor_username: '',
    action: '',
    target_type: '',
    target_id: '',
    start_date: '',
    end_date: '',
  });
  const [appliedFilters, setAppliedFilters] = useState(filters);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState('');
  const [selectedLog, setSelectedLog] = useState(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('limit', limit.toString());

      Object.entries(appliedFilters).forEach(([key, value]) => {
        if (value) {
          const normalizedValue = key.endsWith('_date') ? new Date(value).toISOString() : value;
          params.set(key, normalizedValue);
        }
      });

      const response = await api.get(`/audit-logs/?${params.toString()}`);
      if (response.data.code === 200) {
        const result = response.data.result;
        setLogs(result.data || []);
        setTotal(result.total || 0);
      }
    } catch (err) {
      console.error('Error fetching audit logs:', err);
      setError(err.response?.data?.message || 'Unable to load audit logs');
    } finally {
      setLoading(false);
    }
  }, [appliedFilters, limit, page]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const updateFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const applyFilters = (event) => {
    event.preventDefault();
    setAppliedFilters(filters);
    if (page === 1) {
      return;
    }
    setPage(1);
  };

  const resetFilters = () => {
    const emptyFilters = {
      actor_username: '',
      action: '',
      target_type: '',
      target_id: '',
      start_date: '',
      end_date: '',
    };
    setFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
    setPage(1);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-on-surface uppercase leading-none">Audit Logs</h2>
          <p className="text-on-surface-variant text-[10px] font-mono uppercase tracking-[0.2em] mt-2 opacity-70">
            Administrative Activity Trail
          </p>
        </div>

        <button
          onClick={fetchLogs}
          className="flex items-center gap-2 px-4 py-2.5 bg-surface border border-on-surface/10 text-on-surface-variant hover:text-on-surface hover:border-primary/30 rounded-md text-[10px] font-bold uppercase tracking-[0.15em] transition-all"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      <form onSubmit={applyFilters} className="surface-1 border border-on-surface/5 rounded-md p-5 tech-glow">
        <div className="flex flex-wrap items-end gap-4">
          <label className="space-y-1.5 w-32">
            <span className="flex items-center gap-2 text-[9px] font-mono uppercase tracking-widest text-on-surface-variant pl-1">
              <User className="w-3.5 h-3.5" /> Actor
            </span>
            <input
              value={filters.actor_username}
              onChange={(e) => updateFilter('actor_username', e.target.value)}
              placeholder="username"
              className="w-full px-3 py-2 bg-surface border border-on-surface/10 rounded-md text-[10px] font-mono uppercase tracking-widest outline-none focus:border-primary/50 transition-all placeholder:text-on-surface-variant/50"
            />
          </label>

          <label className="space-y-1.5 w-36">
            <span className="flex items-center gap-2 text-[9px] font-mono uppercase tracking-widest text-on-surface-variant pl-1">
              <Shield className="w-3.5 h-3.5" /> Action
            </span>
            <input
              value={filters.action}
              onChange={(e) => updateFilter('action', e.target.value)}
              placeholder="user.created"
              className="w-full px-3 py-2 bg-surface border border-on-surface/10 rounded-md text-[10px] font-mono tracking-widest outline-none focus:border-primary/50 transition-all placeholder:text-on-surface-variant/50"
            />
          </label>

          <label className="space-y-1.5 w-32">
            <span className="flex items-center gap-2 text-[9px] font-mono uppercase tracking-widest text-on-surface-variant pl-1">
              <Target className="w-3.5 h-3.5" /> Target Type
            </span>
            <input
              value={filters.target_type}
              onChange={(e) => updateFilter('target_type', e.target.value)}
              placeholder="user"
              className="w-full px-3 py-2 bg-surface border border-on-surface/10 rounded-md text-[10px] font-mono uppercase tracking-widest outline-none focus:border-primary/50 transition-all placeholder:text-on-surface-variant/50"
            />
          </label>

          <label className="space-y-1.5 w-28">
            <span className="flex items-center gap-2 text-[9px] font-mono uppercase tracking-widest text-on-surface-variant pl-1">
              <Search className="w-3.5 h-3.5" /> Target ID
            </span>
            <input
              value={filters.target_id}
              onChange={(e) => updateFilter('target_id', e.target.value)}
              placeholder="123"
              className="w-full px-3 py-2 bg-surface border border-on-surface/10 rounded-md text-[10px] font-mono uppercase tracking-widest outline-none focus:border-primary/50 transition-all placeholder:text-on-surface-variant/50"
            />
          </label>

          <div className="space-y-1.5 flex-[2] min-w-[520px]">
            <span className="flex items-center gap-2 text-[9px] font-mono uppercase tracking-widest text-on-surface-variant pl-1">
              <Clock className="w-3.5 h-3.5" /> Date Range
            </span>
            <div className="flex items-center gap-2">
              <DatePickerField
                value={filters.start_date}
                onChange={(value) => updateFilter('start_date', value)}
                placeholder="Start MM-DD-YYYY"
                maxDate={filters.end_date || undefined}
              />
              <span className="text-on-surface/30 text-[10px] font-mono uppercase tracking-widest">to</span>
              <DatePickerField
                value={filters.end_date}
                onChange={(value) => updateFilter('end_date', value)}
                placeholder="End MM-DD-YYYY"
                minDate={filters.start_date || undefined}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-5">
            <button
              type="submit"
              className="flex items-center gap-2 px-5 py-2.5 bg-primary text-background font-bold rounded-md text-[10px] hover:bg-primary/90 transition-all uppercase tracking-[0.15em]"
            >
              <Filter className="w-4 h-4" />
              Apply
            </button>
            <button
              type="button"
              onClick={resetFilters}
              className="px-4 py-2.5 bg-surface border border-on-surface/10 text-on-surface-variant hover:text-on-surface rounded-md text-[10px] font-bold uppercase tracking-[0.15em] transition-all"
            >
              Reset
            </button>
        </div>
      </form>

      <div className="surface-1 border border-on-surface/5 rounded-md overflow-hidden tech-glow min-h-[500px]">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[980px]">
            <thead className="bg-surface-low text-on-surface-variant text-[10px] font-mono uppercase tracking-widest border-b border-on-surface/5">
              <tr>
                <th className="px-5 py-4 font-bold">Time</th>
                <th className="px-5 py-4 font-bold">Actor</th>
                <th className="px-5 py-4 font-bold">Action</th>
                <th className="px-5 py-4 font-bold w-32">Target</th>
                <th className="px-5 py-4 font-bold w-60">Description</th>
                <th className="px-5 py-4 font-bold">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-on-surface/5">
              {loading ? (
                Array(6).fill(0).map((_, index) => (
                  <tr key={index}>
                    <td className="px-5 py-4"><Skeleton width="150px" height="14px" /></td>
                    <td className="px-5 py-4"><Skeleton width="100px" height="14px" /></td>
                    <td className="px-5 py-4"><Skeleton width="130px" height="22px" /></td>
                    <td className="px-5 py-4"><Skeleton width="80px" height="14px" /></td>
                    <td className="px-5 py-4"><Skeleton width="220px" height="14px" /></td>
                    <td className="px-5 py-4"><Skeleton width="90px" height="14px" /></td>
                  </tr>
                ))
              ) : error ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center">
                    <EmptyState icon={FileClock} title="Audit logs unavailable" message={error} />
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center">
                    <EmptyState icon={FileClock} title="No audit logs found" message="No records match the current filter parameters." />
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  return (
                    <tr
                      key={log.id}
                      onClick={() => setSelectedLog(log)}
                      className="hover:bg-primary/5 transition-all align-top cursor-pointer"
                    >
                      <td className="px-5 py-4 text-xs font-mono text-on-surface-variant whitespace-nowrap">
                        {formatDateTime(log.created_at)}
                      </td>
                      <td className="px-5 py-4">
                        <div className="text-sm font-bold text-on-surface">{log.actor_username || 'System'}</div>
                        <div className="text-[10px] font-mono uppercase tracking-widest text-on-surface-variant">
                          {log.actor_role || 'system'} {log.actor_id ? `#${log.actor_id}` : ''}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-flex px-2.5 py-1 rounded-sm bg-primary/10 border border-primary/20 text-primary text-[10px] font-bold font-mono">
                          {log.action}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-xs font-mono text-on-surface-variant w-32 max-w-32">
                        <div className="whitespace-nowrap">{log.target_type || 'N/A'}</div>
                        {log.target_id && (
                          <div className="opacity-60 truncate max-w-28" title={log.target_id}>
                            #{formatTargetId(log.target_id)}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4 text-sm text-on-surface min-w-60 max-w-60">
                        {log.description || 'N/A'}
                      </td>
                      <td className="px-5 py-4 text-xs font-mono text-on-surface-variant whitespace-nowrap">
                        {log.ip_address || 'N/A'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <ViolationPagination
          page={page}
          limit={limit}
          total={total}
          setPage={setPage}
          setLimit={setLimit}
        />
      </div>

      <AuditLogDetailModal log={selectedLog} onClose={() => setSelectedLog(null)} />
    </div>
  );
};

export default AuditLogs;
