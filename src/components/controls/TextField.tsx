import React, { useEffect, useState } from 'react';
import { Info } from 'lucide-react';
import { FieldLabel } from './FieldGroup';

interface TextFieldProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  /** Shown as an ⓘ at the field's right edge. */
  info?: string;
  multiline?: boolean;
  rows?: number;
  mono?: boolean;
}

/**
 * A plain text input.
 *
 * Commits on change rather than on blur, unlike `NumberStepper` — a partly
 * typed string is still a valid string, so there's nothing to protect the
 * template from. (The history hook coalesces the keystrokes into one undo
 * step via its `coalesceKey`.)
 */
export const TextField: React.FC<TextFieldProps> = ({
  value,
  onChange,
  label,
  placeholder,
  info,
  multiline,
  rows = 4,
  mono,
}) => {
  const base = `w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-accent-500 focus:ring-1 focus:ring-accent-500 ${
    mono ? 'font-mono text-xs' : ''
  }`;

  return (
    <div>
      {label && <FieldLabel>{label}</FieldLabel>}
      {multiline ? (
        <textarea
          value={value}
          rows={rows}
          placeholder={placeholder}
          spellCheck={!mono}
          onChange={(e) => onChange(e.target.value)}
          className={`${base} resize-y`}
        />
      ) : (
        <div className="relative">
          <input
            type="text"
            value={value}
            placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)}
            className={`${base} ${info ? 'pr-9' : ''}`}
          />
          {info && (
            <span
              title={info}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
            >
              <Info className="h-4 w-4" />
            </span>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * Text that stops being text and becomes an input on click — the newsletter
 * title in the top bar, and a section's name in the outline.
 *
 * Commits on blur and on Enter, abandons on Escape, and selects the whole value
 * on entry so renaming is one gesture rather than "click, select all, type".
 */
export const InlineRename: React.FC<{
  value: string;
  onChange: (value: string) => void;
  className?: string;
  inputClassName?: string;
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
  placeholder?: string;
  /**
   * What starts a rename. `'click'` — the text is its own trigger, as in the
   * top bar, where there is nothing else the title could mean. `'none'` — plain
   * text, and the caller starts the rename from a control of its own: the
   * outline's rows are *selection* targets first, so a click there has to reach
   * the row rather than open an input.
   */
  renameOn?: 'click' | 'none';
}> = ({
  value,
  onChange,
  className,
  inputClassName,
  editing,
  onEditingChange,
  placeholder = 'Untitled',
  renameOn = 'click',
}) => {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (editing) setDraft(value);
  }, [editing, value]);

  const commit = () => {
    const next = draft.trim();
    if (next && next !== value) onChange(next);
    onEditingChange(false);
  };

  if (!editing) {
    // Plain text rather than a disabled button: a button would swallow the
    // click its own row is listening for.
    return renameOn === 'none' ? (
      <span className={className}>{value || placeholder}</span>
    ) : (
      <button
        type="button"
        onClick={() => onEditingChange(true)}
        className={className}
        title="Rename"
      >
        {value || placeholder}
      </button>
    );
  }

  return (
    <input
      autoFocus
      value={draft}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={(e) => e.target.select()}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commit();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          onEditingChange(false);
        }
      }}
      className={inputClassName ?? className}
    />
  );
};
