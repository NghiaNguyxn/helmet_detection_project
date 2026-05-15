import React from 'react';
import { getViolationStatus, statusMeta } from './violationReview';

const ViolationStatusBadge = ({ violation }) => {
  const violationStatus = getViolationStatus(violation);
  const meta = statusMeta[violationStatus] || statusMeta.confirmed;

  return (
    <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-sm text-[9px] font-bold uppercase tracking-widest border whitespace-nowrap ${meta.className}`}>
      {meta.label}
    </span>
  );
};

export default ViolationStatusBadge;
