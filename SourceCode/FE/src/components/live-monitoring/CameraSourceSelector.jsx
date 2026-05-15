import React from 'react';

const CameraSourceSelector = ({ isCamOn, cameraSources, currentCam, isSwitching, onSwitchCamera }) => {
  if (!isCamOn || cameraSources.length <= 1) return null;

  return (
    <div className="flex gap-1.5 ml-2 p-1 bg-surface-highest/30 backdrop-blur-md rounded border border-on-surface/5">
      {cameraSources.map(source => (
        <button
          key={source}
          onClick={() => onSwitchCamera(source)}
          disabled={isSwitching}
          className={`px-2 py-0.5 rounded text-[8px] font-mono font-bold transition-all ${currentCam === source ? 'bg-primary text-background' : 'text-on-surface-variant hover:bg-on-surface/10'}`}
        >
          {source}
        </button>
      ))}
    </div>
  );
};

export default CameraSourceSelector;
