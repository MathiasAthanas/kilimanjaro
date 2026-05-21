import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'quiet' | 'outline-white';
  loading?: boolean;
  children: ReactNode;
};

const variants = {
  primary:       'bg-ks-blue text-white hover:shadow-lg hover:shadow-ks-blue/20',
  secondary:     'bg-white text-ks-navy border border-ks-line hover:bg-ks-paper',
  ghost:         'bg-transparent text-ks-navy hover:bg-ks-mist/40',
  danger:        'bg-ks-rose text-white hover:shadow-lg hover:shadow-ks-rose/20',
  success:       'bg-ks-emerald text-white hover:shadow-lg hover:shadow-ks-emerald/20',
  quiet:         'bg-ks-mist/30 text-ks-navy hover:bg-ks-mist',
  // For use on dark/image backgrounds — transparent with white border + text
  'outline-white': 'bg-transparent text-white border border-white/40 hover:bg-white/12 hover:border-white/70',
};

export function Button({ variant = 'primary', loading = false, children, className = '', disabled, ...props }: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : null}
      {children}
    </button>
  );
}
