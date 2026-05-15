import React from 'react';
import { AlertCircle, Camera, RefreshCcw } from 'lucide-react';

const CameraViewport = ({
  isCamOn,
  imgRef,
  streamUrl,
  currentCam,
  isSwitching,
  onManualCapture,
  onBroadcast,
}) => (
  <div className="col-span-12 lg:col-span-9 space-y-4">
    <div className="relative aspect-video bg-surface-low rounded-md border border-on-surface/5 overflow-hidden tech-glow group">
      {isCamOn ? (
        <>
          <img
            ref={imgRef}
            crossOrigin="anonymous"
            src={streamUrl}
            alt="Live Stream"
            className={`w-full h-full object-cover transition-opacity duration-500 ${isSwitching ? 'opacity-30' : 'opacity-100'}`}
            onError={(e) => {
              console.warn("Video feed error or initializing...", e);
            }}
          />
          <div className="scanline"></div>

          {/* Switching Overlay */}
          {isSwitching && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-background/20 backdrop-blur-xl animate-in fade-in duration-300">
              <div className="relative">
                <RefreshCcw className="w-12 h-12 text-primary animate-spin opacity-40" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-2 h-2 bg-primary rounded-full animate-ping"></div>
                </div>
              </div>
              <p className="mt-4 font-mono text-[10px] font-black uppercase tracking-[0.4em] text-primary animate-pulse">Establishing Secure Link...</p>
              <p className="mt-1 text-[8px] font-mono text-on-surface-variant opacity-40 uppercase tracking-widest italic">Synchronizing RTSP Stream - {currentCam}</p>
            </div>
          )}
        </>
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center bg-surface-low/30 backdrop-blur-sm relative">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(218,226,253,0.03)_0%,transparent_70%)]"></div>
          <div className="p-6 bg-on-surface/5 rounded-full mb-6 border border-on-surface/5 shadow-inner relative group-hover:border-primary/20 transition-colors">
            <Camera className="w-12 h-12 text-on-surface/20 group-hover:text-primary/30 transition-colors" />
          </div>
          <h3 className="font-mono text-xs font-black uppercase tracking-[0.4em] text-on-surface/40 mb-2">Link Standby</h3>
          <div className="flex items-center gap-3">
            <div className="w-8 h-px bg-on-surface/10"></div>
            <p className="font-mono text-[8px] uppercase tracking-[0.2em] text-on-surface/20 italic">Awaiting secure handshake...</p>
            <div className="w-8 h-px bg-on-surface/10"></div>
          </div>

          {/* Visual interface elements */}
          <div className="absolute top-8 left-8 flex flex-col gap-1.5 opacity-20">
            <div className="w-12 h-0.5 bg-on-surface/30"></div>
            <div className="w-8 h-0.5 bg-on-surface/30"></div>
          </div>
        </div>
      )}

      {/* HUD Overlay */}
      <div className="absolute inset-0 pointer-events-none p-6 flex flex-col justify-between">
        <div className="flex justify-between items-start">
          <div className={`flex items-center gap-2 px-3 py-1.5 backdrop-blur-md rounded text-background text-[10px] font-bold uppercase tracking-widest ${isCamOn ? 'bg-secondary/80 animate-pulse' : 'bg-on-surface-variant/50'}`}>
            <div className={`w-2 h-2 rounded-full ${isCamOn ? 'bg-background' : 'bg-on-surface/30'}`}></div> {isCamOn ? 'Live Stream Active' : 'Interlink Standby'}
          </div>
        </div>
        <div className="flex justify-between items-end">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-mono text-primary opacity-50 uppercase tracking-widest">Security Protocol</span>
            <span className="text-xs font-bold text-background bg-primary px-2 py-0.5 rounded">AX-700 ENABLED</span>
          </div>
        </div>
      </div>

      {/* Corner Markers */}
      <div className="absolute top-4 left-4 w-6 h-6 border-t border-l border-primary/40"></div>
      <div className="absolute top-4 right-4 w-6 h-6 border-t border-r border-primary/40"></div>
      <div className="absolute bottom-4 left-4 w-6 h-6 border-b border-l border-primary/40"></div>
      <div className="absolute bottom-4 right-4 w-6 h-6 border-b border-r border-primary/40"></div>
    </div>

    <div className="flex gap-4">
      <button onClick={onManualCapture} disabled={!isCamOn} className={`flex-1 flex items-center justify-center gap-3 py-4 rounded-md border border-on-surface/5 transition-all font-bold uppercase tracking-widest text-[10px] ${isCamOn ? 'bg-surface hover:border-primary/30 cursor-pointer text-on-surface' : 'bg-surface-variant/20 opacity-50 cursor-not-allowed text-on-surface-variant'}`}>
        <Camera className={`w-4 h-4 ${isCamOn ? 'text-primary' : 'text-on-surface-variant'}`} /> Manual Capture
      </button>
      <button
        onClick={onBroadcast}
        disabled={!isCamOn}
        className={`flex-1 flex items-center justify-center gap-3 py-4 rounded-md border border-on-surface/5 transition-all font-bold uppercase tracking-widest text-[10px] ${isCamOn ? 'bg-surface hover:border-error/30 text-on-surface' : 'bg-surface-variant/20 opacity-50 cursor-not-allowed text-on-surface-variant'}`}
      >
        <AlertCircle className={`w-4 h-4 ${isCamOn ? 'text-error animate-pulse' : 'text-on-surface-variant'}`} /> Broadcast Alert
      </button>
    </div>
  </div>
);

export default CameraViewport;
