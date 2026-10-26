import { useEffect, useRef, useState } from 'react';

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Smooth-scrolls to a section by id (instantly with reduced motion). The top id scrolls to the very top. */
export function scrollToSection(id: string) {
  const behavior: ScrollBehavior = prefersReducedMotion() ? 'auto' : 'smooth';
  if (id === 'top') {
    window.scrollTo({ top: 0, behavior });
    return;
  }
  document.getElementById(id)?.scrollIntoView({ behavior, block: 'start' });
}

/** True once the element has come within `margin` of the viewport; stays true. For lazy-mounting heavy content. */
export function useNearViewport<T extends Element>(margin = '300px') {
  const ref = useRef<T>(null);
  const [near, setNear] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || near) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setNear(true);
      },
      { rootMargin: margin },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [margin, near]);

  return { ref, near } as const;
}

/**
 * Whether this device should open AR directly (a phone or tablet), rather than be
 * shown a QR code to scan with one. The AR page itself still checks real support
 * and explains when the browser cannot do it.
 */
export function isArDevice() {
  if (typeof navigator === 'undefined') return false;
  const touch = window.matchMedia('(pointer: coarse)').matches;
  return touch && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}
