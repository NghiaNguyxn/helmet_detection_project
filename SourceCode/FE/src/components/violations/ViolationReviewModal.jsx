import React from 'react';
import { CheckCircle2, X, XCircle } from 'lucide-react';
import CustomDropdown from '../CustomDropdown';
import { getViolationId, REJECTION_REASON_OPTIONS } from './violationReview';

const ViolationReviewModal = ({
  reviewDialog,
  reviewNote,
  setReviewNote,
  rejectionReason,
  setRejectionReason,
  isReviewing,
  onClose,
  onSubmit,
}) => {
  if (!reviewDialog) return null;

  return (
    <div className="fixed inset-0 w-screen h-screen z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/90 backdrop-blur-md" onClick={onClose}></div>
      <div className="review-modal-content relative w-full max-w-lg surface-1 border border-on-surface/10 rounded-lg p-6 tech-glow animate-in zoom-in-95 duration-200">
        <div className="flex items-start justify-between gap-4 border-b border-on-surface/10 pb-4">
          <div>
            <h2 className="text-lg font-bold text-on-surface uppercase font-mono tracking-widest">
              {reviewDialog.type === 'confirm' ? 'Confirm Violation' : 'Reject Detection'}
            </h2>
            <p className="text-[10px] text-on-surface-variant font-mono uppercase tracking-widest mt-1">
              Evidence ID: {getViolationId(reviewDialog.violation)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface rounded-md transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-5 py-5">
          {reviewDialog.type === 'reject' && (
            <div className="space-y-2">
              <label className="text-[9px] font-mono uppercase text-on-surface-variant tracking-widest">Rejection Reason</label>
              <CustomDropdown
                options={REJECTION_REASON_OPTIONS}
                value={rejectionReason}
                onChange={setRejectionReason}
                labelPrefix="Reason"
                headerText="Rejection Reason"
                align="left"
                width="w-full"
                containerClassName="w-full"
                buttonClassName="w-full justify-between px-3 py-3"
                menuClassName="max-h-64 overflow-y-auto"
                compact
              />
            </div>
          )}

          <div className="space-y-2">
            <label className="text-[9px] font-mono uppercase text-on-surface-variant tracking-widest">Review Note</label>
            <textarea
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              maxLength={1000}
              rows={4}
              placeholder="Optional note"
              className="w-full bg-surface border border-on-surface/10 rounded-md px-3 py-3 text-sm text-on-surface outline-none focus:border-primary/50 transition-all resize-none"
            />
            <div className="text-right text-[9px] font-mono text-on-surface-variant">
              {reviewNote.length}/1000
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-surface border border-on-surface/10 text-on-surface-variant font-bold uppercase tracking-widest text-[10px] rounded-md hover:border-on-surface/20 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={onSubmit}
            disabled={isReviewing}
            className={`flex-1 py-3 font-bold uppercase tracking-widest text-[10px] rounded-md transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed ${reviewDialog.type === 'confirm'
              ? 'bg-secondary text-background hover:bg-secondary/90'
              : 'bg-error text-background hover:bg-error/90'
              }`}
          >
            {isReviewing ? (
              <span className="w-4 h-4 border-2 border-background/30 border-t-background rounded-full animate-spin"></span>
            ) : reviewDialog.type === 'confirm' ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <XCircle className="w-4 h-4" />
            )}
            {reviewDialog.type === 'confirm' ? 'Confirm' : 'Reject'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ViolationReviewModal;
