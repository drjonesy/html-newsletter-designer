import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useDesigner } from '../state/DesignerContext';

/**
 * Paste raw HTML, get a `custom-html` block.
 *
 * The markup is stored verbatim — not parsed into typed blocks. Reverse-engineering
 * arbitrary email HTML into `fontSize`/`alignment` fields is a guess that goes
 * wrong quietly, and a block that renders exactly what you pasted is more
 * useful than a mangled approximation you then have to repair.
 */
export const ImportHtmlModal: React.FC = () => {
  const { importRawHtml, addTarget, ui } = useDesigner();
  const [html, setHtml] = useState('');

  useEffect(() => {
    if (!ui.importOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') ui.setImportOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ui]);

  if (!ui.importOpen) return null;

  const submit = () => {
    if (!html.trim()) return;
    importRawHtml(html);
    setHtml('');
    ui.setImportOpen(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-6"
      onClick={() => ui.setImportOpen(false)}
    >
      <div
        className="flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-bold text-slate-900">Paste HTML</h2>
          <button
            type="button"
            onClick={() => ui.setImportOpen(false)}
            aria-label="Close"
            className="ml-auto rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <textarea
            autoFocus
            value={html}
            spellCheck={false}
            placeholder={'<table role="presentation">…</table>'}
            onChange={(e) => setHtml(e.target.value)}
            className="h-64 w-full resize-y rounded-lg border border-slate-300 bg-slate-900 p-3 font-mono text-[11px] leading-relaxed text-slate-100 outline-none focus:border-accent-500"
          />
          <p className="mt-3 text-xs leading-relaxed text-slate-500">
            Added as a single HTML block{' '}
            {addTarget
              ? `inside “${addTarget.label || 'Section'}”.`
              : 'in a new section of its own.'}{' '}
            It's kept exactly as pasted, so anything that doesn't work in email
            won't start working here.
          </p>
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-slate-200 px-5 py-4">
          <button
            type="button"
            onClick={() => ui.setImportOpen(false)}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!html.trim()}
            className="rounded-md bg-accent-500 px-4 py-2 text-sm font-bold text-white hover:bg-accent-600 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
          >
            Add block
          </button>
        </div>
      </div>
    </div>
  );
};
