import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface FloatingChipProps {
  icon: ReactNode;
  label: string;
  value: string;
  /** translateZ in px — larger values sit closer to the viewer. */
  depth: number;
  className?: string;
}

/** Glass data chip that floats above the product in 3D space. */
export function FloatingChip({ icon, label, value, depth, className }: FloatingChipProps) {
  return (
    <div
      className={cn('glass-panel absolute z-20 flex items-center gap-3 rounded-xl px-4 py-3 shadow-2xl', className)}
      style={{ transform: `translateZ(${depth}px)` }}
    >
      {icon}
      <div className="flex flex-col">
        <span className="text-[10px] uppercase tracking-wider text-fg-muted">{label}</span>
        <span className="text-xs text-fg">{value}</span>
      </div>
    </div>
  );
}
