import type { ReactNode } from 'react';

type BadgeProps = {
  children: ReactNode;
  tone?: 'blue' | 'emerald' | 'amber' | 'rose' | 'slate' | 'gold';
  variant?: 'blue' | 'emerald' | 'amber' | 'rose' | 'slate' | 'gold' | string;
  className?: string;
};

const tones = {
  blue: 'bg-ks-blue/10 text-ks-blue',
  emerald: 'bg-ks-emerald/10 text-ks-emerald',
  amber: 'bg-ks-amber/10 text-ks-amber',
  rose: 'bg-ks-rose/10 text-ks-rose',
  slate: 'bg-ks-slate/10 text-ks-slate',
  gold: 'bg-ks-gold/20 text-[#7a5200]',
};

export function Badge({ children, tone, variant, className = '' }: BadgeProps) {
  const resolvedTone = (tone ?? variant ?? 'blue') as keyof typeof tones;
  return (
    <span className={`rounded px-2 py-1 text-[10px] font-extrabold uppercase tracking-wider ${tones[resolvedTone] ?? tones.blue} ${className}`}>
      {children}
    </span>
  );
}
