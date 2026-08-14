import React, { useEffect, useState } from 'react';
import {
  Check,
  ClipboardCopy,
  ExternalLink,
  Monitor,
  Smartphone,
  TriangleAlert,
  X,
} from 'lucide-react';
import { useDesigner } from '../state/DesignerContext';
import { copyRenderedEmail } from '../utils/clipboard';
import { generateEmailHtml } from '../utils/htmlGenerator';
import { SegmentedControl } from './controls';

/**
 * The email as it will actually arrive, with no editor chrome.
 *
 * Rendered in an **iframe**, which isn't incidental: the generated document has
 * its own `<body>` styles and its `<head>` holds the media queries that drive
 * the mobile layout and per-block visibility. Injected into the page those
 * would either be ignored or would leak into the app's own styles. An iframe is
 * the only way to see what the reader sees — and narrowing it is what makes the
 * mobile toggle mean something, since the media queries key off the *frame's*
 * width, not the window's.
 */
export const PreviewOverlay: React.FC = () => {
  const { emailHtml, ui, openInNewTab, template } = useDesigner();
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>(
    'idle'
  );

  useEffect(() => {
    if (!ui.previewOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') ui.setPreviewOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ui]);

  useEffect(() => {
    if (copyState === 'idle') return;
    const timer = setTimeout(() => setCopyState('idle'), 2500);
    return () => clearTimeout(timer);
  }, [copyState]);

  /*
    Always the paste build, for the reason `TopBar`'s Gmail insert uses it: this
    goes to a compose window, and `copyRenderedEmail` puts the *body* on the
    clipboard — so `<head>` and every media query in it is gone before Gmail
    even sees the markup. Copying what the iframe above is showing would send a
    message fixed at `settings.width`, with its columns still side by side on a
    phone. The frame keeps rendering the ordinary build: that is the email as
    *sent*, which is the thing a preview should show.
  */
  const copyForEmail = async () => {
    const ok = await copyRenderedEmail(
      generateEmailHtml(template, { fluid: true })
    );
    setCopyState(ok ? 'copied' : 'failed');
  };

  if (!ui.previewOpen) return null;

  /*
    The mobile view is the *same* render, scaled down — not a narrower one.

    Narrowing the frame fired the `<head>` media query, so the preview showed
    columns stacking full width. That is a true picture of the email only when
    it is sent as a file: paste it into a Gmail compose window and the
    stylesheet is stripped on the way in, so the reader's phone gets the
    desktop layout and zooms out to fit it. Showing the reflow anyway told the
    author their two columns would stack when, on the path this app is built
    around, they don't.

    Rendering at the design width and scaling is what a phone does with an
    email that can't reflow, so the columns stay side by side and shrink — the
    honest picture. `PHONE_WIDTH` is a mid-range handset in CSS px.
  */
  const PHONE_WIDTH = 375;
  const frameWidth = template.settings.width + 40;
  const mobile = ui.viewMode === 'mobile';
  const scale = mobile ? PHONE_WIDTH / frameWidth : 1;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-800">
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-slate-700 px-4">
        <span className="font-semibold text-white">Preview</span>
        <span className="text-sm text-slate-400">{template.name}</span>

        <div className="mx-auto">
          <SegmentedControl
            value={ui.viewMode}
            block={false}
            onChange={ui.setViewMode}
            segments={[
              {
                value: 'desktop',
                icon: <Monitor className="h-4 w-4" />,
                title: 'Desktop',
              },
              {
                value: 'mobile',
                icon: <Smartphone className="h-4 w-4" />,
                title: 'Mobile',
              },
            ]}
          />
        </div>

        {/*
          Does the "select all, copy" the user would otherwise do by hand in
          this window — but puts the markup on the clipboard directly, so it
          works even though the preview is a sandboxed cross-origin iframe that
          can't be selected into from here.
        */}
        <button
          type="button"
          onClick={copyForEmail}
          title="Copy the email so it pastes into Gmail with its formatting"
          className={`flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-bold transition-colors ${
            copyState === 'failed'
              ? 'bg-amber-500 text-white'
              : 'bg-accent-500 text-white hover:bg-accent-600'
          }`}
        >
          {copyState === 'copied' ? (
            <Check className="h-4 w-4" />
          ) : copyState === 'failed' ? (
            <TriangleAlert className="h-4 w-4" />
          ) : (
            <ClipboardCopy className="h-4 w-4" />
          )}
          {copyState === 'copied'
            ? 'Copied'
            : copyState === 'failed'
              ? "Couldn't copy"
              : 'Copy for Gmail'}
        </button>

        <button
          type="button"
          onClick={() => openInNewTab()}
          className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold text-slate-200 hover:bg-slate-700"
        >
          <ExternalLink className="h-4 w-4" />
          Open in new tab
        </button>
        <button
          type="button"
          onClick={() => ui.setPreviewOpen(false)}
          title="Close (Esc)"
          aria-label="Close preview"
          className="rounded-md p-2 text-slate-200 hover:bg-slate-700"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/*
        Said out loud, because the mobile view now shows the *worse* of the two
        outcomes: an author who exports the file and sends it properly gets the
        reflow this view no longer promises, and should know that.
      */}
      {mobile && (
        <p className="shrink-0 border-b border-slate-700 bg-slate-900/60 px-4 py-2 text-xs text-slate-300">
          The email at its design width, zoomed to fit — what a phone shows when
          the <code>&lt;head&gt;</code> stylesheet doesn't survive, which is the
          case for anything pasted into Gmail. Sent as a file, the media query
          stacks columns to full width instead.
        </p>
      )}

      {/*
        Pasting into a compose window keeps the inline styles — which is every
        style that matters in email — but drops the document's `<head>`, and the
        per-device rules live there. Only worth saying when the email actually
        uses them; the class is in the output only when it does.
      */}
      {emailHtml.includes('nl-hide-sm') && (
        <p className="shrink-0 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-200">
          <strong>Heads up:</strong> this email hides blocks per device, which
          needs the CSS in its <code>&lt;head&gt;</code>. Pasting into Gmail
          keeps the inline styles but drops that, so hidden-on-mobile blocks
          will show. Export the HTML and send it as a file if that matters.
        </p>
      )}

      <div className="flex min-h-0 flex-1 justify-center overflow-auto p-6">
        {/*
          The frame is the phone; the iframe inside it is the email at its
          design width, scaled to fit. The iframe is sized *up* by 1/scale in
          both axes so that once the transform shrinks it, it fills the frame
          exactly — a scaled box keeps its original layout size otherwise, and
          the frame would be left with a gap the height of what was scaled off.
        */}
        <div
          className="h-full overflow-hidden rounded-lg border border-slate-700 bg-white shadow-2xl transition-[width] duration-200"
          style={{ width: `${frameWidth * scale}px`, maxWidth: '100%' }}
        >
          <iframe
            title="Email preview"
            srcDoc={emailHtml}
            /*
              No `allow-scripts`. The document is the user's own markup, but it
              can hold pasted HTML from anywhere, and there is no reason a
              preview of an email — which can't run scripts in a real client
              either — should be able to run one here.
            */
            sandbox=""
            className="border-0 bg-white"
            style={{
              width: `${frameWidth}px`,
              height: `${100 / scale}%`,
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
            }}
          />
        </div>
      </div>
    </div>
  );
};
