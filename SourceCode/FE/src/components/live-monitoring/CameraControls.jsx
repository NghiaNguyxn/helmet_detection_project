import React from 'react';
import { Camera, RefreshCcw } from 'lucide-react';

const CameraControls = ({ isCamOn, isToggling, onToggleCamera, onForceReset }) => (
  <div className="flex gap-2">
    <button
      onClick={onForceReset}
      title="Force Reset Camera (Use if stuck)"
      className="p-2.5 bg-surface-low hover:bg-error/10 border border-on-surface/10 rounded-md transition-all text-on-surface-variant hover:text-error"
    >
      <RefreshCcw className="w-4 h-4" />
    </button>
    <button
      onClick={onToggleCamera}
      disabled={isToggling}
      className={`flex items-center gap-2 px-6 py-2.5 font-bold rounded-md text-[10px] uppercase tracking-widest transition-all ${isToggling ? 'opacity-50 cursor-not-allowed bg-surface-variant text-on-surface-variant' :
        isCamOn ? 'bg-error text-background shadow-[0_0_20px_rgba(var(--error-rgb),0.3)]' : 'bg-primary text-background shadow-[0_0_20px_rgba(var(--primary-rgb),0.3)]'
        }`}
    >
      {isToggling ? (
        <><RefreshCcw className="w-4 h-4 animate-spin" /> Processing...</>
      ) : (
        <><Camera className="w-4 h-4" /> {isCamOn ? "Deactivate Camera" : "Activate Camera"}</>
      )}
    </button>
  </div>
);

export default CameraControls;
