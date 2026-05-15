import React from 'react';
import { Activity, RefreshCcw, ShieldAlert } from 'lucide-react';
import TelemetryPanel from './TelemetryPanel';

const SessionStatsPanel = ({ sessionTime, sessionStats, isCamOn, telemetry, onResetSession, children }) => (
  <div className="surface-1 border border-on-surface/5 rounded-md p-6 space-y-6 tech-glow">
    <h3 className="text-[10px] font-mono uppercase text-on-surface-variant tracking-[0.2em] border-b border-on-surface/5 pb-2 font-bold flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Activity className="w-3.5 h-3.5 text-primary" /> Session Intelligence
      </div>
      <button
        onClick={onResetSession}
        title="Reset Session"
        className="p-1 hover:text-primary transition-colors opacity-40 hover:opacity-100"
      >
        <RefreshCcw className="w-3.5 h-3.5" />
      </button>
    </h3>

    <div className="space-y-5">
      <div className="flex justify-between items-end group">
        <div className="flex flex-col">
          <span className="text-[9px] font-mono text-on-surface-variant uppercase tracking-widest opacity-60">Session Time</span>
          <span className="text-lg font-black font-mono text-on-surface leading-none mt-1">{sessionTime}</span>
        </div>
        <div className="w-8 h-px bg-on-surface/10 group-hover:w-12 transition-all"></div>
      </div>

      <div className="flex justify-between items-end group">
        <div className="flex flex-col">
          <span className="text-[9px] font-mono text-on-surface-variant uppercase tracking-widest opacity-60">Violation Count</span>
          <span className={`text-lg font-black font-mono leading-none mt-1 ${sessionStats.violations > 0 ? 'text-error' : 'text-on-surface'}`}>
            {sessionStats.violations.toString().padStart(2, '0')}
          </span>
        </div>
        <ShieldAlert className={`w-4 h-4 ${sessionStats.violations > 0 ? 'text-error animate-pulse' : 'text-on-surface/20'}`} />
      </div>

      <TelemetryPanel isCamOn={isCamOn} telemetry={telemetry} />
    </div>

    {children}
  </div>
);

export default SessionStatsPanel;
