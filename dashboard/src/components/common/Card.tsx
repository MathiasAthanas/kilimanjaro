import type { HTMLAttributes } from 'react';

export function Card({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  // If caller passes a base bg-* (not a variant like hover:bg-*), skip the default bg-white
  // Matches "bg-" at string start or after a space — ignores "hover:bg-", "focus:bg-", etc.
  const bg = /(^| )bg-/.test(className) ? '' : 'bg-white';
  return <div className={`rounded-xl border border-ks-line shadow-sm ${bg} ${className}`.trim()} {...props} />;
}
