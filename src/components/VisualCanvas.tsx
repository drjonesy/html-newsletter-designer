import React, { useEffect, useRef, useState } from 'react';
import { NewsletterTemplate, EmailElement } from '../types';
import { renderElementToHtml } from '../utils/htmlGenerator';
import {
  ChevronUp,
  ChevronDown,
  Trash2,
  Copy,
  Code2,
  ExternalLink,
} from 'lucide-react';

/** Element types that expose at least one `data-edit-field` on the canvas. */
const INLINE_EDITABLE_TYPES: EmailElement['type'][] = [
  'heading',
  'paragraph',
  'key-value',
  'quote',
  'button',
];

/** Puts the caret where the user double-clicked instead of at the field start. */
function placeCaretAtPoint(x: number, y: number) {
  const doc = document as Document & {
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
    caretPositionFromPoint?: (
      x: number,
      y: number
    ) => { offsetNode: Node; offset: number } | null;
  };

  let range: Range | null = null;
  if (typeof doc.caretRangeFromPoint === 'function') {
    range = doc.caretRangeFromPoint(x, y);
  } else if (typeof doc.caretPositionFromPoint === 'function') {
    const pos = doc.caretPositionFromPoint(x, y);
    if (pos) {
      range = document.createRange();
      range.setStart(pos.offsetNode, pos.offset);
      range.collapse(true);
    }
  }
  if (!range) return false;

  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  return true;
}

function selectAllIn(node: HTMLElement) {
  const range = document.createRange();
  range.selectNodeContents(node);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

interface BlockBodyProps {
  html: string;
  /** Name of the field being edited in this block right now, or null. */
  editingField: string | null;
  /**
   * True once this block is selected, which is what allows editing to start.
   * Selecting a block opens the Inspector and shifts the canvas sideways, so an
   * edit begun on that first click would land on whatever slid under the
   * cursor — the second click is the one that's aimed at what the user sees.
   */
  clickToEdit: boolean;
  onStartEdit: (field: string) => void;
  onCommit: (field: string, value: string) => void;
  onCancelEdit: () => void;
}

/**
 * Renders one block's generated HTML and turns the clicked `[data-edit-field]`
 * span into a contenteditable region.
 *
 * Edits are committed on blur rather than on every keystroke: committing writes
 * to `template`, which regenerates this block's HTML and replaces these DOM
 * nodes — which would drop the caret mid-word.
 */
const BlockBody: React.FC<BlockBodyProps> = ({
  html,
  editingField,
  clickToEdit,
  onStartEdit,
  onCommit,
  onCancelEdit,
}) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const pendingCaret = useRef<{ x: number; y: number } | null>(null);
  /** What to put back if the edit is abandoned with Escape. */
  const restorePoint = useRef<{ html: string; wasEmpty: boolean } | null>(null);
  const abandonEdit = useRef(false);

  const activeNode = () =>
    editingField
      ? rootRef.current?.querySelector<HTMLElement>(
          `[data-edit-field="${editingField}"]`
        ) ?? null
      : null;

  useEffect(() => {
    const node = activeNode();
    if (!node) return;

    const wasEmpty = node.dataset.editEmpty === '1';
    restorePoint.current = { html: node.innerHTML, wasEmpty };
    abandonEdit.current = false;

    // Clear the "Click to edit…" filler so the user types into an empty field.
    if (wasEmpty) {
      node.textContent = '';
      node.style.opacity = '';
      delete node.dataset.editEmpty;
    }

    node.contentEditable = 'true';
    node.spellcheck = true;
    node.focus();

    const caret = pendingCaret.current;
    pendingCaret.current = null;
    if (!caret || !placeCaretAtPoint(caret.x, caret.y)) selectAllIn(node);

    return () => {
      node.contentEditable = 'false';
    };
  }, [editingField, html]);

  const startEditFromEvent = (e: React.MouseEvent) => {
    if (!clickToEdit) return;
    const target = (e.target as HTMLElement).closest<HTMLElement>(
      '[data-edit-field]'
    );
    const field = target?.dataset.editField;
    if (!field || field === editingField) return;

    e.preventDefault();
    e.stopPropagation();
    pendingCaret.current = { x: e.clientX, y: e.clientY };
    onStartEdit(field);
  };

  const handleClick = (e: React.MouseEvent) => {
    // Links inside the preview must not navigate away from the designer.
    if ((e.target as HTMLElement).closest('a')) e.preventDefault();
    startEditFromEvent(e);
  };

  const handleBlur = () => {
    const node = activeNode();
    if (!editingField || !node) return;

    if (abandonEdit.current) {
      const restore = restorePoint.current;
      if (restore) {
        node.innerHTML = restore.html;
        if (restore.wasEmpty) {
          node.dataset.editEmpty = '1';
          node.style.opacity = '0.4';
        }
      }
      onCancelEdit();
      return;
    }

    const isRich = node.dataset.editRich === '1';
    // textContent, not innerText: innerText returns the *rendered* text, so a
    // heading styled `text-transform:uppercase` would save back SHOUTING.
    const value = isRich
      ? node.innerHTML
      : (node.textContent || '')
          .replace(/\u00a0/g, ' ')
          .replace(/\s*\n\s*/g, ' ')
          .trim();

    onCommit(editingField, value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!editingField) return;
    const node = activeNode();

    if (e.key === 'Escape') {
      e.preventDefault();
      abandonEdit.current = true;
      node?.blur();
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      // Rich fields keep multi-line support via <br>; single-line fields save.
      if (node?.dataset.editRich === '1') document.execCommand('insertLineBreak');
      else node?.blur();
    }
  };

  // Paste as plain text — pasted markup from a browser would wreck email HTML.
  const handlePaste = (e: React.ClipboardEvent) => {
    if (!editingField) return;
    e.preventDefault();
    document.execCommand(
      'insertText',
      false,
      e.clipboardData.getData('text/plain')
    );
  };

  return (
    <div
      ref={rootRef}
      onDoubleClick={startEditFromEvent}
      onClick={handleClick}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

interface VisualCanvasProps {
  template: NewsletterTemplate;
  selectedElementId: string | null;
  onSelectElement: (id: string | null) => void;
  onUpdateElement: (updated: EmailElement) => void;
  onDeleteElement: (id: string) => void;
  onDuplicateElement: (id: string) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  viewMode: 'desktop' | 'mobile';
  onOpenNewTab?: () => void;
  onViewElementHtml?: (id: string) => void;
}

export const VisualCanvas: React.FC<VisualCanvasProps> = ({
  template,
  selectedElementId,
  onSelectElement,
  onUpdateElement,
  onDeleteElement,
  onDuplicateElement,
  onMoveUp,
  onMoveDown,
  viewMode,
  onOpenNewTab,
  onViewElementHtml,
}) => {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; field: string } | null>(
    null
  );

  const containerWidth = viewMode === 'mobile' ? 375 : template.settings.width;

  const handleCommitField = (el: EmailElement, field: string, value: string) => {
    setEditing(null);
    const current = (el as unknown as Record<string, unknown>)[field];
    if (current === value) return;
    onUpdateElement({ ...el, [field]: value } as EmailElement);
  };

  /** Shared move / duplicate / delete / view-HTML controls on the hover badge. */
  const renderBadgeActions = (el: EmailElement) => (
    <>
      {onViewElementHtml && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onViewElementHtml(el.id);
          }}
          className="hover:text-red-700 p-0.5 text-slate-600"
          title="View / edit this block's HTML"
        >
          <Code2 className="w-3 h-3" />
        </button>
      )}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onMoveUp(el.id);
        }}
        className="hover:text-red-700 p-0.5 text-slate-600"
        title="Move Up"
      >
        <ChevronUp className="w-3 h-3" />
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onMoveDown(el.id);
        }}
        className="hover:text-red-700 p-0.5 text-slate-600"
        title="Move Down"
      >
        <ChevronDown className="w-3 h-3" />
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDuplicateElement(el.id);
        }}
        className="hover:text-amber-600 p-0.5 text-slate-600"
        title="Duplicate"
      >
        <Copy className="w-3 h-3" />
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDeleteElement(el.id);
        }}
        className="hover:text-red-700 p-0.5 text-slate-600"
        title="Delete"
      >
        <Trash2 className="w-3 h-3" />
      </button>
    </>
  );

  const renderSingleInteractiveElement = (el: EmailElement) => {
    const isSelected = selectedElementId === el.id;
    const isHovered = hoveredId === el.id;

    if (el.type === 'accent-section') {
      return (
        <div
          key={el.id}
          onClick={(e) => {
            e.stopPropagation();
            onSelectElement(el.id);
          }}
          onMouseEnter={(e) => {
            e.stopPropagation();
            setHoveredId(el.id);
          }}
          onMouseLeave={() => setHoveredId(null)}
          className={`relative group rounded transition-all cursor-pointer ${
            isSelected
              ? 'ring-2 ring-red-600 ring-offset-2'
              : isHovered
              ? 'ring-1 ring-red-400/80 ring-offset-1'
              : ''
          }`}
          style={{
            borderLeft: `${el.borderWidth}px solid ${el.borderColor}`,
            paddingLeft: `${el.paddingLeft}px`,
            marginBottom: `${el.marginBottom}px`,
          }}
        >
          {/* Quick Hover Control Badge */}
          {(isSelected || isHovered) && (
            <div className="absolute -top-3 left-2 z-20 flex items-center gap-1 bg-white text-slate-800 text-[10px] font-bold px-2 py-0.5 rounded shadow-sm border border-slate-200">
              <span className="text-red-700 font-bold">Red Accent Block</span>
              {renderBadgeActions(el)}
            </div>
          )}

          {/* Render Child Elements inside accent section */}
          <div className="space-y-1">
            {(el.childElements || []).map((child) =>
              renderSingleInteractiveElement(child)
            )}
          </div>
        </div>
      );
    }

    const htmlContent = renderElementToHtml(el, template.settings.fontFamily, {
      editable: true,
    });
    const isEditing = editing?.id === el.id;

    return (
      <div
        key={el.id}
        onClick={(e) => {
          e.stopPropagation();
          onSelectElement(el.id);
        }}
        onMouseEnter={(e) => {
          e.stopPropagation();
          setHoveredId(el.id);
        }}
        onMouseLeave={() => setHoveredId(null)}
        className={`relative transition-all rounded ${
          isEditing ? 'cursor-text' : 'cursor-pointer'
        } ${
          isSelected
            ? 'ring-2 ring-red-600 ring-offset-2 z-10'
            : isHovered
            ? 'ring-1 ring-red-400/80 ring-offset-1 z-10'
            : ''
        }`}
      >
        {/* Hover/Selection Control Overlay Badge */}
        {(isSelected || isHovered) && (
          <div className="absolute -top-3 left-2 z-20 flex items-center gap-1 bg-white text-slate-800 text-[10px] font-bold px-2 py-0.5 rounded shadow-sm border border-slate-200">
            <span className="text-red-700 capitalize font-bold">
              {el.type.replace('-', ' ')}
            </span>
            {INLINE_EDITABLE_TYPES.includes(el.type) && (
              <span className="text-[9px] font-normal text-slate-400 border-l border-slate-200 pl-1.5">
                {isEditing
                  ? 'Enter or click away to save'
                  : isSelected
                  ? 'Click text to edit it'
                  : 'Click to select'}
              </span>
            )}
            {renderBadgeActions(el)}
          </div>
        )}

        {/* HTML Render Container */}
        <BlockBody
          html={htmlContent}
          editingField={isEditing ? editing.field : null}
          clickToEdit={isSelected}
          onStartEdit={(field) => {
            onSelectElement(el.id);
            setEditing({ id: el.id, field });
          }}
          onCommit={(field, value) => handleCommitField(el, field, value)}
          onCancelEdit={() => setEditing(null)}
        />
      </div>
    );
  };

  return (
    <div
      className="flex-1 bg-slate-100 overflow-y-auto p-4 sm:p-8 flex flex-col items-center justify-start min-h-full"
      onClick={() => onSelectElement(null)}
    >
      {/*
        Device Frame Wrapper.

        `shrink-0` is load-bearing: as a flex item in this column the frame would
        otherwise shrink to the viewport height, and its own `overflow-hidden`
        (which keeps the rounded corners) would clip the rest of the email
        instead of overflowing into the scroll container above.

        `my-auto` centres the frame while it fits; flexbox resolves auto margins
        to 0 once free space goes negative, so a tall email top-aligns and stays
        scrollable to the very first block.
      */}
      <div
        className="transition-all duration-300 shadow-lg rounded-xl overflow-hidden border border-slate-200 my-auto shrink-0"
        style={{
          width: `${containerWidth}px`,
          maxWidth: '100%',
          backgroundColor: template.settings.bgColor,
        }}
      >
        {/* Email Header Bar Simulation (Gmail style) */}
        <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-600"></span>
            <span className="font-bold text-slate-700">Gmail Preview</span>
          </div>
          <div className="flex items-center gap-3">
            {onOpenNewTab && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenNewTab();
                }}
                className="flex items-center gap-1 text-[11px] font-bold text-slate-700 hover:text-red-700 transition-colors cursor-pointer bg-white px-2 py-0.5 rounded border border-slate-200 shadow-2xs hover:bg-slate-100"
                title="Open Email Preview in New Tab"
              >
                <ExternalLink className="w-3 h-3 text-red-700" />
                <span>Open in New Tab</span>
              </button>
            )}
            <span className="font-mono text-[10px] text-slate-500 font-semibold">
              Width: {containerWidth}px {viewMode === 'mobile' ? '(Mobile)' : ''}
            </span>
          </div>
        </div>

        {/* Inner Email Card */}
        <div
          className="mx-auto transition-all"
          style={{
            width: '100%',
            backgroundColor: template.settings.cardBgColor,
            color: template.settings.textColor,
            fontFamily: template.settings.fontFamily,
            padding: `${template.settings.padding}px`,
          }}
        >
          {template.elements.length === 0 ? (
            <div className="text-center py-12 px-4 text-slate-400 border-2 border-dashed border-slate-300 rounded-lg">
              <p className="font-semibold text-sm mb-1">Canvas is empty</p>
              <p className="text-xs text-slate-500">
                Click elements in the left sidebar to start building your email newsletter.
              </p>
            </div>
          ) : (
            template.elements.map((el) => renderSingleInteractiveElement(el))
          )}
        </div>
      </div>
    </div>
  );
};
