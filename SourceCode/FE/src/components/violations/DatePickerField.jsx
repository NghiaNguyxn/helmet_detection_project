import React, { useEffect, useRef, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';
import CustomDropdown from '../CustomDropdown';

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_OPTIONS = MONTHS.map((monthLabel, index) => ({ value: index, label: monthLabel }));

const pad = (value) => value.toString().padStart(2, '0');
const toDateValue = (year, month, day) => `${year}-${pad(month + 1)}-${pad(day)}`;
const toDisplayDateValue = (value) => {
  const date = parseDateValue(value);
  if (!date) return '';
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${date.getFullYear()}`;
};

const parseDateValue = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return null;

  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(year, month - 1, day);

  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }

  return parsed;
};

const parseInputDateValue = (value) => {
  const trimmedValue = value.trim();
  const displayMatch = trimmedValue.match(/^(\d{2})-(\d{2})-(\d{4})$/);

  if (displayMatch) {
    const [, month, day, year] = displayMatch;
    const internalValue = `${year}-${month}-${day}`;
    return parseDateValue(internalValue) ? internalValue : null;
  }

  return parseDateValue(trimmedValue) ? trimmedValue : null;
};

const validateInputDateValue = (nextValue, minDate, maxDate) => {
  if (!nextValue) return '';
  const internalValue = parseInputDateValue(nextValue);
  if (!internalValue) return 'Use MM-DD-YYYY';
  if (minDate && internalValue < minDate) return `After ${toDisplayDateValue(minDate)}`;
  if (maxDate && internalValue > maxDate) return `Before ${toDisplayDateValue(maxDate)}`;
  return '';
};

const buildYearOptions = (visibleYear) => {
  const currentYear = new Date().getFullYear();
  const startYear = Math.min(2000, visibleYear);
  const endYear = Math.max(currentYear + 1, visibleYear);

  return Array.from({ length: endYear - startYear + 1 }, (_, index) => startYear + index);
};

const DatePickerField = ({ value, onChange, placeholder = 'Select date', minDate, maxDate }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [draftValue, setDraftValue] = useState('');
  const [error, setError] = useState('');
  const [viewDate, setViewDate] = useState(() => parseDateValue(value) || new Date());
  const pickerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const selectedDate = parseDateValue(value);
  const today = new Date();
  const todayValue = toDateValue(today.getFullYear(), today.getMonth(), today.getDate());
  const yearOptions = buildYearOptions(year);
  const yearDropdownOptions = yearOptions.map((yearOption) => ({ value: yearOption, label: yearOption.toString() }));
  const displayedValue = isEditing ? draftValue : toDisplayDateValue(value);
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  const isOutOfRange = (nextValue) => (minDate && nextValue < minDate) || (maxDate && nextValue > maxDate);

  const commitValue = (nextValue) => {
    const normalizedValue = nextValue.trim();
    const nextError = validateInputDateValue(normalizedValue, minDate, maxDate);

    if (nextError) {
      setError(nextError);
      return false;
    }

    const internalValue = parseInputDateValue(normalizedValue) || '';
    const parsed = parseDateValue(internalValue);
    if (parsed) setViewDate(parsed);

    onChange(internalValue);
    setError('');
    setIsEditing(false);
    setDraftValue('');
    return true;
  };

  const selectDateValue = (nextValue) => {
    if (isOutOfRange(nextValue)) return;

    const parsed = parseDateValue(nextValue);
    if (parsed) setViewDate(parsed);

    onChange(nextValue);
    setIsEditing(false);
    setDraftValue('');
    setError('');
    setIsOpen(false);
  };

  const clearValue = () => {
    onChange('');
    setIsEditing(false);
    setDraftValue('');
    setError('');
  };

  const moveMonth = (offset) => {
    setViewDate(new Date(year, month + offset, 1));
  };

  const openPicker = () => {
    const selected = parseDateValue(value);
    if (selected) setViewDate(selected);
    setIsOpen(!isOpen);
  };

  return (
    <div className="relative flex-1 min-w-[170px]" ref={pickerRef}>
      <div className={`flex items-center bg-surface border rounded-md transition-all tech-glow ${
        error
          ? 'border-error/60'
          : isOpen
            ? 'border-primary/50'
            : 'border-on-surface/10 hover:border-primary/50'
      }`}>
        <button
          type="button"
          onClick={openPicker}
          className="pl-3 pr-2 py-2 text-primary hover:text-primary-variant transition-colors"
          title="Open calendar"
        >
          <Calendar className="w-3.5 h-3.5" />
        </button>

        <input
          type="text"
          inputMode="numeric"
          value={displayedValue}
          onFocus={() => {
            setIsEditing(true);
            setDraftValue(toDisplayDateValue(value));
            setError('');
          }}
          onChange={(event) => {
            setIsEditing(true);
            setDraftValue(event.target.value);
            if (!event.target.value) setError('');
          }}
          onBlur={() => {
            if (isEditing) commitValue(draftValue);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.currentTarget.blur();
            }

            if (event.key === 'Escape') {
              setIsEditing(false);
              setDraftValue('');
              setError('');
              event.currentTarget.blur();
            }
          }}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent py-2 pl-1 text-[9px] font-mono uppercase tracking-widest text-on-surface placeholder:text-on-surface-variant/50 outline-none"
        />

        {(value || isEditing) && (
          <button
            type="button"
            onClick={clearValue}
            className="p-2 mr-1 text-on-surface-variant hover:text-error transition-colors"
            title="Clear date"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {error && !isOpen && (
        <p className="absolute left-1 top-full mt-1 text-[8px] font-mono uppercase tracking-widest text-error">
          {error}
        </p>
      )}

      {isOpen && (
        <div className="absolute left-0 top-full mt-2 w-full bg-surface-low border border-on-surface/10 rounded-md shadow-2xl z-50 overflow-visible animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center gap-1.5 px-2 py-2 bg-surface-medium border-b border-on-surface/5">
            <button
              type="button"
              onClick={() => moveMonth(-1)}
              className="p-1.5 text-on-surface-variant hover:text-primary hover:bg-surface rounded transition-all"
              title="Previous month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <CustomDropdown
              options={MONTH_OPTIONS}
              value={month}
              onChange={(nextMonth) => setViewDate(new Date(year, Number(nextMonth), 1))}
              labelPrefix="M"
              headerText="Month"
              align="left"
              width="w-full"
              compact
              containerClassName="flex-1 min-w-0"
              buttonClassName="w-full justify-between gap-1 px-2 py-1.5 !shadow-none"
              menuClassName="max-h-44 overflow-y-auto"
              showLabelPrefix={false}
              optionClassName="px-3 py-2"
            />

            <CustomDropdown
              options={yearDropdownOptions}
              value={year}
              onChange={(nextYear) => setViewDate(new Date(Number(nextYear), month, 1))}
              labelPrefix="Y"
              headerText="Year"
              align="left"
              width="w-full"
              compact
              containerClassName="flex-1 min-w-0"
              buttonClassName="w-full justify-between gap-1 px-2 py-1.5 !shadow-none"
              menuClassName="max-h-44 overflow-y-auto"
              showLabelPrefix={false}
              optionClassName="px-3 py-2"
            />

            <button
              type="button"
              onClick={() => moveMonth(1)}
              className="p-1.5 text-on-surface-variant hover:text-primary hover:bg-surface rounded transition-all"
              title="Next month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="p-2.5 bg-surface-low rounded-b-md overflow-hidden">
            <div className="grid grid-cols-7 gap-1 mb-2">
              {WEEKDAYS.map((day) => (
                <div key={day} className="h-6 flex items-center justify-center text-[8px] font-mono font-bold uppercase text-on-surface-variant/50">
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {cells.map((day, index) => {
                if (!day) return <div key={`empty-${index}`} className="h-8" />;

                const dateValue = toDateValue(year, month, day);
                const isSelected = selectedDate && value === dateValue;
                const isToday = dateValue === todayValue;
                const isDisabled = isOutOfRange(dateValue);

                return (
                  <button
                    type="button"
                    key={dateValue}
                    onClick={() => selectDateValue(dateValue)}
                    disabled={isDisabled}
                    className={`h-7 rounded text-[9px] font-mono font-bold transition-all ${
                      isSelected
                        ? 'bg-primary text-background shadow-[0_0_12px_rgba(var(--primary-rgb),0.35)]'
                        : isDisabled
                          ? 'text-on-surface/15 cursor-not-allowed'
                          : isToday
                            ? 'text-primary border border-primary/30 hover:bg-primary/10'
                            : 'text-on-surface hover:bg-surface-medium hover:text-primary'
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between gap-2 pt-3 mt-3 border-t border-on-surface/5">
              <button
                type="button"
                onClick={() => selectDateValue(todayValue)}
                disabled={isOutOfRange(todayValue)}
                className="px-3 py-2 text-[9px] font-mono font-bold uppercase tracking-widest text-primary hover:bg-primary/10 rounded transition-all disabled:text-on-surface/20 disabled:hover:bg-transparent disabled:cursor-not-allowed"
              >
                Today
              </button>
              <button
                type="button"
                onClick={clearValue}
                className="px-3 py-2 text-[9px] font-mono font-bold uppercase tracking-widest text-on-surface-variant hover:text-error hover:bg-error/10 rounded transition-all"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DatePickerField;
