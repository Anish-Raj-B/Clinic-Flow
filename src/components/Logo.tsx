import { cn } from '../lib/utils';

/** ClinicFlow wordmark with the medical cross glyph. */
export function Logo({
  className,
  showText = true,
  size = 'md',
}: {
  className?: string;
  showText?: boolean;
  size?: 'sm' | 'md' | 'lg';
}) {
  const boxSize = size === 'lg' ? 'h-11 w-11' : size === 'sm' ? 'h-8 w-8' : 'h-9 w-9';
  const textSize = size === 'lg' ? 'text-2xl' : size === 'sm' ? 'text-base' : 'text-lg';

  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <span
        className={cn(
          'flex shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm dark:bg-brand-500',
          boxSize,
        )}
      >
        <svg viewBox="0 0 24 24" className="h-3/5 w-3/5" fill="currentColor" aria-hidden="true">
          <path d="M10 4h4v6h6v4h-6v6h-4v-6H4v-4h6z" />
        </svg>
      </span>
      {showText ? (
        <span className={cn('font-bold tracking-tight text-slate-900 dark:text-white', textSize)}>
          Clinic<span className="text-brand-600 dark:text-brand-400">Flow</span>
        </span>
      ) : null}
    </span>
  );
}
