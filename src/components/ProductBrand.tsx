import { cn } from './ui/utils';

/** Brand colors are fixed across themes — the mark is identity, not surface. */
export function AgynMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="agyn-mark-gradient" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#3B82F6" />
          <stop offset="1" stopColor="#8B5CF6" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#agyn-mark-gradient)" />
      <rect x="8" y="8" width="6.5" height="6.5" rx="2" fill="#FFFFFF" />
      <rect x="17.5" y="8" width="6.5" height="6.5" rx="2" fill="#FFFFFF" />
      <rect x="8" y="17.5" width="6.5" height="6.5" rx="2" fill="#FFFFFF" />
      <rect x="17.5" y="17.5" width="6.5" height="6.5" rx="2" fill="#FFFFFF" fillOpacity="0.65" />
    </svg>
  );
}

type ProductBrandProps = {
  /** Product name shown after the wordmark, e.g. "chat". */
  product: string;
  className?: string;
};

export function ProductBrand({ product, className }: ProductBrandProps) {
  return (
    <span className={cn('flex items-center gap-2', className)}>
      <AgynMark className="h-7 w-7 shrink-0" />
      <span className="text-base leading-none">
        <span className="font-semibold text-foreground">agyn</span>{' '}
        <span className="text-muted-foreground">{product}</span>
      </span>
    </span>
  );
}
