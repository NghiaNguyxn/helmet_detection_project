import React from 'react';

const CameraSourceSelector = ({ isCamOn, cameraSources, currentCam, isSwitching, onSwitchCamera }) => {
  if (!isCamOn || cameraSources.length <= 1) return null;

  const getCode = (source) => (typeof source === 'string' ? source : source.code);
  const getLabel = (source) => {
    if (typeof source === 'string') return source;
    return source.name ? `${source.code} · ${source.name}` : source.code;
  };

  return (
    <div className="flex gap-1.5 ml-2 p-1 bg-surface-highest/30 backdrop-blur-md rounded border border-on-surface/5">
      {cameraSources.map(source => (
        <button
          key={getCode(source)}
          onClick={() => onSwitchCamera(getCode(source))}
          disabled={isSwitching}
          title={typeof source === 'string' ? source : source.location || source.name || source.code}
          className={`px-2 py-0.5 rounded text-[8px] font-mono font-bold transition-all ${currentCam === getCode(source) ? 'bg-primary text-background' : 'text-on-surface-variant hover:bg-on-surface/10'}`}
        >
          {getLabel(source)}
        </button>
      ))}
    </div>
  );
};

export default CameraSourceSelector;
