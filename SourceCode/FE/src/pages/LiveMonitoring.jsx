import React, { useCallback, useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';

import api, { API_BASE_URL } from '../services/api';
import socketService from '../services/websocket';
import BroadcastAlertModal from '../components/live-monitoring/BroadcastAlertModal';
import CameraControls from '../components/live-monitoring/CameraControls';
import CameraSourceSelector from '../components/live-monitoring/CameraSourceSelector';
import CameraViewport from '../components/live-monitoring/CameraViewport';
import DeleteCaptureModal from '../components/live-monitoring/DeleteCaptureModal';
import EvidenceImageModal from '../components/live-monitoring/EvidenceImageModal';
import ForceStopModal from '../components/live-monitoring/ForceStopModal';
import RecentViolationsPanel from '../components/live-monitoring/RecentViolationsPanel';
import SessionStatsPanel from '../components/live-monitoring/SessionStatsPanel';

const LiveMonitoring = () => {
  const [viewerId] = useState(() => `v_${Math.random().toString(36).substring(2, 9)}`);
  const [searchParams] = useSearchParams();

  const [isCamOn, setIsCamOn] = useState(() => {
    return localStorage.getItem('helmet_cam_active') === 'true';
  });

  const [sessionTime, setSessionTime] = useState(() => {
    return localStorage.getItem('helmet_session_time') || '00:00:00';
  });

  const [recentLogs, setRecentLogs] = useState(() => {
    const saved = localStorage.getItem('helmet_recent_logs');
    return saved ? JSON.parse(saved) : [];
  });

  const [sessionStats, setSessionStats] = useState(() => {
    const saved = localStorage.getItem('helmet_session_stats');
    return saved ? JSON.parse(saved) : {
      violations: 0,
      securityLevel: 'Standard',
      accuracy: 0
    };
  });

  const [selectedImageIndex, setSelectedImageIndex] = useState(null);

  const [cameraSources, setCameraSources] = useState([]);
  const [currentCam, setCurrentCam] = useState('CAM_1');
  const [isSwitching, setIsSwitching] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [streamKey, setStreamKey] = useState(Date.now());
  const [telemetry, setTelemetry] = useState({
    status: "Inactive",
    fps: 0,
    capture_fps: 0,
    cam_name: "Detecting...",
    resolution: "N/A"
  });

  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [showForceStopModal, setShowForceStopModal] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [isBroadcasting, setIsBroadcasting] = useState(false);

  const processedLogsRef = useRef(new Set(
    JSON.parse(localStorage.getItem('helmet_processed_ids') || '[]')
  ));
  const imgRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    localStorage.setItem('helmet_cam_active', isCamOn);
    setTelemetry({
      status: isCamOn ? "Connecting" : "Inactive",
      fps: 0,
      capture_fps: 0,
      cam_name: "Detecting...",
      resolution: "N/A"
    });
  }, [isCamOn]);

  useEffect(() => {
    localStorage.setItem('helmet_session_stats', JSON.stringify(sessionStats));
  }, [sessionStats]);

  useEffect(() => {
    localStorage.setItem('helmet_recent_logs', JSON.stringify(recentLogs));
  }, [recentLogs]);

  useEffect(() => {
    localStorage.setItem('helmet_processed_ids', JSON.stringify([...processedLogsRef.current]));
  }, [recentLogs]);

  useEffect(() => {
    localStorage.setItem('helmet_session_time', sessionTime);
  }, [sessionTime]);

  const toggleCamera = async () => {
    if (isToggling) return;

    setIsToggling(true);
    const nextState = !isCamOn;
    setIsCamOn(nextState);

    if (nextState) {
      localStorage.setItem('helmet_session_start', Date.now().toString());
      localStorage.setItem('helmet_recent_logs', '[]');

      socketService.resetSessionStats();
      setSessionStats({ violations: 0, securityLevel: 'Standard', accuracy: 0 });
      setRecentLogs([]);
      processedLogsRef.current = new Set();
      localStorage.setItem('helmet_processed_ids', '[]');
      setSessionTime('00:00:00');
      setStreamKey(Date.now());
    } else {
      try {
        await api.post(`/helmet/stop-video-feed?v_id=${viewerId}`);
      } catch (err) {
        console.warn('Stream stop error:', err);
      }
    }

    setTimeout(() => {
      setIsToggling(false);
    }, 1000);
  };

  const handleForceStop = async () => {
    setShowForceStopModal(false);
    try {
      const res = await api.post('/helmet/force-stop-camera');
      if (res.data.code === 200) {
        setIsCamOn(false);
        toast.success('Camera system force-reset successfully');
        setStreamKey(Date.now());
      }
    } catch {
      toast.error('Failed to reset camera');
    }
  };

  const handleResetSession = () => {
    socketService.resetSessionStats();

    const newStartTime = Date.now().toString();
    localStorage.setItem('helmet_session_start', newStartTime);

    setSessionStats({ violations: 0, securityLevel: 'Standard', accuracy: 0 });
    setSessionTime('00:00:00');
    setRecentLogs([]);
    localStorage.setItem('helmet_recent_logs', '[]');

    processedLogsRef.current = new Set();
    localStorage.setItem('helmet_processed_ids', '[]');

    toast.success('Session reset successfully');
  };

  useEffect(() => {
    let interval;
    if (isCamOn) {
      let startTime = localStorage.getItem('helmet_session_start');
      if (!startTime) {
        startTime = Date.now().toString();
        localStorage.setItem('helmet_session_start', startTime);
      }

      const updateTime = () => {
        const startTime = localStorage.getItem('helmet_session_start');
        if (!startTime) return;

        const diff = Math.floor((Date.now() - parseInt(startTime)) / 1000);
        const h = Math.floor(diff / 3600).toString().padStart(2, '0');
        const m = Math.floor((diff % 3600) / 60).toString().padStart(2, '0');
        const s = (diff % 60).toString().padStart(2, '0');
        setSessionTime(`${h}:${m}:${s}`);
      };

      updateTime();
      interval = setInterval(updateTime, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isCamOn]);

  useEffect(() => {
    const initialFetch = async () => {
      try {
        const res = await api.get('/violations/?limit=3');
        if (res.data && res.data.code === 200 && res.data.result) {
          const logs = res.data.result.data || [];
          setRecentLogs(logs);
        }
      } catch (e) {
        console.error("Initial fetch error:", e);
      }
    };

    initialFetch();
    socketService.connect();

    const unsubscribe = socketService.subscribe((message) => {
      if (message.type === 'telemetry') {
        setTelemetry({
          status: message.status,
          fps: message.fps,
          capture_fps: message.capture_fps,
          cam_name: message.cam_name,
          resolution: message.resolution
        });
      }

      if (message.event === 'new_violation') {
        const newViolation = message.data;
        console.log("New violation received via WebSocket:", newViolation);

        setRecentLogs(prev => {
          if (prev.some(log => (log.id || log._id) === (newViolation.id || newViolation._id))) return prev;
          return [newViolation, ...prev.slice(0, 2)];
        });
      }

      if (message.event === 'delete_violation') {
        const { id } = message.data;
        setRecentLogs(prev => prev.filter(log => (log.id || log._id) !== id));
      }
    });

    const unsubscribeStatus = socketService.onStatusChange(() => {
      if (!isCamOn) return;

      const stats = socketService.sessionStats;
      const accuracy = stats.totalDetections > 0
        ? parseFloat(((stats.totalConfidence / stats.totalDetections) * 100).toFixed(1))
        : 0;

      setSessionStats(prev => ({
        ...prev,
        violations: stats.violationCount,
        accuracy: accuracy
      }));
    });

    return () => {
      unsubscribe();
      unsubscribeStatus();
    };
  }, [isCamOn]);

  useEffect(() => {
    const fetchSources = async () => {
      try {
        const res = await api.get('/helmet/camera-sources');
        if (res.data && res.data.code === 200) {
          setCameraSources(res.data.result.sources || []);
          setCurrentCam(res.data.result.current || 'CAM_1');
        }
      } catch (err) {
        console.error("Failed to fetch camera sources:", err);
      }
    };
    fetchSources();
  }, []);

  const handleSwitchCamera = useCallback(async (sourceId) => {
    if (sourceId === currentCam || isSwitching) return;

    setIsSwitching(true);
    try {
      const res = await api.post(`/helmet/switch-camera/${sourceId}`);
      if (res.data && res.data.code === 200) {
        setCurrentCam(sourceId);
        toast.success(`Switched to ${sourceId}`);
      }
    } catch (err) {
      toast.error("Failed to switch camera");
      console.error(err);
    } finally {
      setTimeout(() => setIsSwitching(false), 1000);
    }
  }, [currentCam, isSwitching]);

  useEffect(() => {
    const camId = searchParams.get('cam');
    if (camId && cameraSources.length > 0 && cameraSources.includes(camId) && camId !== currentCam) {
      handleSwitchCamera(camId);
    }
  }, [searchParams, cameraSources, currentCam, handleSwitchCamera]);

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

  const handleDeleteEntry = async () => {
    if (selectedImageIndex === null) return;
    const entry = recentLogs[selectedImageIndex];
    const id = entry._id || entry.id;

    setShowDeleteConfirmModal(false);
    try {
      const res = await api.delete(`/violations/${id}`);
      if (res.data.code === 200) {
        toast.success('Record deleted from database');

        const updatedLogs = recentLogs.filter((_, index) => index !== selectedImageIndex);
        setRecentLogs(updatedLogs);
        localStorage.setItem('helmet_recent_logs', JSON.stringify(updatedLogs));

        if (updatedLogs.length === 0) {
          setSelectedImageIndex(null);
        } else if (selectedImageIndex >= updatedLogs.length) {
          setSelectedImageIndex(updatedLogs.length - 1);
        }
      }
    } catch (err) {
      if (err.response?.status === 403) {
        toast.error('Unauthorized: Admin access required to delete');
      } else {
        toast.error('Failed to delete record');
      }
      console.error(err);
    }
  };

  const handleSendAlert = async () => {
    if (!broadcastMessage.trim() || isBroadcasting) return;

    setIsBroadcasting(true);
    try {
      const res = await api.post('/alerts/broadcast', {
        message: broadcastMessage,
        camera_id: currentCam
      });

      if (res.data.code === 200) {
        toast.success('Broadcast alert sent successfully');
        setShowBroadcastModal(false);
        setBroadcastMessage('');
      }
    } catch (err) {
      toast.error('Failed to send broadcast alert');
      console.error(err);
    } finally {
      setIsBroadcasting(false);
    }
  };

  const handleManualCapture = () => {
    if (!imgRef.current) return;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = imgRef.current.naturalWidth;
      canvas.height = imgRef.current.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(imgRef.current, 0, 0);
      canvas.toBlob((blob) => {
        if (!blob) return;
        const formData = new FormData();
        formData.append('file', blob, 'capture.jpg');
        toast.promise(
          api.post('/helmet/predict', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          }),
          {
            loading: 'Analyzing frame...',
            success: 'Analysis complete!',
            error: 'Failed to analyze frame.'
          }
        );
      }, 'image/jpeg');
    } catch {
      toast.error("Manual capture failed.");
    }
  };

  const handleNextImage = (e) => {
    e?.stopPropagation();
    if (selectedImageIndex === null || recentLogs.length === 0) return;
    setSelectedImageIndex((selectedImageIndex + 1) % recentLogs.length);
  };

  const handlePrevImage = (e) => {
    e?.stopPropagation();
    if (selectedImageIndex === null || recentLogs.length === 0) return;
    setSelectedImageIndex((selectedImageIndex - 1 + recentLogs.length) % recentLogs.length);
  };

  const streamUrl = `${API_BASE_URL}/helmet/video-feed?v_id=${viewerId}&token=${localStorage.getItem('token') || ''}&t=${currentCam}&k=${streamKey}`;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-on-surface uppercase leading-none">Live Monitoring</h2>
          <div className="flex items-center gap-3 mt-2">
            <p className="text-on-surface-variant text-[10px] font-mono uppercase tracking-[0.2em] opacity-70 italic">Camera: {currentCam}</p>
            <CameraSourceSelector
              isCamOn={isCamOn}
              cameraSources={cameraSources}
              currentCam={currentCam}
              isSwitching={isSwitching}
              onSwitchCamera={handleSwitchCamera}
            />
          </div>
        </div>
        <CameraControls
          isCamOn={isCamOn}
          isToggling={isToggling}
          onToggleCamera={toggleCamera}
          onForceReset={() => setShowForceStopModal(true)}
        />
      </div>

      <div className="grid grid-cols-12 gap-6">
        <CameraViewport
          isCamOn={isCamOn}
          imgRef={imgRef}
          streamUrl={streamUrl}
          currentCam={currentCam}
          isSwitching={isSwitching}
          onManualCapture={handleManualCapture}
          onBroadcast={() => setShowBroadcastModal(true)}
        />

        <div className="col-span-12 lg:col-span-3 space-y-6">
          <SessionStatsPanel
            sessionTime={sessionTime}
            sessionStats={sessionStats}
            isCamOn={isCamOn}
            telemetry={telemetry}
            onResetSession={handleResetSession}
          >
            <RecentViolationsPanel
              recentLogs={recentLogs}
              onSelectImage={setSelectedImageIndex}
              onArchiveView={() => navigate('/violations')}
            />
          </SessionStatsPanel>
        </div>

        <EvidenceImageModal
          selectedImageIndex={selectedImageIndex}
          recentLogs={recentLogs}
          onClose={() => setSelectedImageIndex(null)}
          onPrev={handlePrevImage}
          onNext={handleNextImage}
          onDownload={handleDownloadImage}
          onDeleteRequest={() => setShowDeleteConfirmModal(true)}
        />
      </div>

      <BroadcastAlertModal
        show={showBroadcastModal}
        currentCam={currentCam}
        broadcastMessage={broadcastMessage}
        setBroadcastMessage={setBroadcastMessage}
        isBroadcasting={isBroadcasting}
        onClose={() => setShowBroadcastModal(false)}
        onSend={handleSendAlert}
      />

      <ForceStopModal
        show={showForceStopModal}
        onCancel={() => setShowForceStopModal(false)}
        onConfirm={handleForceStop}
      />

      <DeleteCaptureModal
        show={showDeleteConfirmModal}
        onCancel={() => setShowDeleteConfirmModal(false)}
        onConfirm={handleDeleteEntry}
      />
    </div>
  );
};

export default LiveMonitoring;
