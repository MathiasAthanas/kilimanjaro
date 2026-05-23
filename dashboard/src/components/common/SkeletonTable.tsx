import { Skeleton } from './Skeleton';

interface SkeletonTableProps {
  rows?: number;
  cols?: number;
}

/** Animated placeholder for a data table while content loads. */
export function SkeletonTable({ rows = 6, cols = 4 }: SkeletonTableProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-ks-line bg-white">
      <div className="overflow-x-auto">
        {/* Header row */}
        <div className="min-w-max border-b border-ks-line bg-ks-paper px-5 py-3">
          <div className="flex gap-4">
            {Array.from({ length: cols }).map((_, i) => (
              <Skeleton key={i} className={`h-3 ${i === 0 ? 'w-32' : 'w-20'}`} />
            ))}
          </div>
        </div>
        {/* Data rows */}
        {Array.from({ length: rows }).map((_, r) => (
          <div
            key={r}
            className="flex min-w-max items-center gap-4 border-b border-ks-line px-5 py-4 last:border-0"
          >
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton
                key={c}
                className={`h-4 ${c === 0 ? 'w-40' : c === cols - 1 ? 'w-16' : 'w-24'}`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
