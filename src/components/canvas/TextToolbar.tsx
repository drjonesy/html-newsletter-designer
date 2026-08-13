import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Baseline,
  Bold,
  ChevronDown,
  Highlighter,
  Italic,
  Link2,
  Link2Off,
  MoreHorizontal,
  RemoveFormatting,
  Strikethrough,
  Underline,
} from 'lucide-react';
import {
  editorChromeProps,
  RichCommand,
  useEditingSession,
} from '../../state/EditingSession';
import { useDesigner } from '../../state/DesignerContext';
import {
  INHERIT_COLOR,
  NO_HIGHLIGHT,
  RICH_TEXT_COLORS,
  RICH_TEXT_FONTS,
  RICH_TEXT_FONT_SIZES,
  RICH_TEXT_HIGHLIGHTS,
} from '../../utils/richText';
import {
  convertTextBlock,
  TEXT_BLOCK_FORMATS,
  TextBlockFormat,
  textBlockFormat,
} from '../../utils/elementHelpers';

/**
 * Cancels `mousedown` on whatever it's spread onto.
 *
 * The single most load-bearing detail in this file. Clicking any focusable
 * element collapses the selection inside a contenteditable, and a formatting
 * command with nothing selected does nothing — so every control has to refuse
 * the focus that its own click would otherwise take.
 *
 * `<select>` and `<input type="color">` are the exceptions: they won't open at
 * all if their `mousedown` is cancelled. Those restore the remembered range
 * instead, which `runCommand` does for every command anyway.
 */
const keepSelection = {
  onMouseDown: (e: React.MouseEvent) => e.preventDefault(),
};

const Divider: React.FC = () => (
  <span className="mx-1 h-6 w-px shrink-0 bg-slate-200" />
);

/**
 * A dropdown that escapes the toolbar.
 *
 * The bar scrolls sideways on a narrow window (`overflow-x-auto`), and an
 * overflow container clips in *both* axes — an absolutely positioned menu
 * hanging below the bar is cut off at its bottom edge no matter how high its
 * `z-index` is, because a clipping ancestor isn't something stacking order can
 * escape. So the menu is portalled to the body and positioned from the
 * trigger's rect instead.
 *
 * `editorChromeProps` goes on the portalled node itself: it's no longer inside
 * the toolbar's subtree, and `BlockBody` decides "did focus leave the editor?"
 * by walking up from the newly focused node. Without it, opening the link box
 * would end the edit it's meant to act on.
 */
const Popover: React.FC<{
  open: boolean;
  onClose: () => void;
  /** The trigger. The menu is placed under it and re-placed as it moves. */
  anchor: HTMLElement | null;
  /** Which edge of the anchor the menu lines up with. */
  align?: 'left' | 'right';
  className?: string;
  children: React.ReactNode;
}> = ({ open, onClose, anchor, align = 'left', className = '', children }) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!open || !anchor) {
      setPos(null);
      return;
    }

    const place = () => {
      const rect = anchor.getBoundingClientRect();
      const width = menuRef.current?.offsetWidth ?? 0;
      const left = align === 'right' ? rect.right - width : rect.left;
      setPos({
        top: rect.bottom + 4,
        // Clamped to the viewport: unlike the bar, the menu has no scroll
        // container of its own, so anything past the edge is unreachable.
        left: Math.max(8, Math.min(left, window.innerWidth - width - 8)),
      });
    };

    place();
    // Capture phase: the bar's own sideways scroll doesn't bubble to `window`,
    // and it moves the anchor out from under a menu positioned once.
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open, anchor, align]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menuRef.current?.contains(target) || anchor?.contains(target)) return;
      onClose();
    };
    // Only watches — it never cancels the event, so clicking back into the text
    // still places the caret where it was clicked.
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open, anchor, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      ref={menuRef}
      {...editorChromeProps}
      {...keepSelection}
      style={{
        top: pos?.top ?? 0,
        left: pos?.left ?? 0,
        // Hidden for the single frame before it's measured, so a right-aligned
        // menu doesn't flash at the wrong x.
        visibility: pos ? 'visible' : 'hidden',
      }}
      className={`fixed z-50 rounded-lg border border-slate-200 bg-white shadow-lg ${className}`}
    >
      {children}
    </div>,
    document.body
  );
};

interface ToolButtonProps {
  onClick: () => void;
  title: string;
  active?: boolean;
  children: React.ReactNode;
}

const ToolButton: React.FC<ToolButtonProps> = ({
  onClick,
  title,
  active,
  children,
}) => (
  <button
    type="button"
    title={title}
    aria-label={title}
    {...keepSelection}
    onClick={onClick}
    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors ${
      active
        ? 'bg-accent-50 text-accent-700'
        : 'text-slate-700 hover:bg-slate-100'
    }`}
  >
    {children}
  </button>
);

/**
 * The empty swatch: a white box with a red slash through it, the shorthand
 * every colour picker uses for "none".
 *
 * Drawn rather than iconised so it reads as one of the swatches it sits above —
 * same size, same border, just nothing in it.
 */
const NoColorSwatch: React.FC = () => (
  <span className="relative block h-5 w-5 shrink-0 overflow-hidden rounded border border-slate-300 bg-white">
    <span className="absolute left-1/2 top-1/2 h-px w-7 -translate-x-1/2 -translate-y-1/2 -rotate-45 bg-red-500" />
  </span>
);

/** A swatch grid that drops from a toolbar button. */
const SwatchMenu: React.FC<{
  title: string;
  icon: React.ReactNode;
  swatches: string[];
  onPick: (color: string) => void;
  /** Shown under the grid, opening the OS picker for anything not offered. */
  fallback: string;
  /**
   * The "no colour" row above the grid, and what picking it applies.
   *
   * Every swatch here *adds* a colour, so without this there is no way back:
   * a highlight can be changed to another highlight but never taken off, and
   * text nudged to grey can never rejoin the block it lives in.
   */
  clear?: { label: string; value: string };
}> = ({ title, icon, swatches, onPick, fallback, clear }) => {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLDivElement>(null);

  return (
    <div className="shrink-0" ref={anchor}>
      <button
        type="button"
        title={title}
        aria-label={title}
        {...keepSelection}
        onClick={() => setOpen((v) => !v)}
        className="flex h-8 items-center gap-0.5 rounded-md px-1.5 text-slate-700 hover:bg-slate-100"
      >
        {icon}
        <ChevronDown className="h-3 w-3" />
      </button>

      <Popover
        open={open}
        onClose={() => setOpen(false)}
        anchor={anchor.current}
        className="w-44 p-2"
      >
        <div>
          {clear && (
            <button
              type="button"
              title={clear.label}
              {...keepSelection}
              onClick={() => {
                onPick(clear.value);
                setOpen(false);
              }}
              className="mb-2 flex w-full items-center gap-2 rounded border-b border-slate-100 px-0.5 pb-2 text-left text-xs text-slate-700 hover:text-slate-900"
            >
              <NoColorSwatch />
              {clear.label}
            </button>
          )}
          <div className="grid grid-cols-6 gap-1">
            {swatches.map((color) => (
              <button
                key={color}
                type="button"
                title={color}
                {...keepSelection}
                onClick={() => {
                  onPick(color);
                  setOpen(false);
                }}
                className="h-5 w-5 rounded border border-slate-300"
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
          <label className="mt-2 flex cursor-pointer items-center gap-2 border-t border-slate-100 pt-2 text-xs text-slate-600">
            {/*
              Can't cancel its own mousedown — the OS picker wouldn't open. The
              remembered range is what saves the selection here.
            */}
            <input
              type="color"
              defaultValue={fallback}
              onChange={(e) => onPick(e.target.value)}
              className="h-5 w-5 cursor-pointer rounded border border-slate-300 bg-transparent p-0"
            />
            Custom…
          </label>
        </div>
      </Popover>
    </div>
  );
};

/** Prompts for a URL, then links the selection. */
const LinkButton: React.FC<{
  onLink: (url: string) => void;
  onUnlink: () => void;
  currentHref: () => string | null;
}> = ({ onLink, onUnlink, currentHref }) => {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const existing = useRef<string | null>(null);
  const anchor = useRef<HTMLDivElement>(null);

  return (
    <div className="shrink-0" ref={anchor}>
      <ToolButton
        title="Link"
        onClick={() => {
          existing.current = currentHref();
          setUrl(existing.current ?? 'https://');
          setOpen((v) => !v);
        }}
      >
        <Link2 className="h-4 w-4" />
      </ToolButton>

      <Popover
        open={open}
        onClose={() => setOpen(false)}
        anchor={anchor.current}
        className="w-72 p-2"
      >
        <div className="flex items-center gap-1">
          <input
            autoFocus
            value={url}
            spellCheck={false}
            placeholder="https://example.com"
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (url.trim()) onLink(url.trim());
                setOpen(false);
              } else if (e.key === 'Escape') {
                setOpen(false);
              }
            }}
            className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1 text-sm outline-none focus:border-accent-500"
          />
          <button
            type="button"
            {...keepSelection}
            onClick={() => {
              if (url.trim()) onLink(url.trim());
              setOpen(false);
            }}
            className="rounded bg-accent-500 px-2 py-1 text-xs font-semibold text-white hover:bg-accent-600"
          >
            Apply
          </button>
          {existing.current && (
            <button
              type="button"
              title="Remove link"
              {...keepSelection}
              onClick={() => {
                onUnlink();
                setOpen(false);
              }}
              className="rounded p-1 text-slate-500 hover:bg-slate-100"
            >
              <Link2Off className="h-4 w-4" />
            </button>
          )}
        </div>
      </Popover>
    </div>
  );
};

/**
 * The formatting bar, docked at the top of the canvas area.
 *
 * v1 floated this over the field and re-measured it on every scroll and resize.
 * Docking removes all of that: the bar is always in one place, so there is no
 * positioning code, nothing to clip against the canvas's rounded frame, and no
 * chance of it covering the text being edited.
 *
 * What docking costs is proximity to the field, which is why the whole bar is
 * marked as editor chrome — blur handling in `BlockBody` treats focus landing
 * in here as staying inside the edit.
 */
export const TextToolbar: React.FC = () => {
  const session = useEditingSession();
  const { selectedElement, updateElement } = useDesigner();

  const run = (command: RichCommand) => session.runCommand(command);

  const format = selectedElement ? textBlockFormat(selectedElement) : null;
  const blockSize =
    selectedElement && 'fontSize' in selectedElement
      ? (selectedElement.fontSize as number)
      : 16;

  const [showMore, setShowMore] = useState(false);
  const moreAnchor = useRef<HTMLDivElement>(null);

  return (
    <div
      {...editorChromeProps}
      className="flex h-14 shrink-0 items-center gap-1 overflow-x-auto border-b border-slate-200 bg-white px-3"
      role="toolbar"
      aria-label="Text formatting"
    >
      {/*
        Block format. Not a text command — it changes the block's *type*, so it
        goes through `updateElement` rather than `runCommand`.
      */}
      {format && (
        <>
          <select
            value={format}
            onChange={(e) => {
              if (!selectedElement) return;
              updateElement(
                convertTextBlock(
                  selectedElement,
                  e.target.value as TextBlockFormat
                )
              );
            }}
            className="h-8 shrink-0 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-800 outline-none focus:border-accent-500"
            title="Block format"
          >
            {TEXT_BLOCK_FORMATS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <Divider />
        </>
      )}

      <select
        defaultValue=""
        onChange={(e) => {
          if (e.target.value) run({ kind: 'fontFamily', value: e.target.value });
          e.target.value = '';
        }}
        className="h-8 w-36 shrink-0 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-800 outline-none focus:border-accent-500"
        title="Font — applies to the selected text"
      >
        {/*
          Shows a prompt rather than a current value: the selection can span
          three fonts at once, and there is no honest single answer to display.
        */}
        <option value="">Font…</option>
        {RICH_TEXT_FONTS.map((font) => (
          <option key={font.label} value={font.stack}>
            {font.label}
          </option>
        ))}
      </select>

      <select
        value={blockSize}
        onChange={(e) => run({ kind: 'fontSize', value: Number(e.target.value) })}
        className="h-8 w-[70px] shrink-0 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-800 outline-none focus:border-accent-500"
        title="Size — applies to the selected text"
      >
        {/* The block's own size may not be one of the offered steps. */}
        {!RICH_TEXT_FONT_SIZES.includes(blockSize) && (
          <option value={blockSize}>{blockSize}</option>
        )}
        {RICH_TEXT_FONT_SIZES.map((size) => (
          <option key={size} value={size}>
            {size}
          </option>
        ))}
      </select>

      <Divider />

      <SwatchMenu
        title="Text colour"
        icon={<Baseline className="h-4 w-4" />}
        swatches={RICH_TEXT_COLORS}
        fallback="#111827"
        clear={{ label: 'Default colour', value: INHERIT_COLOR }}
        onPick={(value) => run({ kind: 'color', value })}
      />
      <SwatchMenu
        title="Highlight"
        icon={<Highlighter className="h-4 w-4" />}
        swatches={RICH_TEXT_HIGHLIGHTS}
        fallback="#fef08a"
        clear={{ label: 'No highlight', value: NO_HIGHLIGHT }}
        onPick={(value) => run({ kind: 'highlight', value })}
      />

      <Divider />

      <ToolButton title="Bold" onClick={() => run({ kind: 'bold' })}>
        <Bold className="h-4 w-4" />
      </ToolButton>
      <ToolButton title="Italic" onClick={() => run({ kind: 'italic' })}>
        <Italic className="h-4 w-4" />
      </ToolButton>
      <ToolButton title="Underline" onClick={() => run({ kind: 'underline' })}>
        <Underline className="h-4 w-4" />
      </ToolButton>
      <ToolButton
        title="Strikethrough"
        onClick={() => run({ kind: 'strikethrough' })}
      >
        <Strikethrough className="h-4 w-4" />
      </ToolButton>

      <Divider />

      <LinkButton
        currentHref={session.currentLinkHref}
        onLink={(value) => run({ kind: 'link', value })}
        onUnlink={() => run({ kind: 'unlink' })}
      />

      <div className="shrink-0" ref={moreAnchor}>
        <ToolButton title="More" onClick={() => setShowMore((v) => !v)}>
          <MoreHorizontal className="h-4 w-4" />
        </ToolButton>
        <Popover
          open={showMore}
          onClose={() => setShowMore(false)}
          anchor={moreAnchor.current}
          align="right"
          className="w-52 p-1"
        >
          <div>
            <button
              type="button"
              {...keepSelection}
              onClick={() => {
                run({ kind: 'clear' });
                setShowMore(false);
              }}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-100"
            >
              <RemoveFormatting className="h-4 w-4" />
              Clear formatting
            </button>
          </div>
        </Popover>
      </div>

      <span className="ml-auto shrink-0 pl-3 text-xs text-slate-400">
        {session.mode === 'item'
          ? 'Enter adds an item'
          : session.mode === 'rich'
            ? 'Enter starts a paragraph'
            : 'Enter saves'}
      </span>
    </div>
  );
};
