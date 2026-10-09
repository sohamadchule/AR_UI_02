import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface BadgeProps {
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Badge({ icon, children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'glass-panel inline-flex items-center gap-3 rounded-full border-line/10 px-4 py-1.5 text-xs uppercase tracking-widest text-fg-soft',
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}
