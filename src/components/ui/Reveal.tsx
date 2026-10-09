import type { ElementType, ReactNode } from 'react';
import { useScrollReveal } from '@/hooks/useScrollReveal';
import { cn } from '@/lib/cn';

interface RevealProps {
  children: ReactNode;
  as?: ElementType;
  threshold?: number;
  className?: string;
}

/** Fades and slides its children in the first time they scroll into view. */
export function Reveal({ children, as: Tag = 'div', threshold, className }: RevealProps) {
  const { ref, isVisible } = useScrollReveal(threshold);
  return (
    <Tag ref={ref} data-visible={isVisible} className={cn('reveal', className)}>
      {children}
    </Tag>
  );
}
