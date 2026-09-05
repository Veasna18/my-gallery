import { useEffect, useState, type FormEvent } from 'react';
import { X, Loader2, Camera, Mail, Lock, User, Eye, EyeOff } from 'lucide-react';
import { loginAdmin } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode: 'login' | 'signup';
  onAdminLogin?: () => void;
}

const RESEND_COOLDOWN_SECONDS = 60;

function getAuthErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Authentication failed';
  const normalizedMessage = message.toLowerCase();

  if (
    normalizedMessage.includes('rate limit') ||
    normalizedMessage.includes('too many requests') ||
    normalizedMessage.includes('email rate limit')
  ) {
    return 'Email sending is temporarily rate-limited. Please wait a few minutes and try again.';
  }

  return message;
}

export default function AuthModal({ isOpen, onClose, initialMode, onAdminLogin }: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [resendingConfirmation, setResendingConfirmation] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown === 0) return;

    const timer = window.setInterval(() => {
      setResendCooldown((seconds) => Math.max(0, seconds - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (mode === 'login' && loginAdmin(email, password)) {
        onAdminLogin?.();
        onClose();
        return;
      }

      if (mode === 'signup') {
        const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
        if (signUpError) throw signUpError;
        if (!data.session) {
          setSuccess('Account created. Check your email to confirm your address, then sign in.');
          return;
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
      }
      onClose();
    } catch (err) {
      setError(getAuthErrorMessage(err));
      setSuccess(null);
    } finally {
      setLoading(false);
    }
  };

  const resendConfirmation = async () => {
    if (resendCooldown > 0 || resendingConfirmation) return;

    setResendingConfirmation(true);
    setError(null);
    setSuccess(null);

    const { error: resendError } = await supabase.auth.resend({
      type: 'signup',
      email,
    });

    if (resendError) {
      setError(getAuthErrorMessage(resendError));
    } else {
      setSuccess('Confirmation email sent. Check your inbox, then sign in.');
    }

    setResendCooldown(RESEND_COOLDOWN_SECONDS);
    setResendingConfirmation(false);
  };

  const needsConfirmation = error?.toLowerCase().includes('email not confirmed');

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="relative bg-gradient-to-br from-slate-800 to-slate-600 px-6 py-8 text-center">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-white/10 mx-auto mb-3">
            <Camera className="w-7 h-7 text-white" />
          </div>
          <h2 className="text-xl font-bold text-white">
            {mode === 'login' ? 'Welcome Back' : 'Create Account'}
          </h2>
          <p className="text-sm text-white/60 mt-1">
            {mode === 'login'
              ? 'Sign in to access your media gallery'
              : 'Sign up to start your personal media collection'}
          </p>
        </div>

        <div className="px-6 py-6 space-y-4">
          {/* Email/Password Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full pl-10 pr-10 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                <div className="flex items-start gap-2">
                  <X className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{needsConfirmation ? 'Please confirm your email address before signing in.' : error}</span>
                </div>
                {needsConfirmation && (
                  <button
                    type="button"
                    onClick={resendConfirmation}
                    disabled={resendingConfirmation || resendCooldown > 0 || !email}
                    className="mt-2 ml-6 font-semibold underline disabled:opacity-60"
                  >
                    {resendingConfirmation
                      ? 'Sending...'
                      : resendCooldown > 0
                        ? `Try again in ${resendCooldown}s`
                        : 'Resend confirmation email'}
                  </button>
                )}
              </div>
            )}

            {success && (
              <div className="px-3 py-2.5 rounded-lg bg-green-50 border border-green-200 text-sm text-green-700">
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || Boolean(success)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-slate-800 text-white text-sm font-semibold hover:bg-slate-700 transition-colors disabled:opacity-60"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : mode === 'login' ? (
                <User className="w-4 h-4" />
              ) : null}
              {loading
                ? 'Please wait...'
                : mode === 'login'
                  ? 'Sign In'
                  : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500">
            {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <button
              type="button"
              onClick={() => {
                setMode(mode === 'login' ? 'signup' : 'login');
                setError(null);
                setSuccess(null);
              }}
              className="text-slate-600 font-semibold hover:underline"
            >
              {mode === 'login' ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
