import { Skeleton } from './Skeleton';

interface SkeletonCardsProps {
  count?: number;
  /** Tailwind grid cols class, e.g. "md:grid-cols-3" */
  cols?: string;
}

/** Animated placeholder for a card grid while content loads. */
export function SkeletonCards({ count = 6, cols = 'md:grid-cols-3' }: SkeletonCardsProps) {
  return (
    <div className={`grid gap-4 ${cols}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-ks-line bg-white p-5 space-y-3">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-2/3" />
          <Skeleton className="h-8 w-1/2 mt-2" />
        </div>
      ))}
    </div>
  );
}
