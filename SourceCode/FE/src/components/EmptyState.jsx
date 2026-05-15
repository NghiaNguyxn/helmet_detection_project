import React from 'react';
import { Database } from 'lucide-react';

const EmptyState = ({ 
  icon = Database, 
  title = "No data found", 
  message = "We couldn't find any records matching your criteria.",
  className = "" 
}) => {
  const IconComponent = icon;

  return (
    <div className={`flex flex-col items-center justify-center p-12 text-center border border-dashed border-on-surface/10 rounded-xl bg-on-surface/2 ${className}`}>
      <div className="p-4 bg-on-surface/5 rounded-full mb-4">
        <IconComponent className="w-8 h-8 text-on-surface/20" />
      </div>
      <h3 className="text-lg font-bold text-on-surface/80 mb-1">{title}</h3>
      <p className="text-xs text-on-surface-variant max-w-[280px] leading-relaxed">
        {message}
      </p>
    </div>
  );
};

export default EmptyState;
