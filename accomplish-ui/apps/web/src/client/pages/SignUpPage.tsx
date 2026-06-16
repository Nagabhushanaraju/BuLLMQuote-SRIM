import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, Link } from 'react-router';
import { AnimatePresence, motion } from 'framer-motion';
import { registerUser } from '@/lib/session';
import { Eye, EyeSlash } from '@phosphor-icons/react';
import { loginWithGoogle } from '@/lib/session';
import { AuthLayout, Field, PrimaryButton, OrDivider, GoogleButton } from './auth-shared';

const STRENGTH_COLORS = ['bg-red-400', 'bg-orange-400', 'bg-yellow-400', 'bg-green-400'];

function getStrength(p: string): { level: number; label: string } {
  if (p.length < 8) return { level: 0, label: 'Too short (min 8 characters)' };
  const score = [/\d/.test(p), /[A-Z]/.test(p), /[^a-zA-Z0-9]/.test(p)].filter(Boolean).length;
  if (score === 0) return { level: 1, label: 'Weak' };
  if (score === 1) return { level: 2, label: 'Good' };
  return { level: 3, label: 'Strong' };
}

export function SignUpPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const strength = getStrength(password);

  const handleGoogleSignUp = () => {
    setError(null);
    void loginWithGoogle().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : 'Google sign-in is not connected yet.');
    });
  };

  const doRegister = async () => {
    setLoading(true);
    setError(null);
    try {
      await registerUser(username.trim(), email.trim().toLowerCase(), password);
      void navigate('/login', { state: { registered: true }, replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setError('Username is required.');
      return;
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Enter a valid email address.');
      return;
    }
    if (strength.level === 0) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    void doRegister();
  };

  return (
    <AuthLayout subtitle="Join SRIM" title="Create Account">
      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <Field
          id="signup-username"
          label="Username"
          value={username}
          placeholder="yourname"
          autoComplete="username"
          onChange={(v) => {
            setUsername(v);
            setError(null);
          }}
        />
        <Field
          id="signup-email"
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
        <div>
          <Field
            id="signup-password"
            label="Password"
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
          {password && (
            <div className="mt-2 space-y-1">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                      i < strength.level ? STRENGTH_COLORS[strength.level] : 'bg-white/10'
                    }`}
                  />
                ))}
              </div>
              <p
                className={`text-[11px] ${
                  strength.level >= 2 ? 'text-green-300/70' : 'text-orange-300/70'
                }`}
              >
                {strength.label}
              </p>
            </div>
          )}
        </div>
        <Field
          id="signup-confirm"
          label="Confirm Password"
          type={showConfirm ? 'text' : 'password'}
          value={confirm}
          placeholder="Re-enter password"
          autoComplete="new-password"
          onChange={(v) => {
            setConfirm(v);
            setError(null);
          }}
          rightAdornment={
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowConfirm((s) => !s)}
              className="text-white/40 transition hover:text-white/70"
            >
              {showConfirm ? <EyeSlash size={16} /> : <Eye size={16} />}
            </button>
          }
        />
        <PrimaryButton loading={loading} loadingText="Creating account...">
          Create Account
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

      <div className="mt-4 space-y-3">
        <OrDivider />
        <GoogleButton onClick={handleGoogleSignUp} disabled={loading} />
      </div>

      <div className="mt-4 text-center text-xs">
        <span className="text-white/40">Already have an account? </span>
        <Link to="/login" className="font-semibold text-cyan-200/80 transition hover:text-cyan-100">
          Sign In
        </Link>
      </div>
    </AuthLayout>
  );
}
