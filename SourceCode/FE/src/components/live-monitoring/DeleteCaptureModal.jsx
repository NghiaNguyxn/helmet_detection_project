import React from 'react';
import { Trash2 } from 'lucide-react';

const DeleteCaptureModal = ({ show, onCancel, onConfirm }) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="w-full max-w-sm bg-surface border border-error/20 rounded-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
        <div className="p-6 text-center">
          <div className="w-16 h-16 rounded-full bg-error/10 flex items-center justify-center border border-error/20 mx-auto mb-4">
            <Trash2 className="w-8 h-8 text-error" />
          </div>
          <h3 className="text-lg font-bold text-on-surface uppercase tracking-tight mb-2">Delete Intelligence?</h3>
          <p className="text-sm text-on-surface-variant mb-6">
            Are you sure you want to permanently remove this violation record from the secure database?
          </p>

          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 py-3 bg-surface-highest hover:bg-on-surface/10 text-on-surface font-bold rounded-md transition-all text-[10px] uppercase tracking-[0.2em]"
            >
              Keep
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 py-3 bg-error text-background hover:bg-error/90 font-bold rounded-md transition-all text-[10px] uppercase tracking-[0.2em]"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeleteCaptureModal;
