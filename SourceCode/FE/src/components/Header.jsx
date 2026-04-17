import React, { useState, useEffect, useRef } from 'react';
import { Bell, Search, Cpu, Globe, LogOut, CheckCircle, Shield, ShieldAlert, ChevronRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const Header = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isOnline, setIsOnline] = useState(true);
  const [showNotifications, setShowNotifications] = useState(false);
  const [recentAlerts, setRecentAlerts] = useState([]);
  const notifRef = useRef(null);

  useEffect(() => {
    const checkServer = async () => {
      try {
        await api.get('/health');
        setIsOnline(true);
      } catch (error) {
        setIsOnline(false);
      }
    };
    
    const fetchAlerts = async () => {
      try {
        const res = await api.get('/violations/?limit=5');
        if (res.data.code === 200) {
          setRecentAlerts(res.data.result.data || []);
        }
      } catch (e) {}
    };

    checkServer();
    fetchAlerts();
    
    const intvStatus = setInterval(checkServer, 10000);
    const intvAlerts = setInterval(fetchAlerts, 15000);
    return () => {
      clearInterval(intvStatus);
      clearInterval(intvAlerts);
    };
  }, []);

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
            <Cpu className={`w-4 h-4 ${isOnline ? 'text-secondary animate-pulse' : 'text-on-surface-variant'}`} />
            <span className={`text-[10px] font-mono uppercase tracking-wider ${isOnline ? 'text-on-surface-variant' : 'text-error'}`}>
              Neural Engine: {isOnline ? 'Active' : 'Offline'}
            </span>
          </div>
          <div className="w-px h-3 bg-on-surface/10"></div>
          <div className="flex items-center gap-2">
            <Globe className={`w-4 h-4 ${isOnline ? 'text-primary' : 'text-error'}`} />
            <span className={`text-[10px] font-mono uppercase tracking-wider ${isOnline ? 'text-on-surface-variant' : 'text-error'}`}>
              Sync: {isOnline ? 'Nominal' : 'Disconnected'}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative" ref={notifRef}>
          <button 
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface rounded-full transition-all relative cursor-pointer"
          >
            <Bell className="w-5 h-5" />
            {recentAlerts.length > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-error text-[8px] font-bold text-background rounded-full border border-background flex items-center justify-center px-1 animate-in fade-in zoom-in duration-300">
                {recentAlerts.length}
              </span>
            )}
          </button>
          
          {/* Notifications Dropdown */}
          {showNotifications && (
            <div className="absolute top-full right-0 mt-3 w-96 bg-surface border border-on-surface/10 rounded-md shadow-2xl py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="px-5 py-3 border-b border-on-surface/5 flex justify-between items-center">
                <span className="text-xs font-bold text-on-surface uppercase tracking-widest">Notification Center</span>
                <span className="text-[10px] px-2 py-0.5 bg-error/10 text-error rounded-full font-mono font-bold">{recentAlerts.length} New</span>
              </div>
              <div className="max-h-[400px] overflow-y-auto">
                {recentAlerts.length > 0 ? recentAlerts.map(alert => (
                  <div key={alert.id || alert._id} className="px-5 py-4 border-b border-on-surface/5 hover:bg-surface-low transition-all cursor-pointer flex gap-4 group">
                    <div className="w-10 h-10 rounded-lg bg-error/10 flex items-center justify-center shrink-0 border border-error/10 group-hover:border-error/30 transition-all">
                      <ShieldAlert className="w-5 h-5 text-error" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[11px] font-bold text-on-surface group-hover:text-primary transition-colors">
                        Violation Detected at {alert.camera_id || 'Main Gate'}
                      </p>
                      <p className="text-[10px] text-on-surface-variant font-mono mt-1 flex items-center gap-2">
                        <span>Incident ID: {String(alert.id || alert._id).slice(-6).toUpperCase()}</span>
                        <span className="w-1 h-1 bg-on-surface-variant/30 rounded-full"></span>
                        <span className="text-primary font-bold">{formatRelativeTime(alert.timestamp)}</span>
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
              <div className="px-5 py-3 text-center border-t border-on-surface/5" onClick={() => { setShowNotifications(false); navigate('/violations'); }}>
                <button className="text-[10px] text-primary hover:text-primary/80 uppercase tracking-[0.2em] font-bold cursor-pointer transition-all flex items-center justify-center gap-2 w-full">
                  See all notifications <ChevronRight className="w-3 h-3" />
                </button>
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
