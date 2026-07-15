import { useState } from 'react';
import { motion } from 'framer-motion';
import { Palette, Sparkle } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';
import {
  ACCENTS,
  PATTERNS,
  getAppearance,
  setAccent,
  setDim,
  setMotion,
  setPattern,
  type AccentId,
  type PatternId,
} from '@/lib/appearance';

/**
 * Appearance / "Customize" panel — accent palette, dim (medium) contrast,
 * animations toggle, and background pattern. Client-only (see lib/appearance.ts).
 * Labels are inline English (this panel is additive; no locale keys required).
 */
export function CustomizePanel() {
  const initial = getAppearance();
  const [accent, setAccentState] = useState<AccentId>(initial.accent);
  const [dim, setDimState] = useState(initial.dim);
  const [motionEnabled, setMotionState] = useState(initial.motion);
  const [pattern, setPatternState] = useState<PatternId>(initial.pattern);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className="rounded-lg border border-border bg-card p-5 space-y-5 shadow-lg shadow-primary/5"
    >
      <div className="flex items-center gap-2 font-medium text-foreground">
        <Palette className="h-4 w-4 text-muted-foreground" />
        Customize appearance
      </div>

      {/* Accent palette */}
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="text-sm font-medium text-foreground">Accent color</div>
          <p className="mt-1 text-sm text-muted-foreground">
            Recolors buttons, links and highlights.
          </p>
        </div>
        <div className="ml-4 flex items-center gap-2">
          {ACCENTS.map((a) => (
            <motion.button
              whileHover={{ scale: 1.16, y: -2 }}
              whileTap={{ scale: 0.9 }}
              key={a.id}
              type="button"
              aria-label={a.label}
              title={a.label}
              onClick={() => {
                setAccent(a.id);
                setAccentState(a.id);
              }}
              className={cn(
                'h-6 w-6 rounded-full border transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-ring',
                accent === a.id
                  ? 'ring-2 ring-ring ring-offset-2 ring-offset-card'
                  : 'border-border',
              )}
              style={{ background: a.swatch }}
            />
          ))}
        </div>
      </div>

      {/* Dim (medium) */}
      <ToggleRow
        title="Dim mode (medium)"
        description="A softer, mid-contrast dark theme — between light and full dark."
        checked={dim}
        onChange={(v) => {
          setDim(v);
          setDimState(v);
        }}
      />

      {/* Animations */}
      <ToggleRow
        title="Animations"
        description="Turn interface motion and transitions on or off."
        checked={motionEnabled}
        onChange={(v) => {
          setMotion(v);
          setMotionState(v);
        }}
      />

      {/* Background pattern */}
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Sparkle className="h-4 w-4 text-muted-foreground" />
            Background pattern
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Subtle decorative texture behind the app.
          </p>
        </div>
        <div className="ml-4 flex items-center gap-1 rounded-md border border-border p-0.5">
          {PATTERNS.map((p) => (
            <motion.button
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.96 }}
              key={p.id}
              type="button"
              onClick={() => {
                setPattern(p.id);
                setPatternState(p.id);
              }}
              className={cn(
                'rounded px-2.5 py-1 text-xs transition-colors',
                pattern === p.id
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.08]',
              )}
            >
              {p.label}
            </motion.button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

interface ToggleRowProps {
  title: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}

function ToggleRow({ title, description, checked, onChange }: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex-1">
        <div className="text-sm font-medium text-foreground">{title}</div>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <motion.button
        whileTap={{ scale: 0.92 }}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'ml-4 relative h-6 w-11 shrink-0 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-ring',
          checked ? 'bg-primary' : 'bg-input',
        )}
      >
        <motion.span
          layout
          className={cn(
            'absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-5' : 'translate-x-0',
          )}
        />
      </motion.button>
    </div>
  );
}
