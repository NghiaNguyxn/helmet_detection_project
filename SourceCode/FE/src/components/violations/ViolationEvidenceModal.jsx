import React from 'react';
import { ChevronLeft, ChevronRight, Download, Trash2, X } from 'lucide-react';
import ViolationReviewPanel from './ViolationReviewPanel';
import { getViolationId } from './violationReview';

const ViolationEvidenceModal = ({
  selectedViolation,
  selectedViolationIndex,
  violationsLength,
  page,
  limit,
  currentUser,
  onClose,
  onPrev,
  onNext,
  onDownload,
  onDelete,
  onConfirm,
  onReject,
}) => {
  if (!selectedViolation) return null;

  return (
    <div className="fixed inset-0 w-screen h-screen z-50 flex items-center justify-center p-4 md:p-10 animate-in fade-in zoom-in-95 duration-200">
      <div className="violation-modal-bg absolute inset-0 bg-background/95 backdrop-blur-xl" onClick={onClose}></div>

      <div className="violation-modal-content relative w-full max-w-6xl max-h-full flex flex-col items-center">
        {/* Nav Arrows */}
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-between pointer-events-none px-4 md:-mx-20">
          <button
            onClick={onPrev}
            className="w-12 h-12 rounded-full bg-surface/50 backdrop-blur-md border border-on-surface/10 flex items-center justify-center text-on-surface hover:bg-primary hover:text-background transition-all pointer-events-auto shadow-2xl"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            onClick={onNext}
            className="w-12 h-12 rounded-full bg-surface/50 backdrop-blur-md border border-on-surface/10 flex items-center justify-center text-on-surface hover:bg-primary hover:text-background transition-all pointer-events-auto shadow-2xl"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </div>

        <button
          onClick={onClose}
          className="fixed top-6 right-6 p-3 bg-surface/50 backdrop-blur-md border border-on-surface/10 rounded-full text-on-surface hover:bg-primary hover:text-background transition-all flex items-center gap-2 text-xs font-mono tracking-widest uppercase cursor-pointer shadow-lg"
        >
          Close <X className="w-5 h-5" />
        </button>
        <div className="w-full flex flex-col lg:flex-row items-stretch justify-center gap-4">
          <div className="surface-1 border border-primary/20 p-1 rounded-md shadow-[0_0_50px_rgba(var(--primary-rgb),0.2)] relative overflow-hidden group flex-1 flex items-center justify-center min-w-0">
            <img
              src={selectedViolation.image_url}
              alt="Full Evidence"
              className="max-w-full max-h-[70vh] w-auto h-auto object-contain rounded"
            />
            <div className="absolute top-0 left-0 w-full p-4 flex justify-between pointer-events-none">
              <div className="bg-primary/10 backdrop-blur-md px-3 py-1 rounded border border-primary/20 flex flex-col gap-1">
                <span className="text-[10px] font-mono font-bold text-primary tracking-widest uppercase">EVIDENCE {selectedViolationIndex + 1}/{violationsLength}</span>
                <span className="text-[8px] font-mono text-primary/60 uppercase tracking-widest">Global Index: {((page - 1) * limit) + selectedViolationIndex + 1}</span>
              </div>
            </div>

            {/* Details Overlay */}
            <div className="absolute bottom-4 left-4 right-4 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
              <div className="bg-background/80 backdrop-blur-xl border border-on-surface/10 p-4 rounded-md shadow-2xl flex justify-between items-center">
                <div>
                  <p className="text-[10px] font-mono text-primary font-bold uppercase tracking-widest mb-1">TIMESTAMP</p>
                  <p className="text-xs font-bold text-on-surface">{new Date(selectedViolation.timestamp).toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-mono text-error font-bold uppercase tracking-widest mb-1">TOTAL VIOLATIONS</p>
                  <p className="text-xs font-bold text-error">{selectedViolation.total_violations}</p>
                </div>
              </div>
            </div>
          </div>

          <ViolationReviewPanel
            violation={selectedViolation}
            onConfirm={onConfirm}
            onReject={onReject}
          />
        </div>

        <div className="mt-8 flex justify-center gap-6">
          <button
            onClick={() => onDownload(selectedViolation.image_url, getViolationId(selectedViolation))}
            className="flex items-center justify-center w-16 h-16 bg-primary text-background font-bold rounded-xl hover:bg-primary/90 transition-all shadow-[0_0_20px_rgba(var(--primary-rgb),0.3)] cursor-pointer group"
            title="Export Record Image"
          >
            <Download className="w-6 h-6 group-hover:scale-110 transition-transform" />
          </button>

          {currentUser?.role === 'admin' && (
            <button
              onClick={() => onDelete(getViolationId(selectedViolation))}
              className="flex items-center justify-center w-16 h-16 bg-surface-highest hover:bg-error hover:text-background text-error font-bold rounded-xl transition-all shadow-xl cursor-pointer border border-error/20 group"
              title="Delete this record"
            >
              <Trash2 className="w-6 h-6 group-hover:scale-110 transition-transform" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ViolationEvidenceModal;
