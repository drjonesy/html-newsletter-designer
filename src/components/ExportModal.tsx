import React, { useEffect, useState } from 'react';
import { Check, Copy, Download, ExternalLink, X } from 'lucide-react';
import { useDesigner } from '../state/DesignerContext';

/** Roughly where Gmail cuts a message off and hides the rest. */
const GMAIL_CLIP_KB = 102;

/**
 * The email as sendable HTML: read it, copy it, download it, open it.
 *
 * This is the only place the *whole* document is shown. v1 had a third
 * view-mode competing with the canvas for the same space, which was only ever
 * used at the very end — to get the markup out.
 */
export const ExportModal: React.FC = () => {
  const { emailHtml, downloadHtml, openInNewTab, ui } = useDesigner();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!ui.exportOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') ui.setExportOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ui]);

  if (!ui.exportOpen) return null;

  const kb = new Blob([emailHtml]).size / 1024;
  const clipped = kb > GMAIL_CLIP_KB;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-6"
      onClick={() => ui.setExportOpen(false)}
    >
      <div
        className="flex max-h-full w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center gap-3 border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-bold text-slate-900">Export HTML</h2>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
              clipped
                ? 'bg-amber-100 text-amber-800'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            {kb.toFixed(1)} KB
          </span>
          <button
            type="button"
            onClick={() => ui.setExportOpen(false)}
            aria-label="Close"
            className="ml-auto rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {clipped && (
          <p className="shrink-0 border-b border-amber-200 bg-amber-50 px-5 py-2 text-xs leading-relaxed text-amber-900">
            Over Gmail's ~{GMAIL_CLIP_KB}KB clipping threshold: Gmail will cut
            the message off and hide the rest behind a "View entire message"
            link. Uploaded images are usually the cause — they're embedded as
            data URIs, which is what makes a project file self-contained.
          </p>
        )}

        <pre className="min-h-0 flex-1 overflow-auto bg-slate-900 p-4 font-mono text-[11px] leading-relaxed text-slate-100">
          {emailHtml}
        </pre>

        <div className="flex shrink-0 items-center gap-2 border-t border-slate-200 px-5 py-4">
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(emailHtml);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="flex items-center gap-2 rounded-md bg-accent-500 px-4 py-2 text-sm font-bold text-white hover:bg-accent-600"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? 'Copied' : 'Copy HTML'}
          </button>
          <button
            type="button"
            onClick={downloadHtml}
            className="flex items-center gap-2 rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Download className="h-4 w-4" />
            Download
          </button>
          <button
            type="button"
            onClick={openInNewTab}
            className="flex items-center gap-2 rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <ExternalLink className="h-4 w-4" />
            Open in new tab
          </button>
        </div>
      </div>
    </div>
  );
};
