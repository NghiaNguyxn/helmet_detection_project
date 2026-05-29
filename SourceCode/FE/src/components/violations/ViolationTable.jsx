import React from 'react';
import { AlertCircle, CheckCircle2, Clock, Download, Maximize2, MoreVertical, Trash2, XCircle } from 'lucide-react';
import EmptyState from '../EmptyState';
import Skeleton from '../Skeleton';
import ViolationStatusBadge from './ViolationStatusBadge';
import { getViolationId, getViolationStatus } from './violationReview';

const ViolationTable = ({
  loading,
  limit,
  violations,
  activeHighlightId,
  setSelectedViolationIndex,
  setActiveHighlightId,
  sortBy,
  order,
  toggleSort,
  activeMenuId,
  setActiveMenuId,
  menuRef,
  handleDownloadImage,
  currentUser,
  setDeleteConfirmId,
  openReviewDialog,
}) => (
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
          <th className="px-6 py-5 font-bold">Status</th>
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
              <td className="px-6 py-4"><Skeleton width="110px" height="24px" /></td>
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
            <td colSpan="6" className="px-6 py-12 text-center">
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

            const vId = getViolationId(violation);
            const isHighlighted = activeHighlightId === vId;
            const violationStatus = getViolationStatus(violation);

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
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`px-2.5 py-1 rounded-sm text-[10px] font-bold uppercase tracking-widest border ${violation.total_violations > 0
                      ? 'bg-error/10 text-error border-error/20'
                      : 'bg-secondary/10 text-secondary border-secondary/20'
                      }`}>
                      {violation.total_violations} {violation.total_violations > 1 ? 'Violators' : 'Violator'}
                    </span>
                    {violation.is_demo && (
                      <span className="px-2 py-1 rounded-sm bg-primary/10 text-primary border border-primary/20 text-[9px] font-bold uppercase tracking-widest">
                        Demo
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <ViolationStatusBadge violation={violation} />
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

                        {violationStatus !== 'confirmed' && (
                          <button
                            onClick={() => {
                              openReviewDialog('confirm', violation);
                              setActiveMenuId(null);
                            }}
                            className="w-full flex items-center justify-between px-4 py-3 text-[10px] font-bold uppercase font-mono text-secondary hover:bg-secondary/10 transition-all text-left border-t border-on-surface/5"
                          >
                            <span>Confirm</span>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {violationStatus !== 'rejected' && (
                          <button
                            onClick={() => {
                              openReviewDialog('reject', violation);
                              setActiveMenuId(null);
                            }}
                            className="w-full flex items-center justify-between px-4 py-3 text-[10px] font-bold uppercase font-mono text-error hover:bg-error/10 transition-all text-left border-t border-on-surface/5"
                          >
                            <span>Reject</span>
                            <XCircle className="w-3.5 h-3.5" />
                          </button>
                        )}

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
);

export default ViolationTable;
