import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Filter,
  Download,
  ExternalLink,
  ShieldAlert,
  Calendar,
  Trash2,
  ChevronLeft,
  ChevronRight,
  X,
  FileSpreadsheet,
  AlertCircle,
  Clock,
  LayoutGrid,
  Maximize2,
  MoreVertical,
  Plus,
  Minus,
  AlertTriangle
} from 'lucide-react';
import api from '../services/api';
import socketService from '../services/websocket';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import CustomDropdown from '../components/CustomDropdown';
import Skeleton from '../components/Skeleton';
import EmptyState from '../components/EmptyState';
import { useSearchParams } from 'react-router-dom';

const ViolationHistory = () => {
  const { user: currentUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlHighlightId = searchParams.get('id');

  const [violations, setViolations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);

  // Highlight state
  const [activeHighlightId, setActiveHighlightId] = useState(null);

  // Filter States
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [minViolations, setMinViolations] = useState(0);
  const [onlyViolations, setOnlyViolations] = useState(true);

  // Sorting States
  const [sortBy, setSortBy] = useState('timestamp');
  const [order, setOrder] = useState('desc');

  // UI States
  const [selectedViolationIndex, setSelectedViolationIndex] = useState(null);
  const [isDeleting, setIsDeleting] = useState(null);
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setActiveMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Sync URL ID to state
  useEffect(() => {
    if (urlHighlightId) {
      setActiveHighlightId(urlHighlightId);
    }
  }, [urlHighlightId]);

  // Global click listener to clear highlight
  useEffect(() => {
    const handleGlobalClick = (e) => {
      // Tìm xem click có nằm trong thumbnail hoặc modal không
      const isThumbnail = e.target.closest('.evidence-thumbnail');
      const isModal = e.target.closest('.violation-modal-content');
      const isDeleteModal = e.target.closest('.delete-modal-content');
      const isModalBg = e.target.closest('.violation-modal-bg');

      if (!isThumbnail && !isModal && !isDeleteModal && !isModalBg) {
        setActiveHighlightId(null);
        if (urlHighlightId) setSearchParams({});
      }
    };
    document.addEventListener('mousedown', handleGlobalClick);
    return () => document.removeEventListener('mousedown', handleGlobalClick);
  }, [urlHighlightId, setSearchParams]);

  useEffect(() => {
    fetchViolations();
  }, [page, limit, sortBy, order]);

  // Real-time updates from WebSocket
  useEffect(() => {
    const unsubscribe = socketService.subscribe((message) => {
      if (message.event === 'new_violation') {
        const newViolation = message.data;

        // Only prepend if we are on the first page and no specific date filters are active
        // Or simply always prepend to show "Live" updates
        if (page === 1) {
          setViolations(prev => {
            // Check if already exists to avoid duplicates
            if (prev.some(v => (v.id || v._id) === (newViolation.id || newViolation._id))) return prev;
            return [newViolation, ...prev.slice(0, limit - 1)];
          });
          setTotal(prev => prev + 1);
        }
      }
    });

    return () => unsubscribe();
  }, [page, limit]);

  // Auto-scroll and open modal for highlighted item
  useEffect(() => {
    if (activeHighlightId && violations.length > 0) {
      const index = violations.findIndex(v => {
        const id = v.id || v._id;
        return String(id) === String(activeHighlightId);
      });

      if (index !== -1) {
        // Chỉ tự động mở modal nếu là từ URL (thông báo mới)
        if (urlHighlightId === activeHighlightId && selectedViolationIndex === null) {
          setSelectedViolationIndex(index);
        }

        setTimeout(() => {
          const element = document.getElementById(`violation-${activeHighlightId}`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 500);
      }
    }
  }, [activeHighlightId, violations, loading, urlHighlightId]);

  const fetchViolations = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page,
        limit,
        sort_by: sortBy,
        order
      });

      if (startDate) params.append('start_date', new Date(startDate).toISOString());
      if (endDate) params.append('end_date', new Date(endDate).toISOString());
      if (minViolations > 0) params.append('min_violations', minViolations);
      if (onlyViolations) params.append('only_violations', 'true');

      const response = await api.get(`/violations/?${params.toString()}`);
      if (response.data.code === 200) {
        setViolations(response.data.result.data);
        setTotal(response.data.result.total);
      }
    } catch (error) {
      console.error('Error fetching violations:', error);
      toast.error('Failed to load records');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyFilter = (e) => {
    e.preventDefault();
    setPage(1);
    fetchViolations();
  };

  const handleResetFilter = () => {
    setStartDate('');
    setEndDate('');
    setMinViolations(0);
    setOnlyViolations(true);
    setPage(1);
    setTimeout(() => fetchViolations(), 0);
  };

  const handleDownloadImage = async (imageUrl, id) => {
    const toastId = toast.loading('Preparing image for download...');
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      // Đặt tên file theo ID vi phạm
      const fileName = `Violation_${id || Date.now()}.jpg`;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('Image downloaded successfully', { id: toastId });
    } catch (error) {
      console.error('Download failed:', error);
      toast.error('Download failed. Opening in new tab...', { id: toastId });
      window.open(imageUrl, '_blank');
    }
  };

  const handleExportExcel = async () => {
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('start_date', new Date(startDate).toISOString());
      if (endDate) params.append('end_date', new Date(endDate).toISOString());
      if (minViolations > 0) params.append('min_violations', minViolations);
      if (onlyViolations) params.append('only_violations', 'true');

      const response = await api.get(`/violations/export?${params.toString()}`, {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Violation_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Report exported successfully');
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Export failed');
    }
  };

  const handleDelete = async (id) => {
    setIsDeleting(id);
    try {
      const response = await api.delete(`/violations/${id}`);
      if (response.data.code === 200) {
        toast.success('Record deleted');
        fetchViolations();
      }
    } catch (error) {
      toast.error('Could not delete record');
    } finally {
      setIsDeleting(null);
      setDeleteConfirmId(null);
    }
  };

  const toggleSort = (field) => {
    if (sortBy === field) {
      setOrder(order === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setOrder('desc');
    }
  };

  const handleNextImage = (e) => {
    e.stopPropagation();
    if (selectedViolationIndex === null) return;
    const nextIdx = (selectedViolationIndex + 1) % violations.length;
    setSelectedViolationIndex(nextIdx);
    const nextId = violations[nextIdx].id || violations[nextIdx]._id;
    setActiveHighlightId(nextId);
  };

  const handlePrevImage = (e) => {
    e.stopPropagation();
    if (selectedViolationIndex === null) return;
    const prevIdx = (selectedViolationIndex - 1 + violations.length) % violations.length;
    setSelectedViolationIndex(prevIdx);
    const prevId = violations[prevIdx].id || violations[prevIdx]._id;
    setActiveHighlightId(prevId);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      {/* Header Section */}
      <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-on-surface uppercase leading-none">Violation History</h2>
          <p className="text-on-surface-variant text-[10px] font-mono uppercase tracking-[0.2em] mt-2 opacity-70">
            List of detected violations
          </p>
        </div>

        <button
          onClick={handleExportExcel}
          className="flex items-center gap-2 px-6 py-2.5 bg-secondary text-background font-bold rounded-md text-[10px] hover:bg-secondary/90 transition-all uppercase tracking-[0.15em] shadow-[0_0_15px_rgba(var(--secondary-rgb),0.3)] shrink-0 ml-auto"
        >
          <FileSpreadsheet className="w-4 h-4" /> Export Excel
        </button>
      </div>

      {/* Filter Bar */}
      <div className="surface-1 border border-on-surface/5 p-4 rounded-md tech-glow">
        <form onSubmit={handleApplyFilter} className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5 flex-1 min-w-[180px]">
            <label className="text-[9px] font-mono uppercase text-on-surface-variant tracking-widest pl-1">Date Range</label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="flex-1 bg-surface border border-on-surface/10 rounded px-3 py-2 text-[10px] font-mono text-on-surface outline-none focus:border-primary/50 transition-all cursor-pointer"
                style={{ colorScheme: 'dark' }}
              />
              <span className="text-on-surface/30">—</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="flex-1 bg-surface border border-on-surface/10 rounded px-3 py-2 text-[10px] font-mono text-on-surface outline-none focus:border-primary/50 transition-all cursor-pointer"
                style={{ colorScheme: 'dark' }}
              />
            </div>
          </div>

          <div className="space-y-1.5 w-40">
            <label className="text-[9px] font-mono uppercase text-on-surface-variant tracking-widest pl-1">Min Violations</label>
            <div className="custom-number-input">
              <button
                type="button"
                onClick={() => setMinViolations(Math.max(0, minViolations - 1))}
                className="custom-number-btn"
              >
                <Minus className="w-3 h-3" />
              </button>
              <input
                type="number"
                min="0"
                value={minViolations}
                onChange={(e) => setMinViolations(Math.max(0, parseInt(e.target.value) || 0))}
                placeholder="0"
                className="text-center"
              />
              <button
                type="button"
                onClick={() => setMinViolations(minViolations + 1)}
                className="custom-number-btn"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 py-2 px-2">
            <div className="relative flex items-center justify-center">
              <input
                type="checkbox"
                id="onlyViolations"
                checked={onlyViolations}
                onChange={(e) => setOnlyViolations(e.target.checked)}
                className="w-4 h-4 rounded appearance-none border border-on-surface/30 bg-surface checked:bg-primary checked:border-primary focus:outline-none focus:ring-1 focus:ring-primary/50 cursor-pointer transition-colors peer"
              />
              <svg className="w-3 h-3 text-background absolute pointer-events-none opacity-0 peer-checked:opacity-100 transition-opacity" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M11.6666 3.5L5.24992 9.91667L2.33325 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <label htmlFor="onlyViolations" className="text-[10px] font-mono uppercase text-on-surface-variant tracking-widest cursor-pointer select-none">
              Without Helmet Only
            </label>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={handleResetFilter}
              className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant hover:text-on-surface transition-all"
            >
              Clear
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-6 py-2 bg-surface-highest text-on-surface border border-on-surface/10 rounded-md text-[10px] font-bold uppercase tracking-widest hover:border-primary/50 transition-all"
            >
              <Filter className="w-3.5 h-3.5" /> Filter Data
            </button>
          </div>
        </form>
      </div>

      <div className="surface-1 border border-on-surface/5 rounded-md overflow-visible tech-glow min-h-[500px]">
        <div className="overflow-x-auto lg:overflow-visible rounded-md">
          <table className="w-full text-left border-collapse">
            <thead className="bg-surface-low text-on-surface-variant text-[10px] font-mono uppercase tracking-widest border-b border-on-surface/5">
              <tr>
                <th className="px-6 py-5 font-bold">Evidence</th>
                <th
                  className="px-6 py-5 font-bold cursor-pointer hover:text-primary transition-colors"
                  onClick={() => toggleSort('timestamp')}
                >
                  <div className="flex items-center gap-2">
                    Timestamp {sortBy === 'timestamp' && (order === 'asc' ? '↑' : '↓')}
                  </div>
                </th>
                <th
                  className="px-6 py-5 font-bold cursor-pointer hover:text-primary transition-colors"
                  onClick={() => toggleSort('total_violations')}
                >
                  <div className="flex items-center gap-2">
                    Violations {sortBy === 'total_violations' && (order === 'asc' ? '↑' : '↓')}
                  </div>
                </th>
                <th className="px-6 py-5 font-bold">Confidence</th>
                <th className="px-6 py-5 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-on-surface/5">
              {loading ? (
                Array(limit).fill(0).map((_, i) => (
                  <tr key={i} className="border-b border-on-surface/5">
                    <td className="px-6 py-4"><Skeleton width="80px" height="48px" /></td>
                    <td className="px-6 py-4">
                      <Skeleton width="100px" height="12px" className="mb-2" />
                      <Skeleton width="60px" height="10px" />
                    </td>
                    <td className="px-6 py-4"><Skeleton width="90px" height="24px" /></td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <Skeleton width="96px" height="4px" />
                        <Skeleton width="30px" height="10px" />
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right"><Skeleton width="32px" height="32px" className="inline-block" rounded="rounded-md" /></td>
                  </tr>
                ))
              ) : violations.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center">
                    <EmptyState
                      icon={AlertCircle}
                      title="No violations found"
                      message="Try adjusting your filters or checking a different date range."
                    />
                  </td>
                </tr>
              ) : (
                violations.map((violation) => {
                  const avgConfidence = violation.detections && violation.detections.length > 0
                    ? violation.detections.reduce((acc, d) => acc + d.confidence, 0) / violation.detections.length
                    : 0;

                  const vId = violation.id || violation._id;
                  const isHighlighted = activeHighlightId === vId;

                  return (
                    <tr
                      key={vId}
                      id={`violation-${vId}`}
                      className={`hover:bg-primary/5 transition-all group ${isHighlighted ? 'row-highlight' : ''}`}
                    >
                      <td className="px-6 py-4">
                        <div
                          className="evidence-thumbnail relative w-20 h-12 rounded bg-surface border border-on-surface/10 overflow-hidden cursor-zoom-in group/img"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedViolationIndex(violations.indexOf(violation));
                            setActiveHighlightId(vId);
                          }}
                        >
                          <img
                            src={violation.image_url}
                            alt="evidence"
                            className="w-full h-full object-cover group-hover/img:scale-110 transition-transform duration-500"
                          />
                          <div className="absolute inset-0 bg-primary/0 group-hover/img:bg-primary/10 flex items-center justify-center transition-all opacity-0 group-hover/img:opacity-100">
                            <Maximize2 className="w-4 h-4 text-primary" />
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2 text-[11px] font-bold text-on-surface opacity-90">
                            <Clock className="w-3 h-3 text-primary" />
                            {new Date(violation.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </div>
                          <div className="text-[10px] font-mono text-on-surface-variant opacity-60">
                            {new Date(violation.timestamp).toLocaleDateString()}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-sm text-[10px] font-bold uppercase tracking-widest border ${violation.total_violations > 0
                          ? 'bg-error/10 text-error border-error/20'
                          : 'bg-secondary/10 text-secondary border-secondary/20'
                          }`}>
                          {violation.total_violations} {violation.total_violations > 1 ? 'Violators' : 'Violator'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-24 h-1 bg-surface-highest rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all duration-1000 ${avgConfidence > 0.8 ? 'bg-secondary' : avgConfidence > 0.5 ? 'bg-primary' : 'bg-error'
                                }`}
                              style={{ width: `${avgConfidence * 100}%` }}
                            ></div>
                          </div>
                          <span className="text-[10px] font-mono font-bold text-on-surface-variant">
                            {(avgConfidence * 100).toFixed(1)}%
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right relative overflow-visible">
                        <div className="inline-block" ref={activeMenuId === vId ? menuRef : null}>
                          <button
                            onClick={() => setActiveMenuId(activeMenuId === vId ? null : vId)}
                            className="p-2.5 text-on-surface-variant hover:text-on-surface hover:bg-surface rounded-md transition-all border border-transparent hover:border-on-surface/10"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {activeMenuId === vId && (
                            <div className="absolute right-0 top-14 w-48 surface-2 border border-on-surface/10 rounded-md shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                              <div className="px-4 py-2 bg-surface-low border-b border-on-surface/5">
                                <span className="text-[8px] font-mono text-on-surface-variant uppercase tracking-widest opacity-50">Actions</span>
                              </div>

                              <button
                                onClick={() => {
                                  handleDownloadImage(violation.image_url, vId);
                                  setActiveMenuId(null);
                                }}
                                className="w-full flex items-center justify-between px-4 py-3 text-[10px] font-bold uppercase font-mono text-on-surface hover:bg-primary/10 hover:text-primary transition-all text-left"
                              >
                                <span>Download</span>
                                <Download className="w-3.5 h-3.5" />
                              </button>

                              {currentUser?.role === 'admin' && (
                                <button
                                  onClick={() => {
                                    setDeleteConfirmId(vId);
                                    setActiveMenuId(null);
                                  }}
                                  className="w-full flex items-center justify-between px-4 py-3 text-[10px] font-bold uppercase font-mono text-error hover:bg-error/10 transition-all text-left border-t border-on-surface/5"
                                >
                                  <span>Delete</span>
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-4 bg-surface-low border-t border-on-surface/5 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="text-[10px] text-on-surface-variant font-mono uppercase tracking-[0.2em] opacity-60">
              Records Display:
            </span>
            <CustomDropdown
              options={[
                { value: 10, label: '10 Records' },
                { value: 25, label: '25 Records' },
                { value: 50, label: '50 Records' },
                { value: 100, label: '100 Records' },
              ]}
              value={limit}
              onChange={(val) => {
                setLimit(val);
                setPage(1);
              }}
              labelPrefix="Showing"
              headerText="Table Limit"
              align="left"
              width="w-40"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="p-2 border border-on-surface/10 rounded-md hover:bg-surface transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1 mx-2">
              {[...Array(Math.ceil(total / limit))].map((_, i) => {
                const pNum = i + 1;
                if (
                  pNum === 1 ||
                  pNum === Math.ceil(total / limit) ||
                  (pNum >= page - 1 && pNum <= page + 1)
                ) {
                  return (
                    <button
                      key={pNum}
                      onClick={() => setPage(pNum)}
                      className={`w-8 h-8 rounded text-[10px] font-bold transition-all ${page === pNum
                        ? 'bg-primary text-background shadow-lg shadow-primary/20'
                        : 'text-on-surface-variant hover:text-on-surface hover:bg-surface'
                        }`}
                    >
                      {pNum}
                    </button>
                  );
                }
                if (pNum === page - 2 || pNum === page + 2) {
                  return <span key={pNum} className="text-on-surface-variant opacity-30 text-[10px] px-1 font-mono">...</span>;
                }
                return null;
              })}
            </div>

            <button
              onClick={() => setPage(Math.min(Math.ceil(total / limit), page + 1))}
              disabled={page >= Math.ceil(total / limit)}
              className="p-2 border border-on-surface/10 rounded-md hover:bg-surface transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Full Image Modal */}
      {selectedViolationIndex !== null && violations[selectedViolationIndex] && (
        <div className="fixed inset-0 w-screen h-screen z-50 flex items-center justify-center p-4 md:p-10 animate-in fade-in zoom-in-95 duration-200">
          <div className="violation-modal-bg absolute inset-0 bg-background/95 backdrop-blur-xl" onClick={() => setSelectedViolationIndex(null)}></div>

          <div className="violation-modal-content relative max-w-full max-h-full flex flex-col items-center">
            {/* Nav Arrows */}
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-between pointer-events-none px-4 md:-mx-20">
              <button
                onClick={handlePrevImage}
                className="w-12 h-12 rounded-full bg-surface/50 backdrop-blur-md border border-on-surface/10 flex items-center justify-center text-on-surface hover:bg-primary hover:text-background transition-all pointer-events-auto shadow-2xl"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                onClick={handleNextImage}
                className="w-12 h-12 rounded-full bg-surface/50 backdrop-blur-md border border-on-surface/10 flex items-center justify-center text-on-surface hover:bg-primary hover:text-background transition-all pointer-events-auto shadow-2xl"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </div>

            <button
              onClick={() => setSelectedViolationIndex(null)}
              className="fixed top-6 right-6 p-3 bg-surface/50 backdrop-blur-md border border-on-surface/10 rounded-full text-on-surface hover:bg-primary hover:text-background transition-all flex items-center gap-2 text-xs font-mono tracking-widest uppercase cursor-pointer shadow-lg"
            >
              Close <X className="w-5 h-5" />
            </button>
            <div className="surface-1 border border-primary/20 p-1 rounded-md shadow-[0_0_50px_rgba(var(--primary-rgb),0.2)] relative overflow-hidden group">
              <img
                src={violations[selectedViolationIndex].image_url}
                alt="Full Evidence"
                className="max-w-full max-h-[75vh] w-auto h-auto object-contain rounded"
              />
              <div className="absolute top-0 left-0 w-full p-4 flex justify-between pointer-events-none">
                <div className="bg-primary/10 backdrop-blur-md px-3 py-1 rounded border border-primary/20 flex flex-col gap-1">
                  <span className="text-[10px] font-mono font-bold text-primary tracking-widest uppercase">EVIDENCE {selectedViolationIndex + 1}/{violations.length}</span>
                  <span className="text-[8px] font-mono text-primary/60 uppercase tracking-widest">Global Index: {((page - 1) * limit) + selectedViolationIndex + 1}</span>
                </div>
              </div>

              {/* Details Overlay */}
              <div className="absolute bottom-4 left-4 right-4 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                <div className="bg-background/80 backdrop-blur-xl border border-on-surface/10 p-4 rounded-md shadow-2xl flex justify-between items-center">
                  <div>
                    <p className="text-[10px] font-mono text-primary font-bold uppercase tracking-widest mb-1">TIMESTAMP</p>
                    <p className="text-xs font-bold text-on-surface">{new Date(violations[selectedViolationIndex].timestamp).toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-mono text-error font-bold uppercase tracking-widest mb-1">TOTAL VIOLATIONS</p>
                    <p className="text-xs font-bold text-error">{violations[selectedViolationIndex].total_violations}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 flex justify-center gap-6">
              <button
                onClick={() => handleDownloadImage(violations[selectedViolationIndex].image_url, violations[selectedViolationIndex].id || violations[selectedViolationIndex]._id)}
                className="flex items-center justify-center w-16 h-16 bg-primary text-background font-bold rounded-xl hover:bg-primary/90 transition-all shadow-[0_0_20px_rgba(var(--primary-rgb),0.3)] cursor-pointer group"
                title="Export Record Image"
              >
                <Download className="w-6 h-6 group-hover:scale-110 transition-transform" />
              </button>

              {currentUser?.role === 'admin' && (
                <button
                  onClick={() => {
                    const id = violations[selectedViolationIndex].id || violations[selectedViolationIndex]._id;
                    setDeleteConfirmId(id);
                    setSelectedViolationIndex(null);
                  }}
                  className="flex items-center justify-center w-16 h-16 bg-surface-highest hover:bg-error hover:text-background text-error font-bold rounded-xl transition-all shadow-xl cursor-pointer border border-error/20 group"
                  title="Delete this record"
                >
                  <Trash2 className="w-6 h-6 group-hover:scale-110 transition-transform" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-background/90 backdrop-blur-md" onClick={() => setDeleteConfirmId(null)}></div>
          <div className="delete-modal-content relative w-full max-w-sm surface-1 border border-error/20 rounded-lg p-8 tech-glow animate-in zoom-in-95 duration-200 text-center">
            <div className="w-16 h-16 bg-error/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-error/20">
              <AlertTriangle className="w-8 h-8 text-error" />
            </div>
            <h2 className="text-xl font-bold text-on-surface uppercase font-mono tracking-widest">Delete Record</h2>
            <p className="text-[10px] text-on-surface-variant font-mono uppercase tracking-widest mt-1">Confirm deletion</p>
            <p className="text-sm text-on-surface-variant my-8 leading-relaxed">
              Are you sure you want to delete this violation record? This action cannot be undone.
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 py-3 bg-surface border border-on-surface/10 text-on-surface-variant font-bold uppercase tracking-widest text-[10px] rounded-md hover:border-on-surface/20 transition-all"
              >
                Abort
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmId)}
                className="flex-1 py-3 bg-error text-background font-bold uppercase tracking-widest text-[10px] rounded-md primary-glow hover:bg-error/90 transition-all flex items-center justify-center gap-2"
              >
                {isDeleting === deleteConfirmId ? (
                  <span className="w-4 h-4 border-2 border-background/30 border-t-background rounded-full animate-spin"></span>
                ) : null}
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Style fixes */}
      <style>{`
        @keyframes highlight-pulse {
          0% { background-color: transparent; }
          50% { background-color: #3b82f633; border-top-color: #3b82f6; border-bottom-color: #3b82f6; }
          100% { background-color: transparent; }
        }
        .row-highlight {
          animation: highlight-pulse 2s ease-in-out infinite;
          background-color: #3b82f61a !important;
          box-shadow: inset 0 0 10px #3b82f633;
          position: relative;
          z-index: 5;
        }
        input[type="date"]::-webkit-calendar-picker-indicator {
          opacity: 0.8;
          cursor: pointer;
        }
        input[type="date"]::-webkit-calendar-picker-indicator:hover {
          opacity: 1;
        }
      `}</style>
    </div>
  );
};

export default ViolationHistory;
