const options = [
  { value: 'PRESENT', label: 'Present', on: 'bg-emerald-600 text-white border-emerald-600' },
  { value: 'ABSENT', label: 'Absent', on: 'bg-rose-600 text-white border-rose-600' },
  { value: 'ON_LEAVE', label: 'On leave', on: 'bg-sky-600 text-white border-sky-600' },
  { value: 'EXCUSED', label: 'Excused', on: 'bg-amber-500 text-white border-amber-500' },
] as const;

/** One tap per student at roll call. Everyone starts as present; only the exceptions need touching. */
export function StatusToggle({ value, onChange, name }: { value: string; onChange: (value: string) => void; name: string }) {
  return (
    <div role="radiogroup" aria-label={`Status of ${name}`} className="inline-flex overflow-hidden rounded-lg border border-slate-200">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`border-r border-slate-200 px-3 py-1.5 text-xs font-black last:border-r-0 ${value === o.value ? o.on : 'bg-white text-slate-500 hover:bg-slate-50'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
