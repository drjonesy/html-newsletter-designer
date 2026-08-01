import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import { EditMode } from '../utils/htmlGenerator';
import {
  applyColor,
  applyFontFamily,
  applyFontSize,
  applyHighlight,
  applyLink,
  removeLink,
} from '../utils/richText';

/**
 * Marks anything that counts as part of the editor even though it isn't inside
 * the field being typed in.
 *
 * v1 could ask "did focus land inside my wrapper?", because the formatting bar
 * was a DOM sibling of the text. The docked bar lives in the shell, so the
 * question becomes "is the new focus target editor chrome?" — answered by this
 * attribute rather than by geometry or a list of refs.
 *
 * Put it on any control that must not end the edit when clicked.
 */
export const EDITOR_CHROME_ATTR = 'data-editor-chrome';

/** Spread onto a wrapper to mark its subtree as editor chrome. */
export const editorChromeProps = { [EDITOR_CHROME_ATTR]: '' } as Record<
  string,
  string
>;

/** True when focus moving to `node` should *not* end the current edit. */
export function isEditorChrome(node: Node | null): boolean {
  const el = node as HTMLElement | null;
  if (!el || typeof el.closest !== 'function') return false;
  return !!el.closest(`[${EDITOR_CHROME_ATTR}]`);
}

export type RichCommand =
  | { kind: 'bold' }
  | { kind: 'italic' }
  | { kind: 'underline' }
  | { kind: 'strikethrough' }
  | { kind: 'clear' }
  | { kind: 'color'; value: string }
  | { kind: 'highlight'; value: string }
  | { kind: 'fontSize'; value: number }
  | { kind: 'fontFamily'; value: string }
  | { kind: 'link'; value: string }
  | { kind: 'unlink' };

export interface ActiveEdit {
  blockId: string;
  /** Property name on the element, or `name.index` for one array entry. */
  field: string;
}

interface EditingSessionValue {
  /** What's being edited right now, or null. */
  active: ActiveEdit | null;
  /** How the active field behaves. Null when nothing is being edited. */
  mode: EditMode | null;
  start: (edit: ActiveEdit, caret?: { x: number; y: number }) => void;
  stop: () => void;
  /**
   * Called by the canvas once the contenteditable node exists, so the toolbar
   * has something to run commands against.
   */
  attach: (node: HTMLElement | null, mode: EditMode | null) => void;
  /** Where to put the caret when the edit opens. Consumed once. */
  takePendingCaret: () => { x: number; y: number } | null;
  /** Remembers the field's selection, so a control that steals it can restore it. */
  rememberSelection: () => void;
  runCommand: (command: RichCommand) => void;
  /** The URL of the link the caret currently sits in, if any. */
  currentLinkHref: () => string | null;
}

const EditingSessionContext = createContext<EditingSessionValue | null>(null);

/**
 * Owns the in-place editing session: which field is open, the DOM node behind
 * it, and the commands that act on its selection.
 *
 * This exists as a context rather than as state inside the block because the
 * formatting toolbar is docked at the top of the canvas area, nowhere near the
 * text. Something both can reach has to hold the live selection.
 */
export const EditingSessionProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [active, setActive] = useState<ActiveEdit | null>(null);
  const [mode, setMode] = useState<EditMode | null>(null);

  const nodeRef = useRef<HTMLElement | null>(null);
  const pendingCaret = useRef<{ x: number; y: number } | null>(null);
  /**
   * The last selection made inside the field.
   *
   * Toolbar buttons keep the selection themselves by cancelling their own
   * `mousedown`, but a native `<input type="color">` won't open if its
   * `mousedown` is cancelled and a `<select>` takes focus regardless — so every
   * command restores this before running.
   */
  const savedRange = useRef<Range | null>(null);

  const start = useCallback(
    (edit: ActiveEdit, caret?: { x: number; y: number }) => {
      pendingCaret.current = caret ?? null;
      savedRange.current = null;
      setActive(edit);
    },
    []
  );

  const stop = useCallback(() => {
    pendingCaret.current = null;
    savedRange.current = null;
    nodeRef.current = null;
    setActive(null);
    setMode(null);
  }, []);

  const attach = useCallback((node: HTMLElement | null, next: EditMode | null) => {
    nodeRef.current = node;
    setMode(next);
  }, []);

  const takePendingCaret = useCallback(() => {
    const caret = pendingCaret.current;
    pendingCaret.current = null;
    return caret;
  }, []);

  const rememberSelection = useCallback(() => {
    const node = nodeRef.current;
    const selection = window.getSelection();
    if (!node || !selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (node.contains(range.commonAncestorContainer)) {
      savedRange.current = range.cloneRange();
    }
  }, []);

  /** Puts the caret back where it was and returns the field's node. */
  const restoreSelection = useCallback((): HTMLElement | null => {
    const node = nodeRef.current;
    if (!node) return null;

    node.focus();
    const range = savedRange.current;
    if (range && node.contains(range.commonAncestorContainer)) {
      const selection = window.getSelection();
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
    return node;
  }, []);

  const runCommand = useCallback(
    (command: RichCommand) => {
      const node = restoreSelection();
      if (!node) return;

      switch (command.kind) {
        case 'bold':
          document.execCommand('bold');
          break;
        case 'italic':
          document.execCommand('italic');
          break;
        case 'underline':
          document.execCommand('underline');
          break;
        case 'strikethrough':
          document.execCommand('strikeThrough');
          break;
        case 'color':
          applyColor(command.value);
          break;
        case 'highlight':
          applyHighlight(command.value);
          break;
        case 'fontSize':
          applyFontSize(node, command.value);
          break;
        case 'fontFamily':
          applyFontFamily(node, command.value);
          break;
        case 'link':
          applyLink(node, command.value);
          break;
        case 'unlink':
          removeLink();
          break;
        case 'clear':
          document.execCommand('removeFormat');
          // `removeFormat` leaves anchors alone — "clear formatting" that keeps
          // a link behind doesn't match what the button says.
          removeLink();
          break;
      }

      // The command rewrote the DOM under the old range; re-read it so the next
      // one applies to the same words.
      rememberSelection();
    },
    [restoreSelection, rememberSelection]
  );

  const currentLinkHref = useCallback(() => {
    const node = nodeRef.current;
    const selection = window.getSelection();
    if (!node || !selection || selection.rangeCount === 0) return null;

    const from = selection.getRangeAt(0).commonAncestorContainer;
    const el = (from.nodeType === Node.ELEMENT_NODE
      ? (from as HTMLElement)
      : from.parentElement) as HTMLElement | null;
    if (!el || !node.contains(el)) return null;

    return el.closest('a')?.getAttribute('href') ?? null;
  }, []);

  const value = useMemo(
    () => ({
      active,
      mode,
      start,
      stop,
      attach,
      takePendingCaret,
      rememberSelection,
      runCommand,
      currentLinkHref,
    }),
    [
      active,
      mode,
      start,
      stop,
      attach,
      takePendingCaret,
      rememberSelection,
      runCommand,
      currentLinkHref,
    ]
  );

  return (
    <EditingSessionContext.Provider value={value}>
      {children}
    </EditingSessionContext.Provider>
  );
};

export function useEditingSession(): EditingSessionValue {
  const value = useContext(EditingSessionContext);
  if (!value) {
    throw new Error('useEditingSession must be used inside EditingSessionProvider');
  }
  return value;
}
