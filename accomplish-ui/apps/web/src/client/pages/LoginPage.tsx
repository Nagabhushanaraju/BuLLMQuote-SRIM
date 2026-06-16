import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, useLocation, Link } from 'react-router';
import { AnimatePresence, motion } from 'framer-motion';
import { loginWithCredentials } from '@/lib/session';
import { Eye, EyeSlash } from '@phosphor-icons/react';
import { loginWithGoogle } from '@/lib/session';
import { AuthLayout, Field, PrimaryButton, OrDivider, GoogleButton } from './auth-shared';

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

  const runAuth = async (action: () => Promise<unknown>, fallback: string) => {
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      await action();
      void navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : fallback);
    } finally {
      setLoading(false);
    }
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
    void runAuth(
      () => loginWithCredentials(identifier.trim(), password),
      'Sign in failed. Check your credentials.',
    );
  };

  const handleGoogleLogin = () =>
    void runAuth(() => loginWithGoogle(), 'Google sign-in is not connected yet.');

  // For development/testing only. Remove or disable in production.
  const handleTestLogin = () =>
    void runAuth(
      () => loginWithCredentials(TEST_CREDS.username, TEST_CREDS.password),
      'Test login failed.',
    );

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
      </form>

      <AnimatePresence>
        {(error ?? notice) && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={`mt-3 rounded-2xl border px-4 py-3 text-sm ${
              error
                ? 'border-red-300/20 bg-red-400/10 text-red-100'
                : 'border-cyan-200/20 bg-cyan-200/10 text-cyan-50'
            }`}
          >
            {error ?? notice}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-4 space-y-3">
        <OrDivider />
        <GoogleButton onClick={handleGoogleLogin} disabled={loading} />
      </div>

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
