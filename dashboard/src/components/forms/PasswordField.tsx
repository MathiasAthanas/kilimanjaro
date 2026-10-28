import { useState, type InputHTMLAttributes } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { FormError } from './FormError';

type PasswordFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label: string;
  error?: string;
};

export function PasswordField({ label, error, className = '', ...props }: PasswordFieldProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <label className="block space-y-2">
      <span className="text-sm font-bold text-ks-navy">{label}</span>
      <span className="relative block">
        <input
          type={isVisible ? 'text' : 'password'}
          className={`w-full rounded-lg border border-ks-line bg-ks-mist/20 px-4 py-3 pr-12 text-sm outline-none transition focus:border-ks-blue focus:ring-2 focus:ring-ks-blue/20 ${className}`}
          {...props}
        />
        <button
          type="button"
          className="absolute inset-y-0 right-1 my-1 flex w-10 items-center justify-center rounded-md text-ks-muted transition hover:bg-ks-blue/10 hover:text-ks-blue focus:outline-none focus:ring-2 focus:ring-ks-blue/30"
          aria-label={isVisible ? 'Hide password' : 'Show password'}
          aria-pressed={isVisible}
          title={isVisible ? 'Hide password' : 'Show password'}
          onClick={() => setIsVisible((visible) => !visible)}
        >
          {isVisible ? <EyeOff aria-hidden="true" className="h-5 w-5" /> : <Eye aria-hidden="true" className="h-5 w-5" />}
        </button>
      </span>
      <FormError message={error} />
    </label>
  );
}
