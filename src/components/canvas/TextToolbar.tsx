import React, { useRef, useState } from 'react';
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

/** A swatch grid that drops from a toolbar button. */
const SwatchMenu: React.FC<{
  title: string;
  icon: React.ReactNode;
  swatches: string[];
  onPick: (color: string) => void;
  /** Shown under the grid, opening the OS picker for anything not offered. */
  fallback: string;
}> = ({ title, icon, swatches, onPick, fallback }) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
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

      {open && (
        <div
          className="absolute left-0 top-full z-30 mt-1 w-44 rounded-lg border border-slate-200 bg-white p-2 shadow-lg"
          {...keepSelection}
        >
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
      )}
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

  return (
    <div className="relative">
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

      {open && (
        <div
          className="absolute left-0 top-full z-30 mt-1 flex w-72 items-center gap-1 rounded-lg border border-slate-200 bg-white p-2 shadow-lg"
          {...keepSelection}
        >
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
      )}
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

  return (
    <div
      {...editorChromeProps}
      className="flex h-14 items-center gap-1 overflow-x-auto border-b border-slate-200 bg-white px-3"
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
        onPick={(value) => run({ kind: 'color', value })}
      />
      <SwatchMenu
        title="Highlight"
        icon={<Highlighter className="h-4 w-4" />}
        swatches={RICH_TEXT_HIGHLIGHTS}
        fallback="#fef08a"
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

      <div className="relative">
        <ToolButton title="More" onClick={() => setShowMore((v) => !v)}>
          <MoreHorizontal className="h-4 w-4" />
        </ToolButton>
        {showMore && (
          <div
            className="absolute right-0 top-full z-30 mt-1 w-52 rounded-lg border border-slate-200 bg-white p-1 shadow-lg"
            {...keepSelection}
          >
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
        )}
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
