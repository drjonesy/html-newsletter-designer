import React from 'react';
import { Check } from 'lucide-react';

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Sits to the left of the switch, filling the row. */
  label?: React.ReactNode;
  hint?: string;
  disabled?: boolean;
}

/** The pill switch from the design: accent with a tick when on, grey when off. */
export const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  checked,
  onChange,
  label,
  hint,
  disabled,
}) => (
  <label
    className={`flex items-center justify-between gap-4 ${
      disabled ? 'opacity-50' : 'cursor-pointer'
    }`}
  >
    {label && (
      <span className="min-w-0">
        <span className="block text-sm text-slate-800">{label}</span>
        {hint && <span className="block text-xs text-slate-500">{hint}</span>}
      </span>
    )}
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
        checked ? 'bg-accent-500' : 'bg-slate-300'
      }`}
    >
      <span
        className={`inline-flex h-5 w-5 items-center justify-center rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-5.5' : 'translate-x-0.5'
        }`}
      >
        {checked && <Check className="h-3 w-3 text-accent-600" />}
      </span>
    </button>
  </label>
);

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: React.ReactNode;
  disabled?: boolean;
}

/** The square variant, used for "Apply to all sides". */
export const Checkbox: React.FC<CheckboxProps> = ({
  checked,
  onChange,
  label,
  disabled,
}) => (
  <label
    className={`flex items-center gap-2.5 ${
      disabled ? 'opacity-50' : 'cursor-pointer'
    }`}
  >
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
        checked
          ? 'border-accent-500 bg-accent-500'
          : 'border-slate-300 bg-white hover:border-slate-400'
      }`}
    >
      {checked && <Check className="h-3.5 w-3.5 text-white" />}
    </button>
    <span className="text-sm text-slate-800">{label}</span>
  </label>
);
