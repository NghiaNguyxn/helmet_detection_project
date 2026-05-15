import React from 'react';

const TelemetryPanel = ({ isCamOn, telemetry }) => (
  <div className="space-y-3 pt-2">
    <div className="flex items-center justify-between">
      <span className="text-[9px] font-mono text-on-surface-variant uppercase tracking-widest opacity-60">Status</span>
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${!isCamOn ? 'bg-on-surface/20' :
          telemetry.status === 'Streaming' ? 'bg-secondary shadow-[0_0_8px_rgba(0,255,157,0.4)] animate-pulse' :
            telemetry.status === 'Connecting' ? 'bg-cyan-400 animate-pulse' : 'bg-error animate-pulse'
          }`}></div>
        <span className={`text-[10px] font-bold uppercase font-mono ${!isCamOn ? 'text-on-surface/40' :
          telemetry.status === 'Streaming' ? 'text-secondary' :
            telemetry.status === 'Connecting' ? 'text-cyan-400' : 'text-error'
          }`}>
          {!isCamOn ? 'STANDBY' : telemetry.status}
        </span>
      </div>
    </div>
    <div className="flex items-center justify-between">
      <span className="text-[9px] font-mono text-on-surface-variant uppercase tracking-widest opacity-60">Active Source</span>
      <span className="text-[10px] font-bold font-mono text-primary uppercase">{telemetry.cam_name}</span>
    </div>
    <div className="flex items-start justify-between">
      <span className="text-[9px] font-mono text-on-surface-variant uppercase tracking-widest opacity-60 pt-0.5">Performance</span>
      <div className="flex flex-col items-end gap-1">
        <span className="text-[10px] font-bold font-mono text-on-surface">
          <span className="text-primary/80">AI:</span> {Number(telemetry.fps || 0).toFixed(1)} FPS
        </span>
        <span className="text-[10px] font-bold font-mono text-on-surface">
          <span className="text-primary/80">CAP:</span> {Number(telemetry.capture_fps || 0).toFixed(1)} FPS
        </span>
        <span className="text-[9px] font-mono text-on-surface-variant opacity-60">
          @{telemetry.resolution}
        </span>
      </div>
    </div>
  </div>
);

export default TelemetryPanel;
