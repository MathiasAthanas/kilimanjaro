import type { SelectHTMLAttributes } from 'react';
import { FormError } from './FormError';

type SelectFieldProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  error?: string;
  options: Array<{ label: string; value: string }>;
};

export function SelectField({ label, error, options, ...props }: SelectFieldProps) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-bold text-ks-navy">{label}</span>
      <select className="w-full rounded-lg border border-ks-line bg-ks-mist/20 px-4 py-3 text-sm outline-none transition focus:border-ks-blue focus:ring-2 focus:ring-ks-blue/20" {...props}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      <FormError message={error} />
    </label>
  );
}
