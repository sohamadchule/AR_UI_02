import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'outline';
type Size = 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
}

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-fg text-surface hover:bg-fg/80',
  outline:
    'border border-fg/25 text-fg hover:border-fg hover:bg-fg hover:text-surface',
};

const SIZES: Record<Size, string> = {
  md: 'px-6 py-2.5 text-xs uppercase tracking-[0.15em]',
  lg: 'px-8 py-4 text-sm tracking-wide',
};

/** Class list shared by <Button> and anchors that should look like one. */
export function buttonClasses(variant: Variant = 'primary', size: Size = 'lg', className?: string) {
  return cn(
    'group inline-flex items-center justify-center gap-2 rounded-full font-medium transition-colors duration-300',
    VARIANTS[variant],
    SIZES[size],
    className,
  );
}

export function Button({
  variant = 'primary',
  size = 'lg',
  icon,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClasses(variant, size, className)}
      {...rest}
    >
      {children}
      {icon && <span className="transition-transform group-hover:translate-x-1">{icon}</span>}
    </button>
  );
}
