import React, { useState } from 'react';
import { Shield, Eye, EyeOff, Lock, User, Loader2, AlertTriangle, Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { loginApi } from '../services/api';
import api from '../services/api';

const Login = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Forgot Password states
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSubmitting, setForgotSubmitting] = useState(false);
  const [forgotStatus, setForgotStatus] = useState(''); // '' | 'sent' | 'error'
  const [forgotMessage, setForgotMessage] = useState('');

  const navigate = useNavigate();
  const { login } = useAuth();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const response = await loginApi(username, password);
      login(response.data.access_token);
      navigate('/live');
    } catch (err) {
      console.error('Login error:', err);
      setError(err.response?.data?.detail || 'Authentication failed. Please check your credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async (e) => {
    const emailRegex = /\S+@\S+\.\S+/;
    if (!emailRegex.test(forgotEmail)) {
      setForgotStatus('error');
      setForgotMessage('Please enter a valid email address.');
      setForgotSubmitting(false);
      return;
    }

    try {
      const response = await api.post(`/auth/forgot-password?user_mail=${encodeURIComponent(forgotEmail)}`);
      setForgotStatus('sent');
      setForgotMessage(response.data.message || 'If your email is registered, you will receive a password reset link.');
    } catch (err) {
      setForgotStatus('error');
      const detail = err.response?.data?.detail;
      setForgotMessage(typeof detail === 'string' ? detail : 'Something went wrong. Please try again.');
    } finally {
      setForgotSubmitting(false);
    }
  };

  const handleBackToLogin = () => {
    setShowForgotPassword(false);
    setForgotEmail('');
    setForgotStatus('');
    setForgotMessage('');
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {/* Background patterns */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/20 blur-[120px] rounded-full"></div>
        <div className="absolute top-0 left-0 w-full h-full" style={{
          backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(170, 199, 255, 0.05) 1px, transparent 0)',
          backgroundSize: '32px 32px'
        }}></div>
      </div>

      <div className="w-full max-w-md relative">
        <div className="surface-1 border border-on-surface/5 p-8 rounded-md tech-glow">
          <div className="flex flex-col items-center mb-8">
            <div className="p-3 bg-primary/10 rounded-xl mb-4 border border-primary/20">
              <Shield className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-on-surface tracking-tight uppercase">Tactical Access</h1>
            <p className="text-on-surface-variant text-sm mt-1 uppercase tracking-widest font-mono">System Authentication Required</p>
          </div>

          {/* ===== LOGIN FORM ===== */}
          {!showForgotPassword && (
            <div className="animate-in fade-in duration-300">
              {error && (
                <div className="mb-6 p-3 bg-error/10 border border-error/20 rounded flex gap-3 items-center text-error animate-in fade-in slide-in-from-top-2">
                  <AlertTriangle className="w-5 h-5 shrink-0" />
                  <p className="text-xs font-mono uppercase tracking-tight">{error}</p>
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-mono uppercase text-on-surface-variant tracking-wider">Username</label>
                  <div className="relative group">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant group-focus-within:text-primary transition-colors" />
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Username"
                      required
                      className="w-full pl-10 pr-4 py-3 bg-surface rounded-md border border-on-surface/5 focus:outline-none focus:border-primary/40 transition-all text-sm text-on-surface"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-mono uppercase text-on-surface-variant tracking-wider">Password</label>
                  <div className="relative group">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant group-focus-within:text-primary transition-colors" />
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Password"
                      required
                      className="w-full pl-10 pr-12 py-3 bg-surface rounded-md border border-on-surface/5 focus:outline-none focus:border-primary/40 transition-all text-sm text-on-surface"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Forgot Password Link */}
                <div className="flex justify-end -mt-2">
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(true)}
                    className="text-[11px] font-mono text-primary/70 hover:text-primary transition-colors uppercase tracking-wider cursor-pointer"
                  >
                    Forgot Password?
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-primary hover:bg-primary/90 text-background font-bold py-3 rounded-md transition-all uppercase tracking-widest text-sm primary-glow flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    'Initiate Login'
                  )}
                </button>
              </form>
            </div>
          )}

          {/* ===== FORGOT PASSWORD FORM ===== */}
          {showForgotPassword && (
            <div className="animate-in fade-in duration-300">
              {/* Back button */}
              <button
                onClick={handleBackToLogin}
                className="flex items-center gap-2 text-on-surface-variant hover:text-on-surface transition-colors mb-6 text-[11px] font-mono uppercase tracking-widest cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" /> Back to Login
              </button>

              {forgotStatus === '' && (
                <form noValidate onSubmit={handleForgotPassword} className="space-y-5">
                  <div className="text-center mb-4">
                    <p className="text-xs text-on-surface-variant">
                      Enter your email address and we'll send you a link to reset your password.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-mono uppercase text-on-surface-variant tracking-wider">Email Address</label>
                    <div className="relative group">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant group-focus-within:text-primary transition-colors" />
                      <input
                        type="email"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        placeholder="your@email.com"
                        required
                        className="w-full pl-10 pr-4 py-3 bg-surface rounded-md border border-on-surface/5 focus:outline-none focus:border-primary/40 transition-all text-sm text-on-surface"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={forgotSubmitting || !forgotEmail}
                    className="w-full bg-primary hover:bg-primary/90 text-background font-bold py-3 rounded-md transition-all uppercase tracking-widest text-sm primary-glow flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {forgotSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Mail className="w-4 h-4" />
                        Send Reset Link
                      </>
                    )}
                  </button>
                </form>
              )}

              {/* Email Sent Success */}
              {forgotStatus === 'sent' && (
                <div className="flex flex-col items-center gap-5 py-6 animate-in fade-in zoom-in-95 duration-500">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-full bg-secondary/10 border border-secondary/30 flex items-center justify-center">
                      <CheckCircle className="w-8 h-8 text-secondary" />
                    </div>
                    <div className="absolute inset-0 w-16 h-16 rounded-full bg-secondary/10 blur-xl"></div>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-bold text-secondary uppercase tracking-wider">Email Sent</p>
                    <p className="text-xs text-on-surface-variant mt-2 max-w-xs">{forgotMessage}</p>
                  </div>
                  <button
                    onClick={handleBackToLogin}
                    className="w-full flex items-center justify-center gap-2 bg-surface-highest hover:bg-surface border border-on-surface/10 hover:border-primary/30 text-on-surface font-bold py-3 rounded-md transition-all uppercase tracking-widest text-[11px] mt-2"
                  >
                    <ArrowLeft className="w-4 h-4" /> Return to Login
                  </button>
                </div>
              )}

              {/* Forgot Error */}
              {forgotStatus === 'error' && (
                <div className="flex flex-col items-center gap-5 py-6 animate-in fade-in zoom-in-95 duration-500">
                  <div className="p-3 bg-error/10 border border-error/20 rounded flex gap-3 items-center text-error w-full">
                    <AlertTriangle className="w-5 h-5 shrink-0" />
                    <p className="text-xs font-mono uppercase tracking-tight">{forgotMessage}</p>
                  </div>
                  <button
                    onClick={() => {
                      setForgotStatus('');
                      setForgotMessage('');
                    }}
                    className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-background font-bold py-3 rounded-md transition-all uppercase tracking-widest text-sm primary-glow"
                  >
                    Try Again
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="mt-8 pt-6 border-t border-on-surface/5 text-center">
            <p className="text-xs text-on-surface-variant uppercase tracking-tighter">
              Authorized Personnel Only. All access is logged and monitored.
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-between px-2">
          <span className="text-[10px] text-on-surface-variant font-mono uppercase">V1.0.0 Stable</span>
          <span className="text-[10px] text-on-surface-variant font-mono uppercase">Node ID: 0xFF2A</span>
        </div>
      </div>
    </div>
  );
};

export default Login;
