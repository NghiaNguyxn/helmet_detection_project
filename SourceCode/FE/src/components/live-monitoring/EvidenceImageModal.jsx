import React from 'react';
import { ChevronLeft, ChevronRight, Download, Trash2, X } from 'lucide-react';

const EvidenceImageModal = ({
  selectedImageIndex,
  recentLogs,
  onClose,
  onPrev,
  onNext,
  onDownload,
  onDeleteRequest,
}) => {
  if (selectedImageIndex === null || !recentLogs[selectedImageIndex]) return null;

  const selectedLog = recentLogs[selectedImageIndex];

  return (
    <div className="fixed inset-0 w-screen h-screen z-50 flex items-center justify-center p-4 md:p-10 animate-in fade-in zoom-in-95 duration-200">
      <div className="absolute inset-0 bg-background/95 backdrop-blur-xl" onClick={onClose}></div>

      <div className="relative max-w-full max-h-full flex flex-col items-center">
        {/* Navigation Controls */}
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-between pointer-events-none px-4 md:-mx-24">
          <button
            onClick={onPrev}
            className="w-12 h-12 rounded-full bg-surface/50 backdrop-blur-lg border border-on-surface/10 flex items-center justify-center text-on-surface hover:bg-primary hover:text-background transition-all pointer-events-auto shadow-2xl"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            onClick={onNext}
            className="w-12 h-12 rounded-full bg-surface/50 backdrop-blur-lg border border-on-surface/10 flex items-center justify-center text-on-surface hover:bg-primary hover:text-background transition-all pointer-events-auto shadow-2xl"
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

        <div className="surface-1 border border-primary/20 p-1 rounded-md shadow-[0_0_50px_rgba(var(--primary-rgb),0.2)] relative overflow-hidden group">
          <img
            src={selectedLog.image_url}
            alt="Enlarged Intelligence"
            className="max-w-full max-h-[75vh] w-auto h-auto object-contain rounded"
          />
          <div className="absolute top-4 left-4 flex gap-2">
            <div className="bg-primary/20 backdrop-blur-md px-3 py-1 rounded border border-primary/30">
              <span className="text-[9px] font-mono font-black text-primary tracking-widest uppercase">ID: {selectedLog._id?.slice(-6) || 'N/A'}</span>
            </div>
          </div>

          <div className="absolute top-4 right-4 bg-background/60 backdrop-blur-md px-3 py-1 rounded border border-on-surface/10">
            <span className="text-[9px] font-mono font-bold text-on-surface uppercase tracking-widest">{selectedImageIndex + 1} / {recentLogs.length}</span>
          </div>

          {/* Data Overlay */}
          <div className="absolute bottom-4 left-4 right-4 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500">
            <div className="bg-background/90 backdrop-blur-md border border-on-surface/10 p-4 rounded shadow-2xl">
              <p className="text-[8px] font-mono text-primary font-bold uppercase tracking-widest mb-1 opacity-60">System Log Timestamp</p>
              <p className="text-sm font-black text-on-surface font-mono">{new Date(selectedLog.timestamp).toLocaleString()}</p>
            </div>
          </div>
        </div>

        <div className="mt-8 flex justify-center gap-6">
          <button
            onClick={() => onDownload(selectedLog.image_url, selectedLog._id || selectedLog.id)}
            className="flex items-center justify-center w-16 h-16 bg-primary text-background font-bold rounded-xl hover:bg-primary-variant transition-all shadow-[0_0_20px_rgba(var(--primary-rgb),0.3)] cursor-pointer group"
            title="Export Intelligence"
          >
            <Download className="w-6 h-6 group-hover:scale-110 transition-transform" />
          </button>

          <button
            onClick={onDeleteRequest}
            className="flex items-center justify-center w-16 h-16 bg-surface-highest hover:bg-error hover:text-background text-error font-bold rounded-xl transition-all shadow-xl cursor-pointer border border-error/20 group"
            title="Delete this record"
          >
            <Trash2 className="w-6 h-6 group-hover:scale-110 transition-transform" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default EvidenceImageModal;
