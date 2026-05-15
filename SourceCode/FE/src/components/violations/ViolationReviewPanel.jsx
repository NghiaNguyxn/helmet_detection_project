import React from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import ViolationStatusBadge from './ViolationStatusBadge';
import { formatReason, getViolationStatus } from './violationReview';

const ViolationReviewPanel = ({ violation, onConfirm, onReject }) => {
  const violationStatus = getViolationStatus(violation);
  const reviewedBy = violation.reviewed_by?.username || 'N/A';
  const reviewedAt = violation.reviewed_at ? new Date(violation.reviewed_at).toLocaleString() : 'N/A';

  return (
    <div className="w-full lg:w-80 surface-1 border border-on-surface/10 rounded-md p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[9px] font-mono uppercase tracking-widest text-on-surface-variant">Review Status</p>
          <div className="mt-2"><ViolationStatusBadge violation={violation} /></div>
        </div>
        <div className="text-right">
          <p className="text-[9px] font-mono uppercase tracking-widest text-on-surface-variant">Violators</p>
          <p className="text-2xl font-black font-mono text-on-surface">{violation.total_violations}</p>
        </div>
      </div>

      {violationStatus !== 'pending' && (
        <div className="space-y-3 border-t border-on-surface/10 pt-4">
          <div>
            <p className="text-[9px] font-mono uppercase tracking-widest text-on-surface-variant">Reviewed By</p>
            <p className="text-xs font-bold text-on-surface mt-1">{reviewedBy}</p>
          </div>
          <div>
            <p className="text-[9px] font-mono uppercase tracking-widest text-on-surface-variant">Reviewed At</p>
            <p className="text-xs font-mono text-on-surface mt-1">{reviewedAt}</p>
          </div>
          {violationStatus === 'rejected' && (
            <div>
              <p className="text-[9px] font-mono uppercase tracking-widest text-on-surface-variant">Reason</p>
              <p className="text-xs font-bold text-error mt-1">{formatReason(violation.rejection_reason)}</p>
            </div>
          )}
          {violation.review_note && (
            <div>
              <p className="text-[9px] font-mono uppercase tracking-widest text-on-surface-variant">Note</p>
              <p className="text-xs text-on-surface-variant mt-1 leading-relaxed break-words">{violation.review_note}</p>
            </div>
          )}
        </div>
      )}

      <div className="mt-auto grid grid-cols-1 gap-3">
        {violationStatus !== 'confirmed' && (
          <button
            onClick={() => onConfirm(violation)}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-secondary text-background rounded-md text-[10px] font-bold uppercase tracking-widest hover:bg-secondary/90 transition-all"
          >
            <CheckCircle2 className="w-4 h-4" /> Confirm Violation
          </button>
        )}
        {violationStatus !== 'rejected' && (
          <button
            onClick={() => onReject(violation)}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-surface-highest text-error border border-error/20 rounded-md text-[10px] font-bold uppercase tracking-widest hover:bg-error hover:text-background transition-all"
          >
            <XCircle className="w-4 h-4" /> Reject Detection
          </button>
        )}
      </div>
    </div>
  );
};

export default ViolationReviewPanel;
