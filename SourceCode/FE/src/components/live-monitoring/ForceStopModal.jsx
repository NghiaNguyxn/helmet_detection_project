import React from 'react';
import { AlertTriangle } from 'lucide-react';

const ForceStopModal = ({ show, onCancel, onConfirm }) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="w-full max-w-md bg-surface border border-error/20 rounded-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-full bg-error/10 flex items-center justify-center border border-error/20">
              <AlertTriangle className="w-6 h-6 text-error animate-pulse" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-on-surface uppercase tracking-tight">Force System Reset</h3>
              <p className="text-xs text-on-surface-variant font-mono uppercase tracking-widest opacity-60">Security Protocol AX-Reset</p>
            </div>
          </div>

          <div className="space-y-4 mb-6">
            <p className="text-sm text-on-surface-variant leading-relaxed">
              This action will <span className="text-error font-bold">terminate all active viewer sessions</span> and force the camera hardware to shutdown.
            </p>
            <div className="p-3 bg-surface-lowest rounded border border-on-surface/5">
              <p className="text-[10px] text-on-surface-variant/60 font-mono italic">
                Note: A system-wide alert will be broadcasted to notify all users of this manual override.
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 py-3 bg-surface-highest hover:bg-on-surface/10 text-on-surface font-bold rounded-md transition-all text-[10px] uppercase tracking-[0.2em]"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 py-3 bg-error text-background hover:bg-error/90 font-bold rounded-md transition-all text-[10px] uppercase tracking-[0.2em] shadow-[0_0_15px_rgba(var(--error-rgb),0.4)]"
            >
              Force Shutdown
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForceStopModal;
