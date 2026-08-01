import React from 'react';
import { RotateCcw } from 'lucide-react';

/**
 * Wraps a control whose value can come from the theme.
 *
 * Every typographic control shows the *resolved* value, so what you read is
 * what the block renders as — but a block inheriting `16px` and a block that
 * has been set to `16px` behave differently the next time someone edits the
 * theme, and the panel has to say which is which. Editing the control creates
 * an override; the reset hands the field back.
 */
export const ThemedField: React.FC<{
  overridden: boolean;
  onReset: () => void;
  children: React.ReactNode;
}> = ({ overridden, onReset, children }) => (
  <div>
    {children}
    {overridden && (
      <button
        type="button"
        onClick={onReset}
        title="Go back to the value set in Theme"
        className="mt-1 flex items-center gap-1 text-[11px] font-medium text-accent-600 hover:text-accent-700 hover:underline"
      >
        <RotateCcw className="h-3 w-3" />
        Overridden — use theme
      </button>
    )}
  </div>
);
