import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Shield, Lock, Eye, EyeOff, CheckCircle, Loader2, AlertTriangle, ArrowRight, XCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  const token = searchParams.get('token');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // 'form' | 'success' | 'error'
  const [pageStatus, setPageStatus] = useState(token ? 'form' : 'error');
  const [errorMessage, setErrorMessage] = useState(token ? '' : 'No reset token found. The link may be incomplete or expired.');
  const [successMessage, setSuccessMessage] = useState('');
  const [countdown, setCountdown] = useState(3);

  // Client-side validation
  const passwordsMatch = newPassword && confirmPassword && newPassword === confirmPassword;
  const passwordLongEnough = newPassword.length >= 8;
  const showMismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;

  // Handle countdown and redirect
  React.useEffect(() => {
    if (pageStatus === 'success' && countdown > 0) {
      const timer = setInterval(() => {
        setCountdown(prev => prev - 1);
      }, 1000);
      return () => clearInterval(timer);
    } else if (pageStatus === 'success' && countdown === 0) {
      navigate('/live');
    }
  }, [pageStatus, countdown, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!passwordsMatch || !passwordLongEnough) return;
    
    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const response = await api.post('/auth/reset-password', {
        token,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });

      if (response.data.code === 200 && response.data.result?.access_token) {
        login(response.data.result.access_token);
        setSuccessMessage(response.data.message || 'Your password has been reset successfully.');
        setPageStatus('success');
      } else {
        setErrorMessage(response.data.message || 'Failed to reset password.');
        // Don't change pageStatus so the user can see the error message on the form
      }
    } catch (err) {
      const errorData = err.response?.data;
      const detail = errorData?.message || errorData?.detail;
      setErrorMessage(
        typeof detail === 'string'
          ? detail
          : 'Failed to reset password. Please try again or request a new link.'
      );
      // Don't change pageStatus to 'error' for validation/API errors
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {/* Background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/20 blur-[120px] rounded-full"></div>
        <div className="absolute top-0 left-0 w-full h-full" style={{
          backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(170, 199, 255, 0.05) 1px, transparent 0)',
          backgroundSize: '32px 32px'
        }}></div>
      </div>

      <div className="w-full max-w-md relative">
        <div className="surface-1 border border-on-surface/5 p-8 rounded-md tech-glow">
          {/* Header */}
          <div className="flex flex-col items-center mb-8">
            <div className="p-3 bg-primary/10 rounded-xl mb-4 border border-primary/20">
              <Shield className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-xl font-bold text-on-surface tracking-tight uppercase">Reset Password</h1>
            <p className="text-on-surface-variant text-[10px] font-mono uppercase tracking-[0.2em] mt-2 opacity-70">
              Secure Credential Update
            </p>
          </div>

          {/* Form State */}
          {pageStatus === 'form' && (
            <form onSubmit={handleSubmit} className="space-y-5 animate-in fade-in duration-300">
              {/* New Password */}
              <div className="space-y-2">
                <label className="text-xs font-mono uppercase text-on-surface-variant tracking-wider">New Password</label>
                <div className="relative group">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant group-focus-within:text-primary transition-colors" />
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    required
                    minLength={8}
                    className="w-full pl-10 pr-12 py-3 bg-surface rounded-md border border-on-surface/5 focus:outline-none focus:border-primary/40 transition-all text-sm text-on-surface"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {/* Password strength indicators */}
                {newPassword.length > 0 && (
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex gap-1 flex-1">
                      <div className={`h-1 flex-1 rounded-full transition-all ${newPassword.length >= 4 ? 'bg-error' : 'bg-surface-highest'}`}></div>
                      <div className={`h-1 flex-1 rounded-full transition-all ${newPassword.length >= 8 ? 'bg-primary' : 'bg-surface-highest'}`}></div>
                      <div className={`h-1 flex-1 rounded-full transition-all ${newPassword.length >= 12 ? 'bg-secondary' : 'bg-surface-highest'}`}></div>
                    </div>
                    <span className="text-[9px] font-mono text-on-surface-variant uppercase tracking-widest">
                      {newPassword.length < 8 ? 'Too short' : newPassword.length < 12 ? 'Good' : 'Strong'}
                    </span>
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div className="space-y-2">
                <label className="text-xs font-mono uppercase text-on-surface-variant tracking-wider">Confirm Password</label>
                <div className="relative group">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant group-focus-within:text-primary transition-colors" />
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    required
                    className={`w-full pl-10 pr-12 py-3 bg-surface rounded-md border transition-all text-sm text-on-surface focus:outline-none ${
                      showMismatch
                        ? 'border-error/50 focus:border-error/70'
                        : passwordsMatch
                          ? 'border-secondary/40 focus:border-secondary/60'
                          : 'border-on-surface/5 focus:border-primary/40'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {/* Match/mismatch indicator */}
                {confirmPassword.length > 0 && (
                  <div className="flex items-center gap-2 mt-1">
                    {showMismatch ? (
                      <>
                        <XCircle className="w-3 h-3 text-error" />
                        <span className="text-[10px] font-mono text-error uppercase tracking-widest">Passwords do not match</span>
                      </>
                    ) : passwordsMatch ? (
                      <>
                        <CheckCircle className="w-3 h-3 text-secondary" />
                        <span className="text-[10px] font-mono text-secondary uppercase tracking-widest">Passwords match</span>
                      </>
                    ) : null}
                  </div>
                )}
              </div>

              {errorMessage && (
                <div className="p-3 bg-error/10 border border-error/20 rounded flex gap-3 items-center text-error animate-in fade-in slide-in-from-top-2">
                  <AlertTriangle className="w-5 h-5 shrink-0" />
                  <p className="text-xs font-mono uppercase tracking-tight">{errorMessage}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting || !passwordsMatch || !passwordLongEnough}
                className="w-full bg-primary hover:bg-primary/90 text-background font-bold py-3 rounded-md transition-all uppercase tracking-widest text-sm primary-glow flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed mt-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Set New Password'
                )}
              </button>

              <button
                type="button"
                onClick={() => navigate('/login')}
                className="w-full text-center text-on-surface-variant hover:text-on-surface font-bold py-2 rounded-md transition-all uppercase tracking-widest text-[11px]"
              >
                Back to Login
              </button>
            </form>
          )}

          {/* Success State */}
          {pageStatus === 'success' && (
            <div className="flex flex-col items-center gap-6 py-8 animate-in fade-in zoom-in-95 duration-500">
              <div className="relative">
                <div className="w-20 h-20 rounded-full bg-secondary/10 border border-secondary/30 flex items-center justify-center">
                  <CheckCircle className="w-10 h-10 text-secondary" />
                </div>
                <div className="absolute inset-0 w-20 h-20 rounded-full bg-secondary/10 blur-xl"></div>
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-secondary uppercase tracking-wider">Password Updated</p>
                <p className="text-xs text-on-surface-variant mt-2">{successMessage}</p>
                <div className="mt-4 p-2 bg-secondary/5 border border-secondary/10 rounded-md">
                   <p className="text-[10px] font-mono text-secondary uppercase tracking-widest">
                     Redirecting to dashboard in {countdown}s...
                   </p>
                </div>
              </div>
              <button
                onClick={() => navigate('/live')}
                className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-background font-bold py-3 rounded-md transition-all uppercase tracking-widest text-sm primary-glow mt-2"
              >
                Go to Dashboard <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Error State (no token) */}
          {pageStatus === 'error' && (
            <div className="flex flex-col items-center gap-6 py-8 animate-in fade-in zoom-in-95 duration-500">
              <div className="relative">
                <div className="w-20 h-20 rounded-full bg-error/10 border border-error/30 flex items-center justify-center">
                  <XCircle className="w-10 h-10 text-error" />
                </div>
                <div className="absolute inset-0 w-20 h-20 rounded-full bg-error/10 blur-xl"></div>
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-error uppercase tracking-wider">Reset Failed</p>
                <p className="text-xs text-on-surface-variant mt-2 max-w-xs">{errorMessage}</p>
              </div>
              <div className="w-full space-y-3 mt-2">
                <button
                  onClick={() => navigate('/login')}
                  className="w-full flex items-center justify-center gap-2 bg-surface-highest hover:bg-surface border border-on-surface/10 hover:border-primary/30 text-on-surface font-bold py-3 rounded-md transition-all uppercase tracking-widest text-[11px]"
                >
                  Back to Login
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-between px-2">
          <span className="text-[10px] text-on-surface-variant font-mono uppercase">Secure Reset</span>
          <span className="text-[10px] text-on-surface-variant font-mono uppercase">Encrypted Channel</span>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
