import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import CustomDropdown from '../CustomDropdown';

const ViolationPagination = ({ page, limit, total, setPage, setLimit }) => (
  <div className="p-4 bg-surface-low border-t border-on-surface/5 flex flex-col md:flex-row items-center justify-between gap-4">
    <div className="flex items-center gap-4">
      <span className="text-[10px] text-on-surface-variant font-mono uppercase tracking-[0.2em] opacity-60">
        Records Display:
      </span>
      <CustomDropdown
        options={[
          { value: 10, label: '10 Records' },
          { value: 25, label: '25 Records' },
          { value: 50, label: '50 Records' },
          { value: 100, label: '100 Records' },
        ]}
        value={limit}
        onChange={(val) => {
          setLimit(val);
          setPage(1);
        }}
        labelPrefix="Showing"
        headerText="Table Limit"
        align="left"
        width="w-40"
      />
    </div>

    <div className="flex items-center gap-2">
      <button
        onClick={() => setPage(Math.max(1, page - 1))}
        disabled={page === 1}
        className="p-2 border border-on-surface/10 rounded-md hover:bg-surface transition-all disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      <div className="flex items-center gap-1 mx-2">
        {[...Array(Math.ceil(total / limit))].map((_, i) => {
          const pNum = i + 1;
          if (
            pNum === 1 ||
            pNum === Math.ceil(total / limit) ||
            (pNum >= page - 1 && pNum <= page + 1)
          ) {
            return (
              <button
                key={pNum}
                onClick={() => setPage(pNum)}
                className={`w-8 h-8 rounded text-[10px] font-bold transition-all ${page === pNum
                  ? 'bg-primary text-background shadow-lg shadow-primary/20'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface'
                  }`}
              >
                {pNum}
              </button>
            );
          }
          if (pNum === page - 2 || pNum === page + 2) {
            return <span key={pNum} className="text-on-surface-variant opacity-30 text-[10px] px-1 font-mono">...</span>;
          }
          return null;
        })}
      </div>

      <button
        onClick={() => setPage(Math.min(Math.ceil(total / limit), page + 1))}
        disabled={page >= Math.ceil(total / limit)}
        className="p-2 border border-on-surface/10 rounded-md hover:bg-surface transition-all disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  </div>
);

export default ViolationPagination;
