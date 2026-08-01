import React, { useEffect, useMemo, useRef } from 'react';
import { EditMode } from '../../utils/htmlGenerator';
import { sanitizeRichHtml } from '../../utils/richText';
import { isEditorChrome, useEditingSession } from '../../state/EditingSession';

/** Puts the caret where the user clicked instead of at the field start. */
function placeCaretAtPoint(x: number, y: number): boolean {
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

/**
 * Fallback for when there's no click to aim at: editing that starts
 * programmatically (a list item split off the one above) or a click whose
 * position the browser couldn't resolve. The caret goes to the end rather than
 * selecting everything, so the first keystroke never wipes the field.
 */
function placeCaretAtEnd(node: HTMLElement): void {
  const range = document.createRange();
  range.selectNodeContents(node);
  range.collapse(false);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

interface BlockBodyProps {
  /** This block's generated HTML, rendered with `editable: true`. */
  html: string;
  /** Name of the field being edited in this block right now, or null. */
  editingField: string | null;
  /**
   * True once this block is selected, which is what allows editing to start.
   * Selecting a block opens the Inspector and shifts the canvas sideways, so an
   * edit begun on that first click would land on whatever slid under the
   * cursor — the second click is the one aimed at what the user sees.
   */
  clickToEdit: boolean;
  onStartEdit: (field: string, caret: { x: number; y: number }) => void;
  onCommit: (field: string, value: string) => void;
  onCancelEdit: () => void;
  /**
   * Structural edits only a list can do: Enter splits the item being typed into
   * a new one below it, Backspace in an emptied item removes it.
   */
  onEditItem?: (field: string, action: 'split' | 'remove', value: string) => void;
}

/**
 * Renders one block's generated HTML and turns the clicked `[data-edit-field]`
 * node into a contenteditable region.
 *
 * Edits commit on **blur**, not on every keystroke: committing writes to the
 * template, which regenerates this block's HTML and replaces these DOM nodes —
 * dropping the caret mid-word. Escape abandons.
 *
 * The formatting toolbar is no longer a sibling of the text (it's docked at the
 * top of the canvas area), so "did focus leave the editor?" is answered by
 * `isEditorChrome` rather than by a wrapper ref.
 */
export const BlockBody: React.FC<BlockBodyProps> = ({
  html,
  editingField,
  clickToEdit,
  onStartEdit,
  onCommit,
  onCancelEdit,
  onEditItem,
}) => {
  const rootRef = useRef<HTMLDivElement>(null);
  /** What to put back if the edit is abandoned with Escape. */
  const restorePoint = useRef<{ html: string; wasEmpty: boolean } | null>(null);
  const abandonEdit = useRef(false);

  const session = useEditingSession();
  const { attach, takePendingCaret, rememberSelection } = session;

  /**
   * Stable across renders while the markup is unchanged — and that stability is
   * load-bearing, not a micro-optimisation.
   *
   * React compares the `dangerouslySetInnerHTML` **object by reference**. A
   * fresh `{ __html }` literal every render therefore re-assigns `innerHTML`
   * every render, even when the string is identical: the field's DOM node is
   * thrown away and rebuilt, taking `contentEditable`, the focus and the caret
   * with it. Editing simply doesn't start.
   *
   * This block re-renders constantly — hover, selection, drag state, and the
   * editing session's own `attach` — so without the memo the window in which a
   * field stays editable is zero.
   */
  const innerHtml = useMemo(() => ({ __html: html }), [html]);

  const activeNode = () =>
    editingField
      ? rootRef.current?.querySelector<HTMLElement>(
          `[data-edit-field="${editingField}"]`
        ) ?? null
      : null;

  /** What the generator said this field is — see `EditMode` in htmlGenerator. */
  const modeOf = (node: HTMLElement): EditMode =>
    node.dataset.editRich !== '1'
      ? 'plain'
      : node.dataset.editEnter === 'item'
        ? 'item'
        : 'rich';

  useEffect(() => {
    const node = activeNode();
    if (!node) {
      attach(null, null);
      return;
    }

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

    /*
      Ask the browser for tags rather than styles (`<b>`, not
      `<span style="font-weight:700">`), and for a `<p>` when Enter is pressed.
      Neither is honoured by every engine — `sanitizeRichHtml` normalises
      whatever actually comes out — but starting from the right shape means less
      rewriting and markup that reads the way the user expects.
    */
    document.execCommand('styleWithCSS', false, 'false');
    document.execCommand('defaultParagraphSeparator', false, 'p');

    const caret = takePendingCaret();
    if (!caret || !placeCaretAtPoint(caret.x, caret.y)) placeCaretAtEnd(node);

    attach(node, modeOf(node));
    rememberSelection();

    /*
      Track the selection for as long as the field is open. Toolbar buttons
      preserve it by cancelling their own `mousedown`, but the colour inputs and
      `<select>`s can't, so the last known range has to stay recoverable.
    */
    document.addEventListener('selectionchange', rememberSelection);

    return () => {
      document.removeEventListener('selectionchange', rememberSelection);
      node.contentEditable = 'false';
    };
  }, [editingField, html, attach, takePendingCaret, rememberSelection]);

  const startEditFromEvent = (e: React.MouseEvent) => {
    if (!clickToEdit) return;
    const target = (e.target as HTMLElement).closest<HTMLElement>(
      '[data-edit-field]'
    );
    const field = target?.dataset.editField;
    if (!field || field === editingField) return;

    e.preventDefault();
    e.stopPropagation();
    onStartEdit(field, { x: e.clientX, y: e.clientY });
  };

  const handleClick = (e: React.MouseEvent) => {
    // Links inside the preview must not navigate away from the designer.
    if ((e.target as HTMLElement).closest('a')) e.preventDefault();
    startEditFromEvent(e);
  };

  const handleBlur = (e: React.FocusEvent) => {
    const node = activeNode();
    if (!editingField || !node) return;

    /*
      Splitting a list item re-renders the block, which destroys the field the
      user was in — and some browsers report that as a blur. The event is about
      a field that no longer exists, so committing it would write stale text and
      cancel the edit that just moved to the new row.
    */
    const target = e.target as HTMLElement;
    if (target !== node && target.hasAttribute?.('data-edit-field')) return;

    /*
      Reaching for the toolbar isn't leaving the editor. The bar is docked in
      the shell rather than next to the text, so this asks whether the new focus
      target is editor chrome instead of whether it's inside a local wrapper.
    */
    if (isEditorChrome(e.relatedTarget as Node | null)) return;

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

    const mode = modeOf(node);
    /*
      `textContent`, not `innerText`: innerText returns the *rendered* text, so
      a heading styled `text-transform:uppercase` would save back SHOUTING.
      Rich fields go through the sanitizer instead — see utils/richText.ts.
    */
    const value =
      mode !== 'plain'
        ? sanitizeRichHtml(node.innerHTML, { allowParagraphs: mode === 'rich' })
        : (node.textContent || '')
            .replace(/\u00a0/g, ' ')
            .replace(/\s*\n\s*/g, ' ')
            .trim();

    onCommit(editingField, value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!editingField) return;
    const node = activeNode();
    if (!node) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      abandonEdit.current = true;
      node.blur();
      return;
    }

    const enterMode = node.dataset.editEnter;

    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey && enterMode) {
        // The escape hatch in both rich shapes: a soft line break where Enter
        // would otherwise start a new paragraph or a new item.
        document.execCommand('insertLineBreak');
      } else if (enterMode === 'item') {
        onEditItem?.(
          editingField,
          'split',
          sanitizeRichHtml(node.innerHTML, { allowParagraphs: false })
        );
      } else if (enterMode === 'rich') {
        document.execCommand('insertParagraph');
      } else {
        // A single-line field has nowhere to put a break, so Enter saves.
        node.blur();
      }
      return;
    }

    // Backspace in an item the user has emptied removes the row, so an item
    // added by mistake doesn't need a trip to the Inspector.
    if (
      e.key === 'Backspace' &&
      enterMode === 'item' &&
      !(node.textContent || '').trim()
    ) {
      e.preventDefault();
      onEditItem?.(editingField, 'remove', '');
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
      onBlur={handleBlur}
      onDoubleClick={startEditFromEvent}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      dangerouslySetInnerHTML={innerHtml}
    />
  );
};
