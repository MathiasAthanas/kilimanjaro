import type { LucideIcon } from 'lucide-react';

type AdvancedIconProps = {
  icon: LucideIcon;
  tone?: 'blue' | 'gold' | 'emerald' | 'amber' | 'rose' | 'slate';
  badge?: boolean;
};

const toneClasses = {
  blue: 'bg-ks-mist text-ks-blue border-ks-blue/10',
  gold: 'bg-ks-gold/10 text-ks-gold border-ks-gold/20',
  emerald: 'bg-ks-emerald/10 text-ks-emerald border-ks-emerald/20',
  amber: 'bg-ks-amber/10 text-ks-amber border-ks-amber/20',
  rose: 'bg-ks-rose/10 text-ks-rose border-ks-rose/20',
  slate: 'bg-ks-slate/10 text-ks-slate border-ks-slate/10',
};

export function AdvancedIcon({ icon: Icon, tone = 'blue', badge = false }: AdvancedIconProps) {
  return (
    <span className={`relative inline-flex h-12 w-12 items-center justify-center rounded-xl border ${toneClasses[tone]}`}>
      <Icon className="h-6 w-6" aria-hidden />
      {badge ? <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-white bg-ks-gold" /> : null}
    </span>
  );
}
