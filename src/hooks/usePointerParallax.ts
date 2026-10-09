import { useCallback, useRef, useState, type PointerEvent } from 'react';

export interface PointerOffset {
  x: number;
  y: number;
}

const CENTER: PointerOffset = { x: 0, y: 0 };

/**
 * Tracks the pointer inside an element, normalised to the range [-1, 1]
 * on both axes. Resets to centre when the pointer leaves.
 * Touch input is ignored so mobile scrolling is never hijacked.
 */
export function usePointerParallax<T extends HTMLElement = HTMLElement>() {
  const ref = useRef<T>(null);
  const [offset, setOffset] = useState<PointerOffset>(CENTER);

  const onPointerMove = useCallback((e: PointerEvent<T>) => {
    if (e.pointerType === 'touch' || !ref.current) return;
    const { left, top, width, height } = ref.current.getBoundingClientRect();
    setOffset({
      x: ((e.clientX - left) / width - 0.5) * 2,
      y: ((e.clientY - top) / height - 0.5) * 2,
    });
  }, []);

  const onPointerLeave = useCallback(() => setOffset(CENTER), []);

  return { ref, offset, handlers: { onPointerMove, onPointerLeave } } as const;
}
