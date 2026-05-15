export const STATUS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'rejected', label: 'Rejected' },
];

export const REJECTION_REASON_OPTIONS = [
  { value: 'false_positive', label: 'False Positive' },
  { value: 'helmet_detected_incorrectly', label: 'Helmet Detected Incorrectly' },
  { value: 'person_not_riding_motorcycle', label: 'Not Riding Motorcycle' },
  { value: 'image_too_blurry', label: 'Image Too Blurry' },
  { value: 'duplicate_violation', label: 'Duplicate Violation' },
  { value: 'other', label: 'Other' },
];

export const getViolationId = (violation) => violation?.id || violation?._id;
export const getViolationStatus = (violation) => violation?.status || 'confirmed';

export const statusMeta = {
  pending: {
    label: 'Pending Review',
    className: 'bg-primary/10 text-primary border-primary/25'
  },
  confirmed: {
    label: 'Confirmed',
    className: 'bg-secondary/10 text-secondary border-secondary/25'
  },
  rejected: {
    label: 'Rejected',
    className: 'bg-error/10 text-error border-error/25'
  }
};

export const formatReason = (reason) => {
  const option = REJECTION_REASON_OPTIONS.find(item => item.value === reason);
  return option?.label || 'N/A';
};

export const matchesStatusFilter = (violation, statusFilter) => (
  statusFilter === 'all' || getViolationStatus(violation) === statusFilter
);
