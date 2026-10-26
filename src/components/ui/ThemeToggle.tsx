import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/cn';

/**
 * Ghost icon button that swaps the current theme. Deliberately quiet: in the
 * header it sits next to the demo CTA and must not compete with it.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      onClick={toggle}
      className={cn(
        'grid h-9 w-9 shrink-0 place-items-center rounded-lg text-fg-muted transition-colors hover:bg-fg/[0.06] hover:text-fg',
        className,
      )}
    >
      {isDark ? <Moon size={17} aria-hidden /> : <Sun size={17} aria-hidden />}
    </button>
  );
}
