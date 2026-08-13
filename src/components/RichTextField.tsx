import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  $createParagraphNode,
  $getRoot,
  $getSelection,
  $insertNodes,
  $isRangeSelection,
  $isTextNode,
  CAN_REDO_COMMAND,
  CAN_UNDO_COMMAND,
  COMMAND_PRIORITY_LOW,
  FORMAT_TEXT_COMMAND,
  REDO_COMMAND,
  SELECTION_CHANGE_COMMAND,
  UNDO_COMMAND,
  type DOMConversionMap,
  type DOMConversionOutput,
  type LexicalEditor,
  type TextFormatType,
} from 'lexical';
import { $createLinkNode, LinkNode } from '@lexical/link';
import { $generateHtmlFromNodes, $generateNodesFromDOM } from '@lexical/html';
import {
  $forEachSelectedTextNode,
  $getSelectionStyleValueForProperty,
  $patchStyleText,
} from '@lexical/selection';
import { mergeRegister } from '@lexical/utils';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Palette,
  Highlighter,
  RemoveFormatting,
  Undo2,
  Redo2,
} from 'lucide-react';
import {
  RICH_TEXT_COLORS,
  RICH_TEXT_FONT_SIZES,
  RICH_TEXT_HIGHLIGHTS,
  sanitizeRichHtml,
} from '../utils/richText';

/**
 * The Inspector's WYSIWYG editor for a block's rich text, built on Lexical.
 *
 * The element's `content` stays what it has always been — the narrow subset of
 * HTML in `utils/richText.ts` — so nothing downstream changes: the generator,
 * the canvas's own inline editing and the export all read the same string. This
 * component is a *view* onto that string:
 *
 *   content ──$generateNodesFromDOM──▶ EditorState ──$generateHtmlFromNodes──▶
 *   sanitizeRichHtml ──▶ content
 *
 * Lexical's export is not the markup we ship — it carries theme classes,
 * `white-space: pre-wrap` spans and a doubled tag for every text format — so it
 * never reaches `content` without going through `sanitizeRichHtml` first. That
 * is also what keeps the output email-safe; see the sanitizer's header.
 *
 * Two rules govern when data crosses that boundary, and both matter:
 *
 * - **Only a user edit writes back.** A round trip through Lexical normalises
 *   markup slightly, so emitting on mount would rewrite someone's hand-authored
 *   HTML just because they clicked the block. `userEditedRef` gates it.
 * - **Re-seeding never writes back.** When `value` changes from elsewhere — the
 *   canvas's inline editor, or the "Edit HTML source" textarea below this field
 *   — the editor is re-seeded under an `external` tag that the emit path
 *   ignores. Without that, typing `<stro` into the source box would be parsed,
 *   sanitized and written straight back over the half-finished tag.
 */

/**
 * Lexical styles text formats with theme classes rather than tags, so
 * underline and strikethrough are invisible without these. Tailwind utilities
 * work directly — the classes only ever live in the editor's own DOM, and the
 * sanitizer strips `class` from the exported HTML.
 */
const EDITOR_THEME = {
  paragraph: 'mb-2 last:mb-0',
  text: {
    bold: 'font-bold',
    italic: 'italic',
    underline: 'underline',
    strikethrough: 'line-through',
    underlineStrikethrough: 'underline line-through',
  },
  link: 'text-red-700 underline',
};

/**
 * Inline styles carried from the stored HTML onto the Lexical text node.
 *
 * Lexical's own importers ignore these — a `<span style="color:#b22222;">`
 * imports as bare text — so without this, opening a paragraph that already had
 * coloured or resized words and typing a single character would silently
 * flatten all of it.
 */
const IMPORTED_STYLE_PROPS = ['color', 'background-color', 'font-size'];

/** The format each inline tag stands for, so overriding its importer keeps it. */
const TAG_FORMATS: Record<string, TextFormatType> = {
  STRONG: 'bold',
  B: 'bold',
  EM: 'italic',
  I: 'italic',
  U: 'underline',
  S: 'strikethrough',
  STRIKE: 'strikethrough',
  DEL: 'strikethrough',
};

function importedStyle(el: HTMLElement): string {
  return IMPORTED_STYLE_PROPS.map(
    (prop) => [prop, el.style.getPropertyValue(prop)] as const
  )
    .filter(([, value]) => value)
    .map(([prop, value]) => `${prop}: ${value};`)
    .join(' ');
}

/** Emphasis stated as a style rather than a tag — pasted from a word processor. */
function importedFormats(el: HTMLElement): TextFormatType[] {
  const formats: TextFormatType[] = [];
  if (/^(bold|bolder|[6-9]00)$/.test(el.style.fontWeight)) formats.push('bold');
  if (el.style.fontStyle === 'italic' || el.style.fontStyle === 'oblique') {
    formats.push('italic');
  }
  const decoration = `${el.style.textDecoration} ${el.style.textDecorationLine}`;
  if (decoration.includes('underline')) formats.push('underline');
  if (decoration.includes('line-through')) formats.push('strikethrough');
  return formats;
}

/**
 * Pushes an element's styling down onto the text inside it.
 *
 * Lexical resolves exactly one importer per element — the highest priority one
 * that returns non-null — so an override can't be layered on top of the
 * built-in. That's why the tag's own meaning is re-applied here: taking over
 * `<strong style="color:…">` to keep the colour would otherwise lose the bold.
 * Elements with nothing to carry return `null`, which leaves Lexical's own
 * importer in charge.
 */
function convertStyledInline(el: HTMLElement): DOMConversionOutput | null {
  const style = importedStyle(el);
  if (!style) return null;

  const formats = importedFormats(el);
  const tagFormat = TAG_FORMATS[el.tagName];
  if (tagFormat) formats.push(tagFormat);

  return {
    // A link has to keep being a link; everything else here is pure styling
    // that lives on the text nodes underneath.
    node:
      el.tagName === 'A'
        ? $createLinkNode(el.getAttribute('href') ?? '', {
            rel: el.getAttribute('rel'),
            target: el.getAttribute('target'),
            title: el.getAttribute('title'),
          })
        : null,
    forChild: (child) => {
      if ($isTextNode(child)) {
        // The child's own style goes last so an inner colour beats an outer one.
        child.setStyle([style, child.getStyle()].filter(Boolean).join(' '));
        for (const format of formats) {
          // `toggleFormat` would cancel out for nested bold inside bold.
          if (!child.hasFormat(format)) child.toggleFormat(format);
        }
      }
      return child;
    },
  };
}

/*
  The decision to take an element over has to happen *here*, in the selector,
  not inside the conversion. Lexical picks one importer per element by asking
  every registered selector and keeping the highest-priority non-null answer —
  so a selector that always answers wins every time, and a conversion that then
  returns null leaves the element with no importer at all, dropping the bold
  from a plain `<strong>`. Answering null when there's no style to carry is what
  hands the element back to Lexical's own importer.
*/
const HTML_IMPORT: DOMConversionMap = Object.fromEntries(
  ['span', 'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'del', 'a', 'font'].map(
    (tag) => [
      tag,
      (el: HTMLElement) =>
        importedStyle(el)
          ? {
              conversion: convertStyledInline,
              // Above the built-in importers, which register at priority 0.
              priority: 1 as const,
            }
          : null,
    ]
  )
);

/** Replaces the editor's whole contents with `html`. Must run inside an update. */
function $seedFromHtml(editor: LexicalEditor, html: string): void {
  const root = $getRoot();
  root.clear();

  // Parsed detached, exactly like the sanitizer does — no partially-built
  // markup is ever attached to the page.
  const dom = new DOMParser().parseFromString(html ?? '', 'text/html');
  const nodes = $generateNodesFromDOM(editor, dom);

  if (nodes.length) {
    root.select();
    $insertNodes(nodes);
  } else {
    // An empty root has nothing to put a caret in, so the field would refuse
    // the first keystroke.
    root.append($createParagraphNode());
  }
}

interface ContentBridgeProps {
  value: string;
  onChange: (html: string) => void;
  /** The last HTML this field and its parent agreed on. Shared with the toolbar. */
  htmlRef: React.MutableRefObject<string>;
  /** False until the user has actually typed or run a command in here. */
  userEditedRef: React.MutableRefObject<boolean>;
}

/** Keeps `value` and the editor state in step, in both directions. */
const ContentBridge: React.FC<ContentBridgeProps> = ({
  value,
  onChange,
  htmlRef,
  userEditedRef,
}) => {
  const [editor] = useLexicalComposerContext();
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Prop -> editor. Skipped for the value we just emitted ourselves, which is
  // what stops typing here from bouncing back as a re-seed and dropping the
  // caret on every keystroke.
  useEffect(() => {
    if (value === htmlRef.current) return;
    htmlRef.current = value;
    editor.update(() => $seedFromHtml(editor, value), {
      // `external` suppresses the emit below; `history-merge` keeps a re-seed
      // out of the undo stack, where it would be a strange thing to undo.
      tag: ['external', 'history-merge'],
    });
  }, [value, editor, htmlRef]);

  // Editor -> prop.
  useEffect(
    () =>
      editor.registerUpdateListener(
        ({ editorState, tags, dirtyElements, dirtyLeaves }) => {
          if (tags.has('external')) return;
          if (!userEditedRef.current) return;
          // Moving the caret is not an edit, and re-exporting on every
          // selection change would be pure work.
          if (dirtyElements.size === 0 && dirtyLeaves.size === 0) return;

          const html = editorState.read(() => $generateHtmlFromNodes(editor, null));
          const clean = sanitizeRichHtml(html);
          if (clean === htmlRef.current) return;

          htmlRef.current = clean;
          onChangeRef.current(clean);
        }
      ),
    [editor, htmlRef, userEditedRef]
  );

  return null;
};

const buttonClass =
  'p-1.5 rounded text-slate-600 hover:bg-white hover:text-red-700 transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-600';
const activeClass = 'bg-white text-red-700 shadow-sm';

/** Keeps the text selection alive: focusing a button would collapse it. */
const keepSelection = (e: React.MouseEvent) => e.preventDefault();

/**
 * A swatch grid on a toolbar button, with a "none" row above it.
 *
 * `onPick` is handed `null` for that row, which is what `$patchStyleText`
 * wants: the property is *removed* rather than set to a colour that paints
 * nothing, so the text goes back to inheriting the block's — and clearing a
 * highlight leaves no `background-color:transparent` behind for Outlook to
 * misread.
 */
const SwatchDropdown: React.FC<{
  title: string;
  clearLabel: string;
  icon: React.ReactNode;
  swatches: string[];
  onPick: (color: string | null) => void;
}> = ({ title, clearLabel, icon, swatches, onPick }) => {
  const [open, setOpen] = useState(false);

  const pick = (color: string | null) => {
    onPick(color);
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onMouseDown={keepSelection}
        onClick={() => setOpen((v) => !v)}
        aria-pressed={open}
        className={`${buttonClass} flex items-center gap-0.5 ${
          open ? activeClass : ''
        }`}
        title={title}
      >
        {icon}
        <span className="text-[10px] font-bold">▾</span>
      </button>
      {open && (
        // Anchored to the button's *right* edge so it opens leftwards, back
        // into the panel. Anchoring left runs it off the edge of the
        // Inspector, which is only 320px wide and can't scroll sideways.
        <div className="absolute top-full right-0 mt-1 z-20 bg-white border border-slate-200 rounded-lg shadow-lg p-1.5 w-44 space-y-1.5">
          <button
            type="button"
            onMouseDown={keepSelection}
            onClick={() => pick(null)}
            title={clearLabel}
            className="flex w-full items-center gap-1.5 border-b border-slate-100 pb-1.5 text-[10px] font-semibold text-slate-600 hover:text-slate-900"
          >
            {/* White with a slash — the shorthand every picker uses for none. */}
            <span className="relative block w-5 h-5 shrink-0 overflow-hidden rounded border border-slate-300 bg-white">
              <span className="absolute left-1/2 top-1/2 h-px w-7 -translate-x-1/2 -translate-y-1/2 -rotate-45 bg-red-500" />
            </span>
            {clearLabel}
          </button>
          <div className="grid grid-cols-6 gap-1">
            {swatches.map((color) => (
              <button
                key={color}
                type="button"
                onMouseDown={keepSelection}
                onClick={() => pick(color)}
                style={{ backgroundColor: color }}
                className="w-5 h-5 rounded border border-slate-300 hover:scale-110 transition-transform"
                title={color}
              />
            ))}
          </div>
          <label className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-600">
            {/*
              No `keepSelection` here — preventing mousedown stops the native
              picker opening at all. Lexical holds the selection in its own
              state, so losing the DOM one is survivable.
            */}
            <input
              type="color"
              onChange={(e) => onPick(e.target.value)}
              className="w-5 h-5 rounded border-0 bg-transparent cursor-pointer p-0"
            />
            Custom colour
          </label>
        </div>
      )}
    </div>
  );
};

interface ToolbarProps {
  /** Called before every command, so the bridge knows the edit came from a user. */
  onCommand: () => void;
}

const Toolbar: React.FC<ToolbarProps> = ({ onCommand }) => {
  const [editor] = useLexicalComposerContext();
  const [active, setActive] = useState({
    bold: false,
    italic: false,
    underline: false,
    strikethrough: false,
  });
  const [fontSize, setFontSize] = useState('');
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  /** Reads the selection's formats so the buttons can show as pressed. */
  const syncToSelection = useCallback(() => {
    const selection = $getSelection();
    if (!$isRangeSelection(selection)) return;
    setActive({
      bold: selection.hasFormat('bold'),
      italic: selection.hasFormat('italic'),
      underline: selection.hasFormat('underline'),
      strikethrough: selection.hasFormat('strikethrough'),
    });
    // Blank when the selection spans more than one size — the `<select>` then
    // shows its placeholder rather than lying about one of them.
    setFontSize($getSelectionStyleValueForProperty(selection, 'font-size', ''));
  }, []);

  useEffect(
    () =>
      mergeRegister(
        editor.registerUpdateListener(({ editorState }) =>
          editorState.read(syncToSelection)
        ),
        editor.registerCommand(
          SELECTION_CHANGE_COMMAND,
          () => {
            syncToSelection();
            return false;
          },
          COMMAND_PRIORITY_LOW
        ),
        editor.registerCommand(
          CAN_UNDO_COMMAND,
          (payload) => {
            setCanUndo(payload);
            return false;
          },
          COMMAND_PRIORITY_LOW
        ),
        editor.registerCommand(
          CAN_REDO_COMMAND,
          (payload) => {
            setCanRedo(payload);
            return false;
          },
          COMMAND_PRIORITY_LOW
        )
      ),
    [editor, syncToSelection]
  );

  const format = (type: TextFormatType) => {
    onCommand();
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, type);
    editor.focus();
  };

  /**
   * Colour and size are inline styles on the selected text, not formats, so
   * they go through `$patchStyleText` — which splits partially-selected nodes
   * for us. `null` clears the property.
   */
  const patchStyle = (patch: Record<string, string | null>) => {
    onCommand();
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) $patchStyleText(selection, patch);
    });
    // The `<select>` and the colour input take focus when clicked. Lexical
    // keeps its own selection through that, but the caret has to be put back
    // or the next keystroke lands nowhere.
    editor.focus();
  };

  const clearFormatting = () => {
    onCommand();
    editor.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;
      $forEachSelectedTextNode((node) => {
        node.setFormat(0);
        node.setStyle('');
      });
    });
    editor.focus();
  };

  return (
    <div className="flex items-center gap-0.5 flex-wrap px-1 py-1 bg-slate-50 border-b border-slate-200">
      <button
        type="button"
        onMouseDown={keepSelection}
        onClick={() => format('bold')}
        aria-pressed={active.bold}
        className={`${buttonClass} ${active.bold ? activeClass : ''}`}
        title="Bold (⌘B)"
      >
        <Bold className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onMouseDown={keepSelection}
        onClick={() => format('italic')}
        aria-pressed={active.italic}
        className={`${buttonClass} ${active.italic ? activeClass : ''}`}
        title="Italic (⌘I)"
      >
        <Italic className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onMouseDown={keepSelection}
        onClick={() => format('underline')}
        aria-pressed={active.underline}
        className={`${buttonClass} ${active.underline ? activeClass : ''}`}
        title="Underline (⌘U)"
      >
        <Underline className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onMouseDown={keepSelection}
        onClick={() => format('strikethrough')}
        aria-pressed={active.strikethrough}
        className={`${buttonClass} ${active.strikethrough ? activeClass : ''}`}
        title="Strikethrough"
      >
        <Strikethrough className="w-3.5 h-3.5" />
      </button>

      <span className="w-px h-5 bg-slate-200 mx-0.5" />

      <select
        value={RICH_TEXT_FONT_SIZES.some((s) => `${s}px` === fontSize) ? fontSize : ''}
        onChange={(e) =>
          patchStyle({ 'font-size': e.target.value || null })
        }
        className="h-6 bg-white border border-slate-200 rounded text-[11px] text-slate-700 px-1 focus:ring-1 focus:ring-red-500"
        title="Font size for the selected text"
      >
        <option value="">Size</option>
        {RICH_TEXT_FONT_SIZES.map((size) => (
          <option key={size} value={`${size}px`}>
            {size}
          </option>
        ))}
      </select>

      <SwatchDropdown
        title="Colour for the selected text"
        clearLabel="Default colour"
        icon={<Palette className="w-3.5 h-3.5" />}
        swatches={RICH_TEXT_COLORS}
        onPick={(color) => patchStyle({ color })}
      />

      <SwatchDropdown
        title="Highlight behind the selected text"
        clearLabel="No highlight"
        icon={<Highlighter className="w-3.5 h-3.5" />}
        swatches={RICH_TEXT_HIGHLIGHTS}
        onPick={(color) => patchStyle({ 'background-color': color })}
      />

      <button
        type="button"
        onMouseDown={keepSelection}
        onClick={clearFormatting}
        className={buttonClass}
        title="Strip formatting from the selected text"
      >
        <RemoveFormatting className="w-3.5 h-3.5" />
      </button>

      <span className="w-px h-5 bg-slate-200 mx-0.5" />

      <button
        type="button"
        onMouseDown={keepSelection}
        onClick={() => {
          onCommand();
          editor.dispatchCommand(UNDO_COMMAND, undefined);
        }}
        disabled={!canUndo}
        className={buttonClass}
        title="Undo (⌘Z)"
      >
        <Undo2 className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onMouseDown={keepSelection}
        onClick={() => {
          onCommand();
          editor.dispatchCommand(REDO_COMMAND, undefined);
        }}
        disabled={!canRedo}
        className={buttonClass}
        title="Redo (⇧⌘Z)"
      >
        <Redo2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

export interface RichTextFieldProps {
  /** The element's `content`. */
  value: string;
  /** Called with sanitized HTML after a user edit — never on mount. */
  onChange: (html: string) => void;
  /** Shown when the field is empty. */
  placeholder?: string;
  /**
   * Typography copied from the block being edited, so the field reads roughly
   * as the email will. Only a preview — none of it is written to `content`.
   */
  textStyle?: React.CSSProperties;
}

export const RichTextField: React.FC<RichTextFieldProps> = ({
  value,
  onChange,
  placeholder = 'Write your message…',
  textStyle,
}) => {
  const htmlRef = useRef(value);
  const userEditedRef = useRef(false);
  const markUserEdit = useCallback(() => {
    userEditedRef.current = true;
  }, []);

  const initialConfig = useMemo(
    () => ({
      namespace: 'newsletter-rich-text',
      theme: EDITOR_THEME,
      // Registered so an `<a>` already in the content survives the round trip.
      // There's no link button — a link is still authored in the HTML source
      // box, the same as before.
      nodes: [LinkNode],
      html: { import: HTML_IMPORT },
      onError: (error: Error) => {
        // Never throw: a block whose HTML Lexical can't model must not take
        // the whole designer down with it.
        console.error('[RichTextField]', error);
      },
      // Read once, on mount. `ContentBridge` owns every change after this, and
      // the field is remounted (keyed on element id) when the block changes.
      editorState: (editor: LexicalEditor) => $seedFromHtml(editor, htmlRef.current),
    }),
    []
  );

  return (
    <div className="rounded border border-slate-200 bg-white overflow-visible focus-within:ring-1 focus-within:ring-red-500">
      <LexicalComposer initialConfig={initialConfig}>
        <Toolbar onCommand={markUserEdit} />
        {/*
          Capture phase, not bubble: React delivers a bubbled handler after
          Lexical's own listener on the contenteditable has already run and
          committed the update, so the flag would arrive one keystroke late and
          the first character typed would never reach `content`.
        */}
        <div
          className="relative"
          onKeyDownCapture={markUserEdit}
          onBeforeInputCapture={markUserEdit}
          onCompositionStartCapture={markUserEdit}
          onPasteCapture={markUserEdit}
          onCutCapture={markUserEdit}
          onDropCapture={markUserEdit}
        >
          <RichTextPlugin
            contentEditable={
              <ContentEditable
                aria-placeholder={placeholder}
                placeholder={
                  <div className="absolute top-2 left-2 text-slate-400 pointer-events-none select-none text-xs">
                    {placeholder}
                  </div>
                }
                className="min-h-28 max-h-72 overflow-y-auto p-2 outline-none text-slate-800"
                style={textStyle}
              />
            }
            ErrorBoundary={LexicalErrorBoundary}
          />
        </div>
        <HistoryPlugin />
        <ContentBridge
          value={value}
          onChange={onChange}
          htmlRef={htmlRef}
          userEditedRef={userEditedRef}
        />
      </LexicalComposer>
    </div>
  );
};
