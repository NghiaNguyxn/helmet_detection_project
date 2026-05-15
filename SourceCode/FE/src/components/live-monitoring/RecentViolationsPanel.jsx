import React from 'react';
import { Shield } from 'lucide-react';

const RecentViolationsPanel = ({ recentLogs, onSelectImage, onArchiveView }) => (
  <div className="surface-1 border border-on-surface/5 rounded-md p-6 space-y-4">
    <h3 className="text-[10px] font-mono uppercase text-on-surface-variant tracking-[0.2em] border-b border-on-surface/5 pb-2 font-bold">Recent Intelligence</h3>
    <div className="space-y-3">
      {recentLogs.length > 0 ? recentLogs.map((log, i) => (
        <div key={log._id || log.id} className="flex gap-3 items-start p-2 hover:bg-surface rounded transition-all border border-transparent hover:border-on-surface/10 group">
          <div
            className="w-10 h-10 bg-surface-highest rounded flex items-center justify-center shrink-0 overflow-hidden cursor-pointer hover:ring-1 hover:ring-primary/30 transition-all"
            onClick={() => { if (log.image_url) onSelectImage(i); }}
          >
            {log.image_url ? (
              <img src={log.image_url} alt="Log" className="w-full h-full object-cover" />
            ) : (
              <Shield className="w-4 h-4 text-on-surface-variant" />
            )}
          </div>
          <div>
            <p className="text-[10px] font-bold text-on-surface uppercase leading-tight">Violation</p>
            <p className="text-[9px] text-on-surface-variant font-mono mt-0.5 opacity-60">
              {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {log.camera_id || 'CAM_1'}
            </p>
          </div>
        </div>
      )) : (
        <p className="text-[9px] text-on-surface-variant text-center my-6 font-mono uppercase tracking-[0.3em] opacity-40">No Signal</p>
      )}
      <button onClick={onArchiveView} className="w-full text-center text-[9px] font-mono uppercase text-primary hover:text-primary-variant pt-2 tracking-[0.2em] transition-colors cursor-pointer">Archive View</button>
    </div>
  </div>
);

export default RecentViolationsPanel;
