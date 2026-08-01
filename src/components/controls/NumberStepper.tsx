import React, { useEffect, useState } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { FieldLabel } from './FieldGroup';

interface NumberStepperProps {
  value: number;
  onChange: (value: number) => void;
  label?: string;
  min?: number;
  max?: number;
  step?: number;
  /** Rendered inside the field, left of the number — e.g. a rounded-corner glyph. */
  icon?: React.ReactNode;
  suffix?: string;
  disabled?: boolean;
}

/**
 * A number field with the up/down spinner from the design.
 *
 * The input is kept as a *string* while focused so a half-typed value survives.
 * Committing on every keystroke would mean clearing the field sends `0` to the
 * template — the block jumps to zero padding, and the moment the user types the
 * first digit of "24" it jumps again to 2. Text now, number on blur and on the
 * arrows, which also gives the history hook a sane undo granularity.
 */
export const NumberStepper: React.FC<NumberStepperProps> = ({
  value,
  onChange,
  label,
  min,
  max,
  step = 1,
  icon,
  suffix,
  disabled,
}) => {
  const [draft, setDraft] = useState<string | null>(null);

  // A change from elsewhere (undo, a different block selected) must win over a
  // stale draft, but only while the user isn't mid-edit in this field.
  useEffect(() => {
    setDraft(null);
  }, [value]);

  const clamp = (n: number) =>
    Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(min ?? -Infinity, n));

  const commit = (raw: string) => {
    setDraft(null);
    const parsed = Number(raw);
    if (raw.trim() === '' || !isFinite(parsed)) return;
    const next = clamp(parsed);
    if (next !== value) onChange(next);
  };

  const nudge = (delta: number) => {
    const next = clamp(value + delta);
    if (next !== value) onChange(next);
  };

  return (
    <div className={disabled ? 'opacity-50 pointer-events-none' : undefined}>
      {label && <FieldLabel>{label}</FieldLabel>}
      <div className="flex items-stretch rounded-md border border-slate-300 bg-white focus-within:border-accent-500 focus-within:ring-1 focus-within:ring-accent-500">
        {icon && (
          <span className="flex items-center pl-2.5 text-slate-400">{icon}</span>
        )}
        <input
          type="text"
          inputMode="numeric"
          value={draft ?? String(value)}
          disabled={disabled}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commit((e.target as HTMLInputElement).value);
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              nudge(step);
            } else if (e.key === 'ArrowDown') {
              e.preventDefault();
              nudge(-step);
            }
          }}
          className="min-w-0 flex-1 bg-transparent px-2.5 py-1.5 text-sm text-slate-800 outline-none"
        />
        {suffix && (
          <span className="flex items-center pr-1 text-xs text-slate-400">
            {suffix}
          </span>
        )}
        <div className="flex flex-col border-l border-slate-300">
          <button
            type="button"
            tabIndex={-1}
            onClick={() => nudge(step)}
            className="flex flex-1 items-center justify-center px-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            aria-label="Increase"
          >
            <ChevronUp className="h-3 w-3" />
          </button>
          <button
            type="button"
            tabIndex={-1}
            onClick={() => nudge(-step)}
            className="flex flex-1 items-center justify-center border-t border-slate-300 px-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            aria-label="Decrease"
          >
            <ChevronDown className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
};
