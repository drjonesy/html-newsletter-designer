import React from 'react';
import { ChevronDown } from 'lucide-react';
import { FieldLabel } from './FieldGroup';

export interface SelectOption<T extends string> {
  value: T;
  label: string;
}

interface SelectFieldProps<T extends string> {
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  label?: string;
  disabled?: boolean;
}

/**
 * A `<select>` wearing the design's chrome.
 *
 * The native element is kept — it gets keyboard behaviour, mobile pickers and
 * accessibility for free, and nothing in the design needs a custom popup. The
 * chevron is drawn on top with `appearance-none` hiding the browser's own.
 */
export function SelectField<T extends string>({
  value,
  options,
  onChange,
  label,
  disabled,
}: SelectFieldProps<T>) {
  return (
    <div className={disabled ? 'opacity-50' : undefined}>
      {label && <FieldLabel>{label}</FieldLabel>}
      <div className="relative">
        <select
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value as T)}
          className="w-full appearance-none rounded-md border border-slate-300 bg-white py-2 pl-3 pr-9 text-sm text-slate-800 outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-500"
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
      </div>
    </div>
  );
}
