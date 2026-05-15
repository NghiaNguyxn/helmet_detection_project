import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown } from 'lucide-react';

const CustomDropdown = ({ 
  options, 
  value, 
  onChange, 
  icon: Icon, 
  labelPrefix = "Range", 
  headerText = "Actions",
  width = "w-48",
  align = "right",
  compact = false,
  containerClassName = "",
  buttonClassName = "",
  menuClassName = "overflow-hidden",
  showLabelPrefix = true,
  optionClassName = ""
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(o => o.value === value);

  return (
    <div className={`relative ${containerClassName}`} ref={dropdownRef}>
      <button 
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-3 bg-surface border border-on-surface/10 rounded-md hover:border-primary/50 transition-all tech-glow group cursor-pointer ${compact ? 'px-3 py-2' : 'px-6 py-3'} ${buttonClassName}`}
      >
        {Icon && <Icon className="w-4 h-4 text-primary group-hover:scale-110 transition-transform" />}
        <span className={`${compact ? 'text-[9px]' : 'text-[10px]'} min-w-0 items-center font-mono uppercase tracking-widest text-on-surface truncate`}>
          {showLabelPrefix && `${labelPrefix}:`}
          <span className={`text-primary font-bold ${showLabelPrefix ? 'ml-1' : ''}`}>{selectedOption?.label}</span>
        </span>
        <ChevronDown className={`${compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} text-on-surface-variant transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} top-full mt-2 ${width} bg-surface-low border border-on-surface/10 rounded-md shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-200 ${menuClassName}`}>
          <div className="px-4 py-2 bg-surface-medium border-b border-on-surface/5 flex justify-end">
            <span className="text-[8px] font-mono text-on-surface-variant uppercase tracking-widest opacity-50">{headerText}</span>
          </div>
          <div className="py-1">
            {options.map((opt) => (
              <button
                type="button"
                key={opt.value}
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-4 py-3 text-[10px] font-bold uppercase font-mono transition-all text-left ${optionClassName} ${
                  value === opt.value 
                  ? 'bg-primary/10 text-primary' 
                  : 'text-on-surface hover:bg-surface-medium hover:text-primary transition-colors'
                }`}
              >
                {opt.label}
                {value === opt.value && (
                  <div className="w-1 h-1 bg-primary rounded-full shadow-[0_0_8px_rgba(var(--primary-rgb),0.8)]"></div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomDropdown;
