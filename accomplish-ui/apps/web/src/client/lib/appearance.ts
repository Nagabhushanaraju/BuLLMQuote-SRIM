/**
 * Appearance customization — client-only, layered ON TOP of the existing
 * light/dark theme system (see theme-core.ts). It writes `data-*` attributes on
 * <html> which appearance.css turns into CSS-variable overrides. Preferences are
 * persisted in localStorage; NO backend involvement, so it cannot break the
 * daemon/IPC layer.
 *
 * Controls: accent color palette, "dim" (medium) contrast, animations on/off,
 * and a decorative background pattern.
 */

export type AccentId = 'green' | 'blue' | 'violet' | 'amber' | 'rose';
export type PatternId = 'none' | 'stripes' | 'dots' | 'grid';

export interface AppearancePrefs {
  accent: AccentId;
  dim: boolean;
  motion: boolean;
  pattern: PatternId;
}

export const ACCENTS: ReadonlyArray<{ id: AccentId; label: string; swatch: string }> = [
  { id: 'green', label: 'Forest', swatch: 'hsl(123 30% 42%)' },
  { id: 'blue', label: 'Ocean', swatch: 'hsl(212 70% 50%)' },
  { id: 'violet', label: 'Violet', swatch: 'hsl(262 60% 58%)' },
  { id: 'amber', label: 'Amber', swatch: 'hsl(35 90% 50%)' },
  { id: 'rose', label: 'Rose', swatch: 'hsl(346 70% 55%)' },
];

export const PATTERNS: ReadonlyArray<{ id: PatternId; label: string }> = [
  { id: 'none', label: 'None' },
  { id: 'stripes', label: 'Stripes' },
  { id: 'dots', label: 'Dots' },
  { id: 'grid', label: 'Grid' },
];

const KEYS = {
  accent: 'appearance.accent',
  dim: 'appearance.dim',
  motion: 'appearance.motion',
  pattern: 'appearance.pattern',
} as const;

const ACCENT_IDS = ACCENTS.map((a) => a.id);
const PATTERN_IDS = PATTERNS.map((p) => p.id);

const DEFAULTS: AppearancePrefs = { accent: 'green', dim: false, motion: true, pattern: 'none' };

function readString<T extends string>(key: string, fallback: T, valid: readonly T[]): T {
  try {
    const v = localStorage.getItem(key);
    return v && (valid as readonly string[]).includes(v) ? (v as T) : fallback;
  } catch {
    return fallback;
  }
}

function readBool(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v === 'true';
  } catch {
    return fallback;
  }
}

export function getAppearance(): AppearancePrefs {
  return {
    accent: readString(KEYS.accent, DEFAULTS.accent, ACCENT_IDS),
    dim: readBool(KEYS.dim, DEFAULTS.dim),
    motion: readBool(KEYS.motion, DEFAULTS.motion),
    pattern: readString(KEYS.pattern, DEFAULTS.pattern, PATTERN_IDS),
  };
}

/** Event fired on <window> whenever appearance prefs change (for React subscribers). */
export const APPEARANCE_EVENT = 'appearance:changed';

export function applyAppearance(p: AppearancePrefs): void {
  const el = document.documentElement;
  el.setAttribute('data-accent', p.accent);
  el.setAttribute('data-motion', p.motion ? 'on' : 'off');
  el.setAttribute('data-pattern', p.pattern);
  if (p.dim) {
    el.setAttribute('data-contrast', 'dim');
  } else {
    el.removeAttribute('data-contrast');
  }
  // Notify subscribers (e.g. the MotionConfig wrapper) that prefs changed so
  // JavaScript-driven (framer-motion) animations can react, not just CSS.
  try {
    window.dispatchEvent(new CustomEvent(APPEARANCE_EVENT, { detail: p }));
  } catch {
    // window/CustomEvent unavailable (SSR/tests); safe to ignore.
  }
}

function persist(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // localStorage may be unavailable; preference simply won't persist.
  }
}

export function setAccent(accent: AccentId): void {
  persist(KEYS.accent, accent);
  applyAppearance(getAppearance());
}

export function setDim(dim: boolean): void {
  persist(KEYS.dim, String(dim));
  applyAppearance(getAppearance());
}

export function setMotion(motion: boolean): void {
  persist(KEYS.motion, String(motion));
  applyAppearance(getAppearance());
}

export function setPattern(pattern: PatternId): void {
  persist(KEYS.pattern, pattern);
  applyAppearance(getAppearance());
}

/** Apply persisted appearance once at app boot (call before/at React mount). */
export function initAppearance(): void {
  applyAppearance(getAppearance());
}
