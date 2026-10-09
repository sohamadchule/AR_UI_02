import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/lib/cn';

/** Segmented light/dark switch with a sliding thumb. */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label="Dark mode"
      onClick={toggle}
      className={cn(
        'relative grid h-10 w-[76px] shrink-0 grid-cols-2 items-center rounded-full border border-line/15 bg-fg/[0.04] p-1 transition-colors hover:border-fg/40',
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          'absolute left-1 top-1 h-8 w-8 rounded-full bg-fg shadow-sm transition-transform duration-300 ease-out-expo',
          isDark && 'translate-x-[33px]',
        )}
      />
      <Sun
        size={15}
        aria-hidden
        className={cn('relative z-10 mx-auto transition-colors duration-300', isDark ? 'text-fg-subtle' : 'text-surface')}
      />
      <Moon
        size={15}
        aria-hidden
        className={cn('relative z-10 mx-auto transition-colors duration-300', isDark ? 'text-surface' : 'text-fg-subtle')}
      />
    </button>
  );
}
