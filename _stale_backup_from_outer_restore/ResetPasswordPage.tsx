import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { AnimatePresence, motion } from 'framer-motion';
import { Eye, EyeSlash } from '@phosphor-icons/react';
import { resetPassword } from '@/lib/session';
import { AuthLayout, Field, PrimaryButton } from './auth-shared';

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) {
      setError('Reset link is missing or invalid. Request a new one.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await resetPassword(token, password);
      void navigate('/login', { state: { passwordReset: true }, replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed. The link may have expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout subtitle="Set new credentials" title="Reset Password">
      <form onSubmit={(e) => void handleSubmit(e)} className="mt-5 space-y-4">
        <Field
          id="reset-password"
          label="New Password"
          type={showPassword ? 'text' : 'password'}
          value={password}
          placeholder="Min 8 characters"
          autoComplete="new-password"
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
        <Field
          id="reset-confirm"
          label="Confirm Password"
          type="password"
          value={confirm}
          placeholder="Re-enter password"
          autoComplete="new-password"
          onChange={(v) => {
            setConfirm(v);
            setError(null);
          }}
        />
        <PrimaryButton loading={loading} loadingText="Updating password...">
          Update Password
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
    </AuthLayout>
  );
}
