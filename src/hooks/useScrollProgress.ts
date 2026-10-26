import { useEffect, useRef, useState } from 'react';

/**
 * How far the page has scrolled through an element, from 0 (its top reaches the
 * top of the viewport) to 1 (its bottom reaches the bottom of the viewport).
 * Meant for a tall section with a sticky, full-screen child: the extra height is
 * the scroll distance the animation plays over. Updates at most once per frame.
 */
export function useScrollProgress<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let frame = 0;

    const update = () => {
      frame = 0;
      const node = ref.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      const distance = rect.height - window.innerHeight;
      setProgress(distance > 0 ? Math.min(1, Math.max(0, -rect.top / distance)) : 0);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, []);

  return { ref, progress } as const;
}
