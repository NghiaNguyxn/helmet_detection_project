import React, { useState, useEffect, useRef } from 'react';
import {
  User,
  Mail,
  Shield,
  Key,
  CheckCircle,
  AlertCircle,
  Clock,
  Loader2,
  Send,
  Save,
  Camera
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import toast from 'react-hot-toast';

const Profile = () => {
  const { user, loading: authLoading, fetchUserProfile } = useAuth();
  const fileInputRef = useRef(null);

  // Personal Info State
  const [infoForm, setInfoForm] = useState({
    full_name: '',
    email: '',
    username: ''
  });
  const [infoLoading, setInfoLoading] = useState(false);
  const [infoErrors, setInfoErrors] = useState({});
  const [uploading, setUploading] = useState(false);

  // Password State
  const [passForm, setPassForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });
  const [passLoading, setPassLoading] = useState(false);
  const [passErrors, setPassErrors] = useState({});

  // Verification State
  const [resendLoading, setResendLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setInfoForm({
        full_name: user.full_name || '',
        email: user.email || '',
        username: user.username || ''
      });
    }
  }, [user]);

  // Handle Avatar Click
  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  // Handle File Change & Upload
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file type and size
    if (!file.type.startsWith('image/')) {
        toast.error('Please select an image file');
        return;
    }
    if (file.size > 5 * 1024 * 1024) {
        toast.error('Image size must be less than 5MB');
        return;
    }

    const formData = new FormData();
    formData.append('file', file);

    setUploading(true);
    const toastId = toast.loading('Uploading biometric identity...');
    
    try {
      const response = await api.patch('/users/me/avatar', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data.code === 200) {
        toast.success('Identity profile updated', { id: toastId });
        if (fetchUserProfile) await fetchUserProfile();
      }
    } catch (error) {
      console.error('Avatar upload error:', error);
      toast.error(error.response?.data?.message || 'Failed to sync identity profile', { id: toastId });
    } finally {
      setUploading(false);
      e.target.value = ''; // Reset input
    }
  };

  // Handle Personal Info Update
  const handleUpdateInfo = async (e) => {
    e.preventDefault();
    setInfoErrors({});

    const formData = {
      full_name: infoForm.full_name.trim(),
      email: infoForm.email.trim(),
      username: infoForm.username.trim()
    };

    // Simple validation
    const errors = {};
    if (!formData.email) errors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(formData.email)) errors.email = 'Email format is invalid';
    if (!formData.username) errors.username = 'Username is required';

    if (Object.keys(errors).length > 0) {
      setInfoErrors(errors);
      return;
    }

    setInfoLoading(true);
    try {
      const response = await api.patch('/users/me', formData);
      if (response.data.code === 200) {
        toast.success('Information updated successfully');
        if (fetchUserProfile) await fetchUserProfile();
      }
    } catch (error) {
      console.error('Update info error:', error);
      const errorData = error.response?.data;
      const message = errorData?.message;
      const errorCode = errorData?.error_code;

      if (errorCode === 'VALIDATION_ERROR' && errorData.errors) {
        const fieldErrors = {};
        errorData.errors.forEach(err => {
          fieldErrors[err.field] = err.message;
        });
        setInfoErrors(fieldErrors);
      } else if (message?.toLowerCase().includes('username')) {
        setInfoErrors({ username: message });
      } else if (message?.toLowerCase().includes('email')) {
        setInfoErrors({ email: message });
      } else {
        toast.error(message || 'Failed to update information');
      }
    } finally {
      setInfoLoading(false);
    }
  };

  // Handle Password Change
  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPassErrors({});

    const formData = {
      current_password: passForm.current_password.trim(),
      new_password: passForm.new_password.trim(),
      confirm_password: passForm.confirm_password.trim()
    };

    const errors = {};
    if (!formData.current_password) errors.current_password = 'Current password is required';
    if (formData.new_password.length < 8) errors.new_password = 'New password must be at least 8 characters';
    if (formData.new_password !== formData.confirm_password) errors.confirm_password = 'Passwords do not match';

    if (Object.keys(errors).length > 0) {
      setPassErrors(errors);
      return;
    }

    setPassLoading(true);
    try {
      const response = await api.post('/users/change-password', formData);
      if (response.data.code === 200) {
        toast.success('Password updated successfully');
        setPassForm({ current_password: '', new_password: '', confirm_password: '' });
      }
    } catch (error) {
      console.error('Change password error:', error);
      const errorData = error.response?.data;
      const errorCode = errorData?.error_code;
      const message = errorData?.message;

      if (errorCode === 'PASSWORD_SAME_AS_OLD') {
        setPassErrors({ new_password: message || 'New password cannot be same as old password' });
      } else if (errorCode === 'AUTH_FAILED' || errorCode === 'INCORRECT_CREDENTIALS' || message?.toLowerCase().includes('current password')) {
        setPassErrors({ current_password: message || 'Incorrect current password' });
      } else if (errorCode === 'VALIDATION_ERROR' && errorData.errors) {
        const fieldErrors = {};
        errorData.errors.forEach(err => {
          fieldErrors[err.field] = err.message;
        });
        setPassErrors(fieldErrors);
      } else {
        toast.error(message || 'Failed to update password');
      }
    } finally {
      setPassLoading(false);
    }
  };

  // Handle Resend Verification
  const handleResendVerification = async () => {
    setResendLoading(true);
    try {
      const response = await api.post('/auth/resend-verification');
      if (response.data.code === 200) {
        toast.success('Verification email sent');
      }
    } catch (error) {
      toast.error('Failed to resend verification');
    } finally {
      setResendLoading(false);
    }
  };

  if (authLoading) return (
    <div className="flex items-center justify-center p-20">
      <Loader2 className="w-8 h-8 text-primary animate-spin" />
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 animate-in fade-in duration-500">
      <div className="grid grid-cols-12 gap-8">

        {/* LEFT COLUMN (30%) */}
        <div className="col-span-12 lg:col-span-4 space-y-6">
          <div className="surface-1 border border-on-surface/5 p-8 rounded-md tech-glow relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 -mr-10 -mt-10 rounded-full blur-2xl"></div>

            <div className="flex flex-col items-center text-center space-y-4 relative">
              {/* Avatar Section */}
              <div 
                className="relative cursor-pointer group/avatar"
                onClick={handleAvatarClick}
              >
                <div className="w-32 h-32 rounded-lg bg-surface flex items-center justify-center border-2 border-primary/30 text-primary text-4xl font-bold primary-glow mb-2 overflow-hidden">
                  {user?.avatar_url ? (
                    <img 
                      src={user.avatar_url} 
                      alt="Avatar" 
                      className="w-full h-full object-cover group-hover/avatar:scale-110 transition-transform duration-500" 
                    />
                  ) : (
                    (user?.full_name || user?.username || 'U').slice(0, 2).toUpperCase()
                  )}
                  
                  {/* Upload Overlay */}
                  <div className="absolute inset-0 bg-background/60 flex flex-col items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity duration-300">
                    {uploading ? (
                      <Loader2 className="w-8 h-8 text-primary animate-spin" />
                    ) : (
                      <>
                        <Camera className="w-8 h-8 text-primary mb-1" />
                        <span className="text-[8px] font-mono uppercase font-bold text-primary">UPDATE ID</span>
                      </>
                    )}
                  </div>
                </div>
                
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  className="hidden" 
                  accept="image/*"
                />
              </div>

              <div>
                <h3 className="text-xl font-bold text-on-surface uppercase tracking-tight">{user?.full_name || user?.username}</h3>
                <p className="text-sm font-mono text-on-surface-variant italic">@{user?.username}</p>
              </div>

              <div className="flex flex-col items-center gap-3 w-full pt-4 border-t border-on-surface/5">
                {/* Role Badge */}
                <div className={`px-4 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border ${user?.role === 'admin'
                  ? 'bg-primary/10 text-primary border-primary/20'
                  : 'bg-secondary/10 text-secondary border-secondary/20'
                  }`}>
                  {user?.role === 'admin' ? 'Administrator' : 'Agency Staff'}
                </div>

                {/* Verification Status */}
                {user?.is_verified ? (
                  <div className="flex items-center gap-2 py-1 px-3 bg-secondary/10 text-secondary border border-secondary/20 rounded-md text-[10px] font-bold uppercase">
                    <CheckCircle className="w-3 h-3" />
                    Verified
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 w-full">
                    <div className="flex items-center gap-2 py-1 px-3 bg-warning/10 text-warning border border-warning/20 rounded-md text-[10px] font-bold uppercase">
                      <AlertCircle className="w-3 h-3" />
                      Unverified
                    </div>
                    <button
                      onClick={handleResendVerification}
                      disabled={resendLoading}
                      className="text-[10px] font-mono text-primary hover:underline flex items-center gap-1 disabled:opacity-50"
                    >
                      {resendLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                      Resend verification email
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-8 pt-4 border-t border-on-surface/5 flex items-center justify-center gap-2 text-on-surface-variant">
              <Clock className="w-3 h-3" />
              <span className="text-[10px] font-mono uppercase tracking-tighter">
                Joined: {user?.created_at ? new Date(user.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Unknown'}
              </span>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN (70%) */}
        <div className="col-span-12 lg:col-span-8 space-y-8">

          {/* SECTION 1: PERSONAL INFO */}
          <div className="surface-1 border border-on-surface/5 rounded-md overflow-hidden">
            <div className="px-6 py-4 bg-surface-low border-b border-on-surface/5 flex items-center gap-3">
              <User className="w-5 h-5 text-primary" />
              <h3 className="text-sm font-bold text-on-surface uppercase tracking-widest">Update Information</h3>
            </div>

            <form noValidate onSubmit={handleUpdateInfo} className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-mono uppercase text-on-surface-variant font-bold px-1">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
                    <input
                      type="text"
                      value={infoForm.full_name}
                      onChange={(e) => setInfoForm({ ...infoForm, full_name: e.target.value })}
                      className={`w-full pl-10 pr-4 py-2.5 bg-surface rounded-md border text-sm transition-all focus:outline-none ${infoErrors.full_name ? 'border-error/50' : 'border-on-surface/5 focus:border-primary/50'
                        }`}
                      placeholder="Display Name"
                    />
                  </div>
                  {infoErrors.full_name && <p className="text-[10px] text-error px-1">{infoErrors.full_name}</p>}
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-mono uppercase text-on-surface-variant font-bold px-1">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
                    <input
                      type="email"
                      value={infoForm.email}
                      onChange={(e) => setInfoForm({ ...infoForm, email: e.target.value })}
                      className={`w-full pl-10 pr-4 py-2.5 bg-surface rounded-md border text-sm transition-all focus:outline-none ${infoErrors.email ? 'border-error/50' : 'border-on-surface/5 focus:border-primary/50'
                        }`}
                      placeholder="email@agency.com"
                    />
                  </div>
                  {infoErrors.email && <p className="text-[10px] text-error px-1">{infoErrors.email}</p>}
                </div>

                <div className="space-y-2 col-span-full">
                  <label className="text-[10px] font-mono uppercase text-on-surface-variant font-bold px-1">Username</label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm italic font-mono">@</div>
                    <input
                      type="text"
                      value={infoForm.username}
                      onChange={(e) => setInfoForm({ ...infoForm, username: e.target.value })}
                      className={`w-full pl-10 pr-4 py-2.5 bg-surface rounded-md border text-sm transition-all focus:outline-none ${infoErrors.username ? 'border-error/50' : 'border-on-surface/5 focus:border-primary/50'
                        }`}
                      placeholder="username"
                    />
                  </div>
                  {infoErrors.username && <p className="text-[10px] text-error px-1">{infoErrors.username}</p>}
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  type="submit"
                  disabled={infoLoading}
                  className="flex items-center gap-2 px-6 py-2.5 bg-primary text-background font-bold text-xs uppercase tracking-widest rounded-md primary-glow hover:bg-primary/90 transition-all disabled:opacity-50"
                >
                  {infoLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Changes
                </button>
              </div>
            </form>
          </div>

          {/* SECTION 2: SECURITY & PASSWORD */}
          <div className="surface-1 border border-on-surface/5 rounded-md overflow-hidden">
            <div className="px-6 py-4 bg-surface-low border-b border-on-surface/5 flex items-center gap-3">
              <Shield className="w-5 h-5 text-primary" />
              <h3 className="text-sm font-bold text-on-surface uppercase tracking-widest">Security & Password</h3>
            </div>

            <form onSubmit={handleChangePassword} className="p-6 space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-mono uppercase text-on-surface-variant font-bold px-1">Current Password</label>
                  <div className="relative">
                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
                    <input
                      type="password"
                      value={passForm.current_password}
                      onChange={(e) => setPassForm({ ...passForm, current_password: e.target.value })}
                      className={`w-full pl-10 pr-4 py-2.5 bg-surface rounded-md border text-sm transition-all focus:outline-none ${passErrors.current_password ? 'border-error/50' : 'border-on-surface/5 focus:border-primary/50'
                        }`}
                      placeholder="Current Password"
                    />
                  </div>
                  {passErrors.current_password && <p className="text-[10px] text-error px-1">{passErrors.current_password}</p>}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-mono uppercase text-on-surface-variant font-bold px-1">New Password</label>
                    <div className="relative">
                      <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
                      <input
                        type="password"
                        value={passForm.new_password}
                        onChange={(e) => setPassForm({ ...passForm, new_password: e.target.value })}
                        className={`w-full pl-10 pr-4 py-2.5 bg-surface rounded-md border text-sm transition-all focus:outline-none ${passErrors.new_password ? 'border-error/50' : 'border-on-surface/5 focus:border-primary/50'
                          }`}
                        placeholder="New Password"
                      />
                    </div>
                    {passErrors.new_password && <p className="text-[10px] text-error px-1">{passErrors.new_password}</p>}
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-mono uppercase text-on-surface-variant font-bold px-1">Confirm New Password</label>
                    <div className="relative">
                      <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
                      <input
                        type="password"
                        value={passForm.confirm_password}
                        onChange={(e) => setPassForm({ ...passForm, confirm_password: e.target.value })}
                        className={`w-full pl-10 pr-4 py-2.5 bg-surface rounded-md border text-sm transition-all focus:outline-none ${passErrors.confirm_password ? 'border-error/50' : 'border-on-surface/5 focus:border-primary/50'
                          }`}
                        placeholder="Confirm New Password"
                      />
                    </div>
                    {passErrors.confirm_password && <p className="text-[10px] text-error px-1">{passErrors.confirm_password}</p>}
                  </div>
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  type="submit"
                  disabled={passLoading}
                  className="flex items-center gap-2 px-6 py-2.5 bg-secondary text-background font-bold text-xs uppercase tracking-widest rounded-md secondary-glow hover:bg-secondary/90 transition-all disabled:opacity-50"
                >
                  {passLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                  Update Password
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
