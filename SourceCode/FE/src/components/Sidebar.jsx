import React from 'react';
import { NavLink } from 'react-router-dom';
import toast from 'react-hot-toast';
import { 
  Shield, 
  Activity, 
  Camera,
  History, 
  BarChart2, 
  FileClock,
  Users, 
  LogOut,
  User
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Sidebar = () => {
  const { user, logout } = useAuth();
  const isAdmin = user?.role === 'admin';
  const isEmailVerified = user?.is_verified;
  const verifyEmailMessage = 'Please verify your email before using this feature.';

  const menuItems = [
    { icon: Activity, label: 'Live Monitor', path: '/live' },
    { icon: History, label: 'Violations', path: '/violations' },
    { icon: BarChart2, label: 'Analytics', path: '/analytics' },
    ...(isAdmin ? [
      { icon: Users, label: 'User Management', path: '/users' },
      { icon: Camera, label: 'Cameras', path: '/cameras' },
      { icon: FileClock, label: 'Audit Logs', path: '/audit-logs' },
    ] : []),
  ];

  return (
    <aside className="w-64 bg-surface-low border-r border-on-surface/5 flex flex-col h-screen sticky top-0">
      <div className="px-6 h-16 flex items-center gap-3 border-b border-on-surface/5 shrink-0">
        <div className="p-1 overflow-hidden">
          <img src="/ptit-logo.png" alt="PTIT Logo" className="w-7 h-7 object-contain" />
        </div>
        <div className="flex flex-col">
          <h1 className="text-lg font-bold tracking-tight text-on-surface uppercase leading-tight hover:text-primary transition-colors cursor-default">Sentinel</h1>
          <span className="text-[9px] text-primary/60 font-mono uppercase tracking-[0.2em] -mt-0.5">Tactical Oversight</span>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={(event) => {
              if (!isEmailVerified) {
                event.preventDefault();
                toast.error(verifyEmailMessage);
              }
            }}
            className={({ isActive }) => `
              flex items-center gap-3 px-4 py-3 rounded-md transition-all duration-200 group
              ${isActive 
                ? 'bg-primary/10 text-primary border-l-2 border-primary' 
                : 'text-on-surface-variant hover:bg-surface hover:text-on-surface'}
            `}
          >
            <item.icon className="w-5 h-5" />
            <span className="text-sm font-medium tracking-wide">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-on-surface/5 space-y-2">
        <NavLink
          to="/profile"
          className={({ isActive }) => `
            flex items-center gap-3 px-4 py-3 rounded-md transition-all duration-200 group
            ${isActive 
              ? 'bg-primary/10 text-primary border-l-2 border-primary' 
              : 'text-on-surface-variant hover:bg-surface hover:text-on-surface'}
          `}
        >
          <div className="w-5 h-5 rounded bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary overflow-hidden border border-primary/20">
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <User className="w-3.5 h-3.5" />
            )}
          </div>
          <span className="text-sm font-medium">Profile</span>
        </NavLink>
        <button 
          onClick={logout}
          className="flex items-center gap-3 px-4 py-3 w-full rounded-md text-on-surface-variant hover:bg-error/10 hover:text-error transition-all"
        >
          <LogOut className="w-5 h-5" />
          <span className="text-sm font-medium">Sign Out</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
