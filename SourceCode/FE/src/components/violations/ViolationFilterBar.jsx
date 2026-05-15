import React from 'react';
import { Minus, Plus } from 'lucide-react';
import CustomDropdown from '../CustomDropdown';
import DatePickerField from './DatePickerField';
import { STATUS_OPTIONS } from './violationReview';

const ViolationFilterBar = ({
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  minViolations,
  setMinViolations,
  onlyViolations,
  setOnlyViolations,
  statusFilter,
  setStatusFilter,
  setPage,
  onReset,
}) => (
  <div className="surface-1 border border-on-surface/5 p-4 rounded-md tech-glow">
    <div className="flex flex-wrap items-end gap-4">
      <div className="space-y-1.5 flex-1 min-w-[180px]">
        <label className="text-[9px] font-mono uppercase text-on-surface-variant tracking-widest pl-1">Date Range</label>
        <div className="flex items-center gap-2">
          <DatePickerField
            value={startDate}
            onChange={(value) => {
              setStartDate(value);
              setPage(1);
            }}
            placeholder="Start MM-DD-YYYY"
            maxDate={endDate || undefined}
          />
          <span className="text-on-surface/30 text-[10px] font-mono uppercase tracking-widest">to</span>
          <DatePickerField
            value={endDate}
            onChange={(value) => {
              setEndDate(value);
              setPage(1);
            }}
            placeholder="End MM-DD-YYYY"
            minDate={startDate || undefined}
          />
        </div>
      </div>

      <div className="space-y-1.5 w-40">
        <label className="text-[9px] font-mono uppercase text-on-surface-variant tracking-widest pl-1">Min Violations</label>
        <div className="custom-number-input">
          <button
            type="button"
            onClick={() => {
              setMinViolations(Math.max(0, minViolations - 1));
              setPage(1);
            }}
            className="custom-number-btn"
          >
            <Minus className="w-3 h-3" />
          </button>
          <input
            type="number"
            min="0"
            value={minViolations}
            onChange={(e) => {
              setMinViolations(Math.max(0, parseInt(e.target.value) || 0));
              setPage(1);
            }}
            placeholder="0"
            className="text-center"
          />
          <button
            type="button"
            onClick={() => {
              setMinViolations(minViolations + 1);
              setPage(1);
            }}
            className="custom-number-btn"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-[9px] font-mono uppercase text-on-surface-variant tracking-widest pl-1">Review Status</label>
        <CustomDropdown
          options={STATUS_OPTIONS}
          value={statusFilter}
          onChange={(val) => {
            setStatusFilter(val);
            setPage(1);
          }}
          labelPrefix="Status"
          headerText="Review Status"
          align="left"
          width="w-44"
          compact
        />
      </div>

      <div className="flex items-center gap-2 py-2 px-2">
        <div className="relative flex items-center justify-center">
          <input
            type="checkbox"
            id="onlyViolations"
            checked={onlyViolations}
            onChange={(e) => {
              setOnlyViolations(e.target.checked);
              setPage(1);
            }}
            className="w-4 h-4 rounded appearance-none border border-on-surface/30 bg-surface checked:bg-primary checked:border-primary focus:outline-none focus:ring-1 focus:ring-primary/50 cursor-pointer transition-colors peer"
          />
          <svg className="w-3 h-3 text-background absolute pointer-events-none opacity-0 peer-checked:opacity-100 transition-opacity" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M11.6666 3.5L5.24992 9.91667L2.33325 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <label htmlFor="onlyViolations" className="text-[10px] font-mono uppercase text-on-surface-variant tracking-widest cursor-pointer select-none">
          Without Helmet Only
        </label>
      </div>

      <div className="flex items-center gap-2 ml-auto">
        <button
          type="button"
          onClick={onReset}
          className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant hover:text-on-surface transition-all"
        >
          Clear
        </button>
      </div>
    </div>
  </div>
);

export default ViolationFilterBar;
