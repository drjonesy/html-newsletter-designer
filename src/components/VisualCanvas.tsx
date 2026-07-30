import React, { useEffect, useRef, useState } from 'react';
import {
  NewsletterTemplate,
  EmailElement,
  ContainerElement,
  ElementType,
} from '../types';
import { renderElementToHtml } from '../utils/htmlGenerator';
import { canSitAtTopLevel, isContainerElement } from '../utils/elementHelpers';
import {
  ChevronUp,
  ChevronDown,
  Trash2,
  Copy,
  Code2,
  GripVertical,
  CornerLeftUp,
  SquareDashed,
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

/** What a container calls itself on its badges. */
function sectionLabel(el: ContainerElement): string {
  return el.label || 'Section';
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
  onViewElementHtml?: (id: string) => void;
  /** Type being dragged out of the palette right now, or null. */
  paletteDragType: ElementType | null;
  onDropNewElement: (
    type: ElementType,
    targetId: string | null,
    position: 'before' | 'after' | 'inside'
  ) => void;
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
  onViewElementHtml,
  paletteDragType,
  onDropNewElement,
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
  /** Type of the existing block being dragged — decides where it may land. */
  const [draggingType, setDraggingType] = useState<ElementType | null>(null);
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

  /*
    A palette drag starts on a sidebar button, so no canvas block ever sees its
    `dragend` — abandoning one outside a drop target would otherwise leave the
    last hovered block stuck showing a drop highlight. The palette clearing
    `paletteDragType` is the signal to reset.
  */
  useEffect(() => {
    if (!paletteDragType) setDropTarget(null);
  }, [paletteDragType]);

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
    setDraggingType(null);
    setLockedIds([]);
    setDropTarget(null);
  };

  /**
   * What's in flight: a brand-new block from the palette, or an existing block
   * being reordered. Both resolve to a type, which is what the placement rules
   * are written against.
   */
  const activeDragType = paletteDragType ?? draggingType;

  /**
   * Wrapper props that make a block both a drag source and a drop target.
   *
   * `insideContainer` says whether `el` itself lives in a section, which is
   * what decides if dropping *beside* it is legal: only containers may sit at
   * the top level, so a paragraph can go next to another paragraph inside a
   * section but not next to a top-level one.
   */
  const dragProps = (el: EmailElement, insideContainer: boolean) => {
    // Placing beside `el` lands wherever `el` lives.
    const canBeSibling =
      !!activeDragType &&
      (canSitAtTopLevel(activeDragType) || insideContainer);
    // Anything may go inside a container.
    const canGoInside = !!activeDragType && isContainerElement(el);

    const isOwnSubtree =
      !!draggingId && (draggingId === el.id || lockedIds.includes(el.id));
    const canDrop = !isOwnSubtree && (canBeSibling || canGoInside);

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
        setDraggingType(el.type);
        setLockedIds(descendantIds(el));
      },
      onDragEnd: endDrag,
      onDragOver: (e: React.DragEvent) => {
        if (!canDrop) return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = paletteDragType ? 'copy' : 'move';
        const rect = e.currentTarget.getBoundingClientRect();
        const offset = e.clientY - rect.top;

        /*
          Containers get a third outcome: drop *into* them. Children handle
          their own dragover and stop it bubbling, so a container only sees
          events over its own padding — anything outside a thin edge strip
          means "put it in here". When only one outcome is legal (a paragraph
          over a top-level section can only go inside it) the whole box takes
          that outcome, so there's no dead strip to fall into.
        */
        let position: 'before' | 'after' | 'inside';
        if (canGoInside && canBeSibling) {
          const edge = Math.min(14, rect.height / 4);
          position =
            offset < edge
              ? 'before'
              : rect.height - offset < edge
              ? 'after'
              : 'inside';
        } else if (canGoInside) {
          position = 'inside';
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
          dropTarget?.id === el.id
            ? dropTarget.position
            : canGoInside
            ? 'inside'
            : 'after';

        if (paletteDragType) onDropNewElement(paletteDragType, el.id, position);
        else if (draggingId) onReorderElement(draggingId, el.id, position);
        endDrag();
      },
    };
  };

  /**
   * Drop zone standing in for the top level when the email has no blocks at
   * all — without it there'd be nothing to aim the first section at.
   */
  const emptyCanvasDropProps = () => {
    const canDrop = !!paletteDragType && canSitAtTopLevel(paletteDragType);
    return {
      onDragOver: (e: React.DragEvent) => {
        if (!canDrop) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        setDropTarget((prev) =>
          prev?.id === '__root__' ? prev : { id: '__root__', position: 'after' as const }
        );
      },
      onDrop: (e: React.DragEvent) => {
        if (!canDrop) return;
        e.preventDefault();
        onDropNewElement(paletteDragType!, null, 'after');
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

  /**
   * Shared move / duplicate / delete / view-HTML controls on the hover badge.
   *
   * `parentId` adds the step-out button: a full section is mostly covered by
   * its children, and every child stops the click bubbling, so without a
   * deliberate control the only way to select the section is to hit whatever
   * sliver of its own padding is left over.
   */
  const renderBadgeActions = (el: EmailElement, parentId: string | null) => (
    <>
      {parentId && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setEditing(null);
            onSelectElement(parentId);
          }}
          className="hover:text-red-700 p-1 text-slate-600"
          title="Select the section this block sits in"
        >
          <CornerLeftUp className="w-4 h-4" />
        </button>
      )}
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

  const renderSingleInteractiveElement = (
    el: EmailElement,
    parentId: string | null = null
  ) => {
    const isSelected = selectedElementId === el.id;
    const isHovered = hoveredId === el.id;
    const insideContainer = parentId !== null;

    if (isContainerElement(el)) {
      const children = el.childElements || [];
      const dropInside = isDropInside(el);

      /*
        Children stop hover and click bubbling, so a section with any content
        in it goes dark the moment the cursor moves onto a block. Tracking the
        active branch keeps its frame drawn and its badge on screen while you
        work inside it — that badge is the reliable way to select it.
      */
      const inner = descendantIds(el);
      const holdsActive =
        (!!hoveredId && inner.includes(hoveredId)) ||
        (!!selectedElementId && inner.includes(selectedElementId));

      return (
        <div
          key={el.id}
          {...dragProps(el, insideContainer)}
          onClick={(e) => {
            e.stopPropagation();
            onSelectElement(el.id);
          }}
          onMouseOver={(e) => {
            e.stopPropagation();
            setHoveredId(el.id);
          }}
          className={`relative group transition-all cursor-pointer ${
            draggingId === el.id ? 'opacity-40' : ''
          } ${
            dropInside
              ? 'ring-2 ring-red-600 ring-offset-2 bg-red-50/60'
              : isSelected
              ? 'ring-2 ring-red-600 ring-offset-2'
              : isHovered
              ? 'ring-1 ring-red-400/80 ring-offset-1'
              : holdsActive
              ? 'ring-1 ring-red-300/70 ring-offset-1'
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
                {sectionLabel(el)}
              </span>
              <span className="text-[11px] font-normal text-slate-400 border-l border-slate-200 pl-2">
                Drop blocks inside
              </span>
              {renderBadgeActions(el, parentId)}
            </div>
          )}

          {/*
            Working inside the section: one click on its name selects it. Sits
            on the right so it never lands under the first child's own badge.
          */}
          {!isSelected && !isHovered && holdsActive && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setEditing(null);
                onSelectElement(el.id);
              }}
              // Swallowed, not forwarded: letting hover land on the section
              // would satisfy `isHovered`, unmount this button and leave the
              // click with nothing under it.
              onMouseOver={(e) => e.stopPropagation()}
              className="absolute -top-3.5 right-2 z-20 flex items-center gap-1 bg-white/95 text-[11px] font-semibold text-slate-500 hover:text-red-700 px-2 py-0.5 rounded-md shadow-xs border border-slate-200"
              title="Select this section"
            >
              <SquareDashed className="w-3.5 h-3.5" />
              {sectionLabel(el)}
            </button>
          )}

          {/* Child blocks — or a drop zone while the container is empty */}
          {children.length === 0 ? (
            <div
              className={`text-center py-6 px-3 text-[11px] border border-dashed rounded transition-colors ${
                dropInside
                  ? 'border-red-500 text-red-700 bg-red-50 font-semibold'
                  : 'border-slate-300 text-slate-400'
              }`}
            >
              {dropInside
                ? 'Drop here'
                : 'Empty section — drag elements in from the left panel.'}
            </div>
          ) : (
            <div className="space-y-1">
              {children.map((child) =>
                renderSingleInteractiveElement(child, el.id)
              )}
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
        {...dragProps(el, insideContainer)}
        onClick={(e) => {
          e.stopPropagation();
          onSelectElement(el.id);
        }}
        onMouseOver={(e) => {
          e.stopPropagation();
          setHoveredId(el.id);
        }}
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
            {renderBadgeActions(el, parentId)}
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
      className="flex-1 min-h-0 bg-slate-100 overflow-y-auto p-4 sm:p-8 flex flex-col items-center justify-start"
      onClick={() => onSelectElement(null)}
      /*
        Blocks track hover with a bubbling `mouseover` (innermost wrapper stops
        it) rather than enter/leave per block: leaving a child used to clear the
        hover outright, which tore down its section's badge while the cursor was
        still travelling towards it. Hover now only ever moves to another block,
        and this one leave — off the canvas entirely — clears it.
      */
      onMouseLeave={() => setHoveredId(null)}
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
          {/*
            No "Open in New Tab" here — it lives in the view-mode strip directly
            above this bar, where it also works in code view.
          */}
          <span className="font-mono text-[10px] text-slate-500 font-semibold">
            Width: {containerWidth}px {viewMode === 'mobile' ? '(Mobile)' : ''}
          </span>
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
            <div
              {...emptyCanvasDropProps()}
              className={`text-center py-12 px-4 border-2 border-dashed rounded-lg transition-colors ${
                dropTarget?.id === '__root__'
                  ? 'border-red-500 bg-red-50 text-red-700'
                  : 'border-slate-300 text-slate-400'
              }`}
            >
              <p className="font-semibold text-sm mb-1">
                {dropTarget?.id === '__root__' ? 'Drop here' : 'Canvas is empty'}
              </p>
              <p className="text-xs text-slate-500">
                Drag a <strong>Section</strong> here from the left panel, then
                drag elements into it.
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
