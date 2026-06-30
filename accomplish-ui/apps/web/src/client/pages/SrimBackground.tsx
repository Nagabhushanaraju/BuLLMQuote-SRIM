import { motion } from 'framer-motion';
import logoImage from '/assets/digibull-logo.png';

const SRIM_LETTERS = ['S', 'R', 'I', 'M'];
const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.7, delay, ease: EASE },
});

export function SrimBackground() {
  return (
    <div className="relative flex h-full min-h-screen flex-col items-center justify-center overflow-hidden bg-[#020B18] px-10 py-10">

      {/* Ambient glow orbs */}
      <div className="pointer-events-none absolute left-1/4 top-1/4 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-400/10 blur-[90px]" />
      <div className="pointer-events-none absolute bottom-1/4 right-1/4 h-64 w-64 translate-x-1/2 translate-y-1/2 rounded-full bg-amber-400/8 blur-[80px]" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-500/6 blur-[100px]" />

      {/* Center branding stack */}
      <div className="relative z-10 flex flex-col items-center gap-6 text-center">

        {/* Bull logo */}
        <motion.img
          src={logoImage}
          alt="DigiBull.ai"
          {...fadeUp(0.1)}
          className="h-40 w-40 object-contain drop-shadow-[0_0_40px_rgba(34,211,238,0.35)]"
        />

        {/* SRIM letters */}
        <div className="flex gap-1">
          {SRIM_LETTERS.map((l, i) => (
            <motion.span
              key={l}
              {...fadeUp(0.25 + i * 0.08)}
              className="text-8xl font-black leading-none tracking-[-0.06em]"
              style={{
                background: 'linear-gradient(135deg,#ffffff 0%,#67e8f9 45%,#facc15 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              {l}
            </motion.span>
          ))}
        </div>

        {/* Full name */}
        <motion.p
          {...fadeUp(0.6)}
          className="text-xs font-semibold uppercase tracking-[0.28em] text-white/40"
        >
          Skill Runtime Implementation Manager
        </motion.p>
      </div>

      {/* Bottom — Powered by */}
      <motion.div
        {...fadeUp(0.85)}
        className="absolute bottom-8 left-0 right-0 z-10 flex items-center justify-center gap-2"
      >
        <img src={logoImage} alt="" className="h-4 w-4 object-contain opacity-40" />
        <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/30">
          Powered by DigiBull.ai
        </span>
      </motion.div>

    </div>
  );
}
