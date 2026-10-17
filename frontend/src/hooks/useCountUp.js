import { useEffect, useState } from 'react';
// Eased count-up for dashboard statistics. Skips animation when the user prefers reduced motion.
export default function useCountUp(target, duration = 800) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!Number.isFinite(target)) return undefined;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || target === 0) { setValue(target); return undefined; }
    let raf; let start;
    const step = (t) => { start ??= t; const p = Math.min((t - start) / duration, 1); setValue(Math.round(target * (1 - (1 - p) ** 3))); if (p < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}
