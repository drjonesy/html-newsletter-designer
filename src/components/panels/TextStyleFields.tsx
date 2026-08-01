import React from 'react';
import { Bold, Italic } from 'lucide-react';
import { TypographyStyle } from '../../types';
import {
  ColorField,
  NumberStepper,
  SelectField,
  ThemedField,
} from '../controls';

/**
 * The seven fields that make up a text style.
 *
 * Used twice, deliberately: by the Theme panel to edit a scale entry, and by
 * the Inspector to override one on a single block. Both show the *resolved*
 * value; only the Inspector passes `overrides`, which is what turns each field
 * into a themed one with a reset.
 */
export interface TextStyleFieldsProps {
  value: TypographyStyle;
  onChange: (patch: Partial<TypographyStyle>) => void;
  /**
   * Which fields the block sets for itself. Omit entirely when editing the
   * theme, where every field is by definition set.
   */
  overrides?: (keyof TypographyStyle)[];
  onReset?: (field: keyof TypographyStyle) => void;
  /** Stable per subject, so a colour drag folds into one undo step. */
  coalesceScope: string;
  /** Colour commits are coalesced by the caller; everything else is discrete. */
  onColorChange?: (color: string) => void;
}

export const TextStyleFields: React.FC<TextStyleFieldsProps> = ({
  value,
  onChange,
  overrides,
  onReset,
  onColorChange,
}) => {
  const themed = (
    field: keyof TypographyStyle,
    control: React.ReactNode
  ): React.ReactNode => {
    if (!overrides || !onReset) return control;
    return (
      <ThemedField
        overridden={overrides.includes(field)}
        onReset={() => onReset(field)}
      >
        {control}
      </ThemedField>
    );
  };

  return (
    <div className="space-y-3">
      {themed(
        'color',
        <ColorField
          label="Colour"
          value={value.color}
          onChange={(color) =>
            onColorChange ? onColorChange(color) : onChange({ color })
          }
        />
      )}

      <div className="grid grid-cols-2 gap-3">
        {themed(
          'fontSize',
          <NumberStepper
            label="Size"
            suffix="px"
            min={8}
            max={72}
            value={value.fontSize}
            onChange={(fontSize) => onChange({ fontSize })}
          />
        )}
        {themed(
          'lineHeight',
          <NumberStepper
            label="Line height"
            min={1}
            max={3}
            step={0.1}
            value={value.lineHeight}
            onChange={(lineHeight) => onChange({ lineHeight })}
          />
        )}
      </div>

      {/*
        Bold and italic are one control in the design but two fields in the
        model, so an override on either has to be resettable on its own — hence
        the pair rather than a single two-up toggle.
      */}
      <div className="grid grid-cols-2 gap-3">
        {themed(
          'fontWeight',
          <ToggleButton
            active={value.fontWeight === 'bold'}
            icon={<Bold className="h-4 w-4" />}
            label="Bold"
            onClick={() =>
              onChange({
                fontWeight: value.fontWeight === 'bold' ? 'normal' : 'bold',
              })
            }
          />
        )}
        {themed(
          'fontStyle',
          <ToggleButton
            active={value.fontStyle === 'italic'}
            icon={<Italic className="h-4 w-4" />}
            label="Italic"
            onClick={() =>
              onChange({
                fontStyle: value.fontStyle === 'italic' ? 'normal' : 'italic',
              })
            }
          />
        )}
      </div>

      {themed(
        'transform',
        <SelectField
          label="Letter case"
          value={value.transform}
          options={[
            { value: 'none', label: 'As typed' },
            { value: 'uppercase', label: 'UPPERCASE' },
            { value: 'capitalize', label: 'Title Case' },
          ]}
          onChange={(transform) => onChange({ transform })}
        />
      )}

      {themed(
        'letterSpacing',
        <NumberStepper
          label="Letter spacing"
          suffix="px"
          min={-2}
          max={12}
          step={0.5}
          value={parseFloat(value.letterSpacing) || 0}
          onChange={(n) => onChange({ letterSpacing: `${n}px` })}
        />
      )}
    </div>
  );
};

const ToggleButton: React.FC<{
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}> = ({ active, icon, label, onClick }) => (
  <button
    type="button"
    aria-pressed={active}
    onClick={onClick}
    className={`flex h-9 items-center justify-center gap-1.5 self-end rounded-md border text-sm font-semibold ${
      active
        ? 'border-accent-500 bg-accent-50 text-accent-700'
        : 'border-slate-300 text-slate-600 hover:bg-slate-50'
    }`}
  >
    {icon}
    {label}
  </button>
);
