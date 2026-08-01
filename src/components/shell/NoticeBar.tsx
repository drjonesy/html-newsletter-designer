import React from 'react';
import { X } from 'lucide-react';
import { useDesigner } from '../../state/DesignerContext';

/**
 * One-line feedback under the top bar: what a load restructured, what couldn't
 * be read, where a file was saved.
 *
 * Confirmations time out on their own (see `DesignerProvider`); warnings and
 * errors stay until dismissed, because they usually describe something the
 * author needs to go and look at.
 */
export const NoticeBar: React.FC = () => {
  const { notice, setNotice } = useDesigner();
  if (!notice) return null;

  const tone =
    notice.tone === 'error'
      ? 'border-red-200 bg-red-50 text-red-800'
      : notice.tone === 'warning'
        ? 'border-amber-200 bg-amber-50 text-amber-900'
        : 'border-emerald-200 bg-emerald-50 text-emerald-800';

  return (
    <div
      role="status"
      className={`flex shrink-0 items-start gap-2 border-b px-4 py-2 text-xs font-semibold ${tone}`}
    >
      <span className="flex-1 leading-relaxed">{notice.message}</span>
      <button
        type="button"
        onClick={() => setNotice(null)}
        aria-label="Dismiss"
        className="shrink-0 opacity-60 hover:opacity-100"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};
