import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { SpinnerGap, ShieldCheck } from '@phosphor-icons/react';
import { SrimBackground } from './SrimBackground';
import logoImage from '/assets/digibull-logo.png';

export const DIGIBULL_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

const SRIM_LETTERS = ['S', 'R', 'I', 'M'];

export const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, delay, ease: DIGIBULL_EASE },
});

export function Field({
  id,
  label,
  type = 'text',
  value,
  placeholder,
  autoComplete,
  onChange,
  rightAdornment,
  error,
}: {
  id: string;
  label: string;
  type?: string;
  value: string;
  placeholder: string;
  autoComplete?: string;
  onChange: (v: string) => void;
  rightAdornment?: ReactNode;
  error?: string;
}) {
  return (
    <label htmlFor={id} className="block space-y-1.5">
      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
        {label}
      </span>
      <div className="relative">
        <input
          id={id}
          type={type}
          value={value}
          placeholder={placeholder}
          autoComplete={autoComplete}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full rounded-2xl border bg-white/[0.07] py-3 text-sm text-white outline-none transition-all duration-200 placeholder:text-white/25 focus:bg-white/[0.1] focus:shadow-[0_0_0_4px_rgba(34,211,238,0.12)] ${error ? 'border-red-400/50 focus:border-red-400/70' : 'border-white/10 focus:border-cyan-300/60'} ${rightAdornment ? 'pl-4 pr-10' : 'px-4'}`}
        />
        {rightAdornment && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">{rightAdornment}</div>
        )}
      </div>
      {error && <p className="mt-1 text-[11px] text-red-300/70">{error}</p>}
    </label>
  );
}

export function PrimaryButton({
  loading,
  disabled,
  loadingText = 'Please wait...',
  children,
}: {
  loading: boolean;
  disabled?: boolean;
  loadingText?: string;
  children: ReactNode;
}) {
  return (
    <motion.button
      type="submit"
      disabled={loading || disabled}
      whileHover={{ scale: loading || disabled ? 1 : 1.015, y: loading || disabled ? 0 : -1 }}
      whileTap={{ scale: loading || disabled ? 1 : 0.99 }}
      className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-gradient-to-r from-cyan-300 via-blue-400 to-amber-300 px-4 py-3 text-sm font-black text-slate-950 shadow-[0_20px_60px_-24px_rgba(34,211,238,0.75)] transition disabled:cursor-not-allowed disabled:opacity-45"
    >
      <span className="absolute inset-0 translate-x-[-120%] bg-white/35 blur-xl transition-transform duration-700 group-hover:translate-x-[120%]" />
      {loading ? (
        <SpinnerGap className="h-4 w-4 animate-spin" />
      ) : (
        <ShieldCheck className="h-4 w-4" />
      )}
      <span className="relative">{loading ? loadingText : children}</span>
    </motion.button>
  );
}

export function OrDivider() {
  return (
    <div className="flex items-center gap-3">
      <div className="h-px flex-1 bg-white/10" />
      <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/35">or</span>
      <div className="h-px flex-1 bg-white/10" />
    </div>
  );
}

// export function GoogleButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
//   return (
//     <motion.button
//       type="button"
//       disabled={disabled}
//       onClick={onClick}
//       whileHover={{ scale: disabled ? 1 : 1.015, y: disabled ? 0 : -1 }}
//       whileTap={{ scale: disabled ? 1 : 0.99 }}
//       className="flex w-full items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-semibold text-white/85 transition hover:border-white/25 hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-45"
//     >
//       <span className="grid h-5 w-5 place-items-center rounded-full bg-white text-xs font-black text-slate-900">
//         G
//       </span>
//       Continue with Google
//     </motion.button>
//   );
// }

export function AuthLayout({
  subtitle,
  title,
  badge,
  children,
}: {
  subtitle: string;
  title: string;
  badge?: string;
  children: ReactNode;
}) {
  return (
    <>
      <style>{`
        @keyframes srim-beam {
          0%        { transform: translateY(-100%); opacity: 0; }
          12%, 82%  { opacity: 1; }
          100%      { transform: translateY(2800%); opacity: 0; }
        }
        .srim-beam { animation: srim-beam 7s ease-in-out infinite; }
      `}</style>

      <main className="relative min-h-screen overflow-hidden bg-[#020B18] text-white">
        <div className="grid min-h-screen lg:grid-cols-[1fr_480px]">
          <section className="hidden lg:block">
            <SrimBackground />
          </section>

          <section className="flex min-h-screen flex-col items-center justify-center border-l border-white/[0.07] bg-black/25 px-6 py-10 backdrop-blur-none">
            {/* Mobile-only branding */}
            <div className="mb-8 flex flex-col items-center lg:hidden">
              <img
                src={logoImage}
                alt="DigiBull.ai"
                className="mb-3 h-12 w-12 object-contain opacity-80"
              />
              <div className="flex gap-0.5">
                {SRIM_LETTERS.map((l, i) => (
                  <motion.span
                    key={l}
                    {...fadeUp(0.1 + i * 0.07)}
                    className="text-6xl font-black leading-none tracking-[-0.08em]"
                    style={{
                      background: 'linear-gradient(135deg,#fff 0%,#67e8f9 45%,#facc15 100%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                    }}
                  >
                    {l}
                  </motion.span>
                ))}
              </div>
            </div>

            {/* Auth card */}
            <div className="w-full max-w-md">
              <motion.div
                initial={{ opacity: 0, x: 24, scale: 0.97 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                transition={{ duration: 0.75, delay: 0.2, ease: DIGIBULL_EASE }}
                className="relative overflow-hidden rounded-[2rem] border border-white/[0.11] bg-white/[0.075] shadow-[0_40px_120px_-50px_rgba(0,0,0,0.95)] backdrop-blur-2xl"
              >
                <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/50 to-transparent" />
                <div className="rounded-[1.65rem] border border-white/10 bg-black/25 p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.26em] text-cyan-300/70">
                        {subtitle}
                      </p>
                      <h2
                        className="mt-1.5 text-2xl font-black tracking-[-0.04em]"
                        style={{
                          background: 'linear-gradient(135deg,#ffffff 0%,#67e8f9 44%,#facc15 100%)',
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                        }}
                      >
                        {title}
                      </h2>
                    </div>
                    {badge && (
                      <div className="rounded-2xl border border-cyan-200/20 bg-cyan-200/10 px-3 py-2 text-right text-[10px] font-bold uppercase tracking-widest text-cyan-100">
                        {badge}
                      </div>
                    )}
                  </div>
                  {children}
                </div>
              </motion.div>
            </div>

            {/* Status strip
            <motion.div
              {...fadeUp(1.0)}
              className="mt-5 flex items-center gap-5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/25"
            >
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
                System Online
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.8)]" />
                6 Departments
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.8)]" />
                AI Routing Active
              </span>
            </motion.div> */}
          </section>
        </div>
      </main>
    </>
  );
}
