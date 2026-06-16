import { useEffect, useState, type ReactNode } from 'react';
import { MotionConfig } from 'framer-motion';
import { APPEARANCE_EVENT, getAppearance } from '@/lib/appearance';

/**
 * Bridges the "Animations" appearance toggle to framer-motion.
 *
 * The CSS layer (appearance.css `[data-motion='off']`) only neutralises CSS
 * transitions/animations. The vast majority of motion in this app is driven by
 * framer-motion (JavaScript), which ignores that CSS entirely — which is why
 * toggling animations previously looked like it did nothing.
 *
 * MotionConfig with `reducedMotion="always"` makes framer-motion skip transform,
 * layout and other spatial animations app-wide, giving the toggle a real,
 * visible effect. We subscribe to APPEARANCE_EVENT so it flips live.
 */
export function AppMotionConfig({ children }: { children: ReactNode }) {
  const [motionEnabled, setMotionEnabled] = useState<boolean>(() => getAppearance().motion);

  useEffect(() => {
    const handler = () => setMotionEnabled(getAppearance().motion);
    window.addEventListener(APPEARANCE_EVENT, handler);
    return () => window.removeEventListener(APPEARANCE_EVENT, handler);
  }, []);

  return <MotionConfig reducedMotion={motionEnabled ? 'never' : 'always'}>{children}</MotionConfig>;
}
