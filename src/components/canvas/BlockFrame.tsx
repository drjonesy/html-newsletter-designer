import React from 'react';
import {
  ChevronDown,
  ChevronUp,
  Code2,
  Copy,
  CornerLeftUp,
  EyeOff,
  GripVertical,
  Move,
  Trash2,
} from 'lucide-react';
import { EmailElement } from '../../types';
import { blockName, isContainerElement } from '../../utils/elementHelpers';
import { useDesigner } from '../../state/DesignerContext';
import { DropPosition } from '../../state/DesignerContext';

export interface BlockFrameProps {
  element: EmailElement;
  /** Id of the section this block lives in, or null at the top level. */
  parentId: string | null;
  isSelected: boolean;
  isHovered: boolean;
  /** Container whose subtree holds the hovered or selected block. */
  holdsActive: boolean;
  /**
   * Top-level sections wear their name permanently — the "Body" chip in the
   * design. Nested ones don't: they already get the compact badge at their
   * top-right, and two tabs in the same corner would collide.
   */
  showNameTab?: boolean;
  /**
   * How far left of the section the name tab has to sit to clear the email
   * card entirely, in px.
   *
   * `right: 100%` alone only reaches the section's own left edge — which is
   * *inside* the card, because the card pads its content. The caller works out
   * the real distance, since it's the only thing that knows the card's padding.
   */
  nameTabOffset?: number;
  isDragging: boolean;
  dropPosition: DropPosition | null;
  onArmDrag: () => void;
  children: React.ReactNode;
  /** A container's own frame — border, padding, fill — mirrored from the generator. */
  style?: React.CSSProperties;
  /** Props from the canvas that make this a drag source and a drop target. */
  dragProps: React.HTMLAttributes<HTMLDivElement> & { draggable?: boolean };
  onMouseOver: (e: React.MouseEvent) => void;
}

/** True when the author has hidden this block on at least one device. */
function isHiddenSomewhere(el: EmailElement): boolean {
  return el.visibility?.desktop === false || el.visibility?.mobile === false;
}

/**
 * Selection chrome around one block: the outline, the name tab at its top-left,
 * and the floating action rail down its right side.
 *
 * The actions come straight from the designer context rather than through
 * props — every one of them is a plain "do this to the block with this id", and
 * threading eight callbacks through the canvas's recursive renderer bought
 * nothing.
 */
export const BlockFrame: React.FC<BlockFrameProps> = ({
  element,
  parentId,
  isSelected,
  isHovered,
  holdsActive,
  showNameTab,
  nameTabOffset = 0,
  isDragging,
  dropPosition,
  onArmDrag,
  children,
  style,
  dragProps,
  onMouseOver,
}) => {
  const {
    select,
    duplicateElement,
    deleteElement,
    moveUp,
    moveDown,
    ui,
  } = useDesigner();

  const isContainer = isContainerElement(element);
  const showChrome = isSelected || isHovered;
  const dropInside = dropPosition === 'inside';

  const stop = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    fn();
  };

  const outline = dropInside
    ? 'ring-2 ring-accent-500 ring-offset-2 bg-accent-50/50'
    : isSelected
      ? 'ring-2 ring-accent-500 ring-offset-1'
      : isHovered
        ? 'ring-1 ring-accent-400 ring-offset-1'
        : holdsActive
          ? 'ring-1 ring-accent-200 ring-offset-1'
          : '';

  return (
    <div
      {...dragProps}
      /* How the canvas finds a block selected from somewhere else — the
         Sections outline — to bring it into view. */
      data-block-id={element.id}
      onClick={stop(() => select(element.id))}
      onMouseOver={onMouseOver}
      style={style}
      className={`relative cursor-pointer transition-shadow ${outline} ${
        isDragging ? 'opacity-40' : ''
      } ${isSelected || isHovered ? 'z-10' : ''} ${
        isHiddenSomewhere(element) ? 'nl-hidden-block' : ''
      }`}
    >
      {/* Where the dragged block will land. An "inside" drop tints the box. */}
      {dropPosition && dropPosition !== 'inside' && (
        <div
          className={`pointer-events-none absolute inset-x-0 z-30 h-0.5 rounded-full bg-accent-500 ${
            dropPosition === 'before' ? '-top-0.5' : '-bottom-0.5'
          }`}
        />
      )}

      {/*
        A top-level section's resting-state name chip.

        It sits in the gutter *beside* the email rather than above the section,
        for two reasons: sections are flush against each other — a bare one adds
        no margin, by design — so a chip above would land on the previous
        section's last line; and clear of the card entirely, so it never covers
        the content it's labelling.
      */}
      {showNameTab && !showChrome && (
        <button
          type="button"
          title={`Select ${blockName(element)}`}
          onMouseOver={(e) => e.stopPropagation()}
          onClick={stop(() => select(element.id))}
          style={{ right: `calc(100% + ${nameTabOffset}px)` }}
          className="absolute top-0 z-20 max-w-24 truncate rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-500 hover:border-accent-300 hover:text-accent-700"
        >
          {blockName(element)}
        </button>
      )}

      {/* Name tab, top-left. The grip is the only thing that starts a drag. */}
      {showChrome && (
        <div className="absolute -top-5.5 left-0 z-20 flex items-center gap-1 rounded-t-md bg-accent-500 pl-2 pr-1 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
          <span className="max-w-40 truncate">{blockName(element)}</span>
          {isHiddenSomewhere(element) && (
            <EyeOff className="h-3 w-3" aria-label="Hidden on some devices" />
          )}
          <span className="mx-0.5 h-3 w-px bg-white/40" />
          <button
            type="button"
            title="Drag to reorder"
            onMouseDown={(e) => {
              e.stopPropagation();
              onArmDrag();
            }}
            onClick={(e) => e.stopPropagation()}
            className="cursor-grab rounded p-0.5 hover:bg-white/20 active:cursor-grabbing"
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
          {parentId && (
            <button
              type="button"
              title="Select the section this block sits in"
              onClick={stop(() => select(parentId))}
              className="rounded p-0.5 hover:bg-white/20"
            >
              <CornerLeftUp className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      {/*
        A container full of children is almost entirely covered by them, and
        every child stops its own click — so without this there's only whatever
        sliver of the section's padding is left to aim at. Top-*right*, because
        the full tab and every child's tab sit at the top-left.

        Swallows `mouseover` rather than forwarding it: letting hover reach the
        section would satisfy `isHovered`, unmount this button, and leave the
        click with nothing under it.

        Only for *nested* sections. A top-level one already has its permanent
        chip out in the gutter, which does the same job without a second label
        appearing the moment you touch one of its children.
      */}
      {isContainer && !showNameTab && !showChrome && holdsActive && (
        <button
          type="button"
          title="Select this section"
          onMouseOver={(e) => e.stopPropagation()}
          onClick={stop(() => select(element.id))}
          className="absolute -top-4.5 right-0 z-20 rounded-t-md border border-b-0 border-accent-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-accent-700 hover:bg-accent-50"
        >
          {blockName(element)}
        </button>
      )}

      {/*
        Floating action rail, right side. Selection only — not hover: it's the
        one piece of chrome that destroys work (delete, duplicate), and on hover
        it flickers in and out as the cursor crosses the canvas, next to blocks
        the user never meant to act on.
      */}
      {isSelected && (
        <div className="absolute -right-11 top-0 z-20 flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-md">
          <button
            type="button"
            title="Move up"
            onClick={stop(() => moveUp(element.id))}
            className="p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          >
            <ChevronUp className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="Move down"
            onClick={stop(() => moveDown(element.id))}
            className="p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="Drag to move anywhere"
            onMouseDown={(e) => {
              e.stopPropagation();
              onArmDrag();
            }}
            onClick={(e) => e.stopPropagation()}
            className="cursor-grab p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 active:cursor-grabbing"
          >
            <Move className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="Edit this block's HTML"
            onClick={stop(() => {
              select(element.id);
              ui.setInspectorTab('code');
            })}
            className="p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          >
            <Code2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="Duplicate"
            onClick={stop(() => duplicateElement(element.id))}
            className="p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          >
            <Copy className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="Delete"
            onClick={stop(() => deleteElement(element.id))}
            className="p-2 text-red-500 hover:bg-red-50 hover:text-red-700"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      )}

      {children}
    </div>
  );
};
