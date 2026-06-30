import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, useLocation, Link } from 'react-router';
import { AnimatePresence, motion } from 'framer-motion';
import { loginWithCredentials } from '@/lib/session';
import { Eye, EyeSlash, LockKey, ShieldCheck } from '@phosphor-icons/react';
import { AuthLayout, Field, PrimaryButton } from './auth-shared';

// For development/testing only. Remove or disable in production.
const TEST_CREDS = {
  username: 'digibull',
  password: 'srim-test-2026',
};

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const state = location.state as {
      loggedOut?: boolean;
      registered?: boolean;
      passwordReset?: boolean;
    } | null;
    if (state?.loggedOut) setNotice('You have been signed out successfully.');
    if (state?.registered) setNotice('Account created successfully. Please sign in.');
    if (state?.passwordReset) setNotice('Password updated successfully. Please sign in.');
  }, [location.state]);

  const classifyError = (err: unknown): string => {
    const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
    if (msg.includes('fetch') || msg.includes('network') || msg.includes('refused') || msg.includes('failed to fetch')) {
      return '🔴 Cannot reach authentication server. Check your network or firewall.';
    }
    if (msg.includes('inactive') || msg.includes('disabled') || msg.includes('domain') || msg.includes('403')) {
      return '⚠️ Account inactive or domain access denied. Contact your administrator.';
    }
    return '❌ Invalid username or password. Please try again.';
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) {
      setError('Enter your username or email.');
      return;
    }
    if (!password.trim()) {
      setError('Enter your password.');
      return;
    }
    setLoading(true);
    setError(null);
    setNotice(null);
    loginWithCredentials(identifier.trim(), password)
      .then(() => { void navigate('/', { replace: true }); })
      .catch((err) => { setError(classifyError(err)); })
      .finally(() => { setLoading(false); });
  };

  // For development/testing only. Remove or disable in production.
  const handleTestLogin = () => {
    setLoading(true);
    setError(null);
    setNotice(null);
    loginWithCredentials(TEST_CREDS.username, TEST_CREDS.password)
      .then(() => { void navigate('/', { replace: true }); })
      .catch((err) => { setError(classifyError(err)); })
      .finally(() => { setLoading(false); });
  };

  return (
    <AuthLayout subtitle="Welcome back" title="Login to SRIM" badge="Secure">
      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <Field
          id="identifier"
          label="Username or Email"
          value={identifier}
          placeholder="username or email@example.com"
          autoComplete="username"
          onChange={(v) => {
            setIdentifier(v);
            setError(null);
          }}
        />
        <Field
          id="password"
          label="Password"
          type={showPassword ? 'text' : 'password'}
          value={password}
          placeholder="Enter password"
          autoComplete="current-password"
          onChange={(v) => {
            setPassword(v);
            setError(null);
          }}
          rightAdornment={
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPassword((s) => !s)}
              className="text-white/40 transition hover:text-white/70"
            >
              {showPassword ? <EyeSlash size={16} /> : <Eye size={16} />}
            </button>
          }
        />
        <PrimaryButton loading={loading} loadingText="Signing in...">
          Sign In
        </PrimaryButton>

        {/* On-Prem Verified badge */}
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
          <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-400" />
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400">On-Prem Verified</p>
            <p className="text-[10px] text-emerald-300/60">Authentication handled locally — no cloud access</p>
          </div>
          <LockKey className="ml-auto h-4 w-4 shrink-0 text-emerald-500/50" />
        </div>
      </form>

      <AnimatePresence>
        {(error ?? notice) && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={`mt-3 rounded-2xl border px-4 py-3 text-sm ${
              error
                ? error.startsWith('⚠️')
                  ? 'border-amber-300/20 bg-amber-400/10 text-amber-100'
                  : 'border-red-300/20 bg-red-400/10 text-red-100'
                : 'border-cyan-200/20 bg-cyan-200/10 text-cyan-50'
            }`}
          >
            {error ?? notice}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-4 flex items-center justify-between text-xs">
        <Link
          to="/forgot-password"
          className="font-semibold text-cyan-200/80 transition hover:text-cyan-100"
        >
          Forgot password?
        </Link>
        <span className="text-white/40">
          New user?{' '}
          <Link
            to="/signup"
            className="font-semibold text-amber-100/80 transition hover:text-amber-50"
          >
            Sign up
          </Link>
        </span>
      </div>

      {/* For development/testing only. Remove or disable in production. */}
      {import.meta.env.DEV && (
        <div className="mt-5 rounded-2xl border border-dashed border-white/15 bg-white/[0.045] p-3 text-xs text-white/50">
          <div className="flex items-center justify-between gap-3">
            <p className="font-mono uppercase tracking-widest text-cyan-100/80">Dev test access</p>
            <button
              type="button"
              disabled={loading}
              onClick={handleTestLogin}
              className="rounded-full bg-cyan-200 px-3 py-1.5 font-black text-slate-950 disabled:opacity-50"
            >
              Sign in as Tester
            </button>
          </div>
          <p className="mt-2 font-mono">
            user: {TEST_CREDS.username} / pass: {TEST_CREDS.password}
          </p>
        </div>
      )}
    </AuthLayout>
  );
}
