import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Toaster } from 'react-hot-toast';
import Layout from './components/Layout';
import Login from './pages/Login';
import VerifyEmail from './pages/VerifyEmail';
import ResetPassword from './pages/ResetPassword';
import LiveMonitoring from './pages/LiveMonitoring';
import ViolationHistory from './pages/ViolationHistory';
import Analytics from './pages/Analytics';
import UserManagement from './pages/UserManagement';
import AuditLogs from './pages/AuditLogs';
import CameraManagement from './pages/CameraManagement';
import Profile from './pages/Profile';

const PrivateRoute = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
        <p className="text-[10px] font-mono text-on-surface-variant uppercase tracking-[0.2em]">Synchronizing Security Clearance...</p>
      </div>
    );
  }

  return isAuthenticated ? <Outlet /> : <Navigate to="/login" />;
};

const AdminRoute = () => {
  const { user, loading } = useAuth();

  if (loading) return null;

  return user?.role === 'admin' ? <Outlet /> : <Navigate to="/live" />;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          
          {/* Protected Routes */}
          <Route element={<PrivateRoute />}>
            <Route path="/" element={<Layout />}>
              <Route index element={<Navigate to="/live" />} />
              <Route path="live" element={<LiveMonitoring />} />
              <Route path="violations" element={<ViolationHistory />} />
              <Route path="analytics" element={<Analytics />} />
              <Route element={<AdminRoute />}>
                <Route path="users" element={<UserManagement />} />
                <Route path="cameras" element={<CameraManagement />} />
                <Route path="audit-logs" element={<AuditLogs />} />
              </Route>
              <Route path="profile" element={<Profile />} />
            </Route>
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
