import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Camera, AlertCircle, CheckCircle, Shield,
  Maximize2, RefreshCcw, X, Download,
  ChevronLeft, ChevronRight, Activity, ShieldAlert, Target
} from 'lucide-react';
import toast from 'react-hot-toast';
import api, { API_BASE_URL } from '../services/api';
import socketService from '../services/websocket';

const LiveMonitoring = () => {
  // Persist camera state to handle tab switching
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

  // Load initial stats
  const [sessionStats, setSessionStats] = useState(() => {
    const saved = localStorage.getItem('helmet_session_stats');
    return saved ? JSON.parse(saved) : {
      violations: 0,
      securityLevel: 'Standard',
      accuracy: 0
    };
  });

  const [selectedImageIndex, setSelectedImageIndex] = useState(null);

  // Multi-Camera states
  const [cameraSources, setCameraSources] = useState([]);
  const [currentCam, setCurrentCam] = useState('CAM_1');
  const [isSwitching, setIsSwitching] = useState(false);
  const [isToggling, setIsToggling] = useState(false); // Ngăn click liên tục
  // streamKey: thay đổi mỗi lần bật cam để buộc browser tạo HTTP request mới (tránh cache MJPEG)
  const [streamKey, setStreamKey] = useState(Date.now());
  const [telemetry, setTelemetry] = useState({
    status: "Inactive",
    fps: 0,
    cam_name: "Detecting...",
    resolution: "N/A"
  });

  // Persisted processed IDs
  const processedLogsRef = useRef(new Set(
    JSON.parse(localStorage.getItem('helmet_processed_ids') || '[]')
  ));

  const imgRef = useRef(null);
  const navigate = useNavigate();

  // Sync isCamOn state with localStorage
  useEffect(() => {
    localStorage.setItem('helmet_cam_active', isCamOn);
    // Reset telemetry khi trạng thái cam thay đổi để tránh hiện dữ liệu cũ
    setTelemetry({
      status: isCamOn ? "Connecting" : "Inactive",
      fps: 0,
      cam_name: "Detecting...",
      resolution: "N/A"
    });
  }, [isCamOn]);

  // Sync stats when they change
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
    if (isToggling) return; // Chặn click liên tiếp

    setIsToggling(true);
    const nextState = !isCamOn;

    // IF WE ARE TURNING IT ON -> Fresh start, reset everything logic
    if (nextState) {
      localStorage.removeItem('helmet_session_start');
      localStorage.setItem('helmet_session_start', Date.now().toString());
      localStorage.setItem('helmet_session_time', '00:00:00');
      localStorage.setItem('helmet_recent_logs', '[]');

      // Clear all stats for the new session
      socketService.resetSessionStats(); // Reset the global service stats
      setSessionStats({ violations: 0, securityLevel: 'Standard', accuracy: 0 });
      setRecentLogs([]);
      processedLogsRef.current = new Set();
      localStorage.setItem('helmet_processed_ids', '[]');
      setSessionTime('00:00:00');

      // Tạo streamKey mới để buộc browser tạo HTTP request hoàn toàn mới
      // Đây là fix chính cho lỗi "bật lại chỉ hiện màn hình chờ"
      setStreamKey(Date.now());
    } else {
      // Turning OFF manually - ĐỢI backend xác nhận đã nhận tín hiệu stop
      try {
        await api.post('/helmet/stop-video-feed');
      } catch (err) {
        console.warn('Stream stop error:', err);
      }
    }

    setIsCamOn(nextState);

    // Cooldown 1s để đảm bảo backend xử lý xong luồng cũ trước khi cho phép bật lại
    setTimeout(() => {
      setIsToggling(false);
    }, 1000);
  };

  const handleResetSession = () => {
    // 1. Reset Global Service Stats
    socketService.resetSessionStats();

    // 2. Reset Start Time to NOW
    const newStartTime = Date.now().toString();
    localStorage.setItem('helmet_session_start', newStartTime);

    // 3. Reset Local State
    setSessionStats({ violations: 0, securityLevel: 'Standard', accuracy: 0 });
    setSessionTime('00:00:00');
    setRecentLogs([]);
    localStorage.setItem('helmet_recent_logs', '[]');

    // 4. Reset Processed IDs
    processedLogsRef.current = new Set();
    localStorage.setItem('helmet_processed_ids', '[]');

    toast.success('Session reset successfully');
  };

  // Timer logic
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

      // Initial call to avoid flickers
      updateTime();
      interval = setInterval(updateTime, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
      // We DON'T stop video on unmount if we want it truly live, 
      // but img tag won't render anyway. Still, we signal stop for safety ONLY if button was clicked.
    };
  }, [isCamOn]);

  // Log fetching (Initial only if list is empty) and WebSocket subscription
  useEffect(() => {
    // 1. Fetch only if we don't have recent logs
    const initialFetch = async () => {
      if (recentLogs.length > 0) return;
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

    // 2. WebSocket setup
    socketService.connect();

    const unsubscribe = socketService.subscribe((message) => {
      if (message.type === 'telemetry') {
        setTelemetry({
          status: message.status,
          fps: message.fps,
          cam_name: message.cam_name,
          resolution: message.resolution
        });
      }

      if (message.event === 'new_violation') {
        const newViolation = message.data;
        console.log("New violation received via WebSocket:", newViolation);

        // Update recent logs list
        setRecentLogs(prev => {
          // Avoid duplicates
          if (prev.some(log => (log.id || log._id) === (newViolation.id || newViolation._id))) return prev;
          return [newViolation, ...prev.slice(0, 2)];
        });
      }
    });

    // 3. Sync with persistent stats in socketService
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

  // Fetch camera sources on mount
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

  const handleSwitchCamera = async (sourceId) => {
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
      // Giữ trạng thái loading thêm một chút để mượt mà
      setTimeout(() => setIsSwitching(false), 1000);
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
    } catch (e) {
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

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-on-surface uppercase leading-none">Live Monitoring</h2>
          <div className="flex items-center gap-3 mt-2">
            <p className="text-on-surface-variant text-[10px] font-mono uppercase tracking-[0.2em] opacity-70 italic">Camera: {currentCam}</p>
            {isCamOn && cameraSources.length > 1 && (
              <div className="flex gap-1.5 ml-2 p-1 bg-surface-highest/30 backdrop-blur-md rounded border border-on-surface/5">
                {cameraSources.map(source => (
                  <button
                    key={source}
                    onClick={() => handleSwitchCamera(source)}
                    disabled={isSwitching}
                    className={`px-2 py-0.5 rounded text-[8px] font-mono font-bold transition-all ${currentCam === source ? 'bg-primary text-background' : 'text-on-surface-variant hover:bg-on-surface/10'}`}
                  >
                    {source}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={toggleCamera}
            disabled={isToggling}
            className={`flex items-center gap-2 px-6 py-2.5 font-bold rounded-md text-[10px] uppercase tracking-widest transition-all ${isToggling ? 'opacity-50 cursor-not-allowed bg-surface-variant text-on-surface-variant' :
              isCamOn ? 'bg-error text-background shadow-[0_0_20px_rgba(var(--error-rgb),0.3)]' : 'bg-primary text-background shadow-[0_0_20px_rgba(var(--primary-rgb),0.3)]'
              }`}
          >
            {isToggling ? (
              <><RefreshCcw className="w-4 h-4 animate-spin" /> Processing...</>
            ) : (
              <><Camera className="w-4 h-4" /> {isCamOn ? "Deactivate Camera" : "Activate Camera"}</>
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Main Feed */}
        <div className="col-span-12 lg:col-span-9 space-y-4">
          <div className="relative aspect-video bg-surface-low rounded-md border border-on-surface/5 overflow-hidden tech-glow group">
            {isCamOn ? (
              <>
                <img
                  ref={imgRef}
                  crossOrigin="anonymous"
                  src={`${API_BASE_URL}/helmet/video-feed?token=${localStorage.getItem('token') || ''}&t=${currentCam}&k=${streamKey}`}
                  alt="Live Stream"
                  className={`w-full h-full object-cover transition-opacity duration-500 ${isSwitching ? 'opacity-30' : 'opacity-100'}`}
                  onError={(e) => {
                    console.warn("Video feed error or initializing...", e);
                  }}
                />
                <div className="scanline"></div>

                {/* Switching Overlay */}
                {isSwitching && (
                  <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-background/20 backdrop-blur-xl animate-in fade-in duration-300">
                    <div className="relative">
                      <RefreshCcw className="w-12 h-12 text-primary animate-spin opacity-40" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-2 h-2 bg-primary rounded-full animate-ping"></div>
                      </div>
                    </div>
                    <p className="mt-4 font-mono text-[10px] font-black uppercase tracking-[0.4em] text-primary animate-pulse">Establishing Secure Link...</p>
                    <p className="mt-1 text-[8px] font-mono text-on-surface-variant opacity-40 uppercase tracking-widest italic">Synchronizing RTSP Stream - {currentCam}</p>
                  </div>
                )}
              </>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-surface-low/30 backdrop-blur-sm relative">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(218,226,253,0.03)_0%,transparent_70%)]"></div>
                <div className="p-6 bg-on-surface/5 rounded-full mb-6 border border-on-surface/5 shadow-inner relative group-hover:border-primary/20 transition-colors">
                  <Camera className="w-12 h-12 text-on-surface/20 group-hover:text-primary/30 transition-colors" />
                </div>
                <h3 className="font-mono text-xs font-black uppercase tracking-[0.4em] text-on-surface/40 mb-2">Link Standby</h3>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-px bg-on-surface/10"></div>
                  <p className="font-mono text-[8px] uppercase tracking-[0.2em] text-on-surface/20 italic">Awaiting secure handshake...</p>
                  <div className="w-8 h-px bg-on-surface/10"></div>
                </div>

                {/* Visual interface elements */}
                <div className="absolute top-8 left-8 flex flex-col gap-1.5 opacity-20">
                  <div className="w-12 h-0.5 bg-on-surface/30"></div>
                  <div className="w-8 h-0.5 bg-on-surface/30"></div>
                </div>
              </div>
            )}

            {/* HUD Overlay */}
            <div className="absolute inset-0 pointer-events-none p-6 flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <div className={`flex items-center gap-2 px-3 py-1.5 backdrop-blur-md rounded text-background text-[10px] font-bold uppercase tracking-widest ${isCamOn ? 'bg-secondary/80 animate-pulse' : 'bg-on-surface-variant/50'}`}>
                  <div className={`w-2 h-2 rounded-full ${isCamOn ? 'bg-background' : 'bg-on-surface/30'}`}></div> {isCamOn ? 'Live Stream Active' : 'Interlink Standby'}
                </div>
              </div>
              <div className="flex justify-between items-end">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-mono text-primary opacity-50 uppercase tracking-widest">Security Protocol</span>
                  <span className="text-xs font-bold text-background bg-primary px-2 py-0.5 rounded">AX-700 ENABLED</span>
                </div>
              </div>
            </div>

            {/* Corner Markers */}
            <div className="absolute top-4 left-4 w-6 h-6 border-t border-l border-primary/40"></div>
            <div className="absolute top-4 right-4 w-6 h-6 border-t border-r border-primary/40"></div>
            <div className="absolute bottom-4 left-4 w-6 h-6 border-b border-l border-primary/40"></div>
            <div className="absolute bottom-4 right-4 w-6 h-6 border-b border-r border-primary/40"></div>
          </div>

          <div className="flex gap-4">
            <button onClick={handleManualCapture} disabled={!isCamOn} className={`flex-1 flex items-center justify-center gap-3 py-4 rounded-md border border-on-surface/5 transition-all font-bold uppercase tracking-widest text-[10px] ${isCamOn ? 'bg-surface hover:border-primary/30 cursor-pointer text-on-surface' : 'bg-surface-variant/20 opacity-50 cursor-not-allowed text-on-surface-variant'}`}>
              <Camera className={`w-4 h-4 ${isCamOn ? 'text-primary' : 'text-on-surface-variant'}`} /> Manual Capture
            </button>
            <button disabled className="flex-1 flex items-center justify-center gap-3 py-4 bg-surface rounded-md border border-on-surface/5 transition-all font-bold uppercase tracking-widest text-[10px] opacity-30 cursor-not-allowed">
              <AlertCircle className="w-4 h-4 text-error" /> Broadcast Alert
            </button>
          </div>
        </div>

        {/* Info Panel */}
        <div className="col-span-12 lg:col-span-3 space-y-6">
          <div className="surface-1 border border-on-surface/5 rounded-md p-6 space-y-6 tech-glow">
            <h3 className="text-[10px] font-mono uppercase text-on-surface-variant tracking-[0.2em] border-b border-on-surface/5 pb-2 font-bold flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-3.5 h-3.5 text-primary" /> Session Intelligence
              </div>
              <button
                onClick={handleResetSession}
                title="Reset Session"
                className="p-1 hover:text-primary transition-colors opacity-40 hover:opacity-100"
              >
                <RefreshCcw className="w-3.5 h-3.5" />
              </button>
            </h3>

            <div className="space-y-5">
              <div className="flex justify-between items-end group">
                <div className="flex flex-col">
                  <span className="text-[9px] font-mono text-on-surface-variant uppercase tracking-widest opacity-60">Session Time</span>
                  <span className="text-lg font-black font-mono text-on-surface leading-none mt-1">{sessionTime}</span>
                </div>
                <div className="w-8 h-px bg-on-surface/10 group-hover:w-12 transition-all"></div>
              </div>

              <div className="flex justify-between items-end group">
                <div className="flex flex-col">
                  <span className="text-[9px] font-mono text-on-surface-variant uppercase tracking-widest opacity-60">Violation Count</span>
                  <span className={`text-lg font-black font-mono leading-none mt-1 ${sessionStats.violations > 0 ? 'text-error' : 'text-on-surface'}`}>
                    {sessionStats.violations.toString().padStart(2, '0')}
                  </span>
                </div>
                <ShieldAlert className={`w-4 h-4 ${sessionStats.violations > 0 ? 'text-error animate-pulse' : 'text-on-surface/20'}`} />
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-mono text-on-surface-variant uppercase tracking-widest opacity-60">Status</span>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${!isCamOn ? 'bg-on-surface/20' :
                      telemetry.status === 'Streaming' ? 'bg-secondary shadow-[0_0_8px_rgba(0,255,157,0.4)] animate-pulse' :
                        telemetry.status === 'Connecting' ? 'bg-cyan-400 animate-pulse' : 'bg-error animate-pulse'
                      }`}></div>
                    <span className={`text-[10px] font-bold uppercase font-mono ${!isCamOn ? 'text-on-surface/40' :
                      telemetry.status === 'Streaming' ? 'text-secondary' :
                        telemetry.status === 'Connecting' ? 'text-cyan-400' : 'text-error'
                      }`}>
                      {!isCamOn ? 'STANDBY' : telemetry.status}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-mono text-on-surface-variant uppercase tracking-widest opacity-60">Active Source</span>
                  <span className="text-[10px] font-bold font-mono text-primary uppercase">{telemetry.cam_name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-mono text-on-surface-variant uppercase tracking-widest opacity-60">Performance</span>
                  <span className="text-[10px] font-bold font-mono text-on-surface">
                    {telemetry.fps} FPS <span className="opacity-40 ml-1">@{telemetry.resolution}</span>
                  </span>
                </div>
              </div>
            </div>

            <div className="surface-1 border border-on-surface/5 rounded-md p-6 space-y-4">
              <h3 className="text-[10px] font-mono uppercase text-on-surface-variant tracking-[0.2em] border-b border-on-surface/5 pb-2 font-bold">Recent Intelligence</h3>
              <div className="space-y-3">
                {recentLogs.length > 0 ? recentLogs.map((log, i) => (
                  <div key={log._id || log.id} className="flex gap-3 items-start p-2 hover:bg-surface rounded transition-all border border-transparent hover:border-on-surface/10 group">
                    <div
                      className="w-10 h-10 bg-surface-highest rounded flex items-center justify-center shrink-0 overflow-hidden cursor-pointer hover:ring-1 hover:ring-primary/30 transition-all"
                      onClick={() => { if (log.image_url) setSelectedImageIndex(i); }}
                    >
                      {log.image_url ? (
                        <img src={log.image_url} alt="Log" className="w-full h-full object-cover" />
                      ) : (
                        <Shield className="w-4 h-4 text-on-surface-variant" />
                      )}
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-on-surface uppercase leading-tight">Violation</p>
                      <p className="text-[9px] text-on-surface-variant font-mono mt-0.5 opacity-60">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {log.camera_id || 'ENT-01'}
                      </p>
                    </div>
                  </div>
                )) : (
                  <p className="text-[9px] text-on-surface-variant text-center my-6 font-mono uppercase tracking-[0.3em] opacity-40">No Signal</p>
                )}
                <button onClick={() => navigate('/violations')} className="w-full text-center text-[9px] font-mono uppercase text-primary hover:text-primary-variant pt-2 tracking-[0.2em] transition-colors cursor-pointer">Archive View</button>
              </div>
            </div>
          </div>
        </div>

        {/* Enlarged Image Modal */}
        {selectedImageIndex !== null && recentLogs[selectedImageIndex] && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-10 animate-in fade-in zoom-in-95 duration-200">
            <div className="absolute inset-0 bg-background/98 backdrop-blur-2xl" onClick={() => setSelectedImageIndex(null)}></div>

            <div className="relative max-w-full max-h-full flex flex-col items-center">
              {/* Navigation Controls */}
              <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-between pointer-events-none px-4 md:-mx-24">
                <button
                  onClick={handlePrevImage}
                  className="w-12 h-12 rounded-full bg-surface/50 backdrop-blur-lg border border-on-surface/10 flex items-center justify-center text-on-surface hover:bg-primary hover:text-background transition-all pointer-events-auto"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button
                  onClick={handleNextImage}
                  className="w-12 h-12 rounded-full bg-surface/50 backdrop-blur-lg border border-on-surface/10 flex items-center justify-center text-on-surface hover:bg-primary hover:text-background transition-all pointer-events-auto"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </div>

              <button
                onClick={() => setSelectedImageIndex(null)}
                className="absolute -top-12 right-0 p-2 text-on-surface-variant hover:text-on-surface transition-all flex items-center gap-2 text-[9px] font-mono tracking-widest uppercase cursor-pointer"
              >
                Close <X className="w-5 h-5" />
              </button>

              <div className="surface-1 border border-primary/20 p-1 rounded-md shadow-2xl relative overflow-hidden group">
                <img
                  src={recentLogs[selectedImageIndex].image_url}
                  alt="Enlarged Intelligence"
                  className="max-w-full max-h-[75vh] object-contain rounded"
                />
                <div className="absolute top-4 left-4 flex gap-2">
                  <div className="bg-primary/20 backdrop-blur-md px-3 py-1 rounded border border-primary/30">
                    <span className="text-[9px] font-mono font-black text-primary tracking-widest uppercase">ID: {recentLogs[selectedImageIndex]._id?.slice(-6) || 'N/A'}</span>
                  </div>
                </div>

                <div className="absolute top-4 right-4 bg-background/60 backdrop-blur-md px-3 py-1 rounded border border-on-surface/10">
                  <span className="text-[9px] font-mono font-bold text-on-surface uppercase tracking-widest">{selectedImageIndex + 1} / {recentLogs.length}</span>
                </div>

                {/* Data Overlay */}
                <div className="absolute bottom-4 left-4 right-4 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500">
                  <div className="bg-background/90 backdrop-blur-md border border-on-surface/10 p-4 rounded shadow-2xl">
                    <p className="text-[8px] font-mono text-primary font-bold uppercase tracking-widest mb-1 opacity-60">System Log Timestamp</p>
                    <p className="text-sm font-black text-on-surface font-mono">{new Date(recentLogs[selectedImageIndex].timestamp).toLocaleString()}</p>
                  </div>
                </div>
              </div>

              <div className="mt-8">
                <a
                  href={recentLogs[selectedImageIndex].image_url}
                  download
                  className="flex items-center gap-3 px-10 py-4 bg-primary text-background font-bold rounded-md text-[10px] hover:bg-primary-variant transition-all uppercase tracking-[0.2em] shadow-xl"
                >
                  <Download className="w-4 h-4" /> Export Intelligence
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LiveMonitoring;
