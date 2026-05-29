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
  statusFilter,
  setStatusFilter,
  cameraFilter,
  setCameraFilter,
  cameraOptions,
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

      <div className="space-y-1.5 w-28">
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

      <div className="space-y-1.5">
        <label className="text-[9px] font-mono uppercase text-on-surface-variant tracking-widest pl-1">Camera</label>
        <CustomDropdown
          options={cameraOptions}
          value={cameraFilter}
          onChange={(val) => {
            setCameraFilter(val);
            setPage(1);
          }}
          labelPrefix="Camera"
          headerText="Camera Filter"
          align="left"
          width="w-46"
          buttonClassName="w-46 justify-between"
          menuClassName="max-h-72 overflow-y-auto"
          compact
        />
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
