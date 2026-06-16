import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { ARCH_NODES, CONNECTIONS, SrimNode } from './SrimNodes';
import logoImage from '/assets/digibull-logo.png';

const DEPARTMENTS = ['Mktg / BD', 'Sourcing / SCM', 'Engg', 'MFG', 'Quality', 'HR / Admin / IT'];
const SRIM_LETTERS = ['S', 'R', 'I', 'M'];
const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

function useParticles(ref: React.RefObject<HTMLCanvasElement | null>) {
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let id: number;
    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener('resize', resize);
    const dots = Array.from({ length: 55 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.2 + 0.4,
      vx: (Math.random() - 0.5) * 0.22,
      vy: (Math.random() - 0.5) * 0.22,
      a: Math.random() * 0.35 + 0.08,
    }));
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const d of dots) {
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(34,211,238,${d.a})`;
        ctx.fill();
        d.x = (d.x + d.vx + canvas.width) % canvas.width;
        d.y = (d.y + d.vy + canvas.height) % canvas.height;
      }
      id = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener('resize', resize);
    };
  }, [ref]);
}

function ConnectionLines() {
  const nodeMap = Object.fromEntries(ARCH_NODES.map((n) => [n.id, n]));
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      {CONNECTIONS.map(({ from, to }, i) => {
        const a = nodeMap[from];
        const b = nodeMap[to];
        if (!a || !b) return null;
        return (
          <motion.line
            key={`${from}-${to}`}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke="rgba(34,211,238,0.38)"
            strokeWidth="0.28"
            strokeDasharray="1.5 2"
            initial={{ opacity: 0, strokeDashoffset: 0 }}
            animate={{ opacity: 1, strokeDashoffset: [0, -3.5] }}
            transition={{
              opacity: { duration: 0.8, delay: 1.1 + i * 0.12, ease: EASE },
              strokeDashoffset: {
                duration: 1.8,
                repeat: Infinity,
                ease: 'linear',
                delay: 1.1 + i * 0.12,
              },
            }}
          />
        );
      })}
    </svg>
  );
}

export function SrimBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useParticles(canvasRef);

  return (
    <div className="relative flex h-full flex-col overflow-hidden px-10 py-10">
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />

      {/* Ambient glows */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-28 -top-28 h-[420px] w-[420px] rounded-full bg-cyan-400/10 blur-[130px]" />
        <div className="absolute -right-20 top-0 h-80 w-80 rounded-full bg-amber-400/[0.07] blur-[100px]" />
        <div className="absolute bottom-0 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-indigo-500/12 blur-[100px]" />
      </div>

      {/* Perspective grid floor */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-52"
        style={{
          backgroundImage:
            'linear-gradient(rgba(34,211,238,0.07) 1px,transparent 1px),linear-gradient(90deg,rgba(34,211,238,0.07) 1px,transparent 1px)',
          backgroundSize: '38px 38px',
          transform: 'perspective(480px) rotateX(52deg)',
          transformOrigin: 'bottom center',
          maskImage: 'linear-gradient(to top,rgba(0,0,0,0.45),transparent)',
        }}
      />

      {/* Scanbeam */}
      <div className="srim-beam pointer-events-none absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-cyan-200/10 to-transparent" />

      {/* Hero: logo + SRIM title */}
      <div className="relative z-10 mb-2">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE }}
          className="mb-3 flex items-center gap-2.5"
        >
          <img src={logoImage} alt="DigiBull.ai" className="h-16 w-16 object-contain opacity-90" />
          <span className="text-sm font-bold uppercase tracking-[0.32em] text-white/40">
            DigiBull.ai
          </span>
        </motion.div>

        <div className="flex gap-0.5">
          {SRIM_LETTERS.map((l, i) => (
            <motion.span
              key={l}
              initial={{ opacity: 0, y: 24, rotateX: -40 }}
              animate={{ opacity: 1, y: 0, rotateX: 0 }}
              transition={{ duration: 0.7, delay: 0.1 + i * 0.07, ease: EASE }}
              className="text-[72px] font-black leading-none tracking-[-0.08em] xl:text-[84px]"
              style={{
                background: 'linear-gradient(135deg,#ffffff 0%,#67e8f9 44%,#facc15 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              {l}
            </motion.span>
          ))}
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.55, ease: EASE }}
          className="mt-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/30"
        >
          Skill Runtime Implementation Manager
        </motion.p>
      </div>

      {/* Node visualization area */}
      <div className="relative z-10 flex-1">
        <ConnectionLines />
        {ARCH_NODES.map((node) => (
          <SrimNode key={node.id} node={node} />
        ))}
      </div>

      {/* Department chips */}
      <div className="relative z-10 flex flex-wrap gap-2 pt-4">
        {DEPARTMENTS.map((dept, i) => (
          <motion.span
            key={dept}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 1.4 + i * 0.06, ease: EASE }}
            className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[10px] font-semibold text-white/40 backdrop-blur"
          >
            {dept}
          </motion.span>
        ))}
      </div>
    </div>
  );
}
