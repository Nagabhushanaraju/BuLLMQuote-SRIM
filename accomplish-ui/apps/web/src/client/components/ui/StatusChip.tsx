import { motion } from 'framer-motion';
import { Check, X, Warning } from '@phosphor-icons/react';
import { springs } from '@/lib/animations';
import { cn } from '@/lib/utils';

export type ChipState = 'running' | 'done' | 'error' | 'pending' | 'warning';

interface StatusChipProps {
  state: ChipState;
  label: string;
  /** Optional trailing detail, e.g. a duration like "4.2s" */
  detail?: string;
  className?: string;
}

const STATE_CLASSES: Record<ChipState, string> = {
  running: 'border-blue-500/40 bg-blue-500/10 text-blue-400',
  done: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400',
  error: 'border-red-500/40 bg-red-500/10 text-red-400',
  pending: 'border-slate-800 bg-slate-900/40 text-slate-500',
  warning: 'border-amber-500/40 bg-amber-500/10 text-amber-400',
};

function StateIndicator({ state }: { state: ChipState }) {
  if (state === 'done') {
    return <Check className="h-3 w-3 shrink-0" weight="bold" />;
  }
  if (state === 'error') {
    return <X className="h-3 w-3 shrink-0" weight="bold" />;
  }
  if (state === 'warning') {
    return <Warning className="h-3 w-3 shrink-0" weight="fill" />;
  }
  if (state === 'running') {
    return <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current animate-pulse" />;
  }
  // pending — hollow dot
  return <span className="h-1.5 w-1.5 shrink-0 rounded-full border border-current" />;
}

/**
 * Status-first chip used across the canvas: pipeline stages, agent tools,
 * data-quality tiles. Every entity declares its state before its data.
 */
export function StatusChip({ state, label, detail, className }: StatusChipProps) {
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={springs.snappy}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider whitespace-nowrap',
        STATE_CLASSES[state],
        className,
      )}
    >
      <StateIndicator state={state} />
      <span>{label}</span>
      {detail && <span className="opacity-60 normal-case">{detail}</span>}
    </motion.span>
  );
}
