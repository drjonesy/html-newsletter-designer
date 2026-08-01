import React from 'react';

interface FieldGroupProps {
  /** Section heading, e.g. "Block background color". Omit for an unlabelled row. */
  label?: string;
  /** Small print under the heading. */
  hint?: string;
  children: React.ReactNode;
}

/**
 * One labelled band in a panel.
 *
 * The Inspector is a vertical stack of these, separated by hairlines rather
 * than by whitespace — the design leans on the rule to group related controls,
 * which is what lets a long panel stay scannable without headings everywhere.
 */
export const FieldGroup: React.FC<FieldGroupProps> = ({
  label,
  hint,
  children,
}) => (
  <div className="border-b border-slate-200 px-5 py-4 last:border-b-0">
    {label && (
      <h3 className="text-[15px] font-bold text-slate-900 mb-3">{label}</h3>
    )}
    {hint && <p className="text-xs text-slate-500 -mt-2 mb-3">{hint}</p>}
    {children}
  </div>
);

interface FieldLabelProps {
  htmlFor?: string;
  children: React.ReactNode;
}

/** The lighter label above an individual input inside a group. */
export const FieldLabel: React.FC<FieldLabelProps> = ({ htmlFor, children }) => (
  <label
    htmlFor={htmlFor}
    className="block text-xs font-medium text-slate-500 mb-1"
  >
    {children}
  </label>
);
