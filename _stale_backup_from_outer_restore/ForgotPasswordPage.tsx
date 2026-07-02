import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router';
import { AnimatePresence, motion } from 'framer-motion';
import { requestPasswordReset } from '@/lib/session';
import { AuthLayout, Field, PrimaryButton } from './auth-shared';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const doSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      // Best-effort: always show success to avoid revealing whether email is registered.
      await requestPasswordReset(email.trim().toLowerCase());
    } catch {
      // Swallow — backend not yet wired; show success regardless.
    } finally {
      setLoading(false);
      setSent(true);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Enter a valid email address.');
      return;
    }
    void doSubmit();
  };

  return (
    <AuthLayout subtitle="Password Recovery" title="Reset Password">
      {sent ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-5 space-y-4"
        >
          <div className="rounded-2xl border border-cyan-200/20 bg-cyan-200/[0.08] px-5 py-4 text-sm text-cyan-50">
            <p className="font-bold">Check your inbox</p>
            <p className="mt-1 text-cyan-50/70">
              If <span className="font-semibold text-cyan-100">{email}</span> is registered, you
              will receive a reset link shortly.
            </p>
          </div>
          <Link
            to="/login"
            className="block text-center text-xs font-semibold text-cyan-200/80 transition hover:text-cyan-100"
          >
            Back to Sign In
          </Link>
        </motion.div>
      ) : (
        <>
          <p className="mt-3 text-sm text-white/45">
            Enter your registered email address and we will send you a reset link.
          </p>
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <Field
              id="reset-email"
              label="Email Address"
              type="email"
              value={email}
              placeholder="you@example.com"
              autoComplete="email"
              onChange={(v) => {
                setEmail(v);
                setError(null);
              }}
            />
            <PrimaryButton loading={loading} loadingText="Sending...">
              Send Reset Link
            </PrimaryButton>
          </form>

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="mt-3 rounded-2xl border border-red-300/20 bg-red-400/10 px-4 py-3 text-sm text-red-100"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-4 text-center text-xs">
            <Link
              to="/login"
              className="font-semibold text-cyan-200/80 transition hover:text-cyan-100"
            >
              Back to Sign In
            </Link>
          </div>
        </>
      )}
    </AuthLayout>
  );
}
