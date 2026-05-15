import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FileArchive, FileSpreadsheet } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';

import api from '../services/api';
import socketService from '../services/websocket';
import { useAuth } from '../context/AuthContext';
import DeleteViolationModal from '../components/violations/DeleteViolationModal';
import ViolationDatasetExportModal from '../components/violations/ViolationDatasetExportModal';
import ViolationEvidenceModal from '../components/violations/ViolationEvidenceModal';
import ViolationFilterBar from '../components/violations/ViolationFilterBar';
import ViolationPagination from '../components/violations/ViolationPagination';
import ViolationReviewModal from '../components/violations/ViolationReviewModal';
import ViolationTable from '../components/violations/ViolationTable';
import { getViolationId, matchesStatusFilter } from '../components/violations/violationReview';

const ViolationHistory = () => {
  const { user: currentUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlHighlightId = searchParams.get('id');

  const [violations, setViolations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);

  const [activeHighlightId, setActiveHighlightId] = useState(null);

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [minViolations, setMinViolations] = useState(0);
  const [onlyViolations, setOnlyViolations] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');

  const [sortBy, setSortBy] = useState('timestamp');
  const [order, setOrder] = useState('desc');

  const [selectedViolationIndex, setSelectedViolationIndex] = useState(null);
  const [isDeleting, setIsDeleting] = useState(null);
  const [activeMenuId, setActiveMenuId] = useState(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [reviewDialog, setReviewDialog] = useState(null);
  const [reviewNote, setReviewNote] = useState('');
  const [rejectionReason, setRejectionReason] = useState('false_positive');
  const [isReviewing, setIsReviewing] = useState(false);
  const [showDatasetExportModal, setShowDatasetExportModal] = useState(false);
  const [isExportingDataset, setIsExportingDataset] = useState(false);
  const menuRef = useRef(null);

  const patchViolationState = useCallback((reviewUpdate) => {
    setViolations(prev => {
      let removedByFilter = false;
      let matched = false;
      const next = prev
        .map(violation => {
          if (String(getViolationId(violation)) !== String(reviewUpdate.id)) return violation;
          matched = true;
          return { ...violation, ...reviewUpdate };
        })
        .filter(violation => {
          const isReviewedRecord = String(getViolationId(violation)) === String(reviewUpdate.id);
          const keep = !isReviewedRecord || matchesStatusFilter(violation, statusFilter);
          if (isReviewedRecord && !keep) removedByFilter = true;
          return keep;
        });

      if (matched && removedByFilter) {
        setTotal(currentTotal => Math.max(0, currentTotal - 1));
      }
      return next;
    });
  }, [statusFilter]);

  const fetchViolations = useCallback(async (targetPage = page) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: targetPage,
        limit,
        sort_by: sortBy,
        order
      });

      if (startDate) params.append('start_date', new Date(startDate).toISOString());
      if (endDate) params.append('end_date', new Date(endDate).toISOString());
      if (minViolations > 0) params.append('min_violations', minViolations);
      if (onlyViolations) params.append('only_violations', 'true');
      params.append('status', statusFilter);

      const response = await api.get(`/violations/?${params.toString()}`);
      if (response.data.code === 200) {
        setViolations(response.data.result.data);
        setTotal(response.data.result.total);
      }
    } catch (error) {
      console.error('Error fetching violations:', error);
      toast.error('Failed to load records');
    } finally {
      setLoading(false);
    }
  }, [endDate, limit, minViolations, onlyViolations, order, page, sortBy, startDate, statusFilter]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setActiveMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (urlHighlightId) {
      setActiveHighlightId(urlHighlightId);
    }
  }, [urlHighlightId]);

  useEffect(() => {
    const handleGlobalClick = (e) => {
      const isThumbnail = e.target.closest('.evidence-thumbnail');
      const isModal = e.target.closest('.violation-modal-content');
      const isDeleteModal = e.target.closest('.delete-modal-content');
      const isReviewModal = e.target.closest('.review-modal-content');
      const isDatasetModal = e.target.closest('.dataset-export-modal-content');
      const isModalBg = e.target.closest('.violation-modal-bg');

      if (!isThumbnail && !isModal && !isDeleteModal && !isReviewModal && !isDatasetModal && !isModalBg) {
        setActiveHighlightId(null);
        if (urlHighlightId) setSearchParams({});
      }
    };
    document.addEventListener('mousedown', handleGlobalClick);
    return () => document.removeEventListener('mousedown', handleGlobalClick);
  }, [urlHighlightId, setSearchParams]);

  useEffect(() => {
    fetchViolations();
  }, [fetchViolations]);

  useEffect(() => {
    const unsubscribe = socketService.subscribe((message) => {
      if (message.event === 'new_violation') {
        const newViolation = message.data;

        if (page === 1 && matchesStatusFilter(newViolation, statusFilter)) {
          setViolations(prev => {
            if (prev.some(v => getViolationId(v) === getViolationId(newViolation))) return prev;
            return [newViolation, ...prev.slice(0, limit - 1)];
          });
          setTotal(prev => prev + 1);
        }
      }

      if (message.event === 'review_violation') {
        patchViolationState(message.data);
      }
    });

    return () => unsubscribe();
  }, [page, limit, statusFilter, patchViolationState]);

  useEffect(() => {
    if (activeHighlightId && violations.length > 0) {
      const index = violations.findIndex(v => String(getViolationId(v)) === String(activeHighlightId));

      if (index !== -1) {
        if (urlHighlightId === activeHighlightId && selectedViolationIndex === null) {
          setSelectedViolationIndex(index);
        }

        setTimeout(() => {
          const element = document.getElementById(`violation-${activeHighlightId}`);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 500);
      }
    }
  }, [activeHighlightId, violations, loading, urlHighlightId, selectedViolationIndex]);

  useEffect(() => {
    if (selectedViolationIndex !== null && !violations[selectedViolationIndex]) {
      setSelectedViolationIndex(null);
    }
  }, [selectedViolationIndex, violations]);

  const handleResetFilter = () => {
    setStartDate('');
    setEndDate('');
    setMinViolations(0);
    setOnlyViolations(true);
    setStatusFilter('all');
    setPage(1);
  };

  const handleDownloadImage = async (imageUrl, id) => {
    const toastId = toast.loading('Preparing image for download...');
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const fileName = `Violation_${id || Date.now()}.jpg`;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('Image downloaded successfully', { id: toastId });
    } catch (error) {
      console.error('Download failed:', error);
      toast.error('Download failed. Opening in new tab...', { id: toastId });
      window.open(imageUrl, '_blank');
    }
  };

  const handleExportExcel = async () => {
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('start_date', new Date(startDate).toISOString());
      if (endDate) params.append('end_date', new Date(endDate).toISOString());
      if (minViolations > 0) params.append('min_violations', minViolations);
      if (onlyViolations) params.append('only_violations', 'true');
      params.append('status', statusFilter);

      const response = await api.get(`/violations/export?${params.toString()}`, {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Violation_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Report exported successfully');
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Export failed');
    }
  };

  const handleExportFeedbackDataset = async ({ status, rejectionReason, includeImages, limit }) => {
    setIsExportingDataset(true);
    try {
      const params = new URLSearchParams({
        status,
        rejection_reason: rejectionReason,
        include_images: includeImages ? 'true' : 'false',
        limit: String(limit)
      });

      if (startDate) params.append('start_date', new Date(startDate).toISOString());
      if (endDate) params.append('end_date', new Date(endDate).toISOString());

      const response = await api.get(`/violations/export-feedback-dataset?${params.toString()}`, {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `AI_Feedback_Dataset_${new Date().toISOString().split('T')[0]}.zip`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      setShowDatasetExportModal(false);
      toast.success('AI feedback dataset exported');
    } catch (error) {
      console.error('AI dataset export failed:', error);
      const detail = error.response?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : 'Dataset export failed');
    } finally {
      setIsExportingDataset(false);
    }
  };

  const handleDelete = async (id) => {
    setIsDeleting(id);
    try {
      const response = await api.delete(`/violations/${id}`);
      if (response.data.code === 200) {
        toast.success('Record deleted');
        fetchViolations();
      }
    } catch {
      toast.error('Could not delete record');
    } finally {
      setIsDeleting(null);
      setDeleteConfirmId(null);
    }
  };

  const openReviewDialog = (type, violation) => {
    setReviewDialog({ type, violation });
    setReviewNote(violation.review_note || '');
    setRejectionReason(violation.rejection_reason || 'false_positive');
  };

  const closeReviewDialog = () => {
    if (isReviewing) return;
    setReviewDialog(null);
    setReviewNote('');
    setRejectionReason('false_positive');
  };

  const handleSubmitReview = async () => {
    if (!reviewDialog?.violation) return;

    const id = getViolationId(reviewDialog.violation);
    const note = reviewNote.trim() || null;
    setIsReviewing(true);

    try {
      const response = reviewDialog.type === 'confirm'
        ? await api.patch(`/violations/${id}/confirm`, { review_note: note })
        : await api.patch(`/violations/${id}/reject`, {
          rejection_reason: rejectionReason,
          review_note: note
        });

      if (response.data.code === 200) {
        patchViolationState(response.data.result);
        toast.success(reviewDialog.type === 'confirm' ? 'Violation confirmed' : 'Detection rejected');
        setReviewDialog(null);
        setReviewNote('');
        setRejectionReason('false_positive');
      }
    } catch (error) {
      console.error('Review failed:', error);
      toast.error('Could not update review status');
    } finally {
      setIsReviewing(false);
    }
  };

  const toggleSort = (field) => {
    if (sortBy === field) {
      setOrder(order === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setOrder('desc');
    }
  };

  const handleNextImage = (e) => {
    e.stopPropagation();
    if (selectedViolationIndex === null) return;
    const nextIdx = (selectedViolationIndex + 1) % violations.length;
    setSelectedViolationIndex(nextIdx);
    setActiveHighlightId(getViolationId(violations[nextIdx]));
  };

  const handlePrevImage = (e) => {
    e.stopPropagation();
    if (selectedViolationIndex === null) return;
    const prevIdx = (selectedViolationIndex - 1 + violations.length) % violations.length;
    setSelectedViolationIndex(prevIdx);
    setActiveHighlightId(getViolationId(violations[prevIdx]));
  };

  const handleEvidenceDelete = (id) => {
    setDeleteConfirmId(id);
    setSelectedViolationIndex(null);
  };

  const selectedViolation = selectedViolationIndex !== null ? violations[selectedViolationIndex] : null;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-on-surface uppercase leading-none">Violation History</h2>
          <p className="text-on-surface-variant text-[10px] font-mono uppercase tracking-[0.2em] mt-2 opacity-70">
            List of detected violations
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 ml-auto">
          <button
            onClick={() => setShowDatasetExportModal(true)}
            className="flex items-center gap-2 px-6 py-2.5 bg-primary text-background font-bold rounded-md text-[10px] hover:bg-primary/90 transition-all uppercase tracking-[0.15em] primary-glow shrink-0"
          >
            <FileArchive className="w-4 h-4" /> Export AI Dataset
          </button>

          <button
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-6 py-2.5 bg-secondary text-background font-bold rounded-md text-[10px] hover:bg-secondary/90 transition-all uppercase tracking-[0.15em] shadow-[0_0_15px_rgba(var(--secondary-rgb),0.3)] shrink-0"
          >
            <FileSpreadsheet className="w-4 h-4" /> Export Excel
          </button>
        </div>
      </div>

      <ViolationFilterBar
        startDate={startDate}
        setStartDate={setStartDate}
        endDate={endDate}
        setEndDate={setEndDate}
        minViolations={minViolations}
        setMinViolations={setMinViolations}
        onlyViolations={onlyViolations}
        setOnlyViolations={setOnlyViolations}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        setPage={setPage}
        onReset={handleResetFilter}
      />

      <div className="surface-1 border border-on-surface/5 rounded-md overflow-visible tech-glow min-h-[500px]">
        <ViolationTable
          loading={loading}
          limit={limit}
          violations={violations}
          activeHighlightId={activeHighlightId}
          setSelectedViolationIndex={setSelectedViolationIndex}
          setActiveHighlightId={setActiveHighlightId}
          sortBy={sortBy}
          order={order}
          toggleSort={toggleSort}
          activeMenuId={activeMenuId}
          setActiveMenuId={setActiveMenuId}
          menuRef={menuRef}
          handleDownloadImage={handleDownloadImage}
          currentUser={currentUser}
          setDeleteConfirmId={setDeleteConfirmId}
          openReviewDialog={openReviewDialog}
        />

        <ViolationPagination
          page={page}
          limit={limit}
          total={total}
          setPage={setPage}
          setLimit={setLimit}
        />
      </div>

      <ViolationEvidenceModal
        selectedViolation={selectedViolation}
        selectedViolationIndex={selectedViolationIndex}
        violationsLength={violations.length}
        page={page}
        limit={limit}
        currentUser={currentUser}
        onClose={() => setSelectedViolationIndex(null)}
        onPrev={handlePrevImage}
        onNext={handleNextImage}
        onDownload={handleDownloadImage}
        onDelete={handleEvidenceDelete}
        onConfirm={(violation) => openReviewDialog('confirm', violation)}
        onReject={(violation) => openReviewDialog('reject', violation)}
      />

      <ViolationReviewModal
        reviewDialog={reviewDialog}
        reviewNote={reviewNote}
        setReviewNote={setReviewNote}
        rejectionReason={rejectionReason}
        setRejectionReason={setRejectionReason}
        isReviewing={isReviewing}
        onClose={closeReviewDialog}
        onSubmit={handleSubmitReview}
      />

      <ViolationDatasetExportModal
        show={showDatasetExportModal}
        startDate={startDate}
        endDate={endDate}
        isExporting={isExportingDataset}
        onClose={() => {
          if (!isExportingDataset) setShowDatasetExportModal(false);
        }}
        onSubmit={handleExportFeedbackDataset}
      />

      <DeleteViolationModal
        deleteConfirmId={deleteConfirmId}
        isDeleting={isDeleting}
        onCancel={() => setDeleteConfirmId(null)}
        onConfirm={handleDelete}
      />

      <style>{`
        @keyframes highlight-pulse {
          0% { background-color: transparent; }
          50% { background-color: #3b82f633; border-top-color: #3b82f6; border-bottom-color: #3b82f6; }
          100% { background-color: transparent; }
        }
        .row-highlight {
          animation: highlight-pulse 2s ease-in-out infinite;
          background-color: #3b82f61a !important;
          box-shadow: inset 0 0 10px #3b82f633;
          position: relative;
          z-index: 5;
        }
        input[type="date"]::-webkit-calendar-picker-indicator {
          opacity: 0.8;
          cursor: pointer;
        }
        input[type="date"]::-webkit-calendar-picker-indicator:hover {
          opacity: 1;
        }
      `}</style>
    </div>
  );
};

export default ViolationHistory;
