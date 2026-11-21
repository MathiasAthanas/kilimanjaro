import { BedDouble, Home } from 'lucide-react';
import type { ResidenceType } from '../api/residence.hooks';

/**
 * Two big cards: In campus (Boarding) or Off campus (Day Scholar). Used everywhere a student is classified,
 * so the choice looks and reads the same in admissions, enrolment and the student profile.
 */
export function ResidenceChoice({
  value,
  onChange,
  allowUndecided = false,
  disabled = false,
}: {
  value: ResidenceType | '' | null | undefined;
  onChange: (value: ResidenceType | '') => void;
  allowUndecided?: boolean;
  disabled?: boolean;
}) {
  const options: Array<{ value: ResidenceType; title: string; hint: string; Icon: typeof Home }> = [
    { value: 'BOARDING', title: 'In campus', hint: 'Boarding. Sleeps at school and goes to a dormitory.', Icon: BedDouble },
    { value: 'DAY_SCHOLAR', title: 'Off campus', hint: 'Day scholar. Goes home every day.', Icon: Home },
  ];
  return (
    <div role="radiogroup" aria-label="Where does the student stay" className="grid gap-3 sm:grid-cols-2">
      {options.map(({ value: option, title, hint, Icon }) => {
        const selected = value === option;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(option)}
            className={`flex items-start gap-3 rounded-xl border-2 p-4 text-left transition disabled:opacity-60 ${selected ? 'border-[#00334f] bg-[#eef5f8] shadow-sm' : 'border-[#d5dde6] bg-white hover:border-[#00334f]/50'}`}
          >
            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${selected ? 'bg-[#00334f] text-white' : 'bg-[#f1f5f9] text-[#64748b]'}`}>
              <Icon className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-base font-black text-[#00334f]">{title}</span>
              <span className="mt-0.5 block text-xs font-semibold text-[#64748b]">{hint}</span>
            </span>
          </button>
        );
      })}
      {allowUndecided && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange('')}
          className={`rounded-xl border-2 border-dashed px-4 py-2 text-left text-sm font-bold sm:col-span-2 ${!value ? 'border-[#00334f] bg-[#eef5f8] text-[#00334f]' : 'border-[#d5dde6] text-[#64748b] hover:border-[#00334f]/50'}`}
        >
          Not decided yet. It must be set before enrolment.
        </button>
      )}
    </div>
  );
}
