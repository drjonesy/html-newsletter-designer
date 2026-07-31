import React, { useState } from 'react';
import { Bold, Italic, Underline, Palette, Type, RemoveFormatting } from 'lucide-react';
import { RICH_TEXT_COLORS, RICH_TEXT_FONT_SIZES } from '../utils/richText';

/**
 * One formatting action aimed at whatever is selected in the field being
 * edited. `BlockBody` runs it — the toolbar itself never touches the DOM,
 * because restoring the selection first is the whole trick and only the editing
 * component knows which node holds it.
 */
export type RichCommand =
  | { kind: 'bold' }
  | { kind: 'italic' }
  | { kind: 'underline' }
  | { kind: 'color'; value: string }
  | { kind: 'fontSize'; value: number }
  | { kind: 'clear' };

// Sizes and colours live in `utils/richText` so this bar and the Inspector's
// editor offer the same set — see RichTextField.tsx.
const FONT_SIZES = RICH_TEXT_FONT_SIZES;
const COLORS = RICH_TEXT_COLORS;

interface RichTextToolbarProps {
  onCommand: (command: RichCommand) => void;
  /** Viewport coordinates, since the bar is positioned `fixed` — see below. */
  position: { top: number; left: number };
  /** Shown at the right-hand end — what Enter does in this kind of field. */
  hint?: string;
}

/**
 * Formatting bar shown while a rich field is being edited on the canvas.
 *
 * Every control is a `<button>` whose `mousedown` is prevented, which is what
 * keeps the text selection alive: clicking anything focusable would otherwise
 * collapse the selection before the command could apply to it. The one
 * exception is the colour picker — a native `<input type="color">` can't have
 * its `mousedown` prevented without the OS picker refusing to open — so the
 * editor restores the last selection before running a command instead of
 * relying on it having survived.
 *
 * Positioned `fixed` against the viewport rather than absolutely against the
 * block: the canvas draws the email inside a rounded frame with
 * `overflow-hidden`, which would clip a bar floating above the first block in
 * the message. `fixed` also lets it flip below the text when there's no room
 * above. It stays a DOM child of the editor, so focus moving here still reads
 * as staying inside the field.
 */
export const RichTextToolbar: React.FC<RichTextToolbarProps> = ({
  onCommand,
  position,
  hint,
}) => {
  const [openMenu, setOpenMenu] = useState<'size' | 'color' | null>(null);

  const run = (command: RichCommand) => {
    onCommand(command);
    setOpenMenu(null);
  };

  const buttonClass =
    'p-1.5 rounded text-slate-600 hover:bg-slate-100 hover:text-red-700 transition-colors';

  /** Shared by every control: keeps focus, and the selection, where it is. */
  const keepSelection = (e: React.MouseEvent) => e.preventDefault();

  return (
    <div
      className="fixed z-50 flex items-center gap-0.5 bg-white border border-slate-200 rounded-lg shadow-lg px-1 py-1"
      style={{ top: position.top, left: position.left }}
      onMouseDown={keepSelection}
      // The block underneath treats a click as "select me" and a second click
      // as "start editing" — neither should happen from up here.
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onMouseDown={keepSelection}
        onClick={() => run({ kind: 'bold' })}
        className={buttonClass}
        title="Bold (⌘B) — wraps the selection in <strong>"
      >
        <Bold className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onMouseDown={keepSelection}
        onClick={() => run({ kind: 'italic' })}
        className={buttonClass}
        title="Italic (⌘I) — wraps the selection in <em>"
      >
        <Italic className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onMouseDown={keepSelection}
        onClick={() => run({ kind: 'underline' })}
        className={buttonClass}
        title="Underline (⌘U) — wraps the selection in <u>"
      >
        <Underline className="w-3.5 h-3.5" />
      </button>

      <span className="w-px h-5 bg-slate-200 mx-0.5" />

      {/* Font size */}
      <div className="relative">
        <button
          type="button"
          onMouseDown={keepSelection}
          onClick={() => setOpenMenu(openMenu === 'size' ? null : 'size')}
          aria-pressed={openMenu === 'size'}
          className={`${buttonClass} flex items-center gap-0.5 ${
            openMenu === 'size' ? 'bg-slate-100 text-red-700' : ''
          }`}
          title="Font size for the selected text"
        >
          <Type className="w-3.5 h-3.5" />
          <span className="text-[10px] font-bold">▾</span>
        </button>
        {openMenu === 'size' && (
          <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg p-1 grid grid-cols-4 gap-0.5 w-40">
            {FONT_SIZES.map((size) => (
              <button
                key={size}
                type="button"
                onMouseDown={keepSelection}
                onClick={() => run({ kind: 'fontSize', value: size })}
                className="px-1.5 py-1 rounded text-[11px] font-semibold text-slate-700 hover:bg-red-700 hover:text-white transition-colors"
              >
                {size}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Text colour */}
      <div className="relative">
        <button
          type="button"
          onMouseDown={keepSelection}
          onClick={() => setOpenMenu(openMenu === 'color' ? null : 'color')}
          aria-pressed={openMenu === 'color'}
          className={`${buttonClass} flex items-center gap-0.5 ${
            openMenu === 'color' ? 'bg-slate-100 text-red-700' : ''
          }`}
          title="Colour for the selected text"
        >
          <Palette className="w-3.5 h-3.5" />
          <span className="text-[10px] font-bold">▾</span>
        </button>
        {openMenu === 'color' && (
          <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg p-1.5 w-44 space-y-1.5">
            <div className="grid grid-cols-6 gap-1">
              {COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onMouseDown={keepSelection}
                  onClick={() => run({ kind: 'color', value: color })}
                  style={{ backgroundColor: color }}
                  className="w-5 h-5 rounded border border-slate-300 hover:scale-110 transition-transform"
                  title={color}
                />
              ))}
            </div>
            <label className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-600">
              {/*
                No `keepSelection` here: preventing mousedown stops the native
                picker opening at all. The editor restores the saved range
                before applying, so losing the live selection is survivable.
              */}
              <input
                type="color"
                onChange={(e) => run({ kind: 'color', value: e.target.value })}
                className="w-5 h-5 rounded border-0 bg-transparent cursor-pointer p-0"
              />
              Custom colour
            </label>
          </div>
        )}
      </div>

      <span className="w-px h-5 bg-slate-200 mx-0.5" />

      <button
        type="button"
        onMouseDown={keepSelection}
        onClick={() => run({ kind: 'clear' })}
        className={buttonClass}
        title="Strip formatting from the selected text"
      >
        <RemoveFormatting className="w-3.5 h-3.5" />
      </button>

      {hint && (
        <span className="text-[10px] text-slate-400 font-medium border-l border-slate-200 pl-2 ml-1 pr-1 whitespace-nowrap">
          {hint}
        </span>
      )}
    </div>
  );
};
