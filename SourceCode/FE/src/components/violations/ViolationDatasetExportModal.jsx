import React, { useState } from 'react';
import { Database, FileArchive, Image, X } from 'lucide-react';
import CustomDropdown from '../CustomDropdown';
import { REJECTION_REASON_OPTIONS } from './violationReview';

const DATASET_STATUS_OPTIONS = [
  { value: 'all', label: 'All Reviewed' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'rejected', label: 'Rejected' },
];

const DATASET_REASON_OPTIONS = [
  { value: 'all', label: 'All Reasons' },
  ...REJECTION_REASON_OPTIONS,
];

const normalizeLimit = (value) => {
  const parsedValue = parseInt(value, 10);
  if (!Number.isFinite(parsedValue)) return 500;
  return Math.min(2000, Math.max(1, parsedValue));
};

const ViolationDatasetExportModal = ({
  show,
  startDate,
  endDate,
  isExporting,
  onClose,
  onSubmit,
}) => {
  const [datasetStatus, setDatasetStatus] = useState('all');
  const [rejectionReason, setRejectionReason] = useState('all');
  const [includeImages, setIncludeImages] = useState(true);
  const [exportLimit, setExportLimit] = useState('500');

  if (!show) return null;

  const handleStatusChange = (nextStatus) => {
    setDatasetStatus(nextStatus);
    if (nextStatus === 'confirmed') {
      setRejectionReason('all');
    }
  };

  const handleSubmit = () => {
    const normalizedLimit = normalizeLimit(exportLimit);
    setExportLimit(String(normalizedLimit));

    onSubmit({
      status: datasetStatus,
      rejectionReason,
      includeImages,
      limit: normalizedLimit,
    });
  };

  const commitLimit = () => {
    setExportLimit(String(normalizeLimit(exportLimit)));
  };

  return (
    <div className="fixed inset-0 w-screen h-screen z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/90 backdrop-blur-md" onClick={onClose}></div>

      <div className="dataset-export-modal-content relative w-full max-w-xl surface-1 border border-on-surface/10 rounded-lg p-6 tech-glow animate-in zoom-in-95 duration-200">
        <div className="flex items-start justify-between gap-4 border-b border-on-surface/10 pb-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-primary/10 border border-primary/20 rounded-md">
              <Database className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-on-surface uppercase font-mono tracking-widest">
                AI Feedback Dataset
              </h2>
              <p className="text-[10px] text-on-surface-variant font-mono uppercase tracking-widest mt-1">
                Reviewed confirmed/rejected records only
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isExporting}
            className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface rounded-md transition-all disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-5 py-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[9px] font-mono uppercase text-on-surface-variant tracking-widest">Feedback Status</label>
              <CustomDropdown
                options={DATASET_STATUS_OPTIONS}
                value={datasetStatus}
                onChange={handleStatusChange}
                labelPrefix="Status"
                headerText="Dataset Status"
                align="left"
                width="w-full"
                containerClassName="w-full"
                buttonClassName="w-full justify-between"
                compact
              />
            </div>

            <div className="space-y-2">
              <label className="text-[9px] font-mono uppercase text-on-surface-variant tracking-widest">Rejected Reason</label>
              {datasetStatus === 'confirmed' ? (
                <div className="h-[38px] flex items-center px-3 bg-surface/60 border border-on-surface/5 rounded-md text-[9px] font-mono uppercase tracking-widest text-on-surface-variant/50">
                  Not used for confirmed data
                </div>
              ) : (
                <CustomDropdown
                  options={DATASET_REASON_OPTIONS}
                  value={rejectionReason}
                  onChange={setRejectionReason}
                  labelPrefix="Reason"
                  headerText="Rejection Reason"
                  align="left"
                  width="w-full"
                  containerClassName="w-full"
                  buttonClassName="w-full justify-between"
                  menuClassName="max-h-64 overflow-y-auto"
                  compact
                />
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[9px] font-mono uppercase text-on-surface-variant tracking-widest">Record Limit</label>
              <input
                type="number"
                min="1"
                max="2000"
                value={exportLimit}
                onChange={(event) => setExportLimit(event.target.value)}
                onBlur={commitLimit}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.currentTarget.blur();
                  }
                }}
                className="w-full bg-surface border border-on-surface/10 rounded-md px-3 py-3 text-xs font-mono text-on-surface outline-none focus:border-primary/50 transition-all"
              />
              <p className="text-[8px] font-mono uppercase tracking-widest text-on-surface-variant/50">Max 2000 records</p>
            </div>

            <div className="space-y-2">
              <label className="text-[9px] font-mono uppercase text-on-surface-variant tracking-widest">Evidence Images</label>
              <button
                type="button"
                onClick={() => setIncludeImages(!includeImages)}
                className={`w-full h-[42px] flex items-center justify-between px-3 border rounded-md transition-all ${
                  includeImages
                    ? 'bg-primary/10 border-primary/30 text-primary'
                    : 'bg-surface border-on-surface/10 text-on-surface-variant'
                }`}
              >
                <span className="flex items-center gap-2 text-[10px] font-mono font-bold uppercase tracking-widest">
                  <Image className="w-4 h-4" />
                  {includeImages ? 'Included' : 'Manifest Only'}
                </span>
                <span className={`w-8 h-4 rounded-full p-0.5 transition-all ${includeImages ? 'bg-primary' : 'bg-on-surface/20'}`}>
                  <span className={`block w-3 h-3 rounded-full bg-background transition-transform ${includeImages ? 'translate-x-4' : 'translate-x-0'}`}></span>
                </span>
              </button>
            </div>
          </div>

          <div className="rounded-md border border-on-surface/5 bg-surface/50 p-4">
            <p className="text-[9px] font-mono uppercase tracking-widest text-on-surface-variant leading-relaxed">
              Date range uses the current Violation History filter:
              <span className="text-primary font-bold ml-1">{startDate || 'Any start'}</span>
              <span className="mx-1 text-on-surface-variant/50">to</span>
              <span className="text-primary font-bold">{endDate || 'Any end'}</span>.
              Pending records are always excluded.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={onClose}
            disabled={isExporting}
            className="flex-1 py-3 bg-surface border border-on-surface/10 text-on-surface-variant font-bold uppercase tracking-widest text-[10px] rounded-md hover:border-on-surface/20 transition-all disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isExporting}
            className="flex-1 py-3 bg-primary text-background font-bold uppercase tracking-widest text-[10px] rounded-md transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed primary-glow"
          >
            {isExporting ? (
              <span className="w-4 h-4 border-2 border-background/30 border-t-background rounded-full animate-spin"></span>
            ) : (
              <FileArchive className="w-4 h-4" />
            )}
            Export ZIP
          </button>
        </div>
      </div>
    </div>
  );
};

export default ViolationDatasetExportModal;
