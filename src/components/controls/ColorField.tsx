import React, { useEffect, useRef, useState } from 'react';
import { Ban, X } from 'lucide-react';
import { FieldLabel } from './FieldGroup';

/** `transparent` and `''` both mean "no fill" — normalise to one of them. */
export const NO_COLOR = 'transparent';

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

interface ColorFieldProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  /**
   * Whether the field offers "no colour". True for a background, false for
   * anything that must resolve to something (text, borders).
   */
  clearable?: boolean;
  /** Colour the native picker opens on when the field is currently empty. */
  fallback?: string;
}

/**
 * Swatch + hex field.
 *
 * The swatch is a real `<input type="color">` behind a styled button, because
 * every OS picker is better than anything reimplementable here. Typing is
 * committed only once the text parses as a hex colour, so the block doesn't
 * flicker through `#`, `#2`, `#25`… on the way to `#2563eb`.
 */
export const ColorField: React.FC<ColorFieldProps> = ({
  value,
  onChange,
  label,
  clearable = false,
  fallback = '#000000',
}) => {
  const pickerRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<string | null>(null);

  useEffect(() => {
    setDraft(null);
  }, [value]);

  const isEmpty = !value || value === NO_COLOR;
  const shown = draft ?? (isEmpty ? '' : value);

  const commitText = (raw: string) => {
    const text = raw.trim();
    if (text === '') {
      setDraft(null);
      if (clearable && !isEmpty) onChange(NO_COLOR);
      return;
    }
    const withHash = text.startsWith('#') ? text : `#${text}`;
    if (HEX.test(withHash)) {
      setDraft(null);
      if (withHash.toLowerCase() !== value.toLowerCase()) {
        onChange(withHash.toLowerCase());
      }
    } else {
      // Unparseable — drop back to whatever the block actually has.
      setDraft(null);
    }
  };

  return (
    <div>
      {label && <FieldLabel>{label}</FieldLabel>}
      <div className="flex items-center gap-2 rounded-md border border-slate-300 bg-white px-2 py-1.5 focus-within:border-accent-500 focus-within:ring-1 focus-within:ring-accent-500">
        {/*
          The swatch *is* the colour input, laid over the visual at full size
          and made transparent — rather than a button that forwards a synthetic
          click to a hidden input. A zero-sized or `display:none` colour input
          won't open its picker in every browser, and a proxy click has to fight
          that; overlaying the real control sidesteps both.
        */}
        <span
          className="relative h-6 w-6 shrink-0 overflow-hidden rounded-full border border-slate-300"
          style={isEmpty ? undefined : { backgroundColor: value }}
          title={isEmpty ? 'No colour — click to choose one' : value}
        >
          {isEmpty && (
            <Ban className="absolute inset-0 m-auto h-4 w-4 text-slate-400" />
          )}
          <input
            ref={pickerRef}
            type="color"
            value={isEmpty ? fallback : value}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            aria-label="Choose colour"
          />
        </span>

        <input
          type="text"
          value={shown}
          placeholder="#"
          spellCheck={false}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={(e) => commitText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commitText((e.target as HTMLInputElement).value);
            }
          }}
          className="min-w-0 flex-1 bg-transparent text-sm text-slate-800 outline-none"
        />

        {clearable && !isEmpty && (
          <button
            type="button"
            onClick={() => onChange(NO_COLOR)}
            className="shrink-0 text-slate-400 hover:text-slate-700"
            title="Clear colour"
            aria-label="Clear colour"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
