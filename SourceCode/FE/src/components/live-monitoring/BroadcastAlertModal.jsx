import React from 'react';
import { AlertCircle, RefreshCcw } from 'lucide-react';

const BroadcastAlertModal = ({
  show,
  currentCam,
  broadcastMessage,
  setBroadcastMessage,
  isBroadcasting,
  onClose,
  onSend,
}) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-xl" onClick={onClose}></div>
      <div className="relative w-full max-w-md surface-2 border border-error/20 rounded-lg p-8 tech-glow animate-in zoom-in-95 duration-200">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 bg-error/10 rounded-full flex items-center justify-center border border-error/20">
            <AlertCircle className="w-6 h-6 text-error animate-pulse" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-on-surface uppercase tracking-widest">Emergency Broadcast</h3>
            <p className="text-[10px] text-on-surface-variant font-mono uppercase tracking-widest opacity-60">Source: {currentCam}</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-mono uppercase text-on-surface-variant tracking-widest block mb-2">Alert Message</label>
            <textarea
              value={broadcastMessage}
              onChange={(e) => setBroadcastMessage(e.target.value)}
              placeholder="Enter emergency message here..."
              className="w-full bg-surface border border-on-surface/10 rounded-md p-4 text-sm text-on-surface outline-none focus:border-error/50 transition-all min-h-[120px] resize-none"
              autoFocus
            />
          </div>

          <div className="flex flex-wrap gap-2 mb-6">
            {['Security Threat', 'Fire Hazard', 'Safety Violation', 'Equipment Failure'].map(preset => (
              <button
                key={preset}
                onClick={() => setBroadcastMessage(preset)}
                className="px-2 py-1 bg-surface-highest/50 hover:bg-surface-highest text-[8px] font-bold uppercase tracking-widest rounded border border-on-surface/5 transition-all"
              >
                {preset}
              </button>
            ))}
          </div>

          <div className="flex gap-3 pt-4 border-t border-on-surface/5">
            <button
              onClick={onClose}
              className="flex-1 py-3 bg-surface text-on-surface-variant font-bold uppercase tracking-widest text-[10px] rounded-md hover:bg-surface-low transition-all"
            >
              Cancel
            </button>
            <button
              onClick={onSend}
              disabled={!broadcastMessage.trim() || isBroadcasting}
              className="flex-1 py-3 bg-error text-background font-bold uppercase tracking-widest text-[10px] rounded-md primary-glow hover:bg-error/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isBroadcasting ? <RefreshCcw className="w-3 h-3 animate-spin" /> : null}
              Send Broadcast
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BroadcastAlertModal;
