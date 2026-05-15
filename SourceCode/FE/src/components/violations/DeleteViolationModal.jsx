import React from 'react';
import { AlertTriangle } from 'lucide-react';

const DeleteViolationModal = ({ deleteConfirmId, isDeleting, onCancel, onConfirm }) => {
  if (!deleteConfirmId) return null;

  return (
    <div className="fixed inset-0 w-screen h-screen z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/90 backdrop-blur-md" onClick={onCancel}></div>
      <div className="delete-modal-content relative w-full max-w-sm surface-1 border border-error/20 rounded-lg p-8 tech-glow animate-in zoom-in-95 duration-200 text-center">
        <div className="w-16 h-16 bg-error/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-error/20">
          <AlertTriangle className="w-8 h-8 text-error" />
        </div>
        <h2 className="text-xl font-bold text-on-surface uppercase font-mono tracking-widest">Delete Record</h2>
        <p className="text-[10px] text-on-surface-variant font-mono uppercase tracking-widest mt-1">Confirm deletion</p>
        <p className="text-sm text-on-surface-variant my-8 leading-relaxed">
          Are you sure you want to delete this violation record? This action cannot be undone.
        </p>
        <div className="flex gap-4">
          <button
            onClick={onCancel}
            className="flex-1 py-3 bg-surface border border-on-surface/10 text-on-surface-variant font-bold uppercase tracking-widest text-[10px] rounded-md hover:border-on-surface/20 transition-all"
          >
            Abort
          </button>
          <button
            onClick={() => onConfirm(deleteConfirmId)}
            className="flex-1 py-3 bg-error text-background font-bold uppercase tracking-widest text-[10px] rounded-md primary-glow hover:bg-error/90 transition-all flex items-center justify-center gap-2"
          >
            {isDeleting === deleteConfirmId ? (
              <span className="w-4 h-4 border-2 border-background/30 border-t-background rounded-full animate-spin"></span>
            ) : null}
            Confirm Delete
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteViolationModal;
