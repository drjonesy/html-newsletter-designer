import React, { useEffect, useMemo, useState } from 'react';
import { Check, Copy, Download, ExternalLink, X } from 'lucide-react';
import { useDesigner } from '../state/DesignerContext';
import { generateEmailHtml } from '../utils/htmlGenerator';

/** Roughly where Gmail cuts a message off and hides the rest. */
const GMAIL_CLIP_KB = 102;

/**
 * Which build of the email to show.
 *
 * They differ in one thing: where the responsive layout is *stated*. `send`
 * puts it in the `<head>` stylesheet, which is the better markup and what every
 * client renders when the message is sent as HTML. `paste` states it inline on
 * the blocks themselves, because a Gmail compose window strips `<head>` and
 * every `<style>` block from what you paste into it — so the stylesheet build
 * arrives fixed at `settings.width` and the phone just scales it down.
 */
type ExportMode = 'send' | 'paste';

const MODES: { id: ExportMode; label: string; hint: string }[] = [
  {
    id: 'send',
    label: 'For sending',
    hint: 'Mailchimp, Brevo, an SMTP script — anywhere the file is sent as the message body.',
  },
  {
    id: 'paste',
    label: 'For pasting into Gmail',
    hint: 'Copies the rendered email, and reflows on a phone with no stylesheet — because Gmail’s compose window drops one.',
  },
];

/**
 * The email as sendable HTML: read it, copy it, download it, open it.
 *
 * This is the only place the *whole* document is shown. v1 had a third
 * view-mode competing with the canvas for the same space, which was only ever
 * used at the very end — to get the markup out.
 */
export const ExportModal: React.FC = () => {
  const { template, emailHtml, downloadHtml, openInNewTab, ui } = useDesigner();
  const [copied, setCopied] = useState(false);
  const [mode, setMode] = useState<ExportMode>('send');

  // `emailHtml` is already memoised on the template upstream, so only the paste
  // build is generated here — and only once the user has asked for it.
  const pasteHtml = useMemo(
    () => (mode === 'paste' ? generateEmailHtml(template, { fluid: true }) : ''),
    [mode, template]
  );
  const html = mode === 'paste' ? pasteHtml : emailHtml;

  /*
    The two modes copy different *things*, not just different markup.

    `send` copies the source, which is what you paste into an ESP's HTML box.
    `paste` copies the email itself — a `text/html` clipboard flavour, so that
    pasting into a Gmail compose window drops in the rendered newsletter rather
    than a screenful of tags. That is the whole point of the mode, and doing it
    any other way means the open-in-a-tab-and-select-all dance.

    `text/plain` rides along because a plain-text editor gets nothing otherwise,
    and the whole thing falls back to `writeText` where `ClipboardItem` isn't
    available (it needs a secure context).
  */
  async function copy() {
    try {
      if (mode === 'paste' && typeof ClipboardItem !== 'undefined') {
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': new Blob([html], { type: 'text/html' }),
            'text/plain': new Blob([html], { type: 'text/plain' }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(html);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Denied clipboard permission, or no secure context. Download still works.
      setCopied(false);
    }
  }

  useEffect(() => {
    if (!ui.exportOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') ui.setExportOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ui]);

  if (!ui.exportOpen) return null;

  const kb = new Blob([html]).size / 1024;
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

        <div className="shrink-0 border-b border-slate-200 px-5 py-3">
          <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMode(m.id)}
                className={`flex-1 rounded-md px-3 py-1.5 text-sm font-semibold ${
                  mode === m.id
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs leading-relaxed text-slate-500">
            {MODES.find((m) => m.id === mode)!.hint}
          </p>
        </div>

        {mode === 'paste' && (
          <p className="shrink-0 border-b border-slate-200 bg-slate-50 px-5 py-2 text-xs leading-relaxed text-slate-600">
            Columns state their own widths inline instead of in the stylesheet,
            so two or three columns collapse to a single full-width column on a
            phone with no CSS involved. Gmail ignores the part that puts them
            back side by side, so a pasted message stacks them at every width —
            turn <em>Stack on mobile</em> off for a row that has to stay side by
            side there. A row nested <em>inside</em> a column doesn't stack, and
            Outlook needs the conditional comments — which Gmail also strips on
            paste. Prefer <strong>For sending</strong> wherever you can actually
            send the file.
          </p>
        )}

        <pre className="min-h-0 flex-1 overflow-auto bg-slate-900 p-4 font-mono text-[11px] leading-relaxed text-slate-100">
          {html}
        </pre>

        <div className="flex shrink-0 items-center gap-2 border-t border-slate-200 px-5 py-4">
          <button
            type="button"
            onClick={copy}
            className="flex items-center gap-2 rounded-md bg-accent-500 px-4 py-2 text-sm font-bold text-white hover:bg-accent-600"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied
              ? 'Copied'
              : mode === 'paste'
                ? 'Copy for Gmail'
                : 'Copy HTML'}
          </button>
          <button
            type="button"
            onClick={() => downloadHtml(html)}
            className="flex items-center gap-2 rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Download className="h-4 w-4" />
            Download
          </button>
          <button
            type="button"
            onClick={() => openInNewTab(html)}
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
