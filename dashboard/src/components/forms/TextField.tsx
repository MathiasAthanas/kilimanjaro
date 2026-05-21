import type { InputHTMLAttributes } from 'react';
import { FormError } from './FormError';

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
};

export function TextField({ label, error, className = '', ...props }: TextFieldProps) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-bold text-ks-navy">{label}</span>
      <input
        className={`w-full rounded-lg border border-ks-line bg-ks-mist/20 px-4 py-3 text-sm outline-none transition focus:border-ks-blue focus:ring-2 focus:ring-ks-blue/20 ${className}`}
        {...props}
      />
      <FormError message={error} />
    </label>
  );
}
