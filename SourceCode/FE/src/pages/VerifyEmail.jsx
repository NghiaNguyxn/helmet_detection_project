import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Shield, CheckCircle, XCircle, Loader2, ArrowRight, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api, { API_BASE_URL } from '../services/api';

const VerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  const token = searchParams.get('token');

  // States: 'loading' | 'success' | 'error'
  const [status, setStatus] = useState(token ? 'loading' : 'error');
  const [message, setMessage] = useState(token ? '' : 'No verification token found. The link may be incomplete.');
  const [countdown, setCountdown] = useState(3);

  const hasRun = React.useRef(false);

  useEffect(() => {
    if (hasRun.current) return;

    if (!token) {
      return;
    }

    const verifyEmail = async () => {
      try {
        const response = await api.get(`/auth/verify-email?token=${token}`);

        if (response.data.code === 200 && response.data.result?.access_token) {
          hasRun.current = true;
          // Auto-login the user with the returned token
          login(response.data.result.access_token);
          setStatus('success');
          setMessage(response.data.message || 'Your account has been verified successfully.');

          // Auto redirect after 3 seconds is handled by another effect
        } else {
          setStatus('error');
          setMessage(response.data.message || 'Verification failed. Please try again.');
        }
      } catch (err) {
        setStatus('error');
        // Handle both standard FastAPI 'detail' and custom 'message'
        const errorData = err.response?.data;
        const detail = errorData?.message || errorData?.detail;
        setMessage(
          typeof detail === 'string'
            ? detail
            : 'The verification link is invalid or has expired.'
        );
      }
    };

    // Slight delay to show the loading animation
    const timer = setTimeout(verifyEmail, 1500);
    return () => clearTimeout(timer);
  }, [token, login]);

  // Handle countdown and redirect
  useEffect(() => {
    if (status === 'success' && countdown > 0) {
      const timer = setInterval(() => {
        setCountdown(prev => prev - 1);
      }, 1000);
      return () => clearInterval(timer);
    } else if (status === 'success' && countdown === 0) {
      navigate('/live');
    }
  }, [status, countdown, navigate]);

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
        <div className="surface-1 border border-on-surface/5 p-10 rounded-md tech-glow">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="p-2 mb-4 overflow-hidden">
              <img src="/ptit-logo.png" alt="Logo" className="w-16 h-16 object-contain" />
            </div>
            <h1 className="text-xl font-bold text-on-surface tracking-tight uppercase">Account Verification</h1>
          </div>

          {/* Loading State */}
          {status === 'loading' && (
            <div className="flex flex-col items-center gap-6 py-8 animate-in fade-in duration-500">
              <div className="relative">
                <div className="w-20 h-20 rounded-full border-2 border-primary/20 flex items-center justify-center">
                  <Loader2 className="w-10 h-10 text-primary animate-spin" />
                </div>
                {/* Pulse ring */}
                <div className="absolute inset-0 w-20 h-20 rounded-full border border-primary/30 animate-ping"></div>
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-on-surface uppercase tracking-wider">Verifying Your Account</p>
                <p className="text-xs text-on-surface-variant font-mono mt-2 uppercase tracking-widest opacity-60">
                  Processing secure token...
                </p>
              </div>
              {/* Loading bar */}
              <div className="w-full h-1 bg-surface-highest rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full animate-pulse" style={{ width: '70%', transition: 'width 2s ease-in-out' }}></div>
              </div>
            </div>
          )}

          {/* Success State */}
          {status === 'success' && (
            <div className="flex flex-col items-center gap-6 py-8 animate-in fade-in zoom-in-95 duration-500">
              <div className="relative">
                <div className="w-20 h-20 rounded-full bg-secondary/10 border border-secondary/30 flex items-center justify-center">
                  <CheckCircle className="w-10 h-10 text-secondary" />
                </div>
                {/* Glow */}
                <div className="absolute inset-0 w-20 h-20 rounded-full bg-secondary/10 blur-xl"></div>
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-secondary uppercase tracking-wider">Verification Complete</p>
                <p className="text-xs text-on-surface-variant mt-2 max-w-xs">{message}</p>
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

          {/* Error State */}
          {status === 'error' && (
            <div className="flex flex-col items-center gap-6 py-8 animate-in fade-in zoom-in-95 duration-500">
              <div className="relative">
                <div className="w-20 h-20 rounded-full bg-error/10 border border-error/30 flex items-center justify-center">
                  <XCircle className="w-10 h-10 text-error" />
                </div>
                <div className="absolute inset-0 w-20 h-20 rounded-full bg-error/10 blur-xl"></div>
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-error uppercase tracking-wider">Verification Failed</p>
                <p className="text-xs text-on-surface-variant mt-2 max-w-xs">{message}</p>
              </div>
              <div className="w-full space-y-3 mt-2">
                <button
                  onClick={() => {
                    setStatus('loading');
                    setMessage('');
                    setCountdown(3);
                    hasRun.current = false;
                    // Re-trigger verification
                    const token = searchParams.get('token');
                    if (token) {
                      window.location.reload();
                    }
                  }}
                  className="w-full flex items-center justify-center gap-2 bg-surface-highest hover:bg-surface border border-on-surface/10 hover:border-primary/30 text-on-surface font-bold py-3 rounded-md transition-all uppercase tracking-widest text-[11px]"
                >
                  <RefreshCw className="w-4 h-4" /> Resend Verification
                </button>
                <button
                  onClick={() => navigate('/login')}
                  className="w-full flex items-center justify-center gap-2 text-on-surface-variant hover:text-on-surface font-bold py-2 rounded-md transition-all uppercase tracking-widest text-[11px]"
                >
                  Back to Login
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-between px-2">
          <span className="text-[10px] text-on-surface-variant font-mono uppercase">Secure Verification</span>
          <span className="text-[10px] text-on-surface-variant font-mono uppercase">Encrypted Channel</span>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmail;
