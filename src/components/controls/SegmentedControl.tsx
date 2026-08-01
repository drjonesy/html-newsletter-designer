import React from 'react';
import { FieldLabel } from './FieldGroup';

export interface Segment<T extends string> {
  value: T;
  label?: string;
  icon?: React.ReactNode;
  title?: string;
}

interface SegmentedControlProps<T extends string> {
  value: T;
  segments: Segment<T>[];
  onChange: (value: T) => void;
  label?: string;
  /** Fill the row rather than sizing to content. */
  block?: boolean;
  size?: 'sm' | 'md';
}

/**
 * The pill-track switch from the design — Original / Fill / Scale, and the
 * desktop/mobile toggle above the canvas.
 *
 * The selected segment is a raised white card on a grey track, so the control
 * reads as one thing rather than as a row of buttons.
 */
export function SegmentedControl<T extends string>({
  value,
  segments,
  onChange,
  label,
  block = true,
  size = 'md',
}: SegmentedControlProps<T>) {
  return (
    <div>
      {label && <FieldLabel>{label}</FieldLabel>}
      <div
        role="tablist"
        className={`inline-flex rounded-lg bg-slate-100 p-1 ${
          block ? 'flex w-full' : ''
        }`}
      >
        {segments.map((segment) => {
          const active = segment.value === value;
          return (
            <button
              key={segment.value}
              type="button"
              role="tab"
              aria-selected={active}
              title={segment.title ?? segment.label}
              onClick={() => onChange(segment.value)}
              className={`flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors ${
                block ? 'flex-1' : ''
              } ${size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm'} ${
                active
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {segment.icon}
              {segment.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
