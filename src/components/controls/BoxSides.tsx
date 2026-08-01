import React, { useState } from 'react';
import { NumberStepper } from './NumberStepper';
import { Checkbox } from './ToggleSwitch';

export type Side = 'top' | 'bottom' | 'left' | 'right';

/**
 * Display order, which is not the CSS order: the design pairs the two vertical
 * sides on one row and the two horizontal sides on the next, because that is
 * how people think about padding.
 */
const ORDER: Side[] = ['top', 'bottom', 'left', 'right'];

interface BoxSidesProps {
  /** Prefixes each field's label, e.g. "Padding" -> "Padding top". */
  label: string;
  /**
   * Which sides this box actually has. Margins on most blocks are top/bottom
   * only — the generator emits no left/right margin for them, so offering the
   * fields would be a control that does nothing.
   */
  sides?: Side[];
  values: Partial<Record<Side, number>>;
  onChange: (next: Partial<Record<Side, number>>) => void;
  min?: number;
  max?: number;
}

/**
 * The four-side box control, with the design's "Apply to all sides" checkbox.
 *
 * Linked collapses to a single field driving every side. The initial state is
 * *derived* from the values — a block whose sides already match opens linked,
 * which is right far more often than defaulting either way, and matches what
 * the screenshots show (margins all 0 → linked; padding 12/12/24/24 → not).
 *
 * After that it is local UI state, deliberately: unlinking and typing the same
 * number into all four shouldn't silently re-link and take the other three
 * fields away mid-edit.
 */
export const BoxSides: React.FC<BoxSidesProps> = ({
  label,
  sides = ORDER,
  values,
  onChange,
  min = 0,
  max,
}) => {
  const shown = ORDER.filter((side) => sides.includes(side));
  const present = shown.map((side) => values[side] ?? 0);
  const [linked, setLinked] = useState(
    () => present.length > 1 && present.every((v) => v === present[0])
  );

  const setAll = (value: number) => {
    onChange(Object.fromEntries(shown.map((side) => [side, value])));
  };

  return (
    <div className="space-y-3">
      {linked ? (
        <NumberStepper
          label={label}
          value={present[0] ?? 0}
          onChange={setAll}
          min={min}
          max={max}
        />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {shown.map((side) => (
            <NumberStepper
              key={side}
              label={`${label} ${side}`}
              value={values[side] ?? 0}
              onChange={(value) => onChange({ [side]: value })}
              min={min}
              max={max}
            />
          ))}
        </div>
      )}

      {shown.length > 1 && (
        <Checkbox
          checked={linked}
          label="Apply to all sides"
          onChange={(next) => {
            setLinked(next);
            // Linking has to make the sides agree, or the single field would
            // show one number while three others quietly kept different ones.
            if (next) setAll(present[0] ?? 0);
          }}
        />
      )}
    </div>
  );
};
