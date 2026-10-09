import { useEffect, useState } from 'react';

interface ScrollState {
  /** Past the top of the page. */
  scrolled: boolean;
  /** Scrolling down (header should tuck away). */
  hidden: boolean;
}

/**
 * Tracks scroll position and direction. `hidden` flips on as soon as the user
 * scrolls down past `offset`, and off the moment they scroll back up anywhere.
 */
export function useScrollDirection(offset = 50, threshold = 6): ScrollState {
  const [state, setState] = useState<ScrollState>({ scrolled: false, hidden: false });

  useEffect(() => {
    let lastY = window.scrollY;
    let ticking = false;

    const update = () => {
      const y = window.scrollY;
      const delta = y - lastY;
      setState((prev) => {
        const scrolled = y > offset;
        let hidden = prev.hidden;
        if (!scrolled) hidden = false;
        else if (delta > threshold) hidden = true;
        else if (delta < -threshold) hidden = false;
        return scrolled === prev.scrolled && hidden === prev.hidden ? prev : { scrolled, hidden };
      });
      if (Math.abs(delta) > threshold) lastY = y;
      ticking = false;
    };

    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    };

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [offset, threshold]);

  return state;
}
