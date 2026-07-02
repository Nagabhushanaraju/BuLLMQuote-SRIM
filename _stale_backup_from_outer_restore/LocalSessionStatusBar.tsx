import { useEffect, useState } from 'react';
import { LockKey, WifiNone } from '@phosphor-icons/react';
import { getSession } from '@/lib/session';

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) { return `${h}h ${m}m ${String(s).padStart(2, '0')}s`; }
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

export function LocalSessionStatusBar() {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const session = getSession();
    if (!session) { return; }

    const tick = () => {
      setElapsed(Math.floor((Date.now() - session.createdAt) / 1000));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex h-7 w-full shrink-0 items-center justify-between border-t border-slate-800/60 bg-[#020b18] px-4">
      {/* Left — session timer */}
      <div className="flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
        <span className="text-[10px] font-mono text-slate-500">
          SESSION ACTIVE —{' '}
          <span className="text-slate-400">{formatElapsed(elapsed)}</span>
        </span>
      </div>

      {/* Center — hardware lock */}
      <div className="flex items-center gap-1.5">
        <LockKey className="h-3 w-3 text-emerald-500/70" />
        <span className="text-[10px] font-mono font-semibold uppercase tracking-widest text-emerald-500/70">
          Local Hardware Lock
        </span>
      </div>

      {/* Right — offline mode */}
      <div className="flex items-center gap-1.5 rounded-full border border-slate-700/60 bg-slate-900/60 px-2 py-0.5">
        <WifiNone className="h-3 w-3 text-amber-400/70" />
        <span className="text-[10px] font-mono text-amber-400/70 uppercase tracking-wider">
          Offline Mode
        </span>
      </div>
    </div>
  );
}
