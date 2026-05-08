import React, { useState, useEffect, useRef } from 'react';
import { Bell, Cpu, Globe, ShieldAlert, CheckCircle, ChevronRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import socketService from '../services/websocket';

const Header = () => {
  const { user } = useAuth();
  const [wsStatus, setWsStatus] = useState('connecting');
  const [showNotifications, setShowNotifications] = useState(false);
  const [recentAlerts, setRecentAlerts] = useState([]);
  const [unreadCount, setUnreadCount] = useState(() => {
    return parseInt(localStorage.getItem('helmet_header_unread') || '0');
  });
  const notifRef = useRef(null);
  const navigate = useNavigate();

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem('helmet_header_alerts', JSON.stringify(recentAlerts));
  }, [recentAlerts]);

  useEffect(() => {
    localStorage.setItem('helmet_header_unread', unreadCount.toString());
  }, [unreadCount]);

  useEffect(() => {
    const fetchInitialAlerts = async () => {
      try {
        const res = await api.get('/alerts/history?limit=10');
        if (res.data.code === 200) {
          const data = res.data.result || [];
          setRecentAlerts(data);
        }
      } catch (e) { }
    };

    fetchInitialAlerts();
    socketService.connect();

    const unsubscribeAlerts = socketService.subscribe((message) => {
      if (message.event === 'security_alert') {
        const newAlert = message.data;
        setRecentAlerts(prev => [newAlert, ...prev.slice(0, 9)]);
        setUnreadCount(prev => prev + 1);

        // Phát âm thanh cảnh báo nhẹ nếu muốn (tùy chọn)
        // new Audio('/alert.mp3').play();
      }
    });

    const handleStorageChange = (e) => {
      if (e.key === 'helmet_session_start') {
        setUnreadCount(0);
      }
    };
    window.addEventListener('storage', handleStorageChange);

    const unsubscribeStatus = socketService.onStatusChange((status) => {
      setWsStatus(status);
    });

    return () => {
      unsubscribeAlerts();
      unsubscribeStatus();
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const toggleNotifications = () => {
    if (!showNotifications) {
      setUnreadCount(0);
    }
    setShowNotifications(!showNotifications);
  };

  const handleNotificationClick = (alert) => {
    setShowNotifications(false);
    // Điều hướng về trang giám sát và chọn camera tương ứng
    navigate(`/live-monitoring?cam=${alert.camera_id}`);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatRelativeTime = (timestamp) => {
    const diff = (new Date() - new Date(timestamp)) / 1000;
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  return (
    <header className="h-16 px-8 bg-surface-low/50 backdrop-blur-md border-b border-on-surface/5 flex items-center justify-between sticky top-0 z-30 transition-all">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-4 px-4 py-1.5 bg-surface rounded-md border border-on-surface/5 transition-all">
          <div className="flex items-center gap-2">
            <Cpu className={`w-4 h-4 ${wsStatus === 'online' ? 'text-secondary animate-pulse' : wsStatus === 'connecting' ? 'text-cyan-400 animate-pulse' : 'text-on-surface-variant'}`} />
            <span className={`text-[10px] font-mono uppercase tracking-wider ${wsStatus === 'online' ? 'text-on-surface-variant' : wsStatus === 'connecting' ? 'text-cyan-400' : 'text-error'}`}>
              Neural Engine: {wsStatus === 'online' ? 'Active' : wsStatus === 'connecting' ? 'Connecting...' : 'Offline'}
            </span>
          </div>
          <div className="w-px h-3 bg-on-surface/10"></div>
          <div className="flex items-center gap-2">
            <Globe className={`w-4 h-4 ${wsStatus === 'online' ? 'text-primary' : wsStatus === 'connecting' ? 'text-blue-400/70 animate-pulse' : 'text-error'}`} />
            <span className={`text-[10px] font-mono uppercase tracking-wider ${wsStatus === 'online' ? 'text-on-surface-variant' : wsStatus === 'connecting' ? 'text-blue-400/70' : 'text-error'}`}>
              Sync: {wsStatus === 'online' ? 'Nominal' : wsStatus === 'connecting' ? 'Syncing...' : 'Disconnected'}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative" ref={notifRef}>
          <button
            onClick={toggleNotifications}
            className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface rounded-full transition-all relative cursor-pointer"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-error text-[8px] font-bold text-background rounded-full border border-background flex items-center justify-center px-1 animate-in fade-in zoom-in duration-300">
                {unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute top-full right-0 mt-3 w-96 bg-surface border border-on-surface/10 rounded-md shadow-2xl py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="px-5 py-3 border-b border-on-surface/5 flex justify-between items-center">
                <span className="text-xs font-bold text-on-surface uppercase tracking-widest">Notification Center</span>
                {unreadCount > 0 && (
                  <span className="text-[10px] px-2 py-0.5 bg-error/10 text-error rounded-full font-mono font-bold">New Alerts</span>
                )}
              </div>
              <div className="max-h-[400px] overflow-y-auto">
                {recentAlerts.length > 0 ? recentAlerts.map(alert => (
                  <div
                    key={alert.id || alert._id}
                    onClick={() => handleNotificationClick(alert)}
                    className="px-5 py-4 border-b border-on-surface/5 hover:bg-surface-low transition-all cursor-pointer flex gap-4 group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-error/10 flex items-center justify-center shrink-0 border border-error/20 group-hover:border-error/40 transition-all shadow-[0_0_15px_rgba(var(--error-rgb),0.1)]">
                      <ShieldAlert className="w-5 h-5 text-error animate-pulse" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-0.5">
                        <p className="text-[11px] font-bold text-on-surface group-hover:text-error transition-colors uppercase tracking-wider">
                          Broadcast from {alert.sender_name}
                        </p>
                        <span className="text-[9px] font-mono text-primary font-bold">{formatRelativeTime(alert.timestamp)}</span>
                      </div>
                      <p className="text-[10px] text-on-surface-variant leading-relaxed line-clamp-2">
                        {alert.message}
                      </p>
                      <p className="text-[8px] font-mono text-on-surface-variant opacity-40 mt-1.5 uppercase tracking-widest">
                        Location: {alert.camera_id}
                      </p>
                    </div>
                  </div>
                )) : (
                  <div className="py-12 text-center flex flex-col items-center opacity-40">
                    <CheckCircle className="w-10 h-10 mb-3" />
                    <p className="text-xs font-mono uppercase tracking-widest">No active alerts</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 pl-4 border-l border-on-surface/10">
          <div className="text-right">
            <p className="text-sm font-medium text-on-surface leading-none">{user?.full_name || user?.username || 'Command Center'}</p>
            <p className="text-[10px] text-primary font-mono uppercase tracking-tighter">{user?.role || 'Super Admin'}</p>
          </div>
          <div className="w-10 h-10 rounded-md bg-primary/20 flex items-center justify-center text-primary font-bold border border-primary/30 overflow-hidden">
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt="ID" className="w-full h-full object-cover" />
            ) : (
              (user?.full_name || user?.username || 'AD').slice(0, 2).toUpperCase()
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
