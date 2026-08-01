import React, { useEffect, useState } from 'react';
import {
  ColumnElement,
  ContainerElement,
  ElementType,
  EmailElement,
  RowElement,
  SectionElement,
} from '../../types';
import { renderElementToHtml } from '../../utils/htmlGenerator';
import {
  canNest,
  canSitAtTopLevel,
  evenWidths,
  isContainerElement,
  recipeType,
} from '../../utils/elementHelpers';
import { DropPosition, useDesigner } from '../../state/DesignerContext';
import { useEditingSession } from '../../state/EditingSession';
import { BlockFrame } from './BlockFrame';
import { BlockBody } from './BlockBody';

/**
 * What an empty container says. Named per type, because "drag blocks in" is
 * wrong advice for a row — a row takes columns, and its columns take blocks.
 */
const EMPTY_HINTS: Partial<Record<ElementType, string>> = {
  section: 'Empty section — drag blocks in from the left panel.',
  row: 'No columns yet — add one from this row’s Styles tab.',
  column: 'Empty column — drag blocks in from the left panel.',
};

/** Element types that expose at least one `data-edit-field` on the canvas. */
const INLINE_EDITABLE_TYPES: ElementType[] = [
  'heading',
  'paragraph',
  'list',
  'quote',
  'button',
];

/**
 * Box styling for a container's canvas wrapper.
 *
 * Containers are the one case the canvas can't render through
 * `renderElementToHtml`, because their children have to stay individually
 * clickable — so these mirror what the generator emits for the container's own
 * frame. Change one and change the other.
 */
function sectionPreviewStyle(el: SectionElement): React.CSSProperties {
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

/** A row draws nothing of its own — only the space around it. */
function rowPreviewStyle(el: RowElement): React.CSSProperties {
  return { marginTop: el.marginTop, marginBottom: el.marginBottom };
}

/**
 * A column's cell, as a flex item.
 *
 * `flexBasis` rather than `width`, and shrinkable: the widths total 100% and
 * the row also has a gap between them, so fixed widths would overflow the
 * email card by exactly the gap. Shrinking distributes that the way the
 * `<table>` does in a real client.
 */
function columnPreviewStyle(
  el: ColumnElement,
  width: number
): React.CSSProperties {
  return {
    flexBasis: `${width}%`,
    flexGrow: 0,
    flexShrink: 1,
    minWidth: 0,
    paddingTop: el.paddingTop,
    paddingRight: el.paddingRight,
    paddingBottom: el.paddingBottom,
    paddingLeft: el.paddingLeft,
    backgroundColor:
      el.bgColor && el.bgColor !== 'transparent' ? el.bgColor : undefined,
  };
}

/** Mirrors `columnWidths` in the generator: even split for anything unset. */
function columnWidthIn(el: EmailElement, row: EmailElement | null): number {
  const siblings = row && row.type === 'row' ? row.childElements || [] : [];
  const index = siblings.findIndex((child) => child.id === el.id);
  if (el.type === 'column' && isFinite(el.width) && el.width > 0) return el.width;
  return index >= 0 ? evenWidths(siblings.length)[index] : 100;
}

function containerPreviewStyle(
  el: ContainerElement,
  parent: EmailElement | null
): React.CSSProperties {
  if (el.type === 'section') return sectionPreviewStyle(el);
  if (el.type === 'row') return rowPreviewStyle(el);
  return columnPreviewStyle(el, columnWidthIn(el, parent));
}

const descendantIds = (el: EmailElement): string[] =>
  isContainerElement(el)
    ? (el.childElements || []).flatMap((child) => [
        child.id,
        ...descendantIds(child),
      ])
    : [];

/**
 * The live preview, and the primary editing surface.
 *
 * Every block is rendered from its *real* generated HTML rather than from a
 * React lookalike, so the preview and the export can't drift. That is the one
 * rule this file exists to protect: never add a parallel renderer for a block.
 */
export const Canvas: React.FC = () => {
  const {
    template,
    selectedElementId,
    select,
    updateElement,
    reorderElement,
    dropNewElement,
    ui,
  } = useDesigner();

  const session = useEditingSession();

  const [hoveredId, setHoveredId] = useState<string | null>(null);

  /**
   * `armedId` exists because a block's wrapper is only `draggable` while its
   * grip is held: a permanently draggable wrapper would stop text selection
   * during inline editing, and a stray `<img>` drag inside the generated HTML
   * would start a phantom reorder.
   */
  const [armedId, setArmedId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [draggingType, setDraggingType] = useState<ElementType | null>(null);
  /** Ids inside the block being dragged — it can't be dropped into itself. */
  const [lockedIds, setLockedIds] = useState<string[]>([]);
  const [dropTarget, setDropTarget] = useState<{
    id: string;
    position: DropPosition;
  } | null>(null);

  const paletteDrag = ui.paletteDrag;

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
    last hovered block stuck showing a drop highlight.
  */
  useEffect(() => {
    if (!paletteDrag) setDropTarget(null);
  }, [paletteDrag]);

  const endDrag = () => {
    setArmedId(null);
    setDraggingId(null);
    setDraggingType(null);
    setLockedIds([]);
    setDropTarget(null);
  };

  /**
   * What's in flight: a brand-new block from the palette, or an existing block
   * being reordered. Placement rules are written against the type, so they
   * apply identically to both.
   */
  const activeDragType = paletteDrag ? recipeType(paletteDrag) : draggingType;

  /**
   * Wrapper props making a block both a drag source and a drop target.
   *
   * `parentType` is the type of the container `el` lives in, or null at the top
   * level — which is what decides whether dropping *beside* it is legal, since
   * landing beside a block means landing where that block lives. A paragraph
   * may go next to a paragraph inside a section, but not next to a top-level
   * one, and not next to a column inside a row.
   */
  const dragProps = (el: EmailElement, parentType: ElementType | null) => {
    const canBeSibling =
      !!activeDragType &&
      (parentType
        ? canNest(activeDragType, parentType)
        : canSitAtTopLevel(activeDragType));
    const canGoInside =
      !!activeDragType &&
      isContainerElement(el) &&
      canNest(activeDragType, el.type);
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
        e.dataTransfer.dropEffect = paletteDrag ? 'copy' : 'move';

        const rect = e.currentTarget.getBoundingClientRect();
        const offset = e.clientY - rect.top;

        /*
          Containers get a third outcome: drop *into* them. Children handle
          their own dragover and stop it bubbling, so a container only sees
          events over its own padding — anything outside a thin edge strip means
          "put it in here". When only one outcome is legal, the whole box takes
          it, so there's no dead strip to fall into.
        */
        let position: DropPosition;
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

        if (paletteDrag) dropNewElement(paletteDrag, el.id, position);
        else if (draggingId) reorderElement(draggingId, el.id, position);
        endDrag();
      },
    };
  };

  /**
   * Stands in for the top level when the email has no blocks at all — without
   * it there'd be nothing to aim the first section at.
   */
  const emptyCanvasDropProps = () => {
    const canDrop = !!paletteDrag && canSitAtTopLevel(recipeType(paletteDrag));
    return {
      onDragOver: (e: React.DragEvent) => {
        if (!canDrop) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        setDropTarget((prev) =>
          prev?.id === '__root__'
            ? prev
            : { id: '__root__', position: 'after' as const }
        );
      },
      onDrop: (e: React.DragEvent) => {
        if (!canDrop) return;
        e.preventDefault();
        dropNewElement(paletteDrag!, null, 'after');
        endDrag();
      },
    };
  };

  /**
   * Writes a committed field back onto its element.
   *
   * `field` is a property name, or `name.index` for one entry of an array of
   * strings — the only nesting the generator's editable fields use, and the
   * only one this understands. List items are why it exists.
   */
  const commitField = (el: EmailElement, field: string, value: string) => {
    session.stop();
    const [name, index] = field.split('.');
    const record = el as unknown as Record<string, unknown>;

    if (index === undefined) {
      if (record[name] === value) return;
      updateElement({ ...el, [name]: value } as EmailElement);
      return;
    }

    const at = Number(index);
    const list = record[name];
    if (!Array.isArray(list) || !Number.isInteger(at) || list[at] === value) {
      return;
    }
    const next = [...list];
    next[at] = value;
    updateElement({ ...el, [name]: next } as EmailElement);
  };

  /**
   * Enter and Backspace inside a list item, which change the *shape* of the
   * list rather than one field's text. Editing moves to the row the user should
   * now be in, which is what makes typing a whole list without leaving the
   * canvas work.
   */
  const editItem = (
    el: EmailElement,
    field: string,
    action: 'split' | 'remove',
    value: string
  ) => {
    const [name, index] = field.split('.');
    if (el.type !== 'list' || name !== 'items') return;
    const at = Number(index);
    if (!Number.isInteger(at)) return;

    // The generator draws one row for a list with no items; treat that row as
    // real so typing into it lands somewhere.
    const items = el.items?.length ? [...el.items] : [''];

    if (action === 'remove') {
      // The last row stays — a list with nothing in it can't be clicked back
      // into, and deleting the block is what the action rail is for.
      if (items.length <= 1) return;
      items.splice(at, 1);
      updateElement({ ...el, items });
      session.start({
        blockId: el.id,
        field: `items.${Math.max(0, at - 1)}`,
      });
      return;
    }

    items[at] = value;
    items.splice(at + 1, 0, '');
    updateElement({ ...el, items });
    session.start({ blockId: el.id, field: `items.${at + 1}` });
  };

  const renderBlock = (el: EmailElement, parent: EmailElement | null = null) => {
    const isSelected = selectedElementId === el.id;
    const isHovered = hoveredId === el.id;
    const dropPosition = dropTarget?.id === el.id ? dropTarget.position : null;

    const shared = {
      element: el,
      parentId: parent?.id ?? null,
      isSelected,
      isHovered,
      isDragging: draggingId === el.id,
      dropPosition,
      onArmDrag: () => setArmedId(el.id),
      dragProps: dragProps(el, parent?.type ?? null),
      onMouseOver: (e: React.MouseEvent) => {
        e.stopPropagation();
        setHoveredId(el.id);
      },
    };

    if (isContainerElement(el)) {
      const children = el.childElements || [];
      /*
        Children stop hover and click bubbling, so a section with content in it
        goes dark the moment the cursor moves onto a block. Tracking the active
        branch keeps its frame drawn and its badge on screen while you work
        inside it.
      */
      const inner = descendantIds(el);
      const holdsActive =
        (!!hoveredId && inner.includes(hoveredId)) ||
        (!!selectedElementId && inner.includes(selectedElementId));

      return (
        <BlockFrame
          key={el.id}
          {...shared}
          holdsActive={holdsActive}
          showNameTab={parent === null}
          /*
            Clear the card's padding *and* the section's own left border, since
            `right: 100%` is measured from the section's padding box — inside
            that border — not from its outer edge.
          */
          nameTabOffset={
            template.settings.padding +
            (el.type === 'section' ? el.borderLeftWidth || 0 : 0) +
            10
          }
          style={containerPreviewStyle(el, parent)}
        >
          {children.length === 0 ? (
            <div
              className={`rounded border border-dashed px-3 py-6 text-center text-[11px] transition-colors ${
                dropPosition === 'inside'
                  ? 'border-accent-500 bg-accent-50 font-semibold text-accent-700'
                  : 'border-slate-300 text-slate-400'
              }`}
            >
              {dropPosition === 'inside' ? 'Drop here' : EMPTY_HINTS[el.type]}
            </div>
          ) : el.type === 'row' ? (
            /*
              The one place the canvas lays children out horizontally. A flex
              row with the same gap stands in for the generator's `<td>`s and
              spacer cells — the columns keep their own frames, so each stays
              individually selectable.
            */
            <div className="flex items-stretch" style={{ gap: el.gap }}>
              {children.map((child) => renderBlock(child, el))}
            </div>
          ) : (
            <div className="space-y-1">
              {children.map((child) => renderBlock(child, el))}
            </div>
          )}
        </BlockFrame>
      );
    }

    const isEditing = session.active?.blockId === el.id;
    const html = renderElementToHtml(el, template.settings, {
      editable: true,
    });

    return (
      <BlockFrame key={el.id} {...shared} holdsActive={false}>
        <BlockBody
          html={html}
          editingField={isEditing ? session.active!.field : null}
          clickToEdit={isSelected && INLINE_EDITABLE_TYPES.includes(el.type)}
          onStartEdit={(field, caret) => {
            select(el.id);
            session.start({ blockId: el.id, field }, caret);
          }}
          onCommit={(field, value) => commitField(el, field, value)}
          onCancelEdit={session.stop}
          onEditItem={(field, action, value) =>
            editItem(el, field, action, value)
          }
        />
      </BlockFrame>
    );
  };

  const containerWidth =
    ui.viewMode === 'mobile' ? 375 : template.settings.width;

  return (
    <div
      /*
        The wide gutter is what the section name chips hang in. Setting
        `overflow-y` makes the browser compute `overflow-x` to `auto` too, so a
        chip that didn't fit would be clipped or add a scrollbar — the padding
        has to cover the card's own padding plus the chip's `max-w-24`.
      */
      className="flex min-h-0 flex-1 justify-center overflow-y-auto bg-slate-100 px-32 py-10"
      onClick={() => {
        session.stop();
        select(null);
      }}
      /*
        Hover is a bubbling `mouseover` on each block (innermost stops it)
        rather than enter/leave per block: leaving a child used to clear the
        hover outright, which tore down its section's badge while the cursor was
        still travelling towards it. Hover now only ever moves to another block,
        and this one leave — off the canvas entirely — clears it.
      */
      onMouseLeave={() => setHoveredId(null)}
    >
      <div
        className="h-fit w-full shrink-0 shadow-sm ring-1 ring-slate-200 transition-[width] duration-200"
        style={{
          width: `${containerWidth}px`,
          maxWidth: '100%',
          backgroundColor: template.settings.cardBgColor,
          color: template.settings.textColor,
          fontFamily: template.settings.fontFamily,
          padding: `${template.settings.padding}px`,
        }}
      >
        {template.elements.length === 0 ? (
          <div
            {...emptyCanvasDropProps()}
            className={`rounded-lg border-2 border-dashed px-4 py-16 text-center transition-colors ${
              dropTarget?.id === '__root__'
                ? 'border-accent-500 bg-accent-50 text-accent-700'
                : 'border-slate-300 text-slate-400'
            }`}
          >
            <p className="mb-1 text-sm font-semibold">
              {dropTarget?.id === '__root__'
                ? 'Drop here'
                : 'This newsletter is empty'}
            </p>
            <p className="text-xs text-slate-500">
              Add a section from the Sections panel, then drag blocks into it.
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {template.elements.map((el) => renderBlock(el))}
          </div>
        )}
      </div>
    </div>
  );
};
