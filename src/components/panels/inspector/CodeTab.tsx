import React, { useEffect, useState } from 'react';
import { AlertTriangle, Check, Copy, RotateCcw, Undo2 } from 'lucide-react';
import { EmailElement } from '../../../types';
import { renderElementToHtml } from '../../../utils/htmlGenerator';
import { isContainerElement, typeLabel } from '../../../utils/elementHelpers';
import { useDesigner } from '../../../state/DesignerContext';

/**
 * This block's markup, hand-editable.
 *
 * Saving hand-edited markup on a typed block **converts it to `custom-html`**,
 * stashing the original on `convertedFrom` so Revert can restore it. There is
 * no way back otherwise: arbitrary HTML can't be parsed into typed fields like
 * `fontSize` or `alignment`, and pretending it can would silently lose the
 * user's code the next time they touched a control.
 *
 * Mount with `key={element.id}` so the draft resets when the selection changes.
 */
export const CodeTab: React.FC<{ element: EmailElement }> = ({ element }) => {
  const { settings, updateElement, ui } = useDesigner();

  const isRawBlock = element.type === 'custom-html';
  const source = isRawBlock
    ? element.html
    : renderElementToHtml(element, settings);

  const [draft, setDraft] = useState(source);
  const [dirty, setDirty] = useState(false);
  const [copied, setCopied] = useState(false);

  // Keep mirroring the generator until the user starts typing — edits made on
  // the other tabs should show up here live.
  useEffect(() => {
    if (!dirty) setDraft(source);
  }, [source, dirty]);

  const revertTarget = isRawBlock ? element.convertedFrom : undefined;

  const save = () => {
    if (isRawBlock) {
      updateElement({ ...element, html: draft });
    } else {
      updateElement({
        id: element.id,
        type: 'custom-html',
        label: element.label ?? `${typeLabel(element.type)} (HTML)`,
        html: draft,
        convertedFrom: element,
        visibility: element.visibility,
      });
    }
    setDirty(false);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="relative min-h-64 flex-1">
        <textarea
          spellCheck={false}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setDirty(e.target.value !== source);
          }}
          className="h-full w-full resize-none bg-slate-900 p-3 font-mono text-[11px] leading-relaxed text-slate-100 outline-none"
        />

        <div className="absolute right-2 top-2 flex items-center gap-1">
          {dirty && (
            <button
              type="button"
              title="Discard edits and regenerate"
              onClick={() => {
                setDraft(source);
                setDirty(false);
              }}
              className="flex items-center gap-1 rounded bg-slate-700/90 px-2 py-1 text-[10px] font-semibold text-slate-100 hover:bg-slate-600"
            >
              <RotateCcw className="h-3 w-3" />
              Reset
            </button>
          )}
          <button
            type="button"
            title="Copy this block's HTML"
            onClick={() => {
              navigator.clipboard.writeText(draft);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="flex items-center gap-1 rounded bg-slate-700/90 px-2 py-1 text-[10px] font-semibold text-slate-100 hover:bg-slate-600"
          >
            {copied ? (
              <Check className="h-3 w-3 text-emerald-400" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>

        <span className="absolute bottom-2 right-3 rounded-full bg-accent-100 px-2 py-0.5 text-[10px] font-semibold text-accent-800">
          html
        </span>
      </div>

      <div className="shrink-0 space-y-3 border-t border-slate-200 p-4">
        {!isRawBlock && dirty && (
          <div className="space-y-1.5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900">
            <p className="flex items-center gap-1.5 text-xs font-bold">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
              Saving converts this block
            </p>
            <p className="text-[11px] leading-relaxed">
              This {typeLabel(element.type)} becomes a raw HTML block holding
              your code. Its design controls stop applying
              {isContainerElement(element)
                ? ', and its child blocks are flattened into this markup'
                : ''}
              . You can revert afterwards.
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={save}
          disabled={!dirty}
          className={`w-full rounded-md py-2 text-sm font-bold transition-colors ${
            dirty
              ? 'bg-accent-500 text-white hover:bg-accent-600'
              : 'cursor-not-allowed bg-slate-100 text-slate-400'
          }`}
        >
          {isRawBlock ? 'Save HTML' : 'Save as HTML block'}
        </button>

        {revertTarget && (
          <button
            type="button"
            onClick={() => {
              updateElement(revertTarget);
              ui.setInspectorTab('styles');
            }}
            className="flex w-full items-center justify-center gap-1.5 rounded-md border border-slate-300 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Undo2 className="h-4 w-4" />
            Revert to {typeLabel(revertTarget.type)} block
          </button>
        )}

        <p className="text-xs leading-relaxed text-slate-500">
          <strong>Note:</strong> most email clients only support basic HTML.
          JavaScript, forms and embedded media won't run — and this app never
          fetches anything, so remote resources are on you to verify.
        </p>
      </div>
    </div>
  );
};
