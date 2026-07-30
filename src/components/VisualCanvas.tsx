import React, { useEffect, useRef, useState } from 'react';
import { NewsletterTemplate, EmailElement, ContainerElement } from '../types';
import { renderElementToHtml } from '../utils/htmlGenerator';
import { isContainerElement } from '../utils/elementHelpers';
import {
  ChevronUp,
  ChevronDown,
  Trash2,
  Copy,
  Code2,
  ExternalLink,
  GripVertical,
} from 'lucide-react';

/** Element types that expose at least one `data-edit-field` on the canvas. */
const INLINE_EDITABLE_TYPES: EmailElement['type'][] = [
  'heading',
  'paragraph',
  'key-value',
  'quote',
  'button',
];

/**
 * Box styling for a container's canvas wrapper.
 *
 * Containers are the one case the canvas can't render through
 * `renderElementToHtml`, because their children have to stay individually
 * clickable — so this mirrors what the generator emits for the container's own
 * frame. Keep the two in step.
 */
function containerPreviewStyle(el: ContainerElement): React.CSSProperties {
  if (el.type === 'accent-section') {
    return {
      borderLeft: `${el.borderWidth}px solid ${el.borderColor}`,
      paddingLeft: `${el.paddingLeft}px`,
      marginBottom: `${el.marginBottom}px`,
      borderRadius: 4,
    };
  }

  return {
    borderStyle: el.borderStyle,
    borderColor: el.borderColor,
    borderTopWidth: el.borderTopWidth,
    borderRightWidth: el.borderRightWidth,
    borderBottomWidth: el.borderBottomWidth,
    borderLeftWidth: el.borderLeftWidth,
    borderRadius: el.borderRadius,
    paddingTop: el.paddingTop,
    paddingRight: el.paddingRight,
    paddingBottom: el.paddingBottom,
    paddingLeft: el.paddingLeft,
    marginTop: el.marginTop,
    marginBottom: el.marginBottom,
    backgroundColor:
      el.bgColor && el.bgColor !== 'transparent' ? el.bgColor : undefined,
  };
}

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
  onReorderElement: (
    dragId: string,
    targetId: string,
    position: 'before' | 'after' | 'inside'
  ) => void;
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
  onReorderElement,
  viewMode,
  onOpenNewTab,
  onViewElementHtml,
}) => {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; field: string } | null>(
    null
  );

  /**
   * Drag state. `armedId` exists because the block wrapper is only
   * `draggable` while the grip is held: a permanently draggable wrapper would
   * fight inline editing (you couldn't select text) and would let a stray
   * image drag start a reorder.
   */
  const [armedId, setArmedId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  /** Ids inside the block being dragged — it can't be dropped into itself. */
  const [lockedIds, setLockedIds] = useState<string[]>([]);
  const [dropTarget, setDropTarget] = useState<{
    id: string;
    position: 'before' | 'after' | 'inside';
  } | null>(null);

  // Arming without dragging (a click on the grip) must not leave the block
  // draggable, or the next text selection inside it would start a drag.
  useEffect(() => {
    if (!armedId || draggingId) return;
    const clear = () => setArmedId(null);
    window.addEventListener('mouseup', clear);
    return () => window.removeEventListener('mouseup', clear);
  }, [armedId, draggingId]);

  const containerWidth = viewMode === 'mobile' ? 375 : template.settings.width;

  const descendantIds = (el: EmailElement): string[] =>
    isContainerElement(el)
      ? (el.childElements || []).flatMap((child) => [
          child.id,
          ...descendantIds(child),
        ])
      : [];

  const endDrag = () => {
    setArmedId(null);
    setDraggingId(null);
    setLockedIds([]);
    setDropTarget(null);
  };

  /** Wrapper props that make a block both a drag source and a drop target. */
  const dragProps = (el: EmailElement) => {
    const canDrop =
      !!draggingId && draggingId !== el.id && !lockedIds.includes(el.id);

    return {
      draggable: armedId === el.id,
      onDragStart: (e: React.DragEvent) => {
        if (armedId !== el.id) {
          // A bubbled drag from an <img> or <a> in the generated HTML.
          e.preventDefault();
          return;
        }
        e.stopPropagation();
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', el.id);
        setDraggingId(el.id);
        setLockedIds(descendantIds(el));
      },
      onDragEnd: endDrag,
      onDragOver: (e: React.DragEvent) => {
        if (!canDrop) return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
        const rect = e.currentTarget.getBoundingClientRect();
        const offset = e.clientY - rect.top;

        /*
          Containers get a third outcome: drop *into* them. Children handle
          their own dragover and stop it bubbling, so a container only sees
          events over its own padding — anything that isn't within a thin edge
          strip means "put it in here". Non-containers keep the simple
          top-half / bottom-half split.
        */
        let position: 'before' | 'after' | 'inside';
        if (isContainerElement(el)) {
          const edge = Math.min(14, rect.height / 4);
          position =
            offset < edge
              ? 'before'
              : rect.height - offset < edge
              ? 'after'
              : 'inside';
        } else {
          position = offset < rect.height / 2 ? 'before' : 'after';
        }

        setDropTarget((prev) =>
          prev?.id === el.id && prev.position === position
            ? prev
            : { id: el.id, position }
        );
      },
      onDrop: (e: React.DragEvent) => {
        if (!canDrop) return;
        e.preventDefault();
        e.stopPropagation();
        const position =
          dropTarget?.id === el.id ? dropTarget.position : 'after';
        onReorderElement(draggingId!, el.id, position);
        endDrag();
      },
    };
  };

  /**
   * The red rule showing where the dragged block will land. A pending drop
   * *into* a container has no edge to draw on — that one is shown by tinting
   * the container itself (see `isDropInside`).
   */
  const renderDropIndicator = (el: EmailElement) =>
    dropTarget?.id === el.id && dropTarget.position !== 'inside' ? (
      <div
        className={`absolute left-0 right-0 h-0.5 bg-red-600 rounded-full z-30 pointer-events-none ${
          dropTarget.position === 'before' ? '-top-0.5' : '-bottom-0.5'
        }`}
      />
    ) : null;

  const isDropInside = (el: EmailElement) =>
    dropTarget?.id === el.id && dropTarget.position === 'inside';

  /** Grip on the hover badge — the only thing that starts a drag. */
  const renderDragHandle = (el: EmailElement) => (
    <button
      onMouseDown={(e) => {
        e.stopPropagation();
        setArmedId(el.id);
      }}
      onClick={(e) => e.stopPropagation()}
      className="p-1 text-slate-400 hover:text-red-700 cursor-grab active:cursor-grabbing"
      title="Drag to reorder"
    >
      <GripVertical className="w-4 h-4" />
    </button>
  );

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
          className="hover:text-red-700 p-1 text-slate-600"
          title="View / edit this block's HTML"
        >
          <Code2 className="w-4 h-4" />
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
        <ChevronUp className="w-4 h-4" />
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onMoveDown(el.id);
        }}
        className="hover:text-red-700 p-0.5 text-slate-600"
        title="Move Down"
      >
        <ChevronDown className="w-4 h-4" />
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDuplicateElement(el.id);
        }}
        className="hover:text-amber-600 p-1 text-slate-600"
        title="Duplicate"
      >
        <Copy className="w-4 h-4" />
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDeleteElement(el.id);
        }}
        className="hover:text-red-700 p-0.5 text-slate-600"
        title="Delete"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </>
  );

  const renderSingleInteractiveElement = (el: EmailElement) => {
    const isSelected = selectedElementId === el.id;
    const isHovered = hoveredId === el.id;

    if (isContainerElement(el)) {
      const children = el.childElements || [];
      const dropInside = isDropInside(el);

      return (
        <div
          key={el.id}
          {...dragProps(el)}
          onClick={(e) => {
            e.stopPropagation();
            onSelectElement(el.id);
          }}
          onMouseEnter={(e) => {
            e.stopPropagation();
            setHoveredId(el.id);
          }}
          onMouseLeave={() => setHoveredId(null)}
          className={`relative group transition-all cursor-pointer ${
            draggingId === el.id ? 'opacity-40' : ''
          } ${
            dropInside
              ? 'ring-2 ring-red-600 ring-offset-2 bg-red-50/60'
              : isSelected
              ? 'ring-2 ring-red-600 ring-offset-2'
              : isHovered
              ? 'ring-1 ring-red-400/80 ring-offset-1'
              : ''
          }`}
          style={containerPreviewStyle(el)}
        >
          {renderDropIndicator(el)}

          {/* Quick Hover Control Badge */}
          {(isSelected || isHovered) && (
            <div className="absolute -top-4 left-2 z-20 flex items-center gap-1.5 bg-white text-slate-800 text-xs font-bold px-2.5 py-1 rounded-md shadow-md border border-slate-200">
              {renderDragHandle(el)}
              <span className="text-red-700 font-bold">
                {el.type === 'section' ? el.label || 'Section' : 'Red Accent Block'}
              </span>
              <span className="text-[11px] font-normal text-slate-400 border-l border-slate-200 pl-2">
                Drop blocks inside
              </span>
              {renderBadgeActions(el)}
            </div>
          )}

          {/* Child blocks — or a drop zone while the container is empty */}
          {children.length === 0 ? (
            <div className="text-center py-6 px-3 text-[11px] text-slate-400 border border-dashed border-slate-300 rounded">
              Empty section — drag blocks in here, or add them from the left
              panel while this section is selected.
            </div>
          ) : (
            <div className="space-y-1">
              {children.map((child) => renderSingleInteractiveElement(child))}
            </div>
          )}
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
        {...dragProps(el)}
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
        } ${draggingId === el.id ? 'opacity-40' : ''} ${
          isSelected
            ? 'ring-2 ring-red-600 ring-offset-2 z-10'
            : isHovered
            ? 'ring-1 ring-red-400/80 ring-offset-1 z-10'
            : ''
        }`}
      >
        {renderDropIndicator(el)}

        {/* Hover/Selection Control Overlay Badge */}
        {(isSelected || isHovered) && (
          <div className="absolute -top-4 left-2 z-20 flex items-center gap-1.5 bg-white text-slate-800 text-xs font-bold px-2.5 py-1 rounded-md shadow-md border border-slate-200">
            {renderDragHandle(el)}
            <span className="text-red-700 capitalize font-bold">
              {el.type.replace('-', ' ')}
            </span>
            {INLINE_EDITABLE_TYPES.includes(el.type) && (
              <span className="text-[11px] font-normal text-slate-400 border-l border-slate-200 pl-2">
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
